/**
 * KonvaRenderer.ts
 * Konva 繪製管理類
 * 負責元件和導線的繪製邏輯
 */

import Konva from 'konva';
import type { CircuitComponent, Wire } from '@/types/circuit';
import { drawComponentShape } from '@/components/workspace/renderers/componentRenderers';
import { getRotatedPortPosition } from '@/lib/geometryUtils';
import { smartOrthogonalRoute, buildExistingWireSegments } from '@/lib/smartRouter';
import { KonvaNodeManager } from './KonvaNodeManager';

export class KonvaRenderer {
    private nodeManager: KonvaNodeManager;

    constructor(nodeManager: KonvaNodeManager) {
        this.nodeManager = nodeManager;
    }

    /**
     * 繪製導線
     * @param isSelected 是否被選中
     * @param onWireClick 導線點擊回調
     */
    public drawWire(
        wire: Wire,
        components: CircuitComponent[],
        wires: Wire[],
        gridSize: number,
        canvasSize: { width: number; height: number },
        isSelected: boolean = false,
        onWireClick?: (wireId: string) => void
    ): Konva.Group {
        const wireGroup = new Konva.Group({ id: wire.id });

        const fromComp = components.find((c) => c.id === wire.fromComponentId);
        const toComp = components.find((c) => c.id === wire.toComponentId);

        if (!fromComp || !toComp) {
            console.warn('Wire references non-existent component');
            return wireGroup;
        }

        const fromPort = fromComp.ports.find((p) => p.id === wire.fromPortId);
        const toPort = toComp.ports.find((p) => p.id === wire.toPortId);

        if (!fromPort || !toPort) {
            console.warn('Wire references non-existent port');
            return wireGroup;
        }

        // 計算旋轉後的端點位置
        const startPos = getRotatedPortPosition(
            fromComp.x,
            fromComp.y,
            fromPort.offsetX,
            fromPort.offsetY,
            fromComp.rotation
        );
        const endPos = getRotatedPortPosition(
            toComp.x,
            toComp.y,
            toPort.offsetX,
            toPort.offsetY,
            toComp.rotation
        );

        const startX = startPos.x;
        const startY = startPos.y;
        const endX = endPos.x;
        const endY = endPos.y;

        // 建立已存在導線段（排除當前導線）
        const existingSegments = buildExistingWireSegments(wires, wire.id);

        // 使用智慧路由引擎
        const points = smartOrthogonalRoute(
            startX, startY,
            endX, endY,
            components,
            existingSegments,
            gridSize,
            canvasSize,
            {
                startComponentId: wire.fromComponentId,
                endComponentId: wire.toComponentId,
                startPortOffset: { x: fromPort.offsetX, y: fromPort.offsetY },
                endPortOffset: { x: toPort.offsetX, y: toPort.offsetY },
                startRotation: fromComp.rotation,
                endRotation: toComp.rotation,
            }
        );

        const line = new Konva.Line({
            points,
            stroke: isSelected ? '#ffeb3b' : '#ffcc00',
            strokeWidth: isSelected ? 3 : 2,
            lineCap: 'round',
            lineJoin: 'round',
            hitStrokeWidth: 10,
        });

        // 節點圓點（連接點）
        const startDot = new Konva.Circle({
            x: startX,
            y: startY,
            radius: 4,
            fill: '#ffeb3b',
            stroke: '#000',
            strokeWidth: 1,
        });

        const endDot = new Konva.Circle({
            x: endX,
            y: endY,
            radius: 4,
            fill: '#ffeb3b',
            stroke: '#000',
            strokeWidth: 1,
        });

        wireGroup.add(line, startDot, endDot);

        // 添加點擊事件處理
        if (onWireClick) {
            wireGroup.on('click tap', (e) => {
                e.cancelBubble = true;
                onWireClick(wire.id);
            });
        }

        return wireGroup;
    }

    /**
     * 繪製所有元件
     */
    public renderAllComponents(
        components: CircuitComponent[],
        componentLayer: Konva.Layer,
        createComponentNode: (component: CircuitComponent) => Konva.Group
    ): void {
        this.nodeManager.clearComponentNodes();

        components.forEach((comp) => {
            const node = createComponentNode(comp);
            this.nodeManager.setComponentNode(comp.id, node);
            componentLayer.add(node);
        });

        componentLayer.batchDraw();
    }

    /**
     * 繪製所有導線
     */
    public renderAllWires(
        wires: Wire[],
        wireLayer: Konva.Layer,
        components: CircuitComponent[],
        gridSize: number,
        canvasSize: { width: number; height: number },
        selectedWireId?: string,
        onWireClick?: (wireId: string) => void
    ): void {
        this.nodeManager.clearWireNodes();

        wires.forEach((wire) => {
            const isSelected = wire.id === selectedWireId;
            const node = this.drawWire(wire, components, wires, gridSize, canvasSize, isSelected, onWireClick);
            this.nodeManager.setWireNode(wire.id, node);
            wireLayer.add(node);
        });

        wireLayer.batchDraw();
    }

    /**
     * 創建元件 Node
     */
    public createComponentNode(
        component: CircuitComponent,
        onPortClick: (componentId: string, portId: string, x: number, y: number) => void,
        onPortMouseEnter: (componentId: string, portId: string, portShape: Konva.Circle) => void,
        onPortMouseLeave: (componentId: string, portId: string, portShape: Konva.Circle) => void
    ): Konva.Group {
        const group = new Konva.Group({
            x: component.x,
            y: component.y,
            rotation: component.rotation,
            draggable: component.selected,
            id: component.id,
        });

        // 繪製元件形狀
        drawComponentShape(group, component);

        // 為每個端點添加點擊事件
        const portCircles = group.find('.port');
        if (portCircles && portCircles.length > 0) {
            portCircles.forEach((portShape, index) => {
                const port = component.ports[index];
                if (!port) return;

                const portGlobalPos = getRotatedPortPosition(
                    component.x,
                    component.y,
                    port.offsetX,
                    port.offsetY,
                    component.rotation
                );

                portShape.on('click tap', (e) => {
                    e.cancelBubble = true;
                    onPortClick(component.id, port.id, portGlobalPos.x, portGlobalPos.y);
                });

                portShape.on('mouseenter', () => {
                    onPortMouseEnter(component.id, port.id, portShape as Konva.Circle);
                });

                portShape.on('mouseleave', () => {
                    onPortMouseLeave(component.id, port.id, portShape as Konva.Circle);
                });
            });
        }

        return group;
    }

    /**
     * 更新導線選取狀態視覺
     */
    public updateWireSelection(wireId: string, isSelected: boolean, wireLayer: Konva.Layer): void {
        const wireGroup = this.nodeManager.getWireNode(wireId);
        if (!wireGroup) return;

        const line = wireGroup.findOne('Line') as Konva.Line | null;
        if (line) {
            line.stroke(isSelected ? '#ffeb3b' : '#ffcc00');
            line.strokeWidth(isSelected ? 3 : 2);
        }

        wireLayer.batchDraw();
    }
}
