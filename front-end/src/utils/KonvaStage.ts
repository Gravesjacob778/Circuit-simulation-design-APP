/**
 * KonvaStage.ts
 * Konva Stage 和 Layer 管理類
 * 負責 Konva 舞台及各圖層的初始化、管理和銷毀
 */

import Konva from 'konva';

// 關閉 Konva 的層數警告（本應用刻意使用 6 層以分離不同繪圖職責）
Konva.showWarnings = false;

export class KonvaStage {
    private stage: Konva.Stage | null = null;
    private gridLayer: Konva.Layer | null = null;
    private guideLayer: Konva.Layer | null = null;
    private wireLayer: Konva.Layer | null = null;
    private currentFlowLayer: Konva.Layer | null = null;
    private componentLayer: Konva.Layer | null = null;
    private tempLayer: Konva.Layer | null = null;

    /**
     * 初始化 Stage 和所有圖層
     */
    public initialize(container: HTMLDivElement, width: number, height: number): void {
        // 創建 Stage
        this.stage = new Konva.Stage({
            container: container,
            width: width,
            height: height,
        });

        // 建立圖層（由下往上）
        this.gridLayer = new Konva.Layer();
        this.guideLayer = new Konva.Layer();
        this.wireLayer = new Konva.Layer();
        this.currentFlowLayer = new Konva.Layer();
        this.componentLayer = new Konva.Layer();
        this.tempLayer = new Konva.Layer();

        // 加入到 Stage
        this.stage.add(this.gridLayer);
        this.stage.add(this.guideLayer);
        this.stage.add(this.wireLayer);
        this.stage.add(this.currentFlowLayer);
        this.stage.add(this.componentLayer);
        this.stage.add(this.tempLayer);
    }

    /**
     * 獲取 Stage
     */
    public getStage(): Konva.Stage {
        if (!this.stage) throw new Error('Stage not initialized');
        return this.stage;
    }

    /**
     * 獲取網格圖層
     */
    public getGridLayer(): Konva.Layer {
        if (!this.gridLayer) throw new Error('Grid layer not initialized');
        return this.gridLayer;
    }

    /**
     * 獲取輔助線圖層
     */
    public getGuideLayer(): Konva.Layer {
        if (!this.guideLayer) throw new Error('Guide layer not initialized');
        return this.guideLayer;
    }

    /**
     * 獲取導線圖層
     */
    public getWireLayer(): Konva.Layer {
        if (!this.wireLayer) throw new Error('Wire layer not initialized');
        return this.wireLayer;
    }

    /**
     * 獲取電流流動圖層
     */
    public getCurrentFlowLayer(): Konva.Layer {
        if (!this.currentFlowLayer) throw new Error('Current flow layer not initialized');
        return this.currentFlowLayer;
    }

    /**
     * 獲取元件圖層
     */
    public getComponentLayer(): Konva.Layer {
        if (!this.componentLayer) throw new Error('Component layer not initialized');
        return this.componentLayer;
    }

    /**
     * 獲取臨時圖層
     */
    public getTempLayer(): Konva.Layer {
        if (!this.tempLayer) throw new Error('Temp layer not initialized');
        return this.tempLayer;
    }

    /**
     * 獲取所有圖層
     */
    public getLayers(): {
        grid: Konva.Layer;
        guide: Konva.Layer;
        wire: Konva.Layer;
        currentFlow: Konva.Layer;
        component: Konva.Layer;
        temp: Konva.Layer;
    } {
        return {
            grid: this.getGridLayer(),
            guide: this.getGuideLayer(),
            wire: this.getWireLayer(),
            currentFlow: this.getCurrentFlowLayer(),
            component: this.getComponentLayer(),
            temp: this.getTempLayer(),
        };
    }

    /**
     * 調整 Stage 大小
     */
    public resize(width: number, height: number): void {
        if (!this.stage) return;
        this.stage.width(width);
        this.stage.height(height);
    }

    /**
     * 繪製所有圖層
     */
    public draw(): void {
        this.stage?.batchDraw();
    }

    /**
     * 銷毀 Stage
     */
    public destroy(): void {
        this.stage?.destroy();
        this.stage = null;
        this.gridLayer = null;
        this.guideLayer = null;
        this.wireLayer = null;
        this.currentFlowLayer = null;
        this.componentLayer = null;
        this.tempLayer = null;
    }

    /**
     * 檢查是否已初始化
     */
    public isInitialized(): boolean {
        return this.stage !== null;
    }
}
