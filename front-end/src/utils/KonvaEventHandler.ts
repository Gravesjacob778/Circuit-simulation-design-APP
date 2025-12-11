/**
 * KonvaEventHandler.ts
 * Konva 事件處理類
 * 負責 Stage 和元件的各種事件處理
 */

import Konva from 'konva';
import type { CircuitComponent } from '@/types/circuit';

export interface StageEventCallbacks {
    onStageClick?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageMouseMove?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageMouseDown?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageMouseUp?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageMouseLeave?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageWheel?: (e: Konva.KonvaEventObject<WheelEvent>) => void;
}

export interface ComponentEventCallbacks {
    onComponentClick?: (component: CircuitComponent, e: Konva.KonvaEventObject<MouseEvent>) => void;
    onComponentDragStart?: (component: CircuitComponent) => void;
    onComponentDragMove?: (component: CircuitComponent) => void;
    onComponentDragEnd?: (component: CircuitComponent) => void;
    onComponentMouseEnter?: (component: CircuitComponent) => void;
    onComponentMouseLeave?: (component: CircuitComponent) => void;
}

export interface PortEventCallbacks {
    onPortClick?: (componentId: string, portId: string, x: number, y: number) => void;
    onPortMouseEnter?: (componentId: string, portId: string, portShape: Konva.Circle) => void;
    onPortMouseLeave?: (componentId: string, portId: string, portShape: Konva.Circle) => void;
}

export class KonvaEventHandler {
    private stageCallbacks: StageEventCallbacks = {};
    private componentCallbacks: ComponentEventCallbacks = {};
    private portCallbacks: PortEventCallbacks = {};

    /**
     * 設置 Stage 事件回調
     */
    public setStageCallbacks(callbacks: StageEventCallbacks): void {
        this.stageCallbacks = callbacks;
    }

    /**
     * 設置元件事件回調
     */
    public setComponentCallbacks(callbacks: ComponentEventCallbacks): void {
        this.componentCallbacks = callbacks;
    }

    /**
     * 設置端點事件回調
     */
    public setPortCallbacks(callbacks: PortEventCallbacks): void {
        this.portCallbacks = callbacks;
    }

    /**
     * 綁定 Stage 事件
     */
    public bindStageEvents(stage: Konva.Stage): void {
        if (this.stageCallbacks.onStageClick) {
            stage.on('click', this.stageCallbacks.onStageClick);
        }
        if (this.stageCallbacks.onStageMouseMove) {
            stage.on('mousemove', this.stageCallbacks.onStageMouseMove);
        }
        if (this.stageCallbacks.onStageMouseDown) {
            stage.on('mousedown', this.stageCallbacks.onStageMouseDown);
        }
        if (this.stageCallbacks.onStageMouseUp) {
            stage.on('mouseup', this.stageCallbacks.onStageMouseUp);
        }
        if (this.stageCallbacks.onStageMouseLeave) {
            stage.on('mouseleave', this.stageCallbacks.onStageMouseLeave);
        }
        if (this.stageCallbacks.onStageWheel) {
            stage.on('wheel', this.stageCallbacks.onStageWheel);
        }
    }

    /**
     * 綁定元件事件
     */
    public bindComponentEvents(componentGroup: Konva.Group, component: CircuitComponent): void {
        if (this.componentCallbacks.onComponentClick) {
            componentGroup.on('click tap', (e) => {
                // 只有點擊非端點區域才觸發
                if ((e.target as Konva.Node).name() !== 'port') {
                    this.componentCallbacks.onComponentClick?.(component, e);
                }
            });
        }

        if (this.componentCallbacks.onComponentDragStart) {
            componentGroup.on('dragstart', () => {
                this.componentCallbacks.onComponentDragStart?.(component);
            });
        }

        if (this.componentCallbacks.onComponentDragMove) {
            componentGroup.on('dragmove', () => {
                this.componentCallbacks.onComponentDragMove?.(component);
            });
        }

        if (this.componentCallbacks.onComponentDragEnd) {
            componentGroup.on('dragend', () => {
                this.componentCallbacks.onComponentDragEnd?.(component);
            });
        }

        if (this.componentCallbacks.onComponentMouseEnter) {
            componentGroup.on('mouseenter', () => {
                this.componentCallbacks.onComponentMouseEnter?.(component);
            });
        }

        if (this.componentCallbacks.onComponentMouseLeave) {
            componentGroup.on('mouseleave', () => {
                this.componentCallbacks.onComponentMouseLeave?.(component);
            });
        }
    }

    /**
     * 綁定端點事件
     */
    public bindPortEvents(
        portShape: Konva.Circle,
        componentId: string,
        portId: string,
        portX: number,
        portY: number
    ): void {
        if (this.portCallbacks.onPortClick) {
            portShape.on('click tap', (e) => {
                e.cancelBubble = true;
                this.portCallbacks.onPortClick?.(componentId, portId, portX, portY);
            });
        }

        if (this.portCallbacks.onPortMouseEnter) {
            portShape.on('mouseenter', () => {
                this.portCallbacks.onPortMouseEnter?.(componentId, portId, portShape);
            });
        }

        if (this.portCallbacks.onPortMouseLeave) {
            portShape.on('mouseleave', () => {
                this.portCallbacks.onPortMouseLeave?.(componentId, portId, portShape);
            });
        }
    }

    /**
     * 解除 Stage 事件綁定
     */
    public unbindStageEvents(stage: Konva.Stage): void {
        stage.off('click');
        stage.off('mousemove');
        stage.off('mousedown');
        stage.off('mouseup');
        stage.off('mouseleave');
        stage.off('wheel');
    }

    /**
     * 清除所有回調
     */
    public clearCallbacks(): void {
        this.stageCallbacks = {};
        this.componentCallbacks = {};
        this.portCallbacks = {};
    }
}
