/**
 * Type definitions for circuit components and netlists
 */

// Component type enumeration
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
    | 'voltmeter'
    | 'logic_and'
    | 'logic_or';

// AC Source waveform types
export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';

// Port definition
export interface Port {
    id: string;
    name: string; // e.g., '+', '-', 'in', 'out'
    offsetX: number; // X offset relative to component center
    offsetY: number; // Y offset relative to component center
}

// Circuit component
export interface CircuitComponent {
    id: string;
    type: ComponentType;
    x: number;
    y: number;
    rotation: number; // Rotation angle (0, 90, 180, 270)
    value?: number; // Value (e.g., resistance, capacitance)
    unit?: string; // Unit (Ω, F, H, V, A)
    label?: string; // Display label (R1, C1, etc.)
    ports: Port[];
    selected?: boolean;
    current?: number; // Runtime current (Amps) for visual feedback (e.g., LED glowing)
    // LED-specific properties (LED-001 Rule)
    ledColor?: 'Red' | 'Green' | 'Blue' | 'White'; // LED color for V_f lookup
    vfOverride?: number; // User-defined forward voltage (V), takes precedence over ledColor
    // AC Source-specific properties (for transient analysis)
    frequency?: number; // Frequency in Hz (default: 60Hz)
    phase?: number; // Phase angle in radians (default: 0)
    waveformType?: WaveformType; // Waveform shape (default: 'sine')
    // Logic gate properties (for digital simulation)
    logicInputA?: boolean; // Input A state (HIGH=true, LOW=false)
    logicInputB?: boolean; // Input B state (HIGH=true, LOW=false)
    logicOutput?: boolean; // Output state (computed from inputs)
}

// Wire connection
export interface Wire {
    id: string;
    fromComponentId: string;
    fromPortId: string;
    toComponentId: string;
    toPortId: string;
    points: { x: number; y: number }[]; // Wire path points
}

// Net node (Electrical node)
export interface NetNode {
    id: string;
    name: string; // e.g., 'N001', 'GND', 'VCC'
    connectedPorts: { componentId: string; portId: string }[];
}

// Netlist - Data structure for the entire circuit
export interface Netlist {
    components: CircuitComponent[];
    wires: Wire[];
    nodes: NetNode[];
}

// Simulation result data
export interface SimulationData {
    time: number[]; // Time axis
    signals: {
        name: string; // e.g., 'V(N001)', 'I(R1)'
        values: number[];
        unit: string;
        color?: string;
    }[];
}

// Example circuit
export interface ExampleCircuit {
    id: string;
    title: string;
    description: string;
    thumbnail?: string;
    netlist: Netlist;
}

// Component definition (for toolbar)
export interface ComponentDefinition {
    type: ComponentType;
    label: string;
    icon: string; // SVG path or icon name
    defaultValue?: number;
    defaultUnit?: string;
    ports: Omit<Port, 'id'>[]; // Port definition without id (id generated on creation)
}
