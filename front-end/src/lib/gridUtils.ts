/**
 * gridUtils.ts
 * 網格計算工具函數
 * 提供網格吸附、對齊等相關的計算功能
 */

/**
 * 將座標吸附到網格
 * @param x X 座標
 * @param y Y 座標
 * @param gridSize 網格大小
 * @param snapToGrid 是否啟用網格吸附
 * @returns 吸附後的座標
 */
export function snapPosition(
    x: number,
    y: number,
    gridSize: number,
    snapToGrid: boolean = true
): { x: number; y: number } {
    if (!snapToGrid) {
        return { x, y };
    }
    return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
    };
}

/**
 * 將單一座標值吸附到網格
 * @param value 座標值
 * @param gridSize 網格大小
 * @returns 吸附後的座標值
 */
export function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * 檢查座標是否在網格點上
 * @param x X 座標
 * @param y Y 座標
 * @param gridSize 網格大小
 * @param tolerance 容差範圍
 * @returns 是否在網格點上
 */
export function isOnGridPoint(
    x: number,
    y: number,
    gridSize: number,
    tolerance: number = 1
): boolean {
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    return Math.abs(x - snappedX) <= tolerance && Math.abs(y - snappedY) <= tolerance;
}

/**
 * 計算最近的網格點
 * @param x X 座標
 * @param y Y 座標
 * @param gridSize 網格大小
 * @returns 最近的網格點座標
 */
export function getNearestGridPoint(
    x: number,
    y: number,
    gridSize: number
): { x: number; y: number } {
    return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
    };
}

/**
 * 計算兩個網格點之間的網格距離
 * @param x1 第一個點的 X 座標
 * @param y1 第一個點的 Y 座標
 * @param x2 第二個點的 X 座標
 * @param y2 第二個點的 Y 座標
 * @param gridSize 網格大小
 * @returns 網格距離（曼哈頓距離）
 */
export function getGridDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    gridSize: number
): number {
    const dx = Math.abs(x2 - x1) / gridSize;
    const dy = Math.abs(y2 - y1) / gridSize;
    return dx + dy;
}
