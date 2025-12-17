/**
 * CircuitGraph.ts - 電路拓撲圖建構
 * 從 netlist 建立電路節點和連接關係
 */

import type { CircuitComponent, Wire } from '@/types/circuit';
import type { CircuitNode, ComponentStamp } from './SimulationTypes';
import { LED_VF_DEFAULT, type LEDColor } from './SimulationTypes';

/**
 * 電路圖類
 * 負責從元件和導線建立電路的拓撲結構
 */
export class CircuitGraph {
  private nodes: Map<string, CircuitNode> = new Map();
  private nodeIndexMap: Map<string, number> = new Map();
  private stamps: ComponentStamp[] = [];
  private voltageSourceCount = 0;

  /**
   * 從元件和導線建立電路圖
   */
  public build(components: CircuitComponent[], wires: Wire[]): void {
    this.clear();

    // 步驟 1: 建立 Union-Find 結構來追蹤連接的端點
    const portToNode = new Map<string, string>(); // portKey -> nodeId
    const nodeConnections = new Map<string, Set<string>>(); // nodeId -> Set of portKeys

    // 為每個端點初始化節點
    for (const comp of components) {
      for (const port of comp.ports) {
        const portKey = `${comp.id}:${port.id}`;
        portToNode.set(portKey, portKey); // 初始時每個端點是自己的節點
        nodeConnections.set(portKey, new Set([portKey]));
      }
    }

    // 步驟 2: 根據導線合併節點
    for (const wire of wires) {
      const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
      const toKey = `${wire.toComponentId}:${wire.toPortId}`;

      const fromNode = this.findRoot(portToNode, fromKey);
      const toNode = this.findRoot(portToNode, toKey);

      if (fromNode !== toNode) {
        // 合併節點
        const fromConns = nodeConnections.get(fromNode) || new Set();
        const toConns = nodeConnections.get(toNode) || new Set();
        const merged = new Set([...fromConns, ...toConns]);

        // 更新所有端點指向合併後的節點
        for (const portKey of merged) {
          portToNode.set(portKey, fromNode);
        }
        nodeConnections.set(fromNode, merged);
        nodeConnections.delete(toNode);
      }
    }

    // 步驟 3: 建立最終節點列表
    const uniqueNodes = new Set<string>();
    for (const [_, nodeId] of portToNode) {
      uniqueNodes.add(this.findRoot(portToNode, nodeId));
    }

    // 步驟 4: 識別接地節點
    let groundNodeId: string | null = null;
    for (const comp of components) {
      if (comp.type === 'ground') {
        const groundPortKey = `${comp.id}:${comp.ports[0]?.id}`;
        groundNodeId = this.findRoot(portToNode, groundPortKey);
        break;
      }
    }

    // 步驟 5: 建立節點並分配索引
    let nodeIndex = 0;
    for (const nodeId of uniqueNodes) {
      const connectedPorts = nodeConnections.get(nodeId) || new Set();
      const isGround = nodeId === groundNodeId;

      const node: CircuitNode = {
        id: nodeId,
        connectedPorts: Array.from(connectedPorts).map(portKey => {
          const [componentId, portId] = portKey.split(':');
          return { componentId: componentId!, portId: portId! };
        }),
        isGround,
      };

      this.nodes.set(nodeId, node);

      // 接地節點不需要索引（參考節點）
      if (!isGround) {
        this.nodeIndexMap.set(nodeId, nodeIndex++);
      }
    }

    // 步驟 6: 為每個元件建立印記
    for (const comp of components) {
      if (comp.type === 'ground') continue; // 接地不需要印記

      const stamp = this.createComponentStamp(comp, portToNode);
      if (stamp) {
        this.stamps.push(stamp);
      }
    }
  }

  /**
   * Union-Find: 找到根節點
   */
  private findRoot(portToNode: Map<string, string>, key: string): string {
    let current = key;
    while (portToNode.get(current) !== current) {
      current = portToNode.get(current)!;
    }
    // 路徑壓縮
    portToNode.set(key, current);
    return current;
  }

