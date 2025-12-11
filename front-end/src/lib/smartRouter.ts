/**
 * smartRouter.ts
 * 智慧正交路由引擎
 * 實現 A* 尋路 + Manhattan Routing + 避障 + 分道
 */

import type { CircuitComponent, Wire } from '@/types/circuit';

// ============= 型別定義 =============

interface Point {
    x: number;
    y: number;
}

interface PathNode {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: PathNode | null;
    direction: Direction;
}

type Direction = 'N' | 'S' | 'E' | 'W' | 'NONE';

interface RoutingContext {
    gridSize: number;
    canvasWidth: number;
    canvasHeight: number;
    obstacles: BoundingBox[];
    existingWires: WireSegment[];
    turnPenalty: number;
    overlapPenalty: number;
}

interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    componentId?: string;
}

export interface WireSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    wireId: string;
}

// ============= 輔助函數 =============

function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

function manhattanDistance(a: Point, b: Point): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getPortExitDirection(offsetX: number, offsetY: number, rotation: number): Direction {
    const rad = (rotation * Math.PI) / 180;
    const rotatedX = offsetX * Math.cos(rad) - offsetY * Math.sin(rad);
    const rotatedY = offsetX * Math.sin(rad) + offsetY * Math.cos(rad);

    if (Math.abs(rotatedX) > Math.abs(rotatedY)) {
        return rotatedX > 0 ? 'E' : 'W';
    } else {
        return rotatedY > 0 ? 'S' : 'N';
    }
}

function oppositeDirection(dir: Direction): Direction {
    switch (dir) {
        case 'N': return 'S';
        case 'S': return 'N';
        case 'E': return 'W';
        case 'W': return 'E';
        default: return 'NONE';
    }
}

function inflateBoundingBox(box: BoundingBox, margin: number): BoundingBox {
    return {
        minX: box.minX - margin,
        minY: box.minY - margin,
        maxX: box.maxX + margin,
        maxY: box.maxY + margin,
        componentId: box.componentId
    };
}

// ============= 成本網格建構 =============

function buildCostGrid(ctx: RoutingContext): Map<string, number> {
    const costMap = new Map<string, number>();
    const { gridSize, obstacles, existingWires, overlapPenalty } = ctx;

    for (const obs of obstacles) {
        const inflated = inflateBoundingBox(obs, gridSize / 2);
        for (let x = snapToGrid(inflated.minX, gridSize); x <= inflated.maxX; x += gridSize) {
            for (let y = snapToGrid(inflated.minY, gridSize); y <= inflated.maxY; y += gridSize) {
                costMap.set(`${x},${y}`, Infinity);
            }
        }
    }

    for (const seg of existingWires) {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const steps = Math.max(Math.abs(dx), Math.abs(dy)) / gridSize;
        const stepX = steps > 0 ? dx / steps : 0;
        const stepY = steps > 0 ? dy / steps : 0;

        for (let i = 0; i <= steps; i++) {
            const px = snapToGrid(seg.x1 + stepX * i, gridSize);
            const py = snapToGrid(seg.y1 + stepY * i, gridSize);
            const key = `${px},${py}`;
            const currentCost = costMap.get(key) ?? 0;
            if (currentCost !== Infinity) {
                costMap.set(key, currentCost + overlapPenalty);
            }
        }
    }

    return costMap;
}

// ============= A* 正交尋路 =============

