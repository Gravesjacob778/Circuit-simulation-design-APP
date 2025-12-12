<script setup lang="ts">
/**
 * CircuitCanvas - Konva.js 電路畫布
 * 核心繪圖區域，處理元件放置、拖曳、選取、接線
 */

import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import Konva from 'konva';
import { useCircuitStore } from '@/stores/circuitStore';
import { useUIStore } from '@/stores/uiStore';
import type { CircuitComponent, ComponentType } from '@/types/circuit';
import { drawComponentShape } from './renderers/componentRenderers';
import { getRotatedPortPosition, calculateOrthogonalPath } from '@/lib/geometryUtils';
import { KonvaStage } from '@/utils/KonvaStage';
import { KonvaNodeManager } from '@/utils/KonvaNodeManager';
import { KonvaRenderer } from '@/utils/KonvaRenderer';
import { KonvaAnimationManager } from '@/utils/KonvaAnimationManager';
import { WiringStateManager } from '@/utils/WiringStateManager';

const circuitStore = useCircuitStore();
const uiStore = useUIStore();

const containerRef = ref<HTMLDivElement | null>(null);

// 安全檢查畫布是否為空
const isCanvasEmpty = computed(() => {
  return !circuitStore.components || circuitStore.components.length === 0;
});

// Konva 實例
let konvaStage: KonvaStage | null = null;
let nodeManager: KonvaNodeManager | null = null;
let wiringStateManager: WiringStateManager | null = null;
let renderer: KonvaRenderer | null = null;
let animationManager: KonvaAnimationManager | null = null;

// 層級變數 (通過 konvaStage 獲取)
let stage: Konva.Stage | null = null;
let gridLayer: Konva.Layer | null = null;
let guideLayer: Konva.Layer | null = null; // 輔助線圖層
let wireLayer: Konva.Layer | null = null;
let componentLayer: Konva.Layer | null = null;
let tempLayer: Konva.Layer | null = null; // 用於繪製中的導線

// ========== 電流動畫相關 ==========
let currentFlowLayer: Konva.Layer | null = null;

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
 * 繪製臨時接線預覽
 */
