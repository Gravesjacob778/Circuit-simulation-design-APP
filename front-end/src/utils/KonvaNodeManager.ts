/**
 * KonvaNodeManager.ts
 * Konva 節點管理類
 * 負責管理元件和導線的 Konva Node，包含創建、刪除、查詢
 */

import Konva from 'konva';

export class KonvaNodeManager {
    private componentNodes: Map<string, Konva.Group> = new Map();
    private wireNodes: Map<string, Konva.Group> = new Map();

    /**
     * 添加元件 Node
     */
    public setComponentNode(componentId: string, node: Konva.Group): void {
        this.componentNodes.set(componentId, node);
    }

    /**
     * 獲取元件 Node
     */
    public getComponentNode(componentId: string): Konva.Group | undefined {
        return this.componentNodes.get(componentId);
    }

    /**
     * 刪除元件 Node
     */
    public removeComponentNode(componentId: string): void {
        const node = this.componentNodes.get(componentId);
        if (node) {
            node.destroy();
            this.componentNodes.delete(componentId);
        }
    }

    /**
     * 清除所有元件 Node
     */
    public clearComponentNodes(): void {
        this.componentNodes.forEach((node) => node.destroy());
        this.componentNodes.clear();
    }

    /**
     * 添加導線 Node
     */
    public setWireNode(wireId: string, node: Konva.Group): void {
        this.wireNodes.set(wireId, node);
    }

    /**
     * 獲取導線 Node
     */
    public getWireNode(wireId: string): Konva.Group | undefined {
        return this.wireNodes.get(wireId);
    }

    /**
     * 刪除導線 Node
     */
    public removeWireNode(wireId: string): void {
        const node = this.wireNodes.get(wireId);
        if (node) {
            node.destroy();
            this.wireNodes.delete(wireId);
        }
    }

    /**
     * 清除所有導線 Node
     */
    public clearWireNodes(): void {
        this.wireNodes.forEach((node) => node.destroy());
        this.wireNodes.clear();
    }

    /**
     * 遍歷所有元件 Node
     */
    public forEachComponentNode(callback: (node: Konva.Group, componentId: string) => void): void {
        this.componentNodes.forEach((node, componentId) => {
            callback(node, componentId);
        });
    }

    /**
     * 遍歷所有導線 Node
     */
    public forEachWireNode(callback: (node: Konva.Group, wireId: string) => void): void {
        this.wireNodes.forEach((node, wireId) => {
            callback(node, wireId);
        });
    }

    /**
     * 獲取所有元件 Node Map
     */
    public getComponentNodesMap(): Map<string, Konva.Group> {
        return this.componentNodes;
    }

    /**
     * 獲取所有導線 Node Map
     */
    public getWireNodesMap(): Map<string, Konva.Group> {
        return this.wireNodes;
    }

    /**
     * 清除所有 Node
     */
    public clearAll(): void {
        this.clearComponentNodes();
        this.clearWireNodes();
    }
}
