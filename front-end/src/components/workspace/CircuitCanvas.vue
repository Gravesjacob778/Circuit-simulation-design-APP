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
import { getRotatedPortPosition } from '@/lib/geometryUtils';
import { KonvaStage } from '@/utils/KonvaStage';
import { KonvaNodeManager } from '@/utils/KonvaNodeManager';
import { KonvaRenderer } from '@/utils/KonvaRenderer';
import { KonvaAnimationManager } from '@/utils/KonvaAnimationManager';
import { KonvaEventHandler } from '@/utils/KonvaEventHandler';
import { WiringStateManager } from '@/utils/WiringStateManager';
import { drawGuides, clearGuides, drawGrid, drawWiringPreview, clearTempLayer } from '@/utils/konvaUtils';
import { buildDCSimulationOverlayLabels } from '@/lib/simulation/simulationOverlay';

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
let eventHandler: KonvaEventHandler | null = null;

// 層級變數 (通過 konvaStage 獲取)
let stage: Konva.Stage | null = null;
let gridLayer: Konva.Layer | null = null;
let guideLayer: Konva.Layer | null = null; // 輔助線圖層
let wireLayer: Konva.Layer | null = null;
let componentLayer: Konva.Layer | null = null;
let tempLayer: Konva.Layer | null = null; // 用於繪製中的導線

// Stage 平移狀態
// Stage 平移狀態
let isPanning = false;
let panStartPos = { x: 0, y: 0 };
let stageStartPos = { x: 0, y: 0 };

// ========== 電流動畫相關 ==========
let currentFlowLayer: Konva.Layer | null = null;
const ledAnimations: Map<string, Konva.Animation> = new Map();

// ========== 模擬結果標籤（電壓/電流） ==========
let simulationLabelGroup: Konva.Group | null = null;

function ensureSimulationLabelGroup(): Konva.Group | null {
  if (!currentFlowLayer) return null;
  if (simulationLabelGroup && simulationLabelGroup.getLayer()) return simulationLabelGroup;

  simulationLabelGroup = new Konva.Group({
    name: 'simulation-labels',
    listening: false,
  });
  currentFlowLayer.add(simulationLabelGroup);
  simulationLabelGroup.moveToTop();
  currentFlowLayer.batchDraw();
  return simulationLabelGroup;
}

function clearSimulationLabels() {
  const group = ensureSimulationLabelGroup();
  if (!group) return;
  group.destroyChildren();
  group.getLayer()?.batchDraw();
}

function renderSimulationLabels() {
  const group = ensureSimulationLabelGroup();
  if (!group) return;

  if (!circuitStore.isCurrentAnimating || !circuitStore.dcResult?.success) {
    clearSimulationLabels();
    return;
  }

  const labels = buildDCSimulationOverlayLabels(
    circuitStore.components,
    circuitStore.wires,
    circuitStore.dcResult
  );

  group.destroyChildren();

  for (const label of labels) {
    if (label.kind === 'currentDirectionArrow') {
      const radius = label.radius ?? 9;
      const halfWidth = radius * 0.9;
      // Centered triangle pointing "up" at rotation 0.
      const arrow = new Konva.Line({
        id: label.id,
        x: label.x,
        y: label.y,
        points: [
          0, -(4 * radius) / 3,
          -halfWidth, (2 * radius) / 3,
          halfWidth, (2 * radius) / 3,
        ],
        closed: true,
        rotation: label.rotation,
        fill: '#66bb6a',
        stroke: '#66bb6a',
        strokeWidth: 1,
        shadowColor: '#000',
        shadowBlur: 6,
        shadowOpacity: 0.75,
        listening: false,
      });
      group.add(arrow);
      continue;
    }

    const isVoltage = label.kind === 'nodeVoltage';
    const textNode = new Konva.Text({
      id: label.id,
      x: label.x,
      y: label.y,
      text: label.text,
      rotation: label.rotation ?? 0,
      fontSize: isVoltage ? 22 : 20,
      fontStyle: 'bold',
      fill: isVoltage ? '#42a5f5' : '#66bb6a',
      shadowColor: '#000',
      shadowBlur: 6,
      shadowOpacity: 0.75,
      listening: false,
    });

    // Treat label.x/y as the visual center point.
    textNode.offsetX(textNode.width() / 2);
    textNode.offsetY(textNode.height() / 2);
    group.add(textNode);
  }

  group.moveToTop();
  group.getLayer()?.batchDraw();
}

/**
 * 獲取帶有模擬狀態的元件物件
 */
function getComponentWithState(component: CircuitComponent): CircuitComponent {
  const currentMA = circuitStore.getComponentCurrent(component.id);
  if (currentMA !== null) {
    // 轉換 mA 為 A，並賦值給 current 屬性
    return { ...component, current: currentMA / 1000 };
  }
  return component;
}

