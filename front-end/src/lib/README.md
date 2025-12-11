# Lib 資料夾說明

此資料夾包含所有計算類工具函數，依功能分類組織。

## 文件分類

### 1. geometryUtils.ts - 幾何計算工具

提供座標轉換、路徑計算等幾何相關的工具函數。

**主要函數：**

- `getRotatedPortPosition()` - 計算旋轉後的端點位置
- `calculateOrthogonalPath()` - 計算直角走線路徑 (Manhattan Routing)

**用途：**

- 元件旋轉時的端點座標計算
- 導線路徑規劃

---

### 2. animationUtils.ts - 動畫路徑計算工具

提供電流動畫相關的路徑計算功能。

**主要函數：**

- `calculatePathLength()` - 計算導線路徑總長度
- `getPositionOnPath()` - 根據距離比例取得路徑上的位置
- `calculateDistance()` - 計算兩點之間的歐幾里得距離
- `lerp()` - 線性插值函數

**用途：**

- 電流動畫粒子路徑計算
- 動畫位置插值

---

### 3. gridUtils.ts - 網格計算工具

提供網格吸附、對齊等相關的計算功能。

**主要函數：**

- `snapPosition()` - 將座標吸附到網格
- `snapToGrid()` - 將單一座標值吸附到網格
- `isOnGridPoint()` - 檢查座標是否在網格點上
- `getNearestGridPoint()` - 計算最近的網格點
- `getGridDistance()` - 計算兩個網格點之間的曼哈頓距離

**用途：**

- 元件拖曳時的網格吸附
- 導線繪製時的座標對齊

---

### 4. smartRouter.ts - 智慧路由引擎

根據端點位置實現智慧路由，並支援分道機制避免重疊。

**主要函數：**

- `smartOrthogonalRoute()` - 智慧正交路由主函數
- `buildExistingWireSegments()` - 建立現有導線線段數據

**用途：**

- 自動導線路由規劃
- 避免導線重疊

---

## 使用原則

1. **單一職責**：每個文件專注於一個功能領域
2. **純函數**：工具函數應為純函數，無副作用
3. **可測試性**：函數應易於單元測試
4. **文檔完整**：每個函數都有完整的 JSDoc 註釋

## 導入示例

```typescript
// 幾何計算
import { getRotatedPortPosition, calculateOrthogonalPath } from '@/lib/geometryUtils';

// 動畫計算
import { calculatePathLength, getPositionOnPath } from '@/lib/animationUtils';

// 網格計算
import { snapPosition, getNearestGridPoint } from '@/lib/gridUtils';

// 智慧路由
import { smartOrthogonalRoute, buildExistingWireSegments } from '@/lib/smartRouter';
```
