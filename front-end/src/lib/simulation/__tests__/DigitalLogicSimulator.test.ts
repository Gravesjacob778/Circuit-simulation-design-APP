/**
 * DigitalLogicSimulator 單元測試
 * 測試邏輯閘模擬功能
 */

import { describe, it, expect } from 'vitest';
import { DigitalLogicSimulator, LogicLevel } from '../DigitalLogicSimulator';
import type { CircuitComponent, Wire } from '@/types/circuit';

describe('DigitalLogicSimulator', () => {
    const digitalSimulator = new DigitalLogicSimulator();

    /**
     * 建立測試用元件的輔助函數
     */
    function createComponent(
        id: string,
        type: string,
        value?: number,
        ports: { name: string }[] = [{ name: '1' }, { name: '2' }]
    ): CircuitComponent {
        return {
            id,
            type: type as any,
            x: 0,
            y: 0,
            rotation: 0,
            value,
            ports: ports.map((p, i) => ({
                id: `${id}-p${i}`,
                name: p.name,
                offsetX: 0,
                offsetY: i === 0 ? -40 : 40,
            })),
        };
    }

    function createLogicGate(
        id: string,
        type: 'logic_and' | 'logic_or' | 'logic_not' | 'logic_nand' | 'logic_nor' | 'logic_xor'
    ): CircuitComponent {
        const ports = type === 'logic_not'
            ? [{ name: 'A' }, { name: 'Y' }]
            : [{ name: 'A' }, { name: 'B' }, { name: 'Y' }];

        return {
            id,
            type: type as any,
            x: 0,
            y: 0,
            rotation: 0,
            ports: ports.map((p, i) => ({
                id: `${id}-p${i}`,
                name: p.name,
                offsetX: 0,
                offsetY: i === 0 ? -40 : (i === 1 ? 0 : 40),
            })),
        };
    }

    function createWire(
        id: string,
        fromCompId: string,
        fromPortIndex: number,
        toCompId: string,
        toPortIndex: number
    ): Wire {
        return {
            id,
            fromComponentId: fromCompId,
            fromPortId: `${fromCompId}-p${fromPortIndex}`,
            toComponentId: toCompId,
            toPortId: `${toCompId}-p${toPortIndex}`,
            points: [],
        };
    }

    describe('isLogicGate', () => {
        it('should identify logic gate types', () => {
            expect(DigitalLogicSimulator.isLogicGate('logic_and')).toBe(true);
            expect(DigitalLogicSimulator.isLogicGate('logic_or')).toBe(true);
            expect(DigitalLogicSimulator.isLogicGate('logic_not')).toBe(true);
            expect(DigitalLogicSimulator.isLogicGate('logic_nand')).toBe(true);
            expect(DigitalLogicSimulator.isLogicGate('logic_nor')).toBe(true);
            expect(DigitalLogicSimulator.isLogicGate('logic_xor')).toBe(true);
        });

        it('should not identify non-gate types', () => {
            expect(DigitalLogicSimulator.isLogicGate('resistor')).toBe(false);
            expect(DigitalLogicSimulator.isLogicGate('dc_source')).toBe(false);
            expect(DigitalLogicSimulator.isLogicGate('ground')).toBe(false);
        });
    });

    describe('voltageToLogic', () => {
        it('should convert voltage to logic levels correctly', () => {
            // 高電壓 -> HIGH
            expect(digitalSimulator.voltageToLogic(5)).toBe(LogicLevel.HIGH);
            expect(digitalSimulator.voltageToLogic(3.3)).toBe(LogicLevel.HIGH);
            expect(digitalSimulator.voltageToLogic(2.5)).toBe(LogicLevel.HIGH);

            // 低電壓 -> LOW
            expect(digitalSimulator.voltageToLogic(0)).toBe(LogicLevel.LOW);
            expect(digitalSimulator.voltageToLogic(0.5)).toBe(LogicLevel.LOW);
            expect(digitalSimulator.voltageToLogic(0.8)).toBe(LogicLevel.LOW);

            // 中間電壓 -> UNKNOWN (使用預設閾值 2.0V)
            expect(digitalSimulator.voltageToLogic(1.0)).toBe(LogicLevel.LOW);
            expect(digitalSimulator.voltageToLogic(1.9)).toBe(LogicLevel.LOW);

            // undefined -> UNKNOWN
            expect(digitalSimulator.voltageToLogic(undefined)).toBe(LogicLevel.UNKNOWN);
        });
    });

    describe('AND gate simulation with portNodeVoltages', () => {
        it('should output HIGH when both inputs are 5V', () => {
            const andGate = createLogicGate('and1', 'logic_and');
            const components = [andGate];

            // 模擬 portNodeVoltages，直接提供端口電壓
            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('and1:and1-p0', 5);  // 輸入 A = 5V
            portNodeVoltages.set('and1:and1-p1', 5);  // 輸入 B = 5V
            portNodeVoltages.set('and1:and1-p2', 0);  // 輸出 Y = 0V (初始)

            // 執行數位模擬
            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            // 檢查 AND 閘狀態
            const andState = result.gateStates.get('and1');
            expect(andState).toBeDefined();
            expect(andState?.inputA).toBe(LogicLevel.HIGH);
            expect(andState?.inputB).toBe(LogicLevel.HIGH);
            expect(andState?.output).toBe(LogicLevel.HIGH);
        });

        it('should output LOW when one input is LOW', () => {
            const andGate = createLogicGate('and1', 'logic_and');
            const components = [andGate];

            // 模擬 portNodeVoltages，直接提供端口電壓
            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('and1:and1-p0', 5);  // 輸入 A = 5V (HIGH)
            portNodeVoltages.set('and1:and1-p1', 0);  // 輸入 B = 0V (LOW)
            portNodeVoltages.set('and1:and1-p2', 0);  // 輸出 Y = 0V (初始)

            // 執行數位模擬
            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            // 檢查 AND 閘狀態
            const andState = result.gateStates.get('and1');
            expect(andState).toBeDefined();
            expect(andState?.inputA).toBe(LogicLevel.HIGH);
            expect(andState?.inputB).toBe(LogicLevel.LOW);
            expect(andState?.output).toBe(LogicLevel.LOW);
        });

        it('should output LOW when both inputs are LOW', () => {
            const andGate = createLogicGate('and1', 'logic_and');
            const components = [andGate];

            // 模擬 portNodeVoltages，直接提供端口電壓
            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('and1:and1-p0', 0);  // 輸入 A = 0V (LOW)
            portNodeVoltages.set('and1:and1-p1', 0);  // 輸入 B = 0V (LOW)
            portNodeVoltages.set('and1:and1-p2', 0);  // 輸出 Y = 0V (初始)

            // 執行數位模擬
            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            // 檢查 AND 閘狀態
            const andState = result.gateStates.get('and1');
            expect(andState).toBeDefined();
            expect(andState?.inputA).toBe(LogicLevel.LOW);
            expect(andState?.inputB).toBe(LogicLevel.LOW);
            expect(andState?.output).toBe(LogicLevel.LOW);
        });
    });

    describe('OR gate simulation', () => {
        it('should output HIGH when either input is HIGH', () => {
            const orGate = createLogicGate('or1', 'logic_or');
            const components = [orGate];

            // 模擬 portNodeVoltages
            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('or1:or1-p0', 5);  // 輸入 A = 5V (HIGH)
            portNodeVoltages.set('or1:or1-p1', 0);  // 輸入 B = 0V (LOW)
            portNodeVoltages.set('or1:or1-p2', 0);

            // 執行數位模擬
            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            // 檢查 OR 閘狀態
            const orState = result.gateStates.get('or1');
            expect(orState).toBeDefined();
            expect(orState?.inputA).toBe(LogicLevel.HIGH);
            expect(orState?.inputB).toBe(LogicLevel.LOW);
            expect(orState?.output).toBe(LogicLevel.HIGH);
        });

        it('should output LOW when both inputs are LOW', () => {
            const orGate = createLogicGate('or1', 'logic_or');
            const components = [orGate];

            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('or1:or1-p0', 0);  // 輸入 A = 0V (LOW)
            portNodeVoltages.set('or1:or1-p1', 0);  // 輸入 B = 0V (LOW)

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const orState = result.gateStates.get('or1');
            expect(orState).toBeDefined();
            expect(orState?.output).toBe(LogicLevel.LOW);
        });
    });

    describe('NOT gate simulation', () => {
        it('should output LOW when input is HIGH', () => {
            const notGate = createLogicGate('not1', 'logic_not');
            const components = [notGate];

            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('not1:not1-p0', 5);  // 輸入 A = 5V (HIGH)
            portNodeVoltages.set('not1:not1-p1', 0);  // 輸出 Y

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const notState = result.gateStates.get('not1');
            expect(notState).toBeDefined();
            expect(notState?.inputA).toBe(LogicLevel.HIGH);
            expect(notState?.output).toBe(LogicLevel.LOW);
        });

        it('should output HIGH when input is LOW', () => {
            const notGate = createLogicGate('not1', 'logic_not');
            const components = [notGate];

            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('not1:not1-p0', 0);  // 輸入 A = 0V (LOW)
            portNodeVoltages.set('not1:not1-p1', 0);

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const notState = result.gateStates.get('not1');
            expect(notState).toBeDefined();
            expect(notState?.inputA).toBe(LogicLevel.LOW);
            expect(notState?.output).toBe(LogicLevel.HIGH);
        });
    });

    describe('NAND gate simulation', () => {
        it('should output LOW only when both inputs are HIGH', () => {
            const nandGate = createLogicGate('nand1', 'logic_nand');
            const components = [nandGate];

            // 兩個 HIGH 輸入 -> LOW 輸出
            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('nand1:nand1-p0', 5);
            portNodeVoltages.set('nand1:nand1-p1', 5);

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const nandState = result.gateStates.get('nand1');
            expect(nandState?.output).toBe(LogicLevel.LOW);
        });

        it('should output HIGH when at least one input is LOW', () => {
            const nandGate = createLogicGate('nand1', 'logic_nand');
            const components = [nandGate];

            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('nand1:nand1-p0', 5);
            portNodeVoltages.set('nand1:nand1-p1', 0);  // 一個 LOW

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const nandState = result.gateStates.get('nand1');
            expect(nandState?.output).toBe(LogicLevel.HIGH);
        });
    });

    describe('XOR gate simulation', () => {
        it('should output HIGH when inputs are different', () => {
            const xorGate = createLogicGate('xor1', 'logic_xor');
            const components = [xorGate];

            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('xor1:xor1-p0', 5);  // HIGH
            portNodeVoltages.set('xor1:xor1-p1', 0);  // LOW

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const xorState = result.gateStates.get('xor1');
            expect(xorState?.output).toBe(LogicLevel.HIGH);
        });

        it('should output LOW when inputs are same', () => {
            const xorGate = createLogicGate('xor1', 'logic_xor');
            const components = [xorGate];

            // 都是 HIGH
            const portNodeVoltages = new Map<string, number>();
            portNodeVoltages.set('xor1:xor1-p0', 5);
            portNodeVoltages.set('xor1:xor1-p1', 5);

            const result = digitalSimulator.simulate(components, undefined, portNodeVoltages);
            expect(result.success).toBe(true);

            const xorState = result.gateStates.get('xor1');
            expect(xorState?.output).toBe(LogicLevel.LOW);
        });
    });

    describe('Port voltage mapping (Union-Find)', () => {
        it('should correctly build portNodeVoltages using Union-Find', () => {
            // 測試 Union-Find 邏輯：模擬 circuitStore 中的 portNodeVoltages 建立
            const andGate = createLogicGate('and1', 'logic_and');
            const components = [
                createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
                andGate,
                createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
            ];

            const wires = [
                // V1+ -> AND 輸入 A
                createWire('w1', 'v1', 0, 'and1', 0),
                // V1- -> GND
                createWire('w2', 'v1', 1, 'gnd', 0),
                // GND -> AND 輸入 B
                createWire('w3', 'gnd', 0, 'and1', 1),
            ];

            // 模擬 DC 分析結果的 nodeVoltages
            // 假設 nodeVoltages 包含代表每個電氣節點的 portKey
            const mockNodeVoltages = new Map<string, number>();
            mockNodeVoltages.set('v1:v1-p0', 5);  // V1+ 節點 = 5V
            mockNodeVoltages.set('gnd:gnd-p0', 0); // GND 節點 = 0V

            // 建立端口到電壓的映射
            const portNodeVoltages = buildPortNodeVoltages(
                components,
                wires,
                mockNodeVoltages
            );

            // 驗證 AND 閘的輸入 A 應該是 5V（連接到 V1+）
            const inputAVoltage = portNodeVoltages.get('and1:and1-p0');
            expect(inputAVoltage).toBe(5);

            // 驗證 AND 閘的輸入 B 應該是 0V（連接到 GND）
            const inputBVoltage = portNodeVoltages.get('and1:and1-p1');
            expect(inputBVoltage).toBe(0);
        });

        it('should propagate voltages through multiple connected ports', () => {
            // 測試通過多個連接的端口傳播電壓
            const components = [
                createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
                createComponent('r1', 'resistor', 1000),
                createComponent('r2', 'resistor', 1000),
                createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
            ];

            const wires = [
                // V1+ -> R1 端點 1
                createWire('w1', 'v1', 0, 'r1', 0),
                // R1 端點 2 -> R2 端點 1
                createWire('w2', 'r1', 1, 'r2', 0),
                // R2 端點 2 -> GND
                createWire('w3', 'r2', 1, 'gnd', 0),
                // V1- -> GND
                createWire('w4', 'v1', 1, 'gnd', 0),
            ];

            // 模擬 DC 分析結果
            const mockNodeVoltages = new Map<string, number>();
            mockNodeVoltages.set('v1:v1-p0', 5);    // V1+ 節點 = 5V
            mockNodeVoltages.set('r1:r1-p1', 2.5);  // 中間節點 = 2.5V
            mockNodeVoltages.set('gnd:gnd-p0', 0);  // GND = 0V

            const portNodeVoltages = buildPortNodeVoltages(
                components,
                wires,
                mockNodeVoltages
            );

            // V1+ 和 R1 端點 1 應該都是 5V（同一節點）
            expect(portNodeVoltages.get('v1:v1-p0')).toBe(5);
            expect(portNodeVoltages.get('r1:r1-p0')).toBe(5);

            // R1 端點 2 和 R2 端點 1 應該都是 2.5V（同一節點）
            expect(portNodeVoltages.get('r1:r1-p1')).toBe(2.5);
            expect(portNodeVoltages.get('r2:r2-p0')).toBe(2.5);

            // GND 相關的端口應該都是 0V
            expect(portNodeVoltages.get('gnd:gnd-p0')).toBe(0);
            expect(portNodeVoltages.get('v1:v1-p1')).toBe(0);
            expect(portNodeVoltages.get('r2:r2-p1')).toBe(0);
        });
    });
});

