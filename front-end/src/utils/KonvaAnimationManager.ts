/**
 * KonvaAnimationManager.ts
 * Konva 動畫管理類
 * 負責電流流動動畫的初始化、播放、停止
 */

import Konva from 'konva';
import type { CircuitComponent, Wire } from '@/types/circuit';
import { KonvaNodeManager } from './KonvaNodeManager';

interface ParticleData {
    points: number[];
    length: number;
    offset: number;
    direction: 1 | -1;
}

export type CurrentFlowPath = {
    points: number[];
    length: number;
    direction: 1 | -1;
};

export class KonvaAnimationManager {
    private animation: Konva.Animation | null = null;
    private particles: Konva.Circle[] = [];
    private currentFlowLayer: Konva.Layer | null = null;

    /**
     * 初始化動畫管理器
     */
    public initialize(currentFlowLayer: Konva.Layer): void {
        this.currentFlowLayer = currentFlowLayer;
    }

    /**
     * 清除現有粒子
     */
    private clearParticles(): void {
        // 只清除本管理器建立的粒子，避免清掉同圖層上的其他元素（例如模擬文字標籤）
        for (const particle of this.particles) {
            try {
                particle.destroy();
            } catch {
                // ignore
            }
        }
        this.particles.length = 0;
        this.currentFlowLayer?.batchDraw();
    }