  /**
   * 為元件建立印記
   */
  private createComponentStamp(
    comp: CircuitComponent,
    portToNode: Map<string, string>
  ): ComponentStamp | null {
    const ports = comp.ports;
    if (ports.length < 2 && comp.type !== 'ground') {
      // 除接地外，需要至少兩個端點
      return null;
    }

    // 取得兩個端點的節點
    const port1Key = `${comp.id}:${ports[0]?.id}`;
    const port2Key = ports.length > 1 ? `${comp.id}:${ports[1]?.id}` : null;

    const node1Id = this.findRoot(portToNode, port1Key);
    const node2Id = port2Key ? this.findRoot(portToNode, port2Key) : null;

    const node1 = this.nodes.get(node1Id);
    const node2 = node2Id ? this.nodes.get(node2Id) : null;

    // 節點索引 (-1 表示接地)
    const node1Index = node1?.isGround ? -1 : (this.nodeIndexMap.get(node1Id) ?? -1);
    const node2Index = node2?.isGround ? -1 : (node2Id ? (this.nodeIndexMap.get(node2Id) ?? -1) : -1);

    // 取得元件值
    // LED-001 規範：LED 的 V_f 優先順序 vfOverride > ledColor lookup > 預設值
    let value: number;
    if (comp.type === 'led') {
      if (comp.vfOverride !== undefined) {
        value = comp.vfOverride;
      } else if (comp.ledColor && LED_VF_DEFAULT[comp.ledColor as LEDColor]) {
        value = LED_VF_DEFAULT[comp.ledColor as LEDColor];
      } else {
        value = comp.value ?? 2.0; // 預設 LED V_f = 2.0V
      }
    } else {
      value = comp.value ?? this.getDefaultValue(comp.type);
    }

    // 建立印記
    const stamp: ComponentStamp = {
      componentId: comp.id,
      type: comp.type,
      node1Index,
      node2Index,
      value,
    };

    // 電壓源和電感需要額外的電流變數
    // 二極體/LED 在改進的模型中也可能使用電壓源模型 (ON 狀態)
    if (
      comp.type === 'dc_source' ||
      comp.type === 'ac_source' ||
      comp.type === 'inductor' ||
      comp.type === 'diode' ||
      comp.type === 'led'
    ) {
      stamp.currentVarIndex = this.voltageSourceCount++;
    }

    return stamp;
  }

  /**
   * 取得元件的預設值
   */
  private getDefaultValue(type: string): number {
    switch (type) {
      case 'resistor': return 1000; // 1kΩ
      case 'dc_source': return 5; // 5V
      case 'ac_source': return 5; // 5V (RMS)
      case 'capacitor': return 100e-6; // 100μF
      case 'inductor': return 10e-3; // 10mH
      case 'diode': return 0.7; // 順向電壓降
      case 'led': return 2.0; // LED 順向電壓降
      default: return 0;
    }
  }

  /**
   * 清除圖
   */
  private clear(): void {
    this.nodes.clear();
    this.nodeIndexMap.clear();
    this.stamps = [];
    this.voltageSourceCount = 0;
  }

  // Getters
  public getNodes(): Map<string, CircuitNode> { return this.nodes; }
  public getNodeCount(): number { return this.nodeIndexMap.size; }
  public getVoltageSourceCount(): number { return this.voltageSourceCount; }
  public getStamps(): ComponentStamp[] { return this.stamps; }
  public getNodeIndex(nodeId: string): number { return this.nodeIndexMap.get(nodeId) ?? -1; }

  /**
   * 根據端點取得節點索引
   */
  public getNodeIndexByPort(componentId: string, portId: string): number {
    const portKey = `${componentId}:${portId}`;
    for (const [nodeId, node] of this.nodes) {
      if (node.connectedPorts.some(p => `${p.componentId}:${p.portId}` === portKey)) {
        return node.isGround ? -1 : (this.nodeIndexMap.get(nodeId) ?? -1);
      }
    }
    return -1;
  }
}
