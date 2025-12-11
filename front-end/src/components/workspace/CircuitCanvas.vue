<script setup lang="ts">
/**
 * CircuitCanvas - Konva.js 電路畫布
 * 核心繪圖區域，處理元件放置、拖曳、選取、接線
 */

import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import Konva from 'konva';
import { useCircuitStore } from '@/stores/circuitStore';
import { useUIStore } from '@/stores/uiStore';
import { getComponentDefinition } from '@/config/componentDefinitions';
import type { CircuitComponent, ComponentType, Wire } from '@/types/circuit';

const circuitStore = useCircuitStore();
const uiStore = useUIStore();

const containerRef = ref<HTMLDivElement | null>(null);

// 安全檢查畫布是否為空
const isCanvasEmpty = computed(() => {
  return !circuitStore.components || circuitStore.components.length === 0;
});

// Konva 實例
let stage: Konva.Stage;
let gridLayer: Konva.Layer;
let guideLayer: Konva.Layer; // 輔助線圖層
let wireLayer: Konva.Layer;
let componentLayer: Konva.Layer;
let tempLayer: Konva.Layer; // 用於繪製中的導線

// 元件 Konva 節點映射
const componentNodes = new Map<string, Konva.Group>();
const wireNodes = new Map<string, Konva.Line>();

// ========== 接線互動狀態 ==========
interface PortInfo {
  componentId: string;
  portId: string;
  x: number;
  y: number;
}

let isWiring = false;
let wiringStartPort: PortInfo | null = null;

/**
 * 繪製對齊輔助線
 */
function drawGuides(x: number, y: number) {
  if (!guideLayer || !stage) return;
  guideLayer.destroyChildren();

  const width = stage.width();
  const height = stage.height();
  const gridSize = uiStore.gridSize;

  // 使用半透明白色區塊作為輔助線
  // 水平輔助帶
  const hGuide = new Konva.Rect({
    x: 0,
    y: y - gridSize / 2,
    width: width,
    height: gridSize,
    fill: '#ffffff',
    opacity: 0.1, // 低透明度
    listening: false, // 不接收事件
  });

  // 垂直輔助帶
  const vGuide = new Konva.Rect({
    x: x - gridSize / 2,
    y: 0,
    width: gridSize,
    height: height,
    fill: '#ffffff',
    opacity: 0.1, // 低透明度
    listening: false,
  });

  guideLayer.add(hGuide, vGuide);
  guideLayer.batchDraw();
}

/**
 * 清除輔助線
 */
function clearGuides() {
  if (!guideLayer) return;
  guideLayer.destroyChildren();
  guideLayer.batchDraw();
}

/**
 * 計算旋轉後的端點位置
 * @param componentX 元件中心 X 座標
 * @param componentY 元件中心 Y 座標
 * @param offsetX 端點相對於元件中心的 X 偏移
 * @param offsetY 端點相對於元件中心的 Y 偏移
 * @param rotation 元件旋轉角度（度）
 * @returns 旋轉後的全域座標
 */
function getRotatedPortPosition(
  componentX: number,
  componentY: number,
  offsetX: number,
  offsetY: number,
  rotation: number
): { x: number; y: number } {
  // 將角度轉換為弧度
  const rad = (rotation * Math.PI) / 180;
  
  // 旋轉矩陣計算
  const rotatedX = offsetX * Math.cos(rad) - offsetY * Math.sin(rad);
  const rotatedY = offsetX * Math.sin(rad) + offsetY * Math.cos(rad);
  
  return {
    x: componentX + rotatedX,
    y: componentY + rotatedY,
  };
}

/**
 * 計算直角走線路徑 (Manhattan Routing)
 */
function calculateOrthogonalPath(x1: number, y1: number, x2: number, y2: number): number[] {
  const gridSize = uiStore.gridSize;
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  
  if (dx >= dy) {
    const midX = Math.round((x1 + x2) / 2 / gridSize) * gridSize;
    return [x1, y1, midX, y1, midX, y2, x2, y2];
  } else {
    const midY = Math.round((y1 + y2) / 2 / gridSize) * gridSize;
    return [x1, y1, x1, midY, x2, midY, x2, y2];
  }
}

/**
 * 繪製臨時接線預覽
 */
