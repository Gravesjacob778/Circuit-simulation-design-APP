/**
 * geometryUtils.ts
 * 幾何計算工具函數
 * 提供座標轉換、路徑計算等幾何相關的工具函數
 */

/**
 * 計算旋轉後的端點位置
 * @param componentX 元件中心 X 座標
 * @param componentY 元件中心 Y 座標
 * @param offsetX 端點相對於元件中心的 X 偏移
 * @param offsetY 端點相對於元件中心的 Y 偏移
 * @param rotation 元件旋轉角度（度）
 * @returns 旋轉後的全域座標
 */
export function getRotatedPortPosition(
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
 * @param x1 起點 X
 * @param y1 起點 Y
 * @param x2 終點 X
 * @param y2 終點 Y
 * @param gridSize 網格大小
 * @param useZShape 是否使用 Z 型路徑（用於最終導線），預設 false 使用 L 型
 * @returns 路徑點陣列 [x1, y1, x2, y2, ...]
 */
export function calculateOrthogonalPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    gridSize: number,
    useZShape: boolean = false
): number[] {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    if (useZShape) {
        // Z 型路徑：用於最終導線（避開元件）
        if (dx >= dy) {
            const midX = Math.round((x1 + x2) / 2 / gridSize) * gridSize;
            return [x1, y1, midX, y1, midX, y2, x2, y2];
        } else {
            const midY = Math.round((y1 + y2) / 2 / gridSize) * gridSize;
            return [x1, y1, x1, midY, x2, midY, x2, y2];
        }
    }

    // L 型路徑：用於臨時接線預覽（更簡潔）
    // 根據 dx/dy 決定先水平還是先垂直
    if (dx >= dy) {
        // 先水平再垂直 (HV)
        return [x1, y1, x2, y1, x2, y2];
    } else {
        // 先垂直再水平 (VH)
        return [x1, y1, x1, y2, x2, y2];
    }
}