    /**
     * 計算導線路徑總長度
     */
    private calculatePathLength(points: number[]): number {
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
     */
    private getPositionOnPath(points: number[], distance: number): { x: number; y: number } {
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

        return {
            x: points[points.length - 2] ?? 0,
            y: points[points.length - 1] ?? 0,
        };
    }

    /**
     * 取得所有導線的路徑點（包含方向資訊）
     * 不依賴 Vue/Store，所有資料由參數傳入。
     * @param components 電路元件列表
     * @param wires 導線列表
     * @param nodeManager Konva 節點管理器
     * @param branchCurrents 各元件電流值（來自模擬結果）
     */
    public getAllWirePathsWithDirection(
        components: CircuitComponent[],
        wires: Wire[],
        nodeManager: KonvaNodeManager | null,
        branchCurrents?: Map<string, number>
    ): CurrentFlowPath[] {
        const paths: CurrentFlowPath[] = [];
        if (!nodeManager) return paths;

        // 建立預設路徑（所有方向為 1）
        const buildDefaultPaths = (): CurrentFlowPath[] => {
            nodeManager.forEachWireNode((wireGroup, wireId) => {
                const wire = wires.find((w) => w.id === wireId);
                if (!wire) return;

                const line = wireGroup.findOne('Line') as Konva.Line | null;
                if (!line) return;

                const points = line.points();
                const length = this.calculatePathLength(points);
                if (length <= 0) return;

                paths.push({
                    points,
                    length,
                    direction: 1,
                });
            });
            return paths;
        };

        const powerSources = components.filter(
            (c) => c.type === 'dc_source' || c.type === 'ac_source'
        );

        if (powerSources.length === 0) {
            return buildDefaultPaths();
        }

        const primarySource = powerSources[0]!;
        const positivePort = primarySource.ports.find((p) => p.name === '+');

        if (!positivePort) {
            return buildDefaultPaths();
        }

        // 建立端點到節點的映射（Union-Find 概念）
        // 同一個電氣節點上的所有端點應該有相同的電流流向
        const portToNode = new Map<string, string>();

        // 初始化：每個端點是自己的節點
        for (const comp of components) {
            for (const port of comp.ports) {
                const portKey = `${comp.id}:${port.id}`;
                portToNode.set(portKey, portKey);
            }
        }

        // 根據導線合併節點
        const findRoot = (key: string): string => {
            let current = key;
            while (portToNode.get(current) !== current) {
                current = portToNode.get(current)!;
            }
            portToNode.set(key, current);
            return current;
        };

        for (const wire of wires) {
            const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
            const toKey = `${wire.toComponentId}:${wire.toPortId}`;
            const fromRoot = findRoot(fromKey);
            const toRoot = findRoot(toKey);
            if (fromRoot !== toRoot) {
                portToNode.set(toRoot, fromRoot);
            }
        }

        // 節點電流流向：記錄電流從哪個方向進入/離開每個節點
        // nodeFlowDirection: nodeId -> { incomingFromComponent, outgoingToComponent }
        const nodeFlowDirection = new Map<string, 1 | -1>();
        const wireDirections = new Map<string, 1 | -1>();
        const visitedNodes = new Set<string>();

        // 從電源正極開始 BFS 追蹤電流路徑
        const startPortKey = `${primarySource.id}:${positivePort.id}`;
        const startNodeId = findRoot(startPortKey);

        // 使用 BFS 從電源正極向外傳播
        const queue: Array<{ nodeId: string; incomingDirection: 1 | -1 }> = [];
        queue.push({ nodeId: startNodeId, incomingDirection: 1 }); // 電流從正極「流出」
        visitedNodes.add(startNodeId);
        nodeFlowDirection.set(startNodeId, 1);

        while (queue.length > 0) {
            const { nodeId: currentNodeId, incomingDirection } = queue.shift()!;

            // 找出此節點連接的所有導線
            for (const wire of wires) {
                const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
                const toKey = `${wire.toComponentId}:${wire.toPortId}`;
                const fromNode = findRoot(fromKey);
                const toNode = findRoot(toKey);

                let nextNodeId: string | null = null;
                let wireDirection: 1 | -1 = 1;

                if (fromNode === currentNodeId && !visitedNodes.has(toNode)) {
                    // 電流從 from 端流向 to 端
                    nextNodeId = toNode;
                    wireDirection = incomingDirection; // 維持傳入的方向
                } else if (toNode === currentNodeId && !visitedNodes.has(fromNode)) {
                    // 電流從 to 端流向 from 端（反向）
                    nextNodeId = fromNode;
                    wireDirection = (incomingDirection === 1 ? -1 : 1) as 1 | -1;
                }

                if (nextNodeId !== null && !wireDirections.has(wire.id)) {
                    wireDirections.set(wire.id, wireDirection);

                    // 檢查下一個節點是否穿過元件
                    // 電流穿過元件時，方向取決於元件電流的正負
                    const nextComponent = components.find(c => {
                        const ports = c.ports;
                        for (const port of ports) {
                            const portKey = `${c.id}:${port.id}`;
                            if (findRoot(portKey) === nextNodeId) {
                                return true;
                            }
                        }
                        return false;
                    });

                    let nextDirection = wireDirection;
                    if (nextComponent && branchCurrents) {
                        const componentCurrent = branchCurrents.get(nextComponent.id);
                        if (componentCurrent !== undefined) {
                            // 如果電流為負，表示實際流向與定義方向相反
                            nextDirection = componentCurrent >= 0 ? wireDirection : ((wireDirection === 1 ? -1 : 1) as 1 | -1);
                        }
                    }

                    if (!visitedNodes.has(nextNodeId)) {
                        visitedNodes.add(nextNodeId);
                        nodeFlowDirection.set(nextNodeId, nextDirection);
                        queue.push({ nodeId: nextNodeId, incomingDirection: nextDirection });
                    }
                }
            }
        }

        // 處理未被 BFS 訪問到的導線（可能是孤立的分支）
        for (const wire of wires) {
            if (!wireDirections.has(wire.id)) {
                wireDirections.set(wire.id, 1);
            }
        }

        // 建立最終路徑
        nodeManager.forEachWireNode((wireGroup, wireId) => {
            const wire = wires.find((w) => w.id === wireId);
            if (!wire) return;

            const line = wireGroup.findOne('Line') as Konva.Line | null;
            if (!line) return;

            const points = line.points();
            const length = this.calculatePathLength(points);
            if (length <= 0) return;

            paths.push({
                points,
                length,
                direction: wireDirections.get(wireId) ?? 1,
            });
        });

        return paths;
    }

    /**
     * 創建粒子
     */
    public createParticles(paths: CurrentFlowPath[]): void {
        if (!this.currentFlowLayer) return;

        this.clearParticles();

        const particleSpacing = 30;

        paths.forEach((path) => {
            const numParticles = Math.max(2, Math.floor(path.length / particleSpacing));

            for (let i = 0; i < numParticles; i++) {
                const particle = new Konva.Circle({
                    radius: 3,
                    fill: '#00ff99ff',
                    shadowColor: '#00ff91ff',
                    shadowBlur: 8,
                    shadowOpacity: 0.8,
                    opacity: 0.9,
                });

                // 儲存路徑資訊到粒子
                (particle as any).__pathData = {
                    points: path.points,
                    length: path.length,
                    offset: (i / numParticles) * path.length,
                    direction: path.direction,
                } as ParticleData;

                this.particles.push(particle);
                if (this.currentFlowLayer) {
                    this.currentFlowLayer.add(particle);
                }
            }
        });

        this.currentFlowLayer.batchDraw();
    }

    /**
     * 只停止動畫本身，不清除粒子
     */
    private stopAnimationOnly(): void {
        if (this.animation) {
            this.animation.stop();
            this.animation = null;
        }
    }

    /**
     * 啟動動畫
     */
    public start(
        getPositionOnPath?: (points: number[], distance: number) => { x: number; y: number }
    ): void {
        if (!this.currentFlowLayer) return;

        this.stopAnimationOnly(); // 停止之前的動畫但保留粒子

        const speed = 60; // 像素/秒
        const positionFn = getPositionOnPath ?? this.getPositionOnPath.bind(this);

        this.animation = new Konva.Animation((frame) => {
            if (!frame) return;

            const elapsedMs = frame.timeDiff;
            const distanceMoved = (speed * elapsedMs) / 1000;

            this.particles.forEach((particle) => {
                const pathData = (particle as any).__pathData as ParticleData;
                if (!pathData) return;

                // 根據方向更新偏移
                if (pathData.direction === 1) {
                    pathData.offset = (pathData.offset + distanceMoved) % pathData.length;
                } else {
                    pathData.offset = pathData.offset - distanceMoved;
                    if (pathData.offset < 0) {
                        pathData.offset += pathData.length;
                    }
                }

                // 計算新位置
                const pos = positionFn(pathData.points, pathData.offset);
                particle.x(pos.x);
                particle.y(pos.y);
            });
        }, this.currentFlowLayer);

        this.animation.start();
    }

    /**
     * 停止動畫
     */
    public stop(): void {
        this.stopAnimationOnly();
        this.clearParticles();
    }

    /**
     * 檢查動畫是否正在運行
     */
    public isRunning(): boolean {
        return this.animation !== null;
    }

    /**
     * 銷毀動畫管理器
     */
    public destroy(): void {
        this.stop();
        this.currentFlowLayer = null;
    }

    /**
     * 重新初始化粒子（導線變化時調用）
     */
    public reinitializeParticles(paths: CurrentFlowPath[]): void {
        if (this.isRunning()) {
            this.createParticles(paths);
        }
    }
}
