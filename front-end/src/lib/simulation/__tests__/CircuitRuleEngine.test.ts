import { describe, expect, it } from 'vitest';
import { evaluateCircuitDesignRules, evaluateLED001Rule } from '../CircuitRuleEngine';
import { I_EMIT_MIN } from '../SimulationTypes';
import type { CircuitComponent, Wire } from '@/types/circuit';

function createComponent(
  id: string,
  type: CircuitComponent['type'],
  value?: number,
  ports: string[] = ['1', '2']
): CircuitComponent {
  return {
    id,
    type,
    x: 0,
    y: 0,
    rotation: 0,
    value,
    ports: ports.map((name, i) => ({
      id: `${id}-p${i}`,
      name,
      offsetX: 0,
      offsetY: i === 0 ? -40 : 40,
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

function findRuleIds(violations: Array<{ ruleId: string }>): string[] {
  return violations.map((v) => v.ruleId);
}

describe('CircuitRuleEngine (CDRS v1)', () => {
  it('PWR-001: should error when ground nodeId=0 is missing', () => {
    const components = [createComponent('v1', 'dc_source', 5, ['+', '-'])];
    const wires: Wire[] = [];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(findRuleIds(violations)).toContain('PWR-001');
    expect(violations.some((v) => v.ruleId === 'PWR-001' && v.severity === 'ERROR')).toBe(true);
  });

  it('PWR-002: should error when ideal voltage source is shorted by wire', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [createWire('w1', 'v1', 0, 'v1', 1)];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'PWR-002' && v.severity === 'ERROR')).toBe(true);
  });

  it('PWR-002: should error when ideal voltage source is shorted via equivalent 0Ω element', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('s1', 'switch', undefined, ['1', '2']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [
      createWire('w1', 'v1', 0, 's1', 0),
      createWire('w2', 's1', 1, 'v1', 1),
    ];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'PWR-002' && v.severity === 'ERROR')).toBe(true);
  });

  it('TOP-002: should error when a source has no return path', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [createWire('w1', 'v1', 1, 'gnd', 0)];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'TOP-002' && v.severity === 'ERROR')).toBe(true);
  });

  it('REA-001: should warn when capacitor forms a direct loop with an ideal source', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('c1', 'capacitor', 100e-6, ['+', '-']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [
      createWire('w1', 'v1', 0, 'c1', 0),
      createWire('w2', 'v1', 1, 'c1', 1),
    ];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'TOP-002')).toBe(false);
    expect(violations.some((v) => v.ruleId === 'REA-001' && v.severity === 'WARNING')).toBe(true);
  });

  it('REA-002: should warn when inductor forms a direct loop with an ideal source', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('l1', 'inductor', 10e-3, ['1', '2']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [
      createWire('w1', 'v1', 0, 'l1', 0),
      createWire('w2', 'v1', 1, 'l1', 1),
    ];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'TOP-002')).toBe(false);
    expect(violations.some((v) => v.ruleId === 'REA-002' && v.severity === 'WARNING')).toBe(true);
  });

  it('CUR-001: should error when LED is directly across an ideal source with no limiting element', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('led1', 'led', undefined, ['anode', 'cathode']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [
      createWire('w1', 'v1', 0, 'led1', 0),
      createWire('w2', 'v1', 1, 'led1', 1),
    ];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'CUR-001' && v.severity === 'ERROR')).toBe(true);
  });

  it('CUR-001: should pass when all LED source paths include a resistor R >= R_min', () => {
    const components = [
      createComponent('v1', 'dc_source', 5, ['+', '-']),
      createComponent('r1', 'resistor', 220, ['1', '2']),
      createComponent('led1', 'led', undefined, ['anode', 'cathode']),
      createComponent('gnd', 'ground', undefined, ['gnd']),
    ];
    const wires = [
      createWire('w1', 'v1', 0, 'r1', 0),
      createWire('w2', 'r1', 1, 'led1', 0),
      createWire('w3', 'led1', 1, 'v1', 1),
    ];

    const violations = evaluateCircuitDesignRules(components, wires);

    expect(violations.some((v) => v.ruleId === 'CUR-001')).toBe(false);
  });
});

describe('LED-001 Post-Simulation Rule', () => {

  function createLEDComponent(
    id: string,
    label?: string,
    ledColor?: 'Red' | 'Green' | 'Blue' | 'White',
    vfOverride?: number
  ): CircuitComponent {
    return {
      id,
      type: 'led',
      x: 0,
      y: 0,
      rotation: 0,
      label,
      ledColor,
      vfOverride,
      ports: [
        { id: `${id}-p0`, name: 'anode', offsetX: 0, offsetY: -40 },
        { id: `${id}-p1`, name: 'cathode', offsetX: 0, offsetY: 40 },
      ],
    };
  }

  it('LED-001: should return INFO when LED is conducting but current is below I_emit_min', () => {
    const components = [createLEDComponent('led1', 'LED1')];

    // 模擬 LED 導通，電流 0.5mA (低於 1mA 門檻)
    const simulationResult = {
      success: true,
      nodeVoltages: new Map<string, number>(),
      branchCurrents: new Map<string, number>([['led1', 0.0005]]), // 0.5mA
    };

    const violations = evaluateLED001Rule(components, simulationResult);

    expect(violations.length).toBe(1);
    expect(violations[0]!.ruleId).toBe('LED-001');
    expect(violations[0]!.severity).toBe('INFO');
    expect(violations[0]!.componentIds).toContain('led1');
    expect(violations[0]!.message).toContain('below visible emission threshold');
  });

  it('LED-001: should return WARNING in teaching mode', () => {
    const components = [createLEDComponent('led1', 'LED1')];

    const simulationResult = {
      success: true,
      nodeVoltages: new Map<string, number>(),
      branchCurrents: new Map<string, number>([['led1', 0.0005]]), // 0.5mA
    };

    const violations = evaluateLED001Rule(components, simulationResult, true);

    expect(violations.length).toBe(1);
    expect(violations[0]!.severity).toBe('WARNING');
  });

  it('LED-001: should not trigger when LED current is at or above I_emit_min', () => {
    const components = [createLEDComponent('led1', 'LED1')];

    // 電流正好 1mA (等於門檻)
    const simulationResult = {
      success: true,
      nodeVoltages: new Map<string, number>(),
      branchCurrents: new Map<string, number>([['led1', I_EMIT_MIN]]),
    };

    const violations = evaluateLED001Rule(components, simulationResult);

    expect(violations.length).toBe(0);
  });

  it('LED-001: should not trigger when LED is not conducting (current <= 0)', () => {
    const components = [createLEDComponent('led1', 'LED1')];

    const simulationResult = {
      success: true,
      nodeVoltages: new Map<string, number>(),
      branchCurrents: new Map<string, number>([['led1', 0]]),
    };

    const violations = evaluateLED001Rule(components, simulationResult);

    expect(violations.length).toBe(0);
  });

  it('LED-001: should not trigger when simulation failed', () => {
    const components = [createLEDComponent('led1', 'LED1')];

    const simulationResult = {
      success: false,
      nodeVoltages: new Map<string, number>(),
      branchCurrents: new Map<string, number>([['led1', 0.0005]]),
      error: 'Simulation failed',
    };

    const violations = evaluateLED001Rule(components, simulationResult);

    expect(violations.length).toBe(0);
  });
});