function drawWiringPreview(targetX: number, targetY: number) {
  if (!tempLayer || !wiringStartPort) return;
  tempLayer.destroyChildren();

  const points = calculateOrthogonalPath(
    wiringStartPort.x, wiringStartPort.y,
    targetX, targetY
  );

  const previewLine = new Konva.Line({
    points,
    stroke: '#ffeb3b',
    strokeWidth: 2,
    dash: [6, 4],
    opacity: 0.8,
  });
  tempLayer.add(previewLine);

  // 起點圓點
  const startDot = new Konva.Circle({
    x: wiringStartPort.x,
    y: wiringStartPort.y,
    radius: 6,
    fill: '#ffeb3b',
  });
  tempLayer.add(startDot);

  tempLayer.batchDraw();
}

/**
 * 清除臨時層
 */
function clearTempLayer() {
  if (!tempLayer) return;
  tempLayer.destroyChildren();
  tempLayer.batchDraw();
}

/**
 * 處理端點點擊 - 開始或完成接線
 */
function handlePortClick(componentId: string, portId: string, portX: number, portY: number) {
  if (!isWiring) {
    // 開始接線
    isWiring = true;
    wiringStartPort = { componentId, portId, x: portX, y: portY };
    console.log('開始接線:', wiringStartPort);
  } else if (wiringStartPort) {
    // 結束接線 - 不能連接到同一個端點
    if (wiringStartPort.componentId === componentId && wiringStartPort.portId === portId) {
      // 點擊同一個端點，取消接線
      isWiring = false;
      wiringStartPort = null;
      clearTempLayer();
      return;
    }

    // 建立導線
    console.log('結束接線:', { componentId, portId });
    circuitStore.addWire(
      wiringStartPort.componentId,
      wiringStartPort.portId,
      componentId,
      portId
    );

    // 重置接線狀態
    isWiring = false;
    wiringStartPort = null;
    clearTempLayer();
  }
}

// 繪製網格
function drawGrid(width: number, height: number) {
  if (!gridLayer) return;
  gridLayer.destroyChildren();

  const gridSize = uiStore.gridSize;

  if (uiStore.showGrid) {
    // 繪製點狀網格
    for (let x = 0; x <= width; x += gridSize) {
      for (let y = 0; y <= height; y += gridSize) {
        const dot = new Konva.Circle({
          x,
          y,
          radius: 1,
          fill: '#333333',
        });
        gridLayer.add(dot);
      }
    }
  }

  gridLayer.batchDraw();
}

// 繪製電阻符號
function drawResistor(group: Konva.Group, component: CircuitComponent) {
  // 如果選取，添加高亮背景
  if (component.selected) {
    const highlight = new Konva.Rect({
      x: -35,
      y: -15,
      width: 70,
      height: 30,
      fill: 'rgba(76, 175, 80, 0.1)',
      stroke: '#4caf50',
      strokeWidth: 2,
      cornerRadius: 4,
      shadowColor: '#4caf50',
      shadowBlur: 10,
      shadowOpacity: 0.5,
    });
    group.add(highlight);
  }

  // 電阻本體 (鋸齒形狀)
  const zigzag = new Konva.Line({
    points: [-30, 0, -20, 0, -15, -8, -5, 8, 5, -8, 15, 8, 20, 0, 30, 0],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
    lineCap: 'round',
    lineJoin: 'round',
  });
  group.add(zigzag);

  // 端點
  const port1 = new Konva.Circle({
    x: -30,
    y: 0,
    radius: 4,
    fill: '#4caf50',
    stroke: '#4caf50',
    strokeWidth: 1,
    name: 'port',
  });
  const port2 = new Konva.Circle({
    x: 30,
    y: 0,
    radius: 4,
    fill: '#4caf50',
    stroke: '#4caf50',
    strokeWidth: 1,
    name: 'port',
  });
  group.add(port1, port2);

  // 標籤
  const label = new Konva.Text({
    x: -15,
    y: -25,
    text: `${component.label}\n${component.value}${component.unit}`,
    fontSize: 10,
    fill: '#888888',
    align: 'center',
  });
  group.add(label);
}