function drawWiringPreview(targetX: number, targetY: number) {
  if (!tempLayer || !wiringStateManager?.getStartPort()) return;
  tempLayer.destroyChildren();

  const startPort = wiringStateManager.getStartPort();
  if (!startPort) return;

  const points = calculateOrthogonalPath(
    startPort.x, startPort.y,
    targetX, targetY,
    uiStore.gridSize
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
    x: startPort.x,
    y: startPort.y,
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
  if (!wiringStateManager?.isInWiringMode()) {
    // 開始接線
    wiringStateManager?.startWiring({ componentId, portId, x: portX, y: portY });
    console.log('開始接線:', wiringStateManager?.getStartPort());
    
    // 立即顯示起點標記，提供視覺回饋
    if (!tempLayer) return;
    tempLayer.destroyChildren();
    
    // 繪製起點圓點（較大且帶動畫效果）
    const startDot = new Konva.Circle({
      x: portX,
      y: portY,
      radius: 8,
      fill: '#ffeb3b',
      stroke: '#fff',
      strokeWidth: 2,
      shadowColor: '#ffeb3b',
      shadowBlur: 10,
      shadowOpacity: 0.8,
    });
    
    // 添加脈衝動畫效果
    const pulseAnimation = new Konva.Animation((frame) => {
      if (!frame) return;
      const scale = 1 + Math.sin(frame.time * 0.005) * 0.2;
      startDot.scale({ x: scale, y: scale });
    }, tempLayer);
    pulseAnimation.start();
    
    // 添加提示文字
    const hintText = new Konva.Text({
      x: portX + 15,
      y: portY - 10,
      text: '點擊目標端點完成連接',
      fontSize: 12,
      fill: '#ffeb3b',
      shadowColor: '#000',
      shadowBlur: 4,
      shadowOpacity: 0.8,
    });
    
    tempLayer.add(startDot, hintText);
    tempLayer.batchDraw();
    
    // 儲存動畫引用以便後續清除
    (tempLayer as any)._pulseAnimation = pulseAnimation;
    
  } else if (wiringStateManager?.getStartPort()) {
    // 結束接線 - 不能連接到同一個端點
    if (wiringStateManager.isSamePort(componentId, portId)) {
      // 點擊同一個端點，取消接線
      wiringStateManager.cancelWiring();
      
      // 停止動畫
      if ((tempLayer as any)._pulseAnimation) {
        (tempLayer as any)._pulseAnimation.stop();
        (tempLayer as any)._pulseAnimation = null;
      }
      clearTempLayer();
      return;
    }

    // 建立導線
    const startPort = wiringStateManager.getStartPort();
    if (!startPort) return;
    
    console.log('結束接線:', { componentId, portId });
    circuitStore.addWire(
      startPort.componentId,
      startPort.portId,
      componentId,
      portId
    );

    // 重置接線狀態
    wiringStateManager.endWiring();
    
    // 停止動畫
    if ((tempLayer as any)._pulseAnimation) {
      (tempLayer as any)._pulseAnimation.stop();
      (tempLayer as any)._pulseAnimation = null;
    }
    clearTempLayer();
  }
}

// 繪製網格
function drawGrid(width: number, height: number) {
  if (!gridLayer) return;
  gridLayer.destroyChildren();

  const gridSize = uiStore.gridSize;

  if (uiStore.showGrid) {
    // 繪製正方形格線網格
    // 垂直線
    for (let x = 0; x <= width; x += gridSize) {
      const line = new Konva.Line({
        points: [x, 0, x, height],
        stroke: '#333333',
        strokeWidth: 0.5,
        listening: false,
      });
      gridLayer.add(line);
    }
    // 水平線
    for (let y = 0; y <= height; y += gridSize) {
      const line = new Konva.Line({
        points: [0, y, width, y],
        stroke: '#333333',
        strokeWidth: 0.5,
        listening: false,
      });
      gridLayer.add(line);
    }
  }

  gridLayer.batchDraw();
}

// 建立元件的 Konva 節點
function createComponentNode(component: CircuitComponent): Konva.Group {
  const group = new Konva.Group({
    x: component.x,
    y: component.y,
    rotation: component.rotation,
    draggable: component.selected && !wiringStateManager?.isInWiringMode(), // 只有選取且非接線模式才能拖曳
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
        // 在接線模式下，高亮可連接的端點
        if (wiringStateManager?.isInWiringMode()) {
          // 不能連接到同一個端點
          const isSamePort = wiringStateManager.isSamePort(component.id, port.id);
          
          if (isSamePort) {
            // 同一個端點顯示紅色（不可連接）
            (portShape as Konva.Circle).radius(6);
            (portShape as Konva.Circle).stroke('#f44336');
            (portShape as Konva.Circle).strokeWidth(2);
            document.body.style.cursor = 'not-allowed';
          } else {
            // 可連接的端點顯示綠色
            (portShape as Konva.Circle).radius(7);
            (portShape as Konva.Circle).stroke('#4caf50');
            (portShape as Konva.Circle).strokeWidth(3);
            (portShape as Konva.Circle).shadowColor('#4caf50');
            (portShape as Konva.Circle).shadowBlur(10);
            document.body.style.cursor = 'pointer';
          }
        } else {
          // 非接線模式的正常 hover 效果
          (portShape as Konva.Circle).radius(6);
          (portShape as Konva.Circle).stroke('#ffeb3b');
          (portShape as Konva.Circle).strokeWidth(2);
          document.body.style.cursor = 'pointer';
        }
        componentLayer?.batchDraw();
      });

      portShape.on('mouseleave', () => {
        (portShape as Konva.Circle).radius(4);
        (portShape as Konva.Circle).stroke((portShape as Konva.Circle).fill() as string);
        (portShape as Konva.Circle).strokeWidth(1);
        (portShape as Konva.Circle).shadowBlur(0);
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

  // 拖曳過程中即時吸附網格並更新導線
  group.on('dragmove', () => {
    // 即時吸附到網格點
    const snapped = uiStore.snapPosition(group.x(), group.y());
    group.x(snapped.x);
    group.y(snapped.y);
    
    // 更新輔助線位置
    drawGuides(snapped.x, snapped.y);
    
    // 更新 store 中的位置 (不觸發 watch)
    const comp = circuitStore.components.find(c => c.id === component.id);
    if (comp) {
      comp.x = snapped.x;
      comp.y = snapped.y;
    }
    renderAllWires();
  });

  // 點擊選取（非端點區域）
  group.on('click tap', (e) => {
    // 如果點擊的是端點，不處理
    if ((e.target as Konva.Node).name() === 'port') return;
    if (wiringStateManager?.isInWiringMode()) return; // 接線模式不選取

    e.cancelBubble = true;
    circuitStore.selectComponent(component.id);
    updateComponentVisuals();
    renderAllWires();

    // 滑鼠游標改為移動游標
    document.body.style.cursor = 'move';
  });

  return group;
}

// 更新元件視覺（選取狀態）
function updateComponentVisuals() {
  circuitStore.components.forEach((comp) => {
    const node = nodeManager?.getComponentNode(comp.id);
    if (node) {
      // 更新拖拉狀態：只有選取的元件才能拖拉
      node.draggable(comp.selected && !wiringStateManager?.isInWiringMode());
      
      // 更新游標樣式
      if (comp.selected) {
        // 選取時繪製輔助線
        drawGuides(comp.x, comp.y);
        
        node.on('mouseenter', () => {
          if (!wiringStateManager?.isInWiringMode()) document.body.style.cursor = 'move';
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
        // 即時吸附到網格點
        const snapped = uiStore.snapPosition(node.x(), node.y());
        node.x(snapped.x);
        node.y(snapped.y);
        
        // 更新輔助線位置
        drawGuides(snapped.x, snapped.y);
        
        // 更新 store 中的位置 (不觸發 watch)
        const component = circuitStore.components.find(c => c.id === comp.id);
        if (component) {
          component.x = snapped.x;
          component.y = snapped.y;
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
            // 在接線模式下，高亮可連接的端點
            if (wiringStateManager?.isInWiringMode()) {
              // 不能連接到同一個端點
              const isSamePort = wiringStateManager.isSamePort(comp.id, port.id);
              
              if (isSamePort) {
                // 同一個端點顯示紅色（不可連接）
                (portShape as Konva.Circle).radius(6);
                (portShape as Konva.Circle).stroke('#f44336');
                (portShape as Konva.Circle).strokeWidth(2);
                document.body.style.cursor = 'not-allowed';
              } else {
                // 可連接的端點顯示綠色
                (portShape as Konva.Circle).radius(7);
                (portShape as Konva.Circle).stroke('#4caf50');
                (portShape as Konva.Circle).strokeWidth(3);
                (portShape as Konva.Circle).shadowColor('#4caf50');
                (portShape as Konva.Circle).shadowBlur(10);
                document.body.style.cursor = 'pointer';
              }
            } else {
              // 非接線模式的正常 hover 效果
              (portShape as Konva.Circle).radius(6);
              (portShape as Konva.Circle).stroke('#ffeb3b');
              (portShape as Konva.Circle).strokeWidth(2);
              document.body.style.cursor = 'pointer';
            }
            componentLayer?.batchDraw();
          });

          portShape.on('mouseleave', () => {
            (portShape as Konva.Circle).radius(4);
            (portShape as Konva.Circle).stroke((portShape as Konva.Circle).fill() as string);
            (portShape as Konva.Circle).strokeWidth(1);
            (portShape as Konva.Circle).shadowBlur(0);
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

// 重新繪製所有元件
function renderAllComponents() {
  if (!componentLayer || !renderer) return;

  renderer.renderAllComponents(
    circuitStore.components,
    componentLayer,
    (comp) => createComponentNode(comp)
  );
}

// 重新繪製所有導線
function renderAllWires() {
  if (!wireLayer || !renderer || !stage) return;

  renderer.renderAllWires(
    circuitStore.wires,
    wireLayer,
    circuitStore.components,
    uiStore.gridSize,
    { width: stage.width(), height: stage.height() },
    circuitStore.selectedWireId || undefined,
    (wireId) => {
      circuitStore.selectWire(wireId);
      renderAllWires();
    }
  );

  // 如果電流動畫正在運行，重新初始化粒子
  if (circuitStore.isCurrentAnimating && animationManager && nodeManager) {
    const paths = animationManager.getAllWirePathsWithDirection(
      circuitStore.components,
      circuitStore.wires,
      nodeManager
    );
    animationManager.reinitializeParticles(paths);
  }
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
    if (wiringStateManager?.isInWiringMode()) {
      wiringStateManager.cancelWiring();
      
      // 停止動畫
      if ((tempLayer as any)._pulseAnimation) {
        (tempLayer as any)._pulseAnimation.stop();
        (tempLayer as any)._pulseAnimation = null;
      }
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
    if (wiringStateManager?.isInWiringMode()) {
      wiringStateManager.cancelWiring();
      
      // 停止動畫
      if ((tempLayer as any)._pulseAnimation) {
        (tempLayer as any)._pulseAnimation.stop();
        (tempLayer as any)._pulseAnimation = null;
      }
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

  // 初始化 KonvaStage
  konvaStage = new KonvaStage();
  konvaStage.initialize(containerRef.value, width, height);

  // 從 KonvaStage 獲取各層
  const layers = konvaStage.getLayers();
  stage = konvaStage.getStage();
  gridLayer = layers.grid;
  guideLayer = layers.guide;
  wireLayer = layers.wire;
  currentFlowLayer = layers.currentFlow;
  componentLayer = layers.component;
  tempLayer = layers.temp;

  // 初始化 KonvaNodeManager
  nodeManager = new KonvaNodeManager();

  // 初始化 KonvaRenderer
  renderer = new KonvaRenderer(nodeManager);

  // 初始化 KonvaAnimationManager
  animationManager = new KonvaAnimationManager();
  animationManager.initialize(currentFlowLayer!);

  // 若掛載時已處於動畫狀態，立即啟動
  if (circuitStore.isCurrentAnimating && nodeManager) {
    const paths = animationManager.getAllWirePathsWithDirection(
      circuitStore.components,
      circuitStore.wires,
      nodeManager
    );
    animationManager.createParticles(paths);
    animationManager.start();
  }

  // 初始化 WiringStateManager
  wiringStateManager = new WiringStateManager();

  // 繪製網格
  drawGrid(width, height);

  // 綁定事件
  stage.on('click', handleStageClick);
  
  // 滑鼠移動事件 - 用於接線預覽
  stage.on('mousemove', () => {
    if (wiringStateManager?.isInWiringMode()) {
      const pos = stage!.getPointerPosition();
      if (pos) {
        // 將目標點吸附到網格，確保轉角對齊
        const snappedPos = uiStore.snapPosition(pos.x, pos.y);
        drawWiringPreview(snappedPos.x, snappedPos.y);
      }
    }
  });

  // 滑鼠滾輪事件 - 畫面縮放
  stage!.on('wheel', (e) => {
    e.evt.preventDefault(); // 防止頁面滾動
    
    const scaleBy = 1.1; // 縮放係數
    const oldScale = stage!.scaleX(); // 當前縮放比例
    
    const pointer = stage!.getPointerPosition();
    if (!pointer) return;
    
    // 計算滑鼠相對於 stage 的位置
    const mousePointTo = {
      x: (pointer.x - stage!.x()) / oldScale,
      y: (pointer.y - stage!.y()) / oldScale,
    };
    
    // 根據滾輪方向計算新的縮放比例
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // 限制縮放範圍 (0.1x ~ 5x)
    const clampedScale = Math.max(0.1, Math.min(5, newScale));
    
    stage!.scale({ x: clampedScale, y: clampedScale });
    
    // 調整 stage 位置，使縮放以滑鼠位置為中心
    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };
    stage!.position(newPos);
    stage!.batchDraw();
  });

  // 滑鼠拖曳平移畫面
  let isPanning = false;
  let panStartPos = { x: 0, y: 0 };
  let stageStartPos = { x: 0, y: 0 };

  stage.on('mousedown', (e) => {
    // 只有點擊空白背景時才啟動平移
    if (e.target === stage && !wiringStateManager?.isInWiringMode()) {
      isPanning = true;
      panStartPos = stage!.getPointerPosition() || { x: 0, y: 0 };
      stageStartPos = { x: stage!.x(), y: stage!.y() };
      document.body.style.cursor = 'grabbing';
    }
  });

  stage.on('mousemove', () => {
    if (isPanning) {
      const pos = stage!.getPointerPosition();
      if (pos) {
        const dx = pos.x - panStartPos.x;
        const dy = pos.y - panStartPos.y;
        stage!.position({
          x: stageStartPos.x + dx,
          y: stageStartPos.y + dy,
        });
        stage!.batchDraw();
      }
    }
  });

  stage.on('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      document.body.style.cursor = 'crosshair';
    }
  });

  stage.on('mouseleave', () => {
    if (isPanning) {
      isPanning = false;
      document.body.style.cursor = 'crosshair';
    }
  });

  // 監聽鍵盤
  window.addEventListener('keydown', handleKeyDown);

  // 監聽視窗大小變化
  const resizeObserver = new ResizeObserver(() => {
    if (containerRef.value) {
      const newWidth = containerRef.value.clientWidth;
      const newHeight = containerRef.value.clientHeight;
      stage!.width(newWidth);
      stage!.height(newHeight);
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

// 監聽電流動畫狀態變化
watch(
  () => circuitStore.isCurrentAnimating,
  (isAnimating) => {
    if (!animationManager || !nodeManager) return;

    if (isAnimating) {
      const paths = animationManager.getAllWirePathsWithDirection(
        circuitStore.components,
        circuitStore.wires,
        nodeManager
      );
      animationManager.createParticles(paths);
      animationManager.start();
    } else {
      animationManager.stop();
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  animationManager?.destroy();
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