/**
 * 模擬 circuitStore 中的 portNodeVoltages 建立邏輯
 * 這是一個簡化版本，用於測試
 */
function buildPortNodeVoltages(
    components: CircuitComponent[],
    wires: Wire[],
    nodeVoltages: Map<string, number>
): Map<string, number> {
    const portNodeVoltages = new Map<string, number>();
    const portToRoot = new Map<string, string>();

    // 為每個端點初始化（自己是自己的根）
    for (const comp of components) {
        for (const port of comp.ports) {
            const portKey = `${comp.id}:${port.id}`;
            portToRoot.set(portKey, portKey);
        }
    }

    // 找到根節點的輔助函數
    const findRoot = (key: string): string => {
        if (!portToRoot.has(key)) return key;
        let current = key;
        while (portToRoot.get(current) !== current) {
            current = portToRoot.get(current)!;
        }
        // 路徑壓縮
        portToRoot.set(key, current);
        return current;
    };

    // 合併兩個集合
    const union = (a: string, b: string) => {
        const rootA = findRoot(a);
        const rootB = findRoot(b);
        if (rootA !== rootB) {
            portToRoot.set(rootB, rootA);
        }
    };

    // 根據導線合併節點
    for (const wire of wires) {
        const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
        const toKey = `${wire.toComponentId}:${wire.toPortId}`;
        union(fromKey, toKey);
    }

    // 為每個 nodeVoltage，找出所有屬於同一節點的端口
    for (const [nodeId, voltage] of nodeVoltages) {
        const nodeRoot = findRoot(nodeId);

        // 遍歷所有端口，找到與這個節點相同根的端口
        for (const [portKey] of portToRoot) {
            if (findRoot(portKey) === nodeRoot) {
                portNodeVoltages.set(portKey, voltage);
            }
        }
    }

    return portNodeVoltages;
}