// 繪製電容符號
function drawCapacitor(group: Konva.Group, component: CircuitComponent) {
  // 如果選取，添加高亮背景
  if (component.selected) {
    const highlight = new Konva.Rect({
      x: -25,
      y: -20,
      width: 50,
      height: 40,
      fill: 'rgba(76, 175, 80, 0.1)',
      stroke: '#4caf50',
      strokeWidth: 2,
      cornerRadius: 4,
      shadowColor: '#4caf50',
      shadowBlur: 10,
      shadowOpacity: 0.5,
    });
    group.add(highlight);
  }

  // 左側連線
  const line1 = new Konva.Line({
    points: [-20, 0, -5, 0],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
  });
  // 左極板
  const plate1 = new Konva.Line({
    points: [-5, -12, -5, 12],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
  });
  // 右極板
  const plate2 = new Konva.Line({
    points: [5, -12, 5, 12],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
  });
  // 右側連線
  const line2 = new Konva.Line({
    points: [5, 0, 20, 0],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
  });

  group.add(line1, plate1, plate2, line2);

  // 端點
  const port1 = new Konva.Circle({
    x: -20,
    y: 0,
    radius: 4,
    fill: '#ffeb3b',
    name: 'port',
  });
  const port2 = new Konva.Circle({
    x: 20,
    y: 0,
    radius: 4,
    fill: '#ffeb3b',
    name: 'port',
  });
  group.add(port1, port2);

  // 標籤
  const label = new Konva.Text({
    x: -15,
    y: -30,
    text: `${component.label}\n${component.value}${component.unit}`,
    fontSize: 10,
    fill: '#888888',
    align: 'center',
  });
  group.add(label);
}

// 繪製接地符號
function drawGround(group: Konva.Group, component: CircuitComponent) {
  // 垂直線
  const line = new Konva.Line({
    points: [0, -15, 0, 0],
    stroke: '#888888',
    strokeWidth: 2,
  });
  // 接地橫線
  const line1 = new Konva.Line({
    points: [-12, 0, 12, 0],
    stroke: '#888888',
    strokeWidth: 2,
  });
  const line2 = new Konva.Line({
    points: [-8, 5, 8, 5],
    stroke: '#888888',
    strokeWidth: 2,
  });
  const line3 = new Konva.Line({
    points: [-4, 10, 4, 10],
    stroke: '#888888',
    strokeWidth: 2,
  });

  group.add(line, line1, line2, line3);

  // 端點
  const port = new Konva.Circle({
    x: 0,
    y: -15,
    radius: 4,
    fill: '#888888',
    name: 'port',
  });
  group.add(port);
}

// 繪製 DC 電源
function drawDCSource(group: Konva.Group, component: CircuitComponent) {
  // 如果選取，添加高亮背景
  if (component.selected) {
    const highlight = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 40,
      fill: 'rgba(76, 175, 80, 0.1)',
      stroke: '#4caf50',
      strokeWidth: 2,
      shadowColor: '#4caf50',
      shadowBlur: 10,
      shadowOpacity: 0.5,
    });
    group.add(highlight);
  }

  // 圓形
  const circle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: 18,
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
    fill: 'transparent',
  });

  // + 符號
  const plus1 = new Konva.Line({
    points: [0, -12, 0, -4],
    stroke: '#ff5722',
    strokeWidth: 2,
  });
  const plus2 = new Konva.Line({
    points: [-4, -8, 4, -8],
    stroke: '#ff5722',
    strokeWidth: 2,
  });

  // - 符號
  const minus = new Konva.Line({
    points: [-4, 8, 4, 8],
    stroke: '#2196f3',
    strokeWidth: 2,
  });

  // 連接線
  const topLine = new Konva.Line({
    points: [0, -30, 0, -18],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: 2,
  });
  const bottomLine = new Konva.Line({
    points: [0, 18, 0, 30],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: 2,
  });

  group.add(circle, plus1, plus2, minus, topLine, bottomLine);

  // 端點
  const portPlus = new Konva.Circle({
    x: 0,
    y: -30,
    radius: 4,
    fill: '#ff5722',
    name: 'port',
  });
  const portMinus = new Konva.Circle({
    x: 0,
    y: 30,
    radius: 4,
    fill: '#2196f3',
    name: 'port',
  });
  group.add(portPlus, portMinus);

  // 標籤
  const label = new Konva.Text({
    x: 25,
    y: -8,
    text: `${component.value}${component.unit}`,
    fontSize: 11,
    fill: '#ffeb3b',
  });
  group.add(label);
}

