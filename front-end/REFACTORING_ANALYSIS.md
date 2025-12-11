# CircuitCanvas.vue 重構分析報告

## 概述
CircuitCanvas.vue 是應用核心，管理 1131 行代碼的所有畫布操作。當前實現功能完整但存在以下問題：
- 過多混合關注點（混合 Konva、狀態管理、事件處理）
- 已創建的 Konva 類未被充分利用
- 大量重複代碼（尤其是事件綁定）
- 模組級狀態變數缺乏管理

---

## 當前代碼結構分析

### 模組級變數（Lines 40-65）
```
Stage & Layers (6 items):
- stage: Konva.Stage
- gridLayer, guideLayer, wireLayer, componentLayer, tempLayer, currentFlowLayer

Node Tracking (2 items):
- componentNodes: Map<string, Konva.Group>
- wireNodes: Map<string, Konva.Group>

Animation State (3 items):
- currentFlowAnimation: Konva.Animation | null
- currentFlowParticles: Konva.Circle[]

Wiring State (2 items):
- isWiring: boolean
- wiringStartPort: PortInfo | null

Interface:
- PortInfo: { componentId, portId, x, y }
```

**問題**：狀態分散，缺乏統一管理機制

---

### 主要函數分類

#### A. 元件渲染與互動（~350 行）
| 函數 | 用途 | 位置 | 狀態 |
|------|------|------|------|
| `createComponentNode()` | 創建元件 Konva 節點 | L115-240 | 重複事件綁定 |
| `updateComponentVisuals()` | 更新視覺狀態 | L242-330 | 事件綁定重複 |
| `renderAllComponents()` | 批量渲染元件 | L408-420 | ✅ 可用 |

**問題**：
- `createComponentNode()` 和 `updateComponentVisuals()` 都綁定了相同的端點事件
- 端點事件綁定邏輯應提取到獨立方法
- 應使用 KonvaRenderer 的 `createComponentNode()` 方法

#### B. 導線渲染與路由（~200 行）
| 函數 | 用途 | 位置 | 狀態 |
|------|------|------|------|
| `drawWire()` | 單條導線繪製 | L363-406 | 重複代碼 |
| `renderAllWires()` | 批量導線渲染 | L422-437 | ✅ 可用 |

**問題**：
- `drawWire()` 邏輯應移到 KonvaRenderer
- 需要在 wire 變化時重新初始化動畫粒子

#### C. 電流動畫系統（~350 行）
| 函數 | 用途 | 位置 | 狀態 |
|------|------|------|------|
| `getAllWirePathsWithDirection()` | 計算路徑及方向 | L449-570 | ✅ 邏輯清晰 |
| `getDefaultDirectionPaths()` | 預設方向路徑 | L576-595 | 可提取 |
| `initCurrentFlowParticles()` | 初始化粒子 | L601-636 | 應移到 KonvaAnimationManager |
| `startCurrentFlowAnimation()` | 啟動動畫 | L641-670 | 應移到 KonvaAnimationManager |
| `stopCurrentFlowAnimation()` | 停止動畫 | L675-686 | 應移到 KonvaAnimationManager |

**問題**：
- 動畫邏輯應完全委託給 KonvaAnimationManager
- 粒子追蹤邏輯過於複雜，應抽象

#### D. 事件處理（~300 行）
| 函數 | 用途 | 位置 | 狀態 |
|------|------|------|------|
| `handleDrop()` | 拖曳組件到畫布 | L688-699 | ✅ 簡潔 |
| `handleStageClick()` | 背景點擊 | L702-726 | 接線狀態管理混亂 |
| `handleKeyDown()` | 鍵盤快捷鍵 | L729-765 | ✅ 可用 |
| `handlePortClick()` | 端點點擊（引入缺失） | 未見 | ❌ 需要尋找 |
| Port Event Handlers | 懸停、點擊端點 | L175-210, L300-330 | 重複綁定 |

**問題**：
- 接線狀態 (`isWiring`, `wiringStartPort`) 需要統一管理
- 端點點擊邏輯應提取到獨立方法
- 應使用 KonvaEventHandler 管理所有事件