function aStarOrthogonal(
    start: Point,
    end: Point,
    ctx: RoutingContext,
    startDir: Direction = 'NONE',
    endDir: Direction = 'NONE'
): Point[] {
    const { gridSize, canvasWidth, canvasHeight, turnPenalty } = ctx;
    const costGrid = buildCostGrid(ctx);

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const startNode: PathNode = {
        x: snapToGrid(start.x, gridSize),
        y: snapToGrid(start.y, gridSize),
        g: 0,
        h: manhattanDistance(start, end),
        f: manhattanDistance(start, end),
        parent: null,
        direction: startDir
    };

    openSet.push(startNode);

    const endX = snapToGrid(end.x, gridSize);
    const endY = snapToGrid(end.y, gridSize);

    const directions: { dir: Direction; dx: number; dy: number }[] = [
        { dir: 'N', dx: 0, dy: -gridSize },
        { dir: 'S', dx: 0, dy: gridSize },
        { dir: 'E', dx: gridSize, dy: 0 },
        { dir: 'W', dx: -gridSize, dy: 0 }
    ];

    let iterations = 0;
    const maxIterations = 1000;

    while (openSet.length > 0 && iterations < maxIterations) {
        iterations++;

        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift()!;
        const currentKey = `${current.x},${current.y}`;

        if (current.x === endX && current.y === endY) {
            return reconstructPath(current);
        }

        closedSet.add(currentKey);

        for (const { dir, dx, dy } of directions) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const neighborKey = `${nx},${ny}`;

            if (nx < 0 || nx > canvasWidth || ny < 0 || ny > canvasHeight) continue;
            if (closedSet.has(neighborKey)) continue;

            const cellCost = costGrid.get(neighborKey) ?? 0;
            if (cellCost === Infinity) continue;

            let moveCost = gridSize + cellCost;

            if (current.direction !== 'NONE' && current.direction !== dir) {
                moveCost += turnPenalty * gridSize;
            }

            if (current.parent === null && startDir !== 'NONE' && dir !== startDir) {
                moveCost += turnPenalty * gridSize;
            }

            if (nx === endX && ny === endY && endDir !== 'NONE') {
                const requiredApproach = oppositeDirection(endDir);
                if (dir !== requiredApproach) {
                    moveCost += turnPenalty * gridSize;
                }
            }

            const tentativeG = current.g + moveCost;

            const existingIndex = openSet.findIndex(n => n.x === nx && n.y === ny);
            if (existingIndex !== -1) {
                const existingNode = openSet[existingIndex];
                if (existingNode && tentativeG >= existingNode.g) continue;
                openSet.splice(existingIndex, 1);
            }

            const h = manhattanDistance({ x: nx, y: ny }, end);
            const newNode: PathNode = {
                x: nx,
                y: ny,
                g: tentativeG,
                h,
                f: tentativeG + h,
                parent: current,
                direction: dir
            };

            openSet.push(newNode);
        }
    }

    return fallbackLPath(start, end, gridSize);
}

function reconstructPath(node: PathNode): Point[] {
    const path: Point[] = [];
    let current: PathNode | null = node;

    while (current !== null) {
        path.unshift({ x: current.x, y: current.y });
        current = current.parent;
    }

    return path;
}

function simplifyPath(path: Point[]): Point[] {
    if (path.length <= 2) return path;

    const first = path[0];
    if (!first) return path;

    const simplified: Point[] = [first];

    for (let i = 1; i < path.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = path[i];
        const next = path[i + 1];

        if (!prev || !curr || !next) continue;

        const sameLine = (prev.x === curr.x && curr.x === next.x) ||
            (prev.y === curr.y && curr.y === next.y);

        if (!sameLine) {
            simplified.push(curr);
        }
    }

    const last = path[path.length - 1];
    if (last) {
        simplified.push(last);
    }
    return simplified;
}

function fallbackLPath(start: Point, end: Point, gridSize: number): Point[] {
    const x1 = snapToGrid(start.x, gridSize);
    const y1 = snapToGrid(start.y, gridSize);
    const x2 = snapToGrid(end.x, gridSize);
    const y2 = snapToGrid(end.y, gridSize);

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    if (dx >= dy) {
        return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }];
    } else {
        return [{ x: x1, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }];
    }
}

// ============= 分道機制 =============

/**
 * 檢查兩條線段是否重疊（平行且有共同部分）
 */
