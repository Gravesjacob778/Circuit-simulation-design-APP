/**
 * animationUtils.ts
 * 動畫路徑計算工具函數
 * 提供電流動畫相關的路徑計算功能
 */

/**
 * 計算導線路徑總長度
 * @param points 路徑點陣列 [x1, y1, x2, y2, ...]
 * @returns 路徑總長度
 */
export function calculatePathLength(points: number[]): number {
    let length = 0;
    for (let i = 0; i < points.length - 2; i += 2) {
        const p1x = points[i] ?? 0;
        const p1y = points[i + 1] ?? 0;
        const p2x = points[i + 2] ?? 0;
        const p2y = points[i + 3] ?? 0;
        const dx = p2x - p1x;
        const dy = p2y - p1y;
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
}

/**
 * 根據距離比例取得路徑上的位置
 * @param points 路徑點陣列 [x1, y1, x2, y2, ...]
 * @param distance 從起點到目標位置的距離
 * @returns 目標位置的座標
 */
export function getPositionOnPath(points: number[], distance: number): { x: number; y: number } {
    let accumulated = 0;

    for (let i = 0; i < points.length - 2; i += 2) {
        const x1 = points[i] ?? 0;
        const y1 = points[i + 1] ?? 0;
        const x2 = points[i + 2] ?? 0;
        const y2 = points[i + 3] ?? 0;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);

        if (accumulated + segmentLength >= distance) {
            const t = (distance - accumulated) / segmentLength;
            return {
                x: x1 + dx * t,
                y: y1 + dy * t,
            };
        }

        accumulated += segmentLength;
    }

    // 如果距離超過總長度，返回終點
    return {
        x: points[points.length - 2] ?? 0,
        y: points[points.length - 1] ?? 0,
    };
}

/**
 * 計算兩點之間的歐幾里得距離
 * @param x1 第一個點的 X 座標
 * @param y1 第一個點的 Y 座標
 * @param x2 第二個點的 X 座標
 * @param y2 第二個點的 Y 座標
 * @returns 兩點之間的距離
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 線性插值函數
 * @param start 起始值
 * @param end 結束值
 * @param t 插值參數 (0-1)
 * @returns 插值結果
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}