#### E. 工具函數（~150 行）
| 函數 | 用途 | 位置 | 狀態 |
|------|------|------|------|
| `drawGuides()` | 繪製輔助線（包裝） | L70-76 | ⚠️ 包裝函數 |
| `clearGuides()` | 清除輔助線（包裝） | L78-82 | ⚠️ 包裝函數 |
| `drawGrid()` | 繪製網格（包裝） | L84-88 | ⚠️ 包裝函數 |
| `drawWiringPreview()` | 接線預覽（包裝） | L90-100 | ⚠️ 包裝函數 |
| `setPortHover*()` | 端點懸停樣式（4 個） | L102-113 | ⚠️ 包裝函數 |
| `clearTempLayer()` | 清空臨時圖層（包裝） | (推測) | ⚠️ 包裝函數 |

**問題**：
- 都是 konvaUtils 的包裝函數，可直接使用

#### F. 生命週期與監聽（~400 行）
| 鉤子 | 用途 | 行數 |
|------|------|------|
| `onMounted()` | Stage 初始化 + 事件綁定 | L768-920 |
| `watch()` 監聽 | 5 個監聽器 | L925-980 |
| `onUnmounted()` | 清理資源 | L982-987 |

**問題**：
- Stage 初始化應委託給 KonvaStage 類
- 事件綁定應委託給 KonvaEventHandler
- 監聽邏輯可組織得更清晰

---

## 已創建類的利用情況

### ✅ 已創建類
1. **KonvaStage** (145 行) - 完全未使用
2. **KonvaNodeManager** (98 行) - 完全未使用
3. **KonvaRenderer** (194 行) - 創建但未充分使用
4. **KonvaAnimationManager** (122 行) - 完全未使用
5. **KonvaEventHandler** (152 行) - 完全未使用

### ❌ 利用障礙
- CircuitCanvas 仍在直接管理 stage、layers、nodes
- 動畫邏輯未遷移到 KonvaAnimationManager
- 事件綁定仍在各個函數中分散進行

---

## 重構順序（優先級）

### Phase 1: 基礎設施類集成（優先級高）
**目標**：替換模組級變數為類實例

```
1️⃣ 集成 KonvaStage
   - 用 KonvaStage 替換 6 個層變數
   - 移除 stage 初始化代碼

2️⃣ 集成 KonvaNodeManager
   - 用 KonvaNodeManager 替換 componentNodes/wireNodes Maps
   - 更新所有節點訪問邏輯

3️⃣ 創建 WiringStateManager 類（新建）
   - 封裝 isWiring 和 wiringStartPort
   - 提供 startWiring(), cancelWiring(), isInWiringMode()
```

### Phase 2: 渲染邏輯遷移（優先級高）
**目標**：使用 KonvaRenderer 進行所有渲染

```
4️⃣ 遷移 drawWire() 到 KonvaRenderer
   - 移除 CircuitCanvas 中的 drawWire()
   - 使用 KonvaRenderer.drawWire()

5️⃣ 配置 KonvaRenderer.createComponentNode()
   - 驗證端點事件綁定
   - 移除 updateComponentVisuals() 中的重複綁定

6️⃣ 統一批量渲染
   - renderAllComponents 使用 KonvaRenderer.renderAllComponents()
   - renderAllWires 使用 KonvaRenderer.renderAllWires()
```

### Phase 3: 動畫邏輯遷移（優先級中）
**目標**：完全遷移電流動畫到 KonvaAnimationManager

```
7️⃣ 遷移粒子邏輯
   - 將 getAllWirePathsWithDirection() 邏輯移到 KonvaAnimationManager
   - 修改 KonvaAnimationManager 的 createParticles() 方法
   - 移除 CircuitCanvas 中的動畫函數

8️⃣ 連接動畫到 watch
   - 修改 circuitStore.isCurrentAnimating watch
   - 改為呼叫 KonvaAnimationManager.start/stop
```

### Phase 4: 事件處理遷移（優先級中）
**目標**：統一所有事件處理到 KonvaEventHandler

```
9️⃣ 配置 KonvaEventHandler
   - setStageCallbacks() 接收 stage 事件回調
   - setComponentCallbacks() 接收元件事件回調
   - setPortCallbacks() 接收端點事件回調
   - bindStageEvents() 並移除 CircuitCanvas 直接綁定

🔟 移除事件綁定代碼
   - 刪除 onMounted() 中的事件綁定
   - 刪除 port event 綁定邏輯
```