/**
 * 更新 LED 動畫狀態
 */
function updateLEDAnimations() {
  // 清除失效的動畫
  const activeIds = new Set(circuitStore.components.map(c => c.id));
  for (const [id, anim] of ledAnimations.entries()) {
    if (!activeIds.has(id)) {
      anim.stop();
      ledAnimations.delete(id);
    }
  }

  circuitStore.components.forEach(comp => {
    if (comp.type === 'led') {
      const node = nodeManager?.getComponentNode(comp.id);
      if (!node) return;

      const currentMA = circuitStore.getComponentCurrent(comp.id);
      const isConducting = currentMA !== null && currentMA > 0.1; // > 0.1 mA

      if (isConducting) {
        if (!ledAnimations.has(comp.id)) {
          const arrows = node.find('.led-arrow');
          if (arrows.length === 0) return;

          const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            // 閃爍頻率約 5Hz
            const opacity = 0.6 + 0.4 * Math.sin(frame.time * 0.01);
            arrows.forEach(arrow => arrow.opacity(opacity));
          }, node.getLayer());

          anim.start();
          ledAnimations.set(comp.id, anim);
        }
      } else {
        // 停止動畫
        if (ledAnimations.has(comp.id)) {
          ledAnimations.get(comp.id)?.stop();
          ledAnimations.delete(comp.id);
          // 恢復預設透明度 (在 drawLED 中定義為 0.2)
          const arrows = node.find('.led-arrow');
          arrows.forEach(arrow => arrow.opacity(0.2));
        }
      }
    }
  });
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
      clearTempLayer(tempLayer);
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
    clearTempLayer(tempLayer);
  }
}

/**
 * 端點事件回調（由 KonvaEventHandler 觸發）
 */
function handlePortEventClick(componentId: string, portId: string) {
  const component = circuitStore.components.find(c => c.id === componentId);
  const port = component?.ports.find(p => p.id === portId);
  if (!component || !port) return;

  const portGlobalPos = getRotatedPortPosition(
    component.x,
    component.y,
    port.offsetX,
    port.offsetY,
    component.rotation
  );
  handlePortClick(componentId, portId, portGlobalPos.x, portGlobalPos.y);
}

function handlePortMouseEnter(componentId: string, portId: string, portShape: Konva.Circle) {
  if (wiringStateManager?.isInWiringMode()) {
    const isSamePort = wiringStateManager.isSamePort(componentId, portId);

    if (isSamePort) {
      portShape.radius(6);
      portShape.stroke('#f44336');
      portShape.strokeWidth(2);
      portShape.shadowBlur(0);
      document.body.style.cursor = 'not-allowed';
    } else {
      portShape.radius(7);
      portShape.stroke('#4caf50');
      portShape.strokeWidth(3);
      portShape.shadowColor('#4caf50');
      portShape.shadowBlur(10);
      document.body.style.cursor = 'pointer';
    }
  } else {
    portShape.radius(6);
    portShape.stroke('#ffeb3b');
    portShape.strokeWidth(2);
    portShape.shadowBlur(0);
    document.body.style.cursor = 'pointer';
  }

  componentLayer?.batchDraw();
}

function handlePortMouseLeave(componentId: string, _portId: string, portShape: Konva.Circle) {
  portShape.radius(4);
  portShape.stroke(portShape.fill() as string);
  portShape.strokeWidth(1);
  portShape.shadowBlur(0);
  componentLayer?.batchDraw();

  const comp = circuitStore.components.find(c => c.id === componentId);
  document.body.style.cursor = comp?.selected ? 'move' : 'crosshair';
}

// 建立元件的 Konva 節點
function createComponentNode(component: CircuitComponent): Konva.Group {
  // 注入模擬狀態
  const componentWithState = getComponentWithState(component);

  const group = new Konva.Group({
    x: componentWithState.x,
    y: componentWithState.y,
    rotation: componentWithState.rotation,
    draggable: componentWithState.selected && !wiringStateManager?.isInWiringMode(),
    id: componentWithState.id,
  });

  // 繪製元件形狀
  drawComponentShape(group, componentWithState);

  // 端點事件交給 KonvaEventHandler
  const portCircles = group.find('.port');
  if (portCircles && portCircles.length > 0) {
    portCircles.forEach((portShape, index) => {
      const port = component.ports[index];
      if (!port) return;

      const portGlobalPos = getRotatedPortPosition(
        component.x,
        component.y,
        port.offsetX,
        port.offsetY,
        component.rotation
      );

      eventHandler?.bindPortEvents(
        portShape as Konva.Circle,
        component.id,
        port.id,
        portGlobalPos.x,
        portGlobalPos.y
      );
    });
  }

  // 元件事件交給 KonvaEventHandler
  eventHandler?.bindComponentEvents(group, component);

  return group;
}