function checkSegmentOverlap(
    seg1: { x1: number; y1: number; x2: number; y2: number },
    seg2: WireSegment
): { overlaps: boolean; isHorizontal: boolean } {
    const isHorizontal1 = seg1.y1 === seg1.y2;
    const isVertical1 = seg1.x1 === seg1.x2;
    const isHorizontal2 = seg2.y1 === seg2.y2;
    const isVertical2 = seg2.x1 === seg2.x2;

    // 兩條水平線段
    if (isHorizontal1 && isHorizontal2 && seg1.y1 === seg2.y1) {
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
    if (isVertical1 && isVertical2 && seg1.x1 === seg2.x1) {
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
 * 分道機制 - 檢測並偏移重疊的線段
 */
function assignLane(
    path: Point[],
    existingWires: WireSegment[],
    gridSize: number
): Point[] {
    if (path.length < 2) return path;

    const result = path.map(p => ({ ...p }));
    const laneOffset = gridSize / 2; // 分道偏移量

    // 遍歷路徑中的每一條線段
    for (let i = 0; i < result.length - 1; i++) {
        const p1 = result[i];
        const p2 = result[i + 1];

        if (!p1 || !p2) continue;

        const currentSeg = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
        let maxOverlapCount = 0;

        // 檢查當前線段與所有現有線段的重疊
        for (const existingSeg of existingWires) {
            const { overlaps } = checkSegmentOverlap(currentSeg, existingSeg);
            if (overlaps) {
                maxOverlapCount++;
            }
        }

        // 如果有重疊，偏移當前線段
        if (maxOverlapCount > 0) {
            const isHorizontal = p1.y === p2.y;
            const offsetAmount = maxOverlapCount * laneOffset;

            if (isHorizontal) {
                // 水平線段 -> 垂直偏移 (向下)
                // 需要同時調整這條線段的兩個端點
                // 但不能調整路徑的第一個和最後一個點（端點）
                if (i > 0) {
                    result[i] = { x: p1.x, y: p1.y + offsetAmount };
                }
                if (i + 1 < result.length - 1) {
                    result[i + 1] = { x: p2.x, y: p2.y + offsetAmount };
                }
            } else {
                // 垂直線段 -> 水平偏移 (向右)
                if (i > 0) {
                    result[i] = { x: p1.x + offsetAmount, y: p1.y };
                }
                if (i + 1 < result.length - 1) {
                    result[i + 1] = { x: p2.x + offsetAmount, y: p2.y };
                }
            }
        }
    }

    // 清理路徑：確保相鄰點之間的連線仍然是正交的
    return cleanupPath(result, gridSize);
}

/**
 * 清理路徑，確保正交性並移除冗餘點
 */
function cleanupPath(path: Point[], _gridSize?: number): Point[] {
    if (path.length < 2) return path;

    const result: Point[] = [path[0]!];

    for (let i = 1; i < path.length; i++) {
        const prev = result[result.length - 1]!;
        const curr = path[i]!;

        // 如果當前點與前一點相同，跳過
        if (prev.x === curr.x && prev.y === curr.y) continue;

        // 如果不是正交連接，插入中間點
        if (prev.x !== curr.x && prev.y !== curr.y) {
            // 插入一個中間點使其正交（先水平後垂直）
            result.push({ x: curr.x, y: prev.y });
        }

        result.push(curr);
    }

    // 再次簡化：移除共線的中間點
    const simplified: Point[] = [result[0]!];
    for (let i = 1; i < result.length - 1; i++) {
        const prev = simplified[simplified.length - 1]!;
        const curr = result[i]!;
        const next = result[i + 1]!;

        const sameLine = (prev.x === curr.x && curr.x === next.x) ||
            (prev.y === curr.y && curr.y === next.y);

        if (!sameLine) {
            simplified.push(curr);
        }
    }

    if (result.length > 1) {
        simplified.push(result[result.length - 1]!);
    }

    return simplified;
}

// ============= 主要導出函數 =============

export function buildObstaclesFromComponents(
    components: CircuitComponent[],
    excludeIds: string[] = []
): BoundingBox[] {
    const obstacles: BoundingBox[] = [];
    const componentSize = 40;

    for (const comp of components) {
        if (excludeIds.includes(comp.id)) continue;

        obstacles.push({
            minX: comp.x - componentSize / 2,
            minY: comp.y - componentSize / 2,
            maxX: comp.x + componentSize / 2,
            maxY: comp.y + componentSize / 2,
            componentId: comp.id
        });
    }

    return obstacles;
}

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
 * 根據方向計算延伸點位置
 */
function getExtensionPoint(x: number, y: number, dir: Direction, distance: number): Point {
    switch (dir) {
        case 'N': return { x, y: y - distance };
        case 'S': return { x, y: y + distance };
        case 'E': return { x: x + distance, y };
        case 'W': return { x: x - distance, y };
        default: return { x, y };
    }
}

/**
 * 智慧正交路由 - 主函數
 */
export function smartOrthogonalRoute(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    components: CircuitComponent[],
    existingWireSegments: WireSegment[],
    gridSize: number,
    canvasSize: { width: number; height: number } = { width: 2000, height: 2000 },
    options: {
        startComponentId?: string;
        endComponentId?: string;
        startPortOffset?: { x: number; y: number };
        endPortOffset?: { x: number; y: number };
        startRotation?: number;
        endRotation?: number;
    } = {}
): number[] {
    const obstacles = buildObstaclesFromComponents(
        components,
        [options.startComponentId, options.endComponentId].filter(Boolean) as string[]
    );

    const ctx: RoutingContext = {
        gridSize,
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        obstacles,
        existingWires: existingWireSegments,
        turnPenalty: 2.0,
        overlapPenalty: 5.0
    };

    // 計算端點出口方向
    const startDir = options.startPortOffset
        ? getPortExitDirection(options.startPortOffset.x, options.startPortOffset.y, options.startRotation ?? 0)
        : 'NONE' as Direction;

    const endDir = options.endPortOffset
        ? getPortExitDirection(options.endPortOffset.x, options.endPortOffset.y, options.endRotation ?? 0)
        : 'NONE' as Direction;

    // 計算延伸點 - 線路必須從端點沿著正確方向先延伸一段距離
    const extensionDistance = gridSize;
    const startExtPoint = startDir !== 'NONE'
        ? getExtensionPoint(startX, startY, startDir, extensionDistance)
        : { x: startX, y: startY };
    const endExtPoint = endDir !== 'NONE'
        ? getExtensionPoint(endX, endY, endDir, extensionDistance)
        : { x: endX, y: endY };

    // 對齊到網格
    startExtPoint.x = snapToGrid(startExtPoint.x, gridSize);
    startExtPoint.y = snapToGrid(startExtPoint.y, gridSize);
    endExtPoint.x = snapToGrid(endExtPoint.x, gridSize);
    endExtPoint.y = snapToGrid(endExtPoint.y, gridSize);

    // 從延伸點開始進行 A* 路徑規劃
    let path = aStarOrthogonal(
        startExtPoint,
        endExtPoint,
        ctx,
        startDir,
        oppositeDirection(endDir)
    );

    path = simplifyPath(path);
    path = assignLane(path, existingWireSegments, gridSize);

    // 組裝最終路徑：起點 -> 延伸點 -> A* 路徑 -> 延伸點 -> 終點
    const points: number[] = [];

    // 始終從實際起點開始
    points.push(startX, startY);

    // 如果有延伸點且與起點不同，加入延伸點
    if (startDir !== 'NONE' && (startExtPoint.x !== startX || startExtPoint.y !== startY)) {
        // 避免重複加入與 A* 路徑第一個點相同的點
        if (path.length > 0 && path[0] && (path[0].x !== startExtPoint.x || path[0].y !== startExtPoint.y)) {
            points.push(startExtPoint.x, startExtPoint.y);
        }
    }

    // 加入 A* 計算的路徑（跳過第一個點，因為它是延伸點）
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        if (!p) continue;
        // 避免加入與最後一個點相同的點
        if (points.length >= 2) {
            const lastX = points[points.length - 2];
            const lastY = points[points.length - 1];
            if (lastX === p.x && lastY === p.y) continue;
        }
        points.push(p.x, p.y);
    }

    // 如果有結束延伸點且與終點不同，確保經過延伸點
    if (endDir !== 'NONE' && (endExtPoint.x !== endX || endExtPoint.y !== endY)) {
        const lastX = points[points.length - 2];
        const lastY = points[points.length - 1];
        if (lastX !== endExtPoint.x || lastY !== endExtPoint.y) {
            points.push(endExtPoint.x, endExtPoint.y);
        }
    }

    // 確保以實際終點結束
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    if (lastX !== endX || lastY !== endY) {
        points.push(endX, endY);
    }

    return points;
}