### Phase 5: 最終清理（優先級低）
**目標**：優化和驗證

```
1️⃣1️⃣ 移除包裝函數
   - 將 drawGuides/clearGuides/drawGrid 等直接呼叫轉換為工具函數直接使用

1️⃣2️⃣ 優化監聽器
   - 合併相關的 watch
   - 整理生命週期邏輯

1️⃣3️⃣ 代碼驗證
   - 測試所有互動模式
   - 驗證性能沒有下降
```

---

## 具體改進項目

### 1. WiringStateManager 類（新建）
```typescript
// utils/WiringStateManager.ts
export class WiringStateManager {
  private isWiring = false;
  private wiringStartPort: PortInfo | null = null;

  isInWiringMode(): boolean { return this.isWiring; }
  getStartPort(): PortInfo | null { return this.wiringStartPort; }
  
  startWiring(portInfo: PortInfo): void { ... }
  endWiring(): void { ... }
  cancelWiring(): void { ... }
  isSamePort(componentId: string, portId: string): boolean { ... }
}
```

**預期改進**：
- 集中管理接線狀態
- 提供清晰的 API
- 便於單元測試

### 2. 端點事件綁定提取
```typescript
// 新建函數：bindPortEvents()
function bindPortEvents(
  portShape: Konva.Node,
  componentId: string,
  portId: string,
  port: Port,
  component: CircuitComponent
) {
  // 統一的端點事件綁定邏輯
  // 避免在 createComponentNode 和 updateComponentVisuals 中重複
}
```

**預期改進**：
- 消除重複代碼
- 單一職責
- 易於維護

### 3. 事件回調管理
```typescript
// 使用 KonvaEventHandler
const eventHandler = new KonvaEventHandler();
eventHandler.setStageCallbacks({
  onStageClick: handleStageClick,
  onStageWheel: handleStageWheel,
  onStagePan: handleStagePan,
});
eventHandler.setPortCallbacks({
  onPortClick: handlePortClick,
  onPortHover: handlePortHover,
});
eventHandler.bindStageEvents(stage);
```

**預期改進**：
- 集中管理所有事件
- 易於添加新事件
- 解耦事件邏輯

### 4. 動畫邏輯增強
```typescript
// 增強 KonvaAnimationManager
animationManager.reinitializeParticles(getAllWirePathsWithDirection());
```

**預期改進**：
- 動畫邏輯與渲染邏輯分離
- 便於動畫優化
- 支持多種動畫策略

---

## 代碼品質指標

### 當前狀態
| 指標 | 值 | 狀態 |
|------|-----|------|
| 代碼行數 | 1131 | ❌ 過多 |
| 函數個數 | 20+ | ⚠️ 過多 |
| 混合關注點 | 6+ | ❌ 過多 |
| 模組級變數 | 10+ | ❌ 過多 |
| 重複代碼行 | ~80 | ⚠️ 可優化 |

### 目標狀態（重構後）
| 指標 | 目標 | 改進 |
|------|------|------|
| 代碼行數 | ~600 | ↓ 47% |
| 函數個數 | 10 | ↓ 50% |
| 混合關注點 | 2-3 | ↓ 50% |
| 模組級變數 | 3-4 | ↓ 65% |
| 重複代碼 | ~10 | ↓ 88% |

---

## 實施計畫

### 預期時間線
- **Phase 1** (基礎設施): 2-3 小時
- **Phase 2** (渲染邏輯): 1.5-2 小時
- **Phase 3** (動畫邏輯): 1-1.5 小時
- **Phase 4** (事件處理): 1.5-2 小時
- **Phase 5** (清理驗證): 1-1.5 小時

**總計**：7-10 小時

### 風險評估
| 風險 | 概率 | 影響 | 緩解 |
|------|------|------|------|
| 事件綁定出錯 | 中 | 高 | 測試所有互動，單元測試 |
| 性能下降 | 低 | 中 | 使用 batchDraw()，避免多次渲染 |
| 動畫邏輯破損 | 中 | 中 | 逐步遷移，保留備份 |

---

## 下一步建議

1. **立即行動**：建立 WiringStateManager 類（簡單、高價值）
2. **集成 KonvaStage**：替換模組級層變數
3. **測試驗證**：確保所有互動正常
4. **逐步遷移**：按 Phase 順序進行，每個 Phase 後驗證

