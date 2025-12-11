# 元件繪製模組重構說明

## 概述

為了提升程式碼的模組化和可維護性，我們將 `CircuitCanvas.vue` 中的元件繪製邏輯抽離到獨立的模組中。

## 檔案結構

```
src/components/workspace/
├── CircuitCanvas.vue           # 主畫布元件（簡化後）
└── renderers/
    └── componentRenderers.ts   # 元件繪製函數模組
```

## 變更內容

### 新建檔案

**`renderers/componentRenderers.ts`**
- 包含所有電路元件的繪製函數
- 函數列表：
  - `drawResistor()` - 繪製電阻
  - `drawCapacitor()` - 繪製電容
  - `drawGround()` - 繪製接地符號
  - `drawDCSource()` - 繪製 DC 電源
  - `drawACSource()` - 繪製 AC 電源
  - `drawGenericComponent()` - 繪製通用元件
  - `drawComponentShape()` - 根據類型繪製對應元件（主要入口函數）

### 修改檔案

**`CircuitCanvas.vue`**
- 移除了約 425 行的元件繪製程式碼
- 新增 import：`import { drawComponentShape } from './renderers/componentRenderers'`
- 保留了畫布核心邏輯：
  - 網格繪製
  - 元件互動（拖曳、選取、旋轉）
  - 接線邏輯
  - 事件處理

## 優點

1. **關注點分離**：畫布邏輯與繪製邏輯分離
2. **可維護性提升**：繪製函數集中管理，易於修改和擴展
3. **程式碼可讀性**：`CircuitCanvas.vue` 從 1405 行減少到約 980 行
4. **可重用性**：繪製函數可以在其他地方重複使用（如縮圖預覽）
5. **測試友善**：繪製函數可以獨立測試

## 使用方式

在 `CircuitCanvas.vue` 中使用：

```typescript
import { drawComponentShape } from './renderers/componentRenderers';

// 在需要繪製元件時呼叫
const group = new Konva.Group({ ... });
drawComponentShape(group, component);
```

## 幾何計算工具

**`@/lib/geometryUtils.ts`**
- 包含幾何計算相關的工具函數
- 函數列表：
  - `getRotatedPortPosition()` - 計算旋轉後的端點位置
  - `calculateOrthogonalPath()` - 計算直角走線路徑（支援 L 型和 Z 型）

使用範例：

```typescript
import { getRotatedPortPosition, calculateOrthogonalPath } from '@/lib/geometryUtils';

// 計算旋轉後的端點位置
const portPos = getRotatedPortPosition(100, 100, 40, 0, 90);

// 計算走線路徑
const path = calculateOrthogonalPath(0, 0, 100, 100, 20, true); // Z 型路徑
```

## 未來擴展

可以考慮進一步模組化：
- `wireRenderers.ts` - 導線繪製邏輯
- `gridRenderers.ts` - 網格繪製邏輯
- `interactionHandlers.ts` - 互動事件處理邏輯