// 更新元件視覺（選取狀態）
function updateComponentVisuals() {
  circuitStore.components.forEach((comp) => {
    const node = nodeManager?.getComponentNode(comp.id);
    if (node) {
      // 更新拖拉狀態：只有選取的元件才能拖拉
      node.draggable(comp.selected && !wiringStateManager?.isInWiringMode());

      if (comp.selected) {
        // 選取時繪製輔助線
        drawGuides(guideLayer, stage, comp.x, comp.y, uiStore.gridSize);
      }

      // 重新繪製以顯示高亮效果 (包含模擬狀態)
      node.destroyChildren();
      drawComponentShape(node, getComponentWithState(comp));

      // 重新綁定端點事件（因為子節點被重建）
      const portCircles = node.find('.port');
      if (portCircles && portCircles.length > 0) {
        portCircles.forEach((portShape, index) => {
          const port = comp.ports[index];
          if (!port) return;

          const portGlobalPos = getRotatedPortPosition(
            comp.x,
            comp.y,
            port.offsetX,
            port.offsetY,
            comp.rotation
          );

          eventHandler?.bindPortEvents(
            portShape as Konva.Circle,
            comp.id,
            port.id,
            portGlobalPos.x,
            portGlobalPos.y
          );
        });
      }
    }
  });

  // 檢查是否有選取的元件，如果沒有則清除輔助線
  if (!circuitStore.selectedComponentId) {
    clearGuides(guideLayer);
  }

  componentLayer?.batchDraw();
}

/**
 * 元件事件回調（由 KonvaEventHandler 觸發）
 */
function handleComponentClick(component: CircuitComponent, e: Konva.KonvaEventObject<MouseEvent>) {
  if (wiringStateManager?.isInWiringMode()) return; // 接線模式不選取

  e.cancelBubble = true;
  circuitStore.selectComponent(component.id);
  updateComponentVisuals();
  renderAllWires();
  document.body.style.cursor = 'move';
}

function handleComponentDragMove(component: CircuitComponent) {
  const node = nodeManager?.getComponentNode(component.id);
  if (!node) return;

  const snapped = uiStore.snapPosition(node.x(), node.y());
  node.x(snapped.x);
  node.y(snapped.y);

  drawGuides(guideLayer, stage, snapped.x, snapped.y, uiStore.gridSize);

  // 直接更新 store 中的位置（避免觸發整體重新渲染）
  component.x = snapped.x;
  component.y = snapped.y;

  renderAllWires();
  renderSimulationLabels();
}

function handleComponentDragEnd(component: CircuitComponent) {
  const node = nodeManager?.getComponentNode(component.id);
  if (!node) return;

  const snapped = uiStore.snapPosition(node.x(), node.y());
  node.x(snapped.x);
  node.y(snapped.y);

  circuitStore.updateComponentPosition(component.id, snapped.x, snapped.y);
  renderAllWires();
  renderSimulationLabels();
}

function handleComponentMouseEnter(component: CircuitComponent) {
  if (component.selected && !wiringStateManager?.isInWiringMode()) {
    document.body.style.cursor = 'move';
  }
}

function handleComponentMouseLeave() {
  if (!wiringStateManager?.isInWiringMode()) {
    document.body.style.cursor = 'crosshair';
  }
}

// 重新繪製所有元件
function renderAllComponents() {
  if (!componentLayer || !renderer) return;

  renderer.renderAllComponents(
    circuitStore.components,
    componentLayer,
    (comp) => createComponentNode(comp)
  );

  // 更新 LED 動畫
  updateLEDAnimations();
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

  renderSimulationLabels();
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
      clearTempLayer(tempLayer);
      return;
    }

    circuitStore.selectComponent(null);
    circuitStore.selectWire(null);
    clearGuides(guideLayer); // 清除輔助線
    updateComponentVisuals();
    renderAllWires();
    // 恢復預設游標
    document.body.style.cursor = 'crosshair';
  }
}

function handleStageMouseMove() {
  if (!stage) return;

  const pos = stage.getPointerPosition();
  if (!pos) return;

  // 平移畫面
  if (isPanning) {
    const dx = pos.x - panStartPos.x;
    const dy = pos.y - panStartPos.y;
    stage.position({
      x: stageStartPos.x + dx,
      y: stageStartPos.y + dy,
    });
    stage.batchDraw();
  }

  // 接線預覽
  if (wiringStateManager?.isInWiringMode()) {
    const snappedPos = uiStore.snapPosition(pos.x, pos.y);
    drawWiringPreview(tempLayer, wiringStateManager?.getStartPort() || null, snappedPos.x, snappedPos.y, uiStore.gridSize);
  }
}

function handleStageWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  if (!stage) return;

  e.evt.preventDefault();

  const scaleBy = 1.1;
  const oldScale = stage.scaleX();

  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };

  const direction = e.evt.deltaY > 0 ? -1 : 1;
  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
  const clampedScale = Math.max(0.1, Math.min(5, newScale));

  stage.scale({ x: clampedScale, y: clampedScale });

  const newPos = {
    x: pointer.x - mousePointTo.x * clampedScale,
    y: pointer.y - mousePointTo.y * clampedScale,
  };
  stage.position(newPos);
  stage.batchDraw();
}

function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
  if (!stage) return;

  if (e.target === stage && !wiringStateManager?.isInWiringMode()) {
    isPanning = true;
    panStartPos = stage.getPointerPosition() || { x: 0, y: 0 };
    stageStartPos = { x: stage.x(), y: stage.y() };
    document.body.style.cursor = 'grabbing';
  }
}

function handleStageMouseUp() {
  if (isPanning) {
    isPanning = false;
    document.body.style.cursor = 'crosshair';
  }
}

function handleStageMouseLeave() {
  if (isPanning) {
    isPanning = false;
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
      clearTempLayer(tempLayer);
      return;
    }
    circuitStore.selectComponent(null);
    circuitStore.selectWire(null);
    clearGuides(guideLayer); // 清除輔助線
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

  // 初始化模擬標籤群組（放在 currentFlowLayer，與粒子分離）
  ensureSimulationLabelGroup();

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
  drawGrid(gridLayer, width, height, uiStore.gridSize, uiStore.showGrid);

  // 初始化 KonvaEventHandler 並綁定事件
  eventHandler = new KonvaEventHandler();
  eventHandler.setStageCallbacks({
    onStageClick: handleStageClick,
    onStageMouseMove: handleStageMouseMove,
    onStageMouseDown: handleStageMouseDown,
    onStageMouseUp: handleStageMouseUp,
    onStageMouseLeave: handleStageMouseLeave,
    onStageWheel: handleStageWheel,
  });
  eventHandler.setComponentCallbacks({
    onComponentClick: handleComponentClick,
    onComponentDragMove: handleComponentDragMove,
    onComponentDragEnd: handleComponentDragEnd,
    onComponentMouseEnter: handleComponentMouseEnter,
    onComponentMouseLeave: handleComponentMouseLeave,
  });
  eventHandler.setPortCallbacks({
    onPortClick: handlePortEventClick,
    onPortMouseEnter: handlePortMouseEnter,
    onPortMouseLeave: handlePortMouseLeave,
  });
  eventHandler.bindStageEvents(stage!);

  // 監聽鍵盤
  window.addEventListener('keydown', handleKeyDown);

  // 監聽視窗大小變化
  const resizeObserver = new ResizeObserver(() => {
    if (containerRef.value) {
      const newWidth = containerRef.value.clientWidth;
      const newHeight = containerRef.value.clientHeight;
      stage!.width(newWidth);
      stage!.height(newHeight);
      drawGrid(gridLayer, newWidth, newHeight, uiStore.gridSize, uiStore.showGrid);
    }
  });
  resizeObserver.observe(containerRef.value);

  // 初始繪製
  if (circuitStore.components.length > 0) {
    renderAllComponents();
  }

  renderSimulationLabels();
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
      drawGrid(gridLayer, containerRef.value.clientWidth, containerRef.value.clientHeight, uiStore.gridSize, uiStore.showGrid);
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
      renderSimulationLabels();
    } else {
      animationManager.stop();
      clearSimulationLabels();
    }
  }
);

// 監聽 DC 模擬結果變化
watch(
  () => circuitStore.dcResult,
  () => {
    // 當模擬結果更新時，重新繪製元件以反映狀態 (如 LED 發光)
    renderAllComponents();
    // updateComponentVisuals 不是全部重繪，可能不夠
    // 但 renderAllComponents 會重建節點，可以確保 drawLED 拿到最新 current

    renderSimulationLabels();
  },
  { deep: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  animationManager?.destroy();
  // 清除 LED 動畫
  ledAnimations.forEach(anim => anim.stop());
  ledAnimations.clear();

  if (stage && eventHandler) {
    eventHandler.unbindStageEvents(stage);
    eventHandler.clearCallbacks();
  }
  simulationLabelGroup?.destroy();
  simulationLabelGroup = null;
  stage?.destroy();
});
</script>

<template>
  <div ref="containerRef" class="circuit-canvas" @drop="handleDrop" @dragover.prevent>
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