// 繪製 AC 電源
function drawACSource(group: Konva.Group, component: CircuitComponent) {
  // 如果選取，添加高亮背景
  if (component.selected) {
    const highlight = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 40,
      fill: 'rgba(76, 175, 80, 0.1)',
      stroke: '#4caf50',
      strokeWidth: 2,
      shadowColor: '#4caf50',
      shadowBlur: 10,
      shadowOpacity: 0.5,
    });
    group.add(highlight);
  }

  // 圓形
  const circle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: 18,
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: component.selected ? 3 : 2,
    fill: 'transparent',
  });

  // 正弦波符號
  const sine = new Konva.Line({
    points: [-10, 0, -5, -6, 0, 0, 5, 6, 10, 0],
    stroke: '#ab47bc',
    strokeWidth: 2,
    tension: 0.5,
  });

  // 連接線
  const topLine = new Konva.Line({
    points: [0, -30, 0, -18],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: 2,
  });
  const bottomLine = new Konva.Line({
    points: [0, 18, 0, 30],
    stroke: component.selected ? '#4caf50' : '#cccccc',
    strokeWidth: 2,
  });

  group.add(circle, sine, topLine, bottomLine);

  // 端點
  const portPlus = new Konva.Circle({
    x: 0,
    y: -30,
    radius: 4,
    fill: '#ab47bc',
    name: 'port',
  });
  const portMinus = new Konva.Circle({
    x: 0,
    y: 30,
    radius: 4,
    fill: '#ab47bc',
    name: 'port',
  });
  group.add(portPlus, portMinus);

  // 標籤
  const label = new Konva.Text({
    x: 25,
    y: -8,
    text: `${component.value}${component.unit}`,
    fontSize: 11,
    fill: '#ffeb3b',
  });
  group.add(label);
}

// 繪製通用元件
function drawGenericComponent(group: Konva.Group, component: CircuitComponent) {
  // 如果選取，添加高亮背景
  if (component.selected) {
    const highlight = new Konva.Rect({
      x: -30,
      y: -20,
      width: 60,
      height: 40,
      fill: 'rgba(76, 175, 80, 0.1)',
      stroke: '#4caf50',
      strokeWidth: 2,
      cornerRadius: 4,
      shadowColor: '#4caf50',
      shadowBlur: 10,
      shadowOpacity: 0.5,
    });
    group.add(highlight);
  }

  const rect = new Konva.Rect({
    x: -25,
    y: -15,
    width: 50,
    height: 30,
    stroke: component.selected ? '#4caf50' : '#666666',
    strokeWidth: component.selected ? 3 : 2,
    fill: 'transparent',
    cornerRadius: 4,
  });

  const text = new Konva.Text({
    x: -20,
    y: -6,
    text: component.type.substring(0, 3).toUpperCase(),
    fontSize: 12,
    fill: '#888888',
  });

  group.add(rect, text);

  // 通用端點
  const port1 = new Konva.Circle({
    x: -25,
    y: 0,
    radius: 4,
    fill: '#4caf50',
    name: 'port',
  });
  const port2 = new Konva.Circle({
    x: 25,
    y: 0,
    radius: 4,
    fill: '#4caf50',
    name: 'port',
  });
  group.add(port1, port2);
}

// 根據類型繪製元件
function drawComponentShape(group: Konva.Group, component: CircuitComponent) {
  switch (component.type) {
    case 'resistor':
      drawResistor(group, component);
      break;
    case 'capacitor':
      drawCapacitor(group, component);
      break;
    case 'ground':
      drawGround(group, component);
      break;
    case 'dc_source':
      drawDCSource(group, component);
      break;
    case 'ac_source':
      drawACSource(group, component);
      break;
    default:
      drawGenericComponent(group, component);
  }
}

