/**
 * smartRouter.ts
 * 簡化正交路由引擎
 * 根據端點位置實現智慧路由，並支援分道機制避免重疊
 */

import type { CircuitComponent, Wire } from '@/types/circuit';

// ============= 型別定義 =============

export interface WireSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    wireId: string;
}

interface Point {
    x: number;
    y: number;
}

// ============= 主要導出函數 =============

export function buildExistingWireSegments(
    wires: Wire[],
    excludeWireId?: string
): WireSegment[] {
    const segments: WireSegment[] = [];

    for (const wire of wires) {
        if (wire.id === excludeWireId) continue;

        if (wire.points && wire.points.length >= 2) {
            for (let i = 0; i < wire.points.length - 1; i++) {
                const p1 = wire.points[i];
                const p2 = wire.points[i + 1];
                if (p1 && p2) {
                    segments.push({
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        wireId: wire.id
                    });
                }
            }
        }
    }

    return segments;
}

/**
 * 檢查兩條線段是否重疊（平行且有共同部分）
 */
function checkSegmentOverlap(
    seg1: { x1: number; y1: number; x2: number; y2: number },
    seg2: WireSegment
): { overlaps: boolean; isHorizontal: boolean } {
    const isHorizontal1 = Math.abs(seg1.y1 - seg1.y2) < 1;
    const isVertical1 = Math.abs(seg1.x1 - seg1.x2) < 1;
    const isHorizontal2 = Math.abs(seg2.y1 - seg2.y2) < 1;
    const isVertical2 = Math.abs(seg2.x1 - seg2.x2) < 1;

    // 兩條水平線段
    if (isHorizontal1 && isHorizontal2 && Math.abs(seg1.y1 - seg2.y1) < 5) {
        const min1 = Math.min(seg1.x1, seg1.x2);
        const max1 = Math.max(seg1.x1, seg1.x2);
        const min2 = Math.min(seg2.x1, seg2.x2);
        const max2 = Math.max(seg2.x1, seg2.x2);
        // 檢查是否有重疊區間
        if (max1 > min2 && max2 > min1) {
            return { overlaps: true, isHorizontal: true };
        }
    }

    // 兩條垂直線段
    if (isVertical1 && isVertical2 && Math.abs(seg1.x1 - seg2.x1) < 5) {
        const min1 = Math.min(seg1.y1, seg1.y2);
        const max1 = Math.max(seg1.y1, seg1.y2);
        const min2 = Math.min(seg2.y1, seg2.y2);
        const max2 = Math.max(seg2.y1, seg2.y2);
        // 檢查是否有重疊區間
        if (max1 > min2 && max2 > min1) {
            return { overlaps: true, isHorizontal: false };
        }
    }

    return { overlaps: false, isHorizontal: false };
}

/**
 * 計算線段的重疊數量
 */
function countOverlaps(
    segment: { x1: number; y1: number; x2: number; y2: number },
    existingWires: WireSegment[]
): { count: number; isHorizontal: boolean } {
    let count = 0;
    let isHorizontal = Math.abs(segment.y1 - segment.y2) < 1;

    for (const existingSeg of existingWires) {
        const { overlaps, isHorizontal: segIsHorizontal } = checkSegmentOverlap(segment, existingSeg);
        if (overlaps) {
            count++;
            isHorizontal = segIsHorizontal;
        }
    }

    return { count, isHorizontal };
}

/**
 * 應用分道偏移到路徑點
 */
function applyLaneOffset(
    points: Point[],
    existingWires: WireSegment[],
    gridSize: number
): Point[] {
    if (points.length < 2) return points;

    const result = points.map(p => ({ ...p }));
    const laneOffset = gridSize * 0.6; // 分道偏移量

    // 遍歷路徑中的每一條線段
    for (let i = 0; i < result.length - 1; i++) {
        const p1 = result[i];
        const p2 = result[i + 1];

        if (!p1 || !p2) continue;

        const segment = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
        const { count, isHorizontal } = countOverlaps(segment, existingWires);

        // 如果有重疊，偏移中間的線段
        if (count > 0) {
            const offsetAmount = count * laneOffset;

            if (isHorizontal) {
                // 水平線段 -> 垂直偏移
                // 只偏移中間點，不偏移端點
                if (i > 0) {
                    result[i] = { x: p1.x, y: p1.y + offsetAmount };
                }
                if (i + 1 < result.length - 1) {
                    result[i + 1] = { x: p2.x, y: p2.y + offsetAmount };
                }
            } else {
                // 垂直線段 -> 水平偏移
                if (i > 0) {
                    result[i] = { x: p1.x + offsetAmount, y: p1.y };
                }
                if (i + 1 < result.length - 1) {
                    result[i + 1] = { x: p2.x + offsetAmount, y: p2.y };
                }
            }
        }
    }

    return result;
}

/**
 * 智慧正交路由 - 主函數
 */
export function smartOrthogonalRoute(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    _components: CircuitComponent[],
    existingWireSegments: WireSegment[],
    gridSize: number,
    _canvasSize: { width: number; height: number } = { width: 2000, height: 2000 },
    options: {
        startComponentId?: string;
        endComponentId?: string;
        startPortOffset?: { x: number; y: number };
        endPortOffset?: { x: number; y: number };
        startRotation?: number;
        endRotation?: number;
    } = {}
): number[] {
    // 簡單路徑判斷：檢查是否可以使用簡化的路由邏輯
    const yTolerance = gridSize / 2; // Y 軸容差
    const isSameY = Math.abs(startY - endY) < yTolerance;

    // 判斷起點和終點是上端點還是下端點
    // 上端點：offsetY < 0（在元件上方）
    // 下端點：offsetY > 0（在元件下方）
    const isStartTopPort = options.startPortOffset ? options.startPortOffset.y < 0 : false;
    const isEndTopPort = options.endPortOffset ? options.endPortOffset.y < 0 : false;

    let pathPoints: Point[];

    // 情況 1：相同 Y 軸 - 直接水平連接
    if (isSameY) {
        pathPoints = [
            { x: startX, y: startY },
            { x: endX, y: startY }
        ];
    } else {
        // 情況 2：不同 Y 軸 - 根據端點類型決定路由方式
        const isStartHigher = startY < endY; // Y 軸向下為正

        // 判斷是上端點連線還是下端點連線
        // 如果起點或終點任一是上端點，使用上端點邏輯
        const isTopPortConnection = isStartTopPort || isEndTopPort;

        if (isTopPortConnection) {
            // 上端點連線邏輯：從最高點開始，先水平後垂直
            if (isStartHigher) {
                pathPoints = [
                    { x: startX, y: startY },
                    { x: endX, y: startY },
                    { x: endX, y: endY }
                ];
            } else {
                pathPoints = [
                    { x: startX, y: startY },
                    { x: startX, y: endY },
                    { x: endX, y: endY }
                ];
            }
        } else {
            // 下端點連線邏輯：從最低點開始，先水平後垂直（與上端點相反）
            if (isStartHigher) {
                pathPoints = [
                    { x: startX, y: startY },
                    { x: startX, y: endY },
                    { x: endX, y: endY }
                ];
            } else {
                pathPoints = [
                    { x: startX, y: startY },
                    { x: endX, y: startY },
                    { x: endX, y: endY }
                ];
            }
        }
    }

    // 應用分道機制避免重疊
    const adjustedPath = applyLaneOffset(pathPoints, existingWireSegments, gridSize);

    // 轉換為扁平的數字陣列
    const result: number[] = [];
    for (const p of adjustedPath) {
        result.push(p.x, p.y);
    }

    return result;
}
