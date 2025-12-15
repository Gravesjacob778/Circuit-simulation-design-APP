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
     */
    public getAllWirePathsWithDirection(
        components: CircuitComponent[],
        wires: Wire[],
        nodeManager: KonvaNodeManager | null
    ): CurrentFlowPath[] {
        const paths: CurrentFlowPath[] = [];
        if (!nodeManager) return paths;

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

        const visitedPorts = new Set<string>();
        const wireDirections = new Map<string, 1 | -1>();

        const traceCurrentPath = (
            componentId: string,
            portId: string,
            visitedWires: Set<string>
        ) => {
            const key = `${componentId}:${portId}`;
            if (visitedPorts.has(key)) return;
            visitedPorts.add(key);

            const connectedWires = wires.filter(
                (w) =>
                    (w.fromComponentId === componentId && w.fromPortId === portId) ||
                    (w.toComponentId === componentId && w.toPortId === portId)
            );

            for (const wire of connectedWires) {
                if (visitedWires.has(wire.id)) continue;
                visitedWires.add(wire.id);

                const isFromEnd =
                    wire.fromComponentId === componentId && wire.fromPortId === portId;
                const direction: 1 | -1 = isFromEnd ? 1 : -1;
                wireDirections.set(wire.id, direction);

                const nextComponentId = isFromEnd
                    ? wire.toComponentId
                    : wire.fromComponentId;
                const nextPortId = isFromEnd ? wire.toPortId : wire.fromPortId;

                const nextComponent = components.find((c) => c.id === nextComponentId);
                if (nextComponent) {
                    for (const port of nextComponent.ports) {
                        if (port.id !== nextPortId) {
                            traceCurrentPath(nextComponentId, port.id, visitedWires);
                        }
                    }
                }
            }
        };

        traceCurrentPath(primarySource.id, positivePort.id, new Set());

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