// 建立元件的 Konva 節點
function createComponentNode(component: CircuitComponent): Konva.Group {
  const group = new Konva.Group({
    x: component.x,
    y: component.y,
    rotation: component.rotation,
    draggable: component.selected && !isWiring, // 只有選取且非接線模式才能拖曳
    id: component.id,
  });

  // 繪製元件形狀
  drawComponentShape(group, component);

  // 為每個端點添加點擊事件
  const portCircles = group.find('.port');
  if (portCircles && portCircles.length > 0) {
    portCircles.forEach((portShape, index) => {
      const port = component.ports[index];
      if (!port) return;

      portShape.on('click tap', (e) => {
        e.cancelBubble = true;
        // 計算端點的全域座標（考慮旋轉）
        const portGlobalPos = getRotatedPortPosition(
          component.x,
          component.y,
          port.offsetX,
          port.offsetY,
          component.rotation
        );
        handlePortClick(component.id, port.id, portGlobalPos.x, portGlobalPos.y);
      });

      // hover 效果
      portShape.on('mouseenter', () => {
        (portShape as Konva.Circle).radius(6);
        (portShape as Konva.Circle).stroke('#ffeb3b');
        (portShape as Konva.Circle).strokeWidth(2);
        componentLayer?.batchDraw();
        document.body.style.cursor = 'pointer';
      });

      portShape.on('mouseleave', () => {
        (portShape as Konva.Circle).radius(4);
        (portShape as Konva.Circle).stroke((portShape as Konva.Circle).fill() as string);
        (portShape as Konva.Circle).strokeWidth(1);
        componentLayer?.batchDraw();
        document.body.style.cursor = 'crosshair';
      });
    });
  }

  // 拖曳結束時吸附網格並更新導線
  group.on('dragend', () => {
    const snapped = uiStore.snapPosition(group.x(), group.y());
    group.x(snapped.x);
    group.y(snapped.y);
    circuitStore.updateComponentPosition(component.id, snapped.x, snapped.y);
    renderAllWires(); // 重繪導線
  });

  // 拖曳過程中也更新導線
  group.on('dragmove', () => {
    // 臨時更新元件位置以便重繪導線
    const tempX = group.x();
    const tempY = group.y();
    
    // 更新輔助線位置
    drawGuides(tempX, tempY);
    
    // 更新 store 中的位置 (不觸發 watch)
    const comp = circuitStore.components.find(c => c.id === component.id);
    if (comp) {
      comp.x = tempX;
      comp.y = tempY;
    }
    renderAllWires();
  });

  // 點擊選取（非端點區域）
  group.on('click tap', (e) => {
    // 如果點擊的是端點，不處理
    if ((e.target as Konva.Node).name() === 'port') return;
    if (isWiring) return; // 接線模式不選取
    
    e.cancelBubble = true;
    circuitStore.selectComponent(component.id);
    updateComponentVisuals();
    // 滑鼠游標改為移動游標
    document.body.style.cursor = 'move';
  });

  return group;
}

// 更新元件視覺（選取狀態）
function updateComponentVisuals() {
  circuitStore.components.forEach((comp) => {
    const node = componentNodes.get(comp.id);
    if (node) {
      // 更新拖拉狀態：只有選取的元件才能拖拉
      node.draggable(comp.selected && !isWiring);
      
      // 更新游標樣式
      if (comp.selected) {
        // 選取時繪製輔助線
        drawGuides(comp.x, comp.y);
        
        node.on('mouseenter', () => {
          if (!isWiring) document.body.style.cursor = 'move';
        });
        node.on('mouseleave', () => {
          document.body.style.cursor = 'crosshair';
        });
      } else {
        node.off('mouseenter');
        node.off('mouseleave');
        // 沒有選取時清除輔助線（如果在遍歷中，可能需要在外部處理，但因為這裡是對forEach，我們可以檢查 selectedComponentId）
      }
      
      // 確保先移除可能存在的重複監聽器
      node.off('dragmove');
      node.on('dragmove', () => {
        // 臨時更新元件位置以便重繪導線
        const tempX = node.x();
        const tempY = node.y();
        
        // 更新輔助線位置
        drawGuides(tempX, tempY);
        
        // 更新 store 中的位置 (不觸發 watch)
        const component = circuitStore.components.find(c => c.id === comp.id);
        if (component) {
          component.x = tempX;
          component.y = tempY;
        }
        renderAllWires();
      });
      
      // 重新繪製以顯示高亮效果
      node.destroyChildren();
      drawComponentShape(node, comp);
      
      // 重新綁定端點事件（因為子節點被重建）
      const portCircles = node.find('.port');
      if (portCircles && portCircles.length > 0) {
        portCircles.forEach((portShape, index) => {
          const port = comp.ports[index];
          if (!port) return;

          portShape.on('click tap', (e) => {
            e.cancelBubble = true;
            const portGlobalPos = getRotatedPortPosition(
              comp.x,
              comp.y,
              port.offsetX,
              port.offsetY,
              comp.rotation
            );
            handlePortClick(comp.id, port.id, portGlobalPos.x, portGlobalPos.y);
          });

          portShape.on('mouseenter', () => {
            (portShape as Konva.Circle).radius(6);
            (portShape as Konva.Circle).stroke('#ffeb3b');
            (portShape as Konva.Circle).strokeWidth(2);
            componentLayer?.batchDraw();
            document.body.style.cursor = 'pointer';
          });

          portShape.on('mouseleave', () => {
            (portShape as Konva.Circle).radius(4);
            (portShape as Konva.Circle).stroke((portShape as Konva.Circle).fill() as string);
            (portShape as Konva.Circle).strokeWidth(1);
            componentLayer?.batchDraw();
            document.body.style.cursor = comp.selected ? 'move' : 'crosshair';
          });
        });
      }
    }
  });
  
  // 檢查是否有選取的元件，如果沒有則清除輔助線
  if (!circuitStore.selectedComponentId) {
    clearGuides();
  }
  
  componentLayer?.batchDraw();
}

