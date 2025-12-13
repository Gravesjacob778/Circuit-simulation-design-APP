/**
 * MNASolver 單元測試
 */

import { describe, it, expect } from 'vitest';
import { runDCAnalysis } from '../MNASolver';
import { gaussianElimination } from '../Matrix';
import type { CircuitComponent, Wire } from '@/types/circuit';

describe('Matrix Operations', () => {
  it('should solve 2x2 linear system', () => {
    // 2x + 3y = 8
    // x - y = -1
    // Solution: x = 1, y = 2
    const A = [[2, 3], [1, -1]];
    const b = [8, -1];
    const x = gaussianElimination(A, b);
    
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(1, 5);
    expect(x![1]).toBeCloseTo(2, 5);
  });
  
  it('should solve 3x3 linear system', () => {
    // x + y + z = 6
    // 2y + 5z = -4
    // 2x + 5y - z = 27
    // Solution: x = 5, y = 3, z = -2
    const A = [[1, 1, 1], [0, 2, 5], [2, 5, -1]];
    const b = [6, -4, 27];
    const x = gaussianElimination(A, b);
    
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(5, 5);
    expect(x![1]).toBeCloseTo(3, 5);
    expect(x![2]).toBeCloseTo(-2, 5);
  });
  
  it('should return null for singular matrix', () => {
    // 兩個相同的方程
    const A = [[1, 2], [2, 4]];
    const b = [3, 6];
    const x = gaussianElimination(A, b);
    
    expect(x).toBeNull();
  });
});

