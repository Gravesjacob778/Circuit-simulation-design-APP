/**
 * 電路元件與網表的型別定義
 */

// 元件類型枚舉
export type ComponentType =
    | 'resistor'
    | 'capacitor'
    | 'inductor'
    | 'dc_source'
    | 'ac_source'
    | 'ground'
    | 'opamp'
    | 'diode'
    | 'transistor_npn'
    | 'transistor_pnp'
    | 'switch'
    | 'led'
    | 'ammeter'
    | 'voltmeter';

// 端點 (Node) 定義
export interface Port {
    id: string;
    name: string; // e.g., '+', '-', 'in', 'out'
    offsetX: number; // 相對於元件中心的 X 偏移
    offsetY: number; // 相對於元件中心的 Y 偏移
}

// 電路元件
export interface CircuitComponent {
    id: string;
    type: ComponentType;
    x: number;
    y: number;
    rotation: number; // 旋轉角度 (0, 90, 180, 270)
    value?: number; // 數值 (如電阻值、電容值)
    unit?: string; // 單位 (Ω, F, H, V, A)
    label?: string; // 顯示標籤 (R1, C1, etc.)
    ports: Port[];
    selected?: boolean;
}

// 導線連接
export interface Wire {
    id: string;
    fromComponentId: string;
    fromPortId: string;
    toComponentId: string;
    toPortId: string;
    points: { x: number; y: number }[]; // 導線路徑點
}

// 節點 (電氣節點)
export interface NetNode {
    id: string;
    name: string; // e.g., 'N001', 'GND', 'VCC'
    connectedPorts: { componentId: string; portId: string }[];
}

// 網表 (Netlist) - 整個電路的資料結構
export interface Netlist {
    components: CircuitComponent[];
    wires: Wire[];
    nodes: NetNode[];
}

// 模擬結果數據
export interface SimulationData {
    time: number[]; // 時間軸
    signals: {
        name: string; // e.g., 'V(N001)', 'I(R1)'
        values: number[];
        unit: string;
        color?: string;
    }[];
}

// 範例電路
export interface ExampleCircuit {
    id: string;
    title: string;
    description: string;
    thumbnail?: string;
    netlist: Netlist;
}

// 元件定義（用於工具列）
export interface ComponentDefinition {
    type: ComponentType;
    label: string;
    icon: string; // SVG path 或 icon name
    defaultValue?: number;
    defaultUnit?: string;
    ports: Omit<Port, 'id'>[]; // 不含 id 的 port 定義，id 在建立時生成
}