// 繪製導線 (使用直角路徑)
function drawWire(wire: Wire): Konva.Group {
  const wireGroup = new Konva.Group({ id: wire.id });
  
  const fromComp = circuitStore.components.find((c) => c.id === wire.fromComponentId);
  const toComp = circuitStore.components.find((c) => c.id === wire.toComponentId);

  if (!fromComp || !toComp) {
    console.warn('Wire references non-existent component');
    return wireGroup;
  }

  const fromPort = fromComp.ports.find((p) => p.id === wire.fromPortId);
  const toPort = toComp.ports.find((p) => p.id === wire.toPortId);

  if (!fromPort || !toPort) {
    console.warn('Wire references non-existent port');
    return wireGroup;
  }

  // 計算旋轉後的端點位置
  const startPos = getRotatedPortPosition(
    fromComp.x,
    fromComp.y,
    fromPort.offsetX,
    fromPort.offsetY,
    fromComp.rotation
  );
  const endPos = getRotatedPortPosition(
    toComp.x,
    toComp.y,
    toPort.offsetX,
    toPort.offsetY,
    toComp.rotation
  );

  const startX = startPos.x;
  const startY = startPos.y;
  const endX = endPos.x;
  const endY = endPos.y;

  // 使用直角路徑
  const points = calculateOrthogonalPath(startX, startY, endX, endY);
  const isSelected = wire.id === circuitStore.selectedWireId;

  const line = new Konva.Line({
    points,
    stroke: isSelected ? '#ffeb3b' : '#ffcc00', // 黃色導線
    strokeWidth: isSelected ? 3 : 2,
    lineCap: 'round',
    lineJoin: 'round',
    hitStrokeWidth: 10,
  });

  // 節點圓點（連接點）
  const startDot = new Konva.Circle({
    x: startX,
    y: startY,
    radius: 4,
    fill: '#ffeb3b',
    stroke: '#000',
    strokeWidth: 1,
  });

  const endDot = new Konva.Circle({
    x: endX,
    y: endY,
    radius: 4,
    fill: '#ffeb3b',
    stroke: '#000',
    strokeWidth: 1,
  });

  wireGroup.add(line, startDot, endDot);

  wireGroup.on('click tap', (e) => {
    e.cancelBubble = true;
    circuitStore.selectWire(wire.id);
    renderAllWires(); // 重繪以顯示選取狀態
  });

  return wireGroup;
}

// 重新繪製所有元件
function renderAllComponents() {
  if (!componentLayer || !stage) return;

  // 清空
  componentNodes.forEach((node) => node.destroy());
  componentNodes.clear();

  // 繪製所有元件
  circuitStore.components.forEach((comp) => {
    const node = createComponentNode(comp);
    componentNodes.set(comp.id, node);
    componentLayer.add(node);
  });

  componentLayer.batchDraw();
}

// 重新繪製所有導線
function renderAllWires() {
  if (!wireLayer || !stage) return;

  wireNodes.forEach((node) => node.destroy());
  wireNodes.clear();

  circuitStore.wires.forEach((wire) => {
    const node = drawWire(wire);
    wireNodes.set(wire.id, node);
    wireLayer.add(node);
  });

  wireLayer.batchDraw();
}

// 處理 Drop 事件
function handleDrop(e: DragEvent) {
  e.preventDefault();
  const type = e.dataTransfer?.getData('component-type') as ComponentType;

  if (!type || !stage) return;

  // 計算 Konva 座標
  stage.setPointersPositions(e);
  const pos = stage.getPointerPosition();

  if (pos) {
    const snapped = uiStore.snapPosition(pos.x, pos.y);
    circuitStore.addComponent(type, snapped.x, snapped.y);
  }
}

