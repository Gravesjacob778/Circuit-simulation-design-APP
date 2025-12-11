/**
 * KonvaAnimationManager.ts
 * Konva 動畫管理類
 * 負責電流流動動畫的初始化、播放、停止
 */

import Konva from 'konva';

interface ParticleData {
    points: number[];
    length: number;
    offset: number;
    direction: 1 | -1;
}

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
        if (this.currentFlowLayer) {
            this.currentFlowLayer.destroyChildren();
        }
        this.particles.length = 0;
    }

    /**
     * 創建粒子
     */
    public createParticles(paths: Array<{
        points: number[];
        length: number;
        direction: 1 | -1;
    }>): void {
        if (!this.currentFlowLayer) return;

        this.clearParticles();

        const particleSpacing = 30;

        paths.forEach((path) => {
            const numParticles = Math.max(2, Math.floor(path.length / particleSpacing));

            for (let i = 0; i < numParticles; i++) {
                const particle = new Konva.Circle({
                    radius: 3,
                    fill: '#00ffff',
                    shadowColor: '#00ffff',
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
     * 啟動動畫
     */
    public start(getPositionOnPath: (points: number[], distance: number) => { x: number; y: number }): void {
        if (!this.currentFlowLayer) return;

        this.stop(); // 停止之前的動畫

        const speed = 60; // 像素/秒

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
                const pos = getPositionOnPath(pathData.points, pathData.offset);
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
        if (this.animation) {
            this.animation.stop();
            this.animation = null;
        }

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
    public reinitializeParticles(paths: Array<{
        points: number[];
        length: number;
        direction: 1 | -1;
    }>): void {
        if (this.isRunning()) {
            this.createParticles(paths);
        }
    }
}