describe('MNASolver', () => {
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

  describe('Validation', () => {
    it('should fail for empty circuit', () => {
      const result = runDCAnalysis([], []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('空');
    });
    
    it('should fail for circuit without ground', () => {
      const components = [
        createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
        createComponent('r1', 'resistor', 1000),
      ];
      const wires: Wire[] = [];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('接地');
    });

    it('should fail for circuit with unconnected ground', () => {
      const components = [
        createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
        createComponent('r1', 'resistor', 1000),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];

      // 有導線，但沒有任何導線把 gnd 接到非接地元件
      const wires = [
        createWire('w1', 'v1', 0, 'r1', 0),
      ];

      const result = runDCAnalysis(components, wires);

      expect(result.success).toBe(false);
      expect(result.error).toContain('接地');
      expect(result.error).toContain('未連接');
    });
    
    it('should fail for circuit without power source', () => {
      const components = [
        createComponent('r1', 'resistor', 1000),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];
      const wires = [
        createWire('w1', 'r1', 1, 'gnd', 0),
      ];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('電源');
    });
  });

  describe('Simple DC Analysis', () => {
    it('should analyze simple voltage divider', () => {
      // 電路: DC 5V -> R1 1kΩ -> R2 1kΩ -> GND
      // 預期: 中間節點電壓 2.5V，電流 2.5mA
      
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
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(true);
      
      // 檢查電流 (應為 5V / 2000Ω = 2.5mA)
      const r1Current = result.branchCurrents.get('r1');
      expect(r1Current).toBeDefined();
      expect(r1Current).toBeCloseTo(0.0025, 6); // 2.5mA
      
      const r2Current = result.branchCurrents.get('r2');
      expect(r2Current).toBeDefined();
      expect(r2Current).toBeCloseTo(0.0025, 6);
    });

    it('should analyze single resistor circuit', () => {
      // 電路: DC 5V -> R1 1kΩ -> GND
      // 預期: 電流 5mA
      
      const components = [
        createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
        createComponent('r1', 'resistor', 1000),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];
      
      const wires = [
        createWire('w1', 'v1', 0, 'r1', 0),
        createWire('w2', 'r1', 1, 'gnd', 0),
        createWire('w3', 'v1', 1, 'gnd', 0),
      ];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(true);
      
      // 檢查電流 (應為 5V / 1000Ω = 5mA)
      const r1Current = result.branchCurrents.get('r1');
      expect(r1Current).toBeDefined();
      expect(r1Current).toBeCloseTo(0.005, 6); // 5mA
    });

    it('should analyze parallel resistors', () => {
      // 電路: DC 10V -> (R1 1kΩ || R2 1kΩ) -> GND
      // 等效電阻: 500Ω
      // 總電流: 10V / 500Ω = 20mA
      // 每個電阻電流: 10mA
      
      const components = [
        createComponent('v1', 'dc_source', 10, [{ name: '+' }, { name: '-' }]),
        createComponent('r1', 'resistor', 1000),
        createComponent('r2', 'resistor', 1000),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];
      
      const wires = [
        // V1+ 連接到 R1 和 R2 的端點 1
        createWire('w1', 'v1', 0, 'r1', 0),
        createWire('w2', 'v1', 0, 'r2', 0),
        // R1 和 R2 的端點 2 連接到 GND
        createWire('w3', 'r1', 1, 'gnd', 0),
        createWire('w4', 'r2', 1, 'gnd', 0),
        // V1- 連接到 GND
        createWire('w5', 'v1', 1, 'gnd', 0),
      ];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(true);
      
      // 每個電阻電流應為 10mA
      const r1Current = result.branchCurrents.get('r1');
      const r2Current = result.branchCurrents.get('r2');
      
      expect(r1Current).toBeDefined();
      expect(r2Current).toBeDefined();
      expect(r1Current).toBeCloseTo(0.01, 6); // 10mA
      expect(r2Current).toBeCloseTo(0.01, 6); // 10mA
    });
  });

  describe('Extended Component Models', () => {
    it('should treat inductor as short circuit in DC analysis', () => {
      // 電路: DC 5V -> L1 (inductor) -> R1 1kΩ -> GND
      // DC 穩態時電感為短路，電流應為 5V / 1000Ω = 5mA
      
      const components = [
        createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
        createComponent('l1', 'inductor', 10e-3), // 10mH
        createComponent('r1', 'resistor', 1000),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];
      
      const wires = [
        createWire('w1', 'v1', 0, 'l1', 0),
        createWire('w2', 'l1', 1, 'r1', 0),
        createWire('w3', 'r1', 1, 'gnd', 0),
        createWire('w4', 'v1', 1, 'gnd', 0),
      ];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(true);
      
      // 電感電流應等於電阻電流 = 5mA
      const l1Current = result.branchCurrents.get('l1');
      const r1Current = result.branchCurrents.get('r1');
      
      expect(l1Current).toBeDefined();
      expect(r1Current).toBeDefined();
      expect(Math.abs(l1Current!)).toBeCloseTo(0.005, 5); // 5mA
      expect(r1Current).toBeCloseTo(0.005, 5); // 5mA
    });

    it('should treat capacitor as open circuit in DC analysis', () => {
      // 電路: DC 5V -> C1 (capacitor) || R1 1kΩ -> GND
      // DC 穩態時電容為開路，電流只流經電阻
      
      const components = [
        createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
        createComponent('c1', 'capacitor', 100e-6), // 100μF
        createComponent('r1', 'resistor', 1000),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];
      
      const wires = [
        createWire('w1', 'v1', 0, 'c1', 0),
        createWire('w2', 'v1', 0, 'r1', 0),
        createWire('w3', 'c1', 1, 'gnd', 0),
        createWire('w4', 'r1', 1, 'gnd', 0),
        createWire('w5', 'v1', 1, 'gnd', 0),
      ];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(true);
      
      // 電阻電流應為 5mA，電容電流應接近 0
      const c1Current = result.branchCurrents.get('c1');
      const r1Current = result.branchCurrents.get('r1');
      
      expect(c1Current).toBeDefined();
      expect(r1Current).toBeDefined();
      expect(Math.abs(c1Current!)).toBeLessThan(1e-9); // 接近 0
      expect(r1Current).toBeCloseTo(0.005, 5); // 5mA
    });

    it('should analyze circuit with LED (simplified model)', () => {
      // 電路: DC 5V -> LED -> R1 100Ω -> GND
      // LED 簡化為 10Ω 電阻，總電阻 110Ω
      // 電流 ≈ 5V / 110Ω ≈ 45.5mA
      
      const components = [
        createComponent('v1', 'dc_source', 5, [{ name: '+' }, { name: '-' }]),
        createComponent('led1', 'led', 2.0, [{ name: 'anode' }, { name: 'cathode' }]),
        createComponent('r1', 'resistor', 100),
        createComponent('gnd', 'ground', undefined, [{ name: 'gnd' }]),
      ];
      
      const wires = [
        createWire('w1', 'v1', 0, 'led1', 0),
        createWire('w2', 'led1', 1, 'r1', 0),
        createWire('w3', 'r1', 1, 'gnd', 0),
        createWire('w4', 'v1', 1, 'gnd', 0),
      ];
      
      const result = runDCAnalysis(components, wires);
      
      expect(result.success).toBe(true);
      
      // 電流應約為 5V / 110Ω ≈ 45.5mA
      const ledCurrent = result.branchCurrents.get('led1');
      const r1Current = result.branchCurrents.get('r1');
      
      expect(ledCurrent).toBeDefined();
      expect(r1Current).toBeDefined();
      expect(ledCurrent).toBeCloseTo(0.0455, 3); // ~45.5mA
      expect(r1Current).toBeCloseTo(0.0455, 3);
    });
  });
});
