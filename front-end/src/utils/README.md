# Utils 資料夾說明

此資料夾包含與 UI 框架（Konva.js）相關的工具函數和類。

## 與 `/lib` 的區別

- **`/lib`** - 純計算工具函數，不依賴任何 UI 框架
  - 幾何計算 (geometryUtils.ts)
  - 動畫路徑計算 (animationUtils.ts)
  - 網格計算 (gridUtils.ts)
  - 智慧路由 (smartRouter.ts)

- **`/utils`** - UI 框架相關工具函數和類
  - Konva.js 圖層操作 (konvaUtils.ts)
  - Konva 類封裝 (KonvaStage, KonvaNodeManager, KonvaRenderer, KonvaAnimationManager, KonvaEventHandler)

## 文件說明

### konvaUtils.ts - Konva.js 圖層繪製工具

提供畫布層級的繪製功能，包括網格、輔助線、預覽等。

**主要函數：**

- `drawGuides()` - 繪製對齊輔助線
- `clearGuides()` - 清除輔助線
- `drawGrid()` - 繪製網格
- `drawWiringPreview()` - 繪製臨時接線預覽
- `clearTempLayer()` - 清除臨時層

---

### KonvaStage.ts - Konva Stage 和 Layer 管理

管理 Konva 舞台及各圖層的初始化、管理和銷毀。

**主要方法：**

- `initialize(container, width, height)` - 初始化 Stage 和所有圖層
- `getStage()` - 獲取 Stage
- `getGridLayer()` - 獲取網格圖層
- `getGuideLayer()` - 獲取輔助線圖層
- `getWireLayer()` - 獲取導線圖層
- `getCurrentFlowLayer()` - 獲取電流流動圖層
- `getComponentLayer()` - 獲取元件圖層
- `getTempLayer()` - 獲取臨時圖層
- `getLayers()` - 獲取所有圖層物件
- `resize(width, height)` - 調整 Stage 大小
- `draw()` - 繪製所有圖層
- `destroy()` - 銷毀 Stage
- `isInitialized()` - 檢查是否已初始化

**使用範例：**

```typescript
const konvaStage = new KonvaStage();
konvaStage.initialize(container, 1200, 800);
const stage = konvaStage.getStage();
const layers = konvaStage.getLayers();
```

---

### KonvaNodeManager.ts - Konva 節點管理

管理元件和導線的 Konva Node，包含創建、刪除、查詢。

**主要方法：**

- `setComponentNode(componentId, node)` - 添加元件 Node
- `getComponentNode(componentId)` - 獲取元件 Node
- `removeComponentNode(componentId)` - 刪除元件 Node
- `clearComponentNodes()` - 清除所有元件 Node
- `setWireNode(wireId, node)` - 添加導線 Node
- `getWireNode(wireId)` - 獲取導線 Node
- `removeWireNode(wireId)` - 刪除導線 Node
- `clearWireNodes()` - 清除所有導線 Node
- `forEachComponentNode(callback)` - 遍歷所有元件 Node
- `forEachWireNode(callback)` - 遍歷所有導線 Node
- `getComponentNodesMap()` - 獲取所有元件 Node Map
- `getWireNodesMap()` - 獲取所有導線 Node Map
- `clearAll()` - 清除所有 Node

---

### KonvaRenderer.ts - Konva 繪製管理

負責元件和導線的繪製邏輯。

**主要方法：**

- `drawWire()` - 繪製單條導線
- `renderAllComponents()` - 繪製所有元件
- `renderAllWires()` - 繪製所有導線
- `createComponentNode()` - 創建元件 Node 並綁定事件
- `updateWireSelection()` - 更新導線選取狀態視覺

---

### KonvaAnimationManager.ts - Konva 動畫管理

負責電流流動動畫的初始化、播放、停止。

**主要方法：**

- `initialize(currentFlowLayer)` - 初始化動畫管理器
- `getAllWirePathsWithDirection(components, wires, nodeManager)` - 計算電流路徑與方向
- `createParticles(paths)` - 創建動畫粒子
- `start(getPositionOnPath)` - 啟動動畫
- `stop()` - 停止動畫
- `isRunning()` - 檢查動畫是否正在運行
- `reinitializeParticles(paths)` - 重新初始化粒子
- `destroy()` - 銷毀動畫管理器

---

### KonvaEventHandler.ts - Konva 事件處理

負責 Stage 和元件的各種事件處理。

**主要方法：**

- `setStageCallbacks(callbacks)` - 設置 Stage 事件回調
- `setComponentCallbacks(callbacks)` - 設置元件事件回調
- `setPortCallbacks(callbacks)` - 設置端點事件回調
- `bindStageEvents(stage)` - 綁定 Stage 事件
- `bindComponentEvents(componentGroup, component)` - 綁定元件事件
- `bindPortEvents()` - 綁定端點事件
- `unbindStageEvents(stage)` - 解除 Stage 事件綁定
- `clearCallbacks()` - 清除所有回調

**支持的 Stage 事件：**

- `onStageClick` - Stage 點擊
- `onStageMouseMove` - Stage 滑鼠移動
- `onStageMouseDown` - Stage 滑鼠按下
- `onStageMouseUp` - Stage 滑鼠釋放
- `onStageMouseLeave` - Stage 滑鼠離開
- `onStageWheel` - Stage 滾輪

**支持的元件事件：**

- `onComponentClick` - 元件點擊
- `onComponentDragStart` - 元件拖曳開始
- `onComponentDragMove` - 元件拖曳移動
- `onComponentDragEnd` - 元件拖曳結束
- `onComponentMouseEnter` - 元件滑鼠進入
- `onComponentMouseLeave` - 元件滑鼠離開

**支持的端點事件：**

- `onPortClick` - 端點點擊
- `onPortMouseEnter` - 端點滑鼠進入
- `onPortMouseLeave` - 端點滑鼠離開

---

## 完整使用範例

```typescript
import { KonvaStage } from '@/utils/KonvaStage';
import { KonvaNodeManager } from '@/utils/KonvaNodeManager';
import { KonvaRenderer } from '@/utils/KonvaRenderer';
import { KonvaAnimationManager } from '@/utils/KonvaAnimationManager';
import { KonvaEventHandler } from '@/utils/KonvaEventHandler';

// 初始化
const konvaStage = new KonvaStage();
konvaStage.initialize(container, 1200, 800);

const nodeManager = new KonvaNodeManager();
const renderer = new KonvaRenderer(nodeManager);
const animationManager = new KonvaAnimationManager();
const eventHandler = new KonvaEventHandler();

// 初始化動畫管理器
animationManager.initialize(konvaStage.getCurrentFlowLayer());

// 設置事件回調
eventHandler.setStageCallbacks({
    onStageClick: (e) => { /* ... */ },
    onStageMouseMove: (e) => { /* ... */ },
});

// 繪製
renderer.renderAllComponents(
    components,
    konvaStage.getComponentLayer(),
    (comp) => renderer.createComponentNode(comp, /* 回調 */)
);

renderer.renderAllWires(
    wires,
    konvaStage.getWireLayer(),
    components,
    gridSize,
    canvasSize
);

// 銷毀
konvaStage.destroy();
```

## 設計原則

1. **職責分明**：每個類負責特定的功能領域
2. **UI 框架依賴性**：工具函數和類可以依賴 Konva.js
3. **無組件狀態**：不依賴 Vue 組件的內部狀態
4. **參數化**：所有需要的數據通過參數傳入
5. **可測試性**：所有方法應易於單元測試