// 處理背景點擊（取消選取或接線）
function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
  // 只有點擊背景時才處理
  if (e.target === stage) {
    // 如果正在接線，取消接線
    if (isWiring) {
      isWiring = false;
      wiringStartPort = null;
      clearTempLayer();
      return;
    }
    
    circuitStore.selectComponent(null);
    circuitStore.selectWire(null);
    clearGuides(); // 清除輔助線
    updateComponentVisuals();
    renderAllWires();
    // 恢復預設游標
    document.body.style.cursor = 'crosshair';
  }
}

// 處理鍵盤事件
function handleKeyDown(e: KeyboardEvent) {
  // Escape 取消接線
  if (e.key === 'Escape') {
    if (isWiring) {
      isWiring = false;
      wiringStartPort = null;
      clearTempLayer();
      return;
    }
    circuitStore.selectComponent(null);
    circuitStore.selectWire(null);
    clearGuides(); // 清除輔助線
    updateComponentVisuals();
    renderAllWires();
    return;
  }

  const selected = circuitStore.selectedComponent;

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      if (selected) {
        circuitStore.removeComponent(selected.id);
      } else if (circuitStore.selectedWireId) {
        circuitStore.removeWire(circuitStore.selectedWireId);
      }
      break;
    case 'r':
    case 'R':
      if (selected) {
        circuitStore.rotateComponent(selected.id);
        updateComponentVisuals();
        renderAllWires();
      }
      break;
  }
}

// 初始化 Stage
onMounted(() => {
  if (!containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  stage = new Konva.Stage({
    container: containerRef.value,
    width,
    height,
  });

  // 建立圖層（由下往上）
  gridLayer = new Konva.Layer();
  guideLayer = new Konva.Layer();
  wireLayer = new Konva.Layer();
  componentLayer = new Konva.Layer();
  tempLayer = new Konva.Layer();

  stage.add(gridLayer);
  stage.add(guideLayer);
  stage.add(wireLayer);
  stage.add(componentLayer);
  stage.add(tempLayer);

  // 繪製網格
  drawGrid(width, height);

  // 綁定事件
  stage.on('click', handleStageClick);
  
  // 滑鼠移動事件 - 用於接線預覽
  stage.on('mousemove', () => {
    if (isWiring && wiringStartPort) {
      const pos = stage.getPointerPosition();
      if (pos) {
        drawWiringPreview(pos.x, pos.y);
      }
    }
  });

  // 監聽鍵盤
  window.addEventListener('keydown', handleKeyDown);

  // 監聽視窗大小變化
  const resizeObserver = new ResizeObserver(() => {
    if (containerRef.value) {
      const newWidth = containerRef.value.clientWidth;
      const newHeight = containerRef.value.clientHeight;
      stage.width(newWidth);
      stage.height(newHeight);
      drawGrid(newWidth, newHeight);
    }
  });
  resizeObserver.observe(containerRef.value);
});

// 監聽元件數量變化（新增/刪除）
watch(
  () => circuitStore.components.length,
  () => {
    renderAllComponents();
  }
);

// 監聽元件選取狀態變化
watch(
  () => circuitStore.selectedComponentId,
  () => {
    updateComponentVisuals();
  }
);

// 監聽導線變化
watch(
  () => circuitStore.wires,
  () => {
    renderAllWires();
  },
  { deep: true, flush: 'post' }
);

// 監聯網格顯示
watch(
  () => uiStore.showGrid,
  () => {
    if (containerRef.value) {
      drawGrid(containerRef.value.clientWidth, containerRef.value.clientHeight);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  stage?.destroy();
});
</script>

<template>
  <div
    ref="containerRef"
    class="circuit-canvas"
    @drop="handleDrop"
    @dragover.prevent
  >
    <!-- Konva 會在這裡掛載 -->

    <!-- 空白提示 -->
    <div v-if="isCanvasEmpty" class="empty-hint">
      <p>Drag components from the toolbar above</p>
      <p class="hint-sub">or select an example from the left panel</p>
    </div>
  </div>
</template>

<style scoped>
.circuit-canvas {
  width: 100%;
  height: 100%;
  background-color: #050505;
  position: relative;
  cursor: crosshair;
}

.empty-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-muted);
  pointer-events: none;
}

.empty-hint p {
  margin: 0;
  font-size: var(--font-size-md);
}

.hint-sub {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  opacity: 0.6;
}
</style>
