/**
 * TransientSolver.test.ts - 瞬態分析求解器測試
 */

import { describe, it, expect } from 'vitest';
import { generateWaveform, runTransientAnalysis } from '../TransientSolver';
import type { CircuitComponent, Wire } from '@/types/circuit';

describe('generateWaveform', () => {
  const amplitude = 5;
  const frequency = 60; // 60Hz
  const phase = 0;

  it('generates sine wave correctly', () => {
    // 在 t=0 時，sin(0) = 0
    expect(generateWaveform(0, amplitude, frequency, phase, 'sine')).toBeCloseTo(0, 5);

    // 在 t=1/(4*f) 時（1/4 週期），sin(π/2) = 1
    const quarterPeriod = 1 / (4 * frequency);
    expect(generateWaveform(quarterPeriod, amplitude, frequency, phase, 'sine')).toBeCloseTo(amplitude, 5);

    // 在 t=1/(2*f) 時（半週期），sin(π) = 0
    const halfPeriod = 1 / (2 * frequency);
    expect(generateWaveform(halfPeriod, amplitude, frequency, phase, 'sine')).toBeCloseTo(0, 5);
  });

  it('generates square wave correctly', () => {
    // 在正半週期，應該是 +amplitude
    expect(generateWaveform(0.001, amplitude, frequency, phase, 'square')).toBe(amplitude);

    // 在負半週期，應該是 -amplitude
    const halfPeriod = 1 / (2 * frequency);
    expect(generateWaveform(halfPeriod + 0.001, amplitude, frequency, phase, 'square')).toBe(-amplitude);
  });

  it('generates triangle wave correctly', () => {
    // 在 t=0 時，三角波從 -amplitude 開始
    expect(generateWaveform(0, amplitude, frequency, phase, 'triangle')).toBeCloseTo(-amplitude, 5);

    // 在 1/4 週期時，應該是 0
    const quarterPeriod = 1 / (4 * frequency);
    expect(generateWaveform(quarterPeriod, amplitude, frequency, phase, 'triangle')).toBeCloseTo(0, 5);

    // 在 1/2 週期時，應該是 +amplitude
    const halfPeriod = 1 / (2 * frequency);
    expect(generateWaveform(halfPeriod, amplitude, frequency, phase, 'triangle')).toBeCloseTo(amplitude, 5);
  });

  it('generates sawtooth wave correctly', () => {
    // 在 t=0 時，鋸齒波從 -amplitude 開始
    expect(generateWaveform(0, amplitude, frequency, phase, 'sawtooth')).toBeCloseTo(-amplitude, 5);

    // 在 1/2 週期時，應該是 0
    const halfPeriod = 1 / (2 * frequency);
    expect(generateWaveform(halfPeriod, amplitude, frequency, phase, 'sawtooth')).toBeCloseTo(0, 5);
  });

  it('handles phase offset correctly', () => {
    const phaseOffset = Math.PI / 2; // 90 度
    // 帶相位偏移的正弦波在 t=0 時應該等於 sin(π/2) = 1
    expect(generateWaveform(0, amplitude, frequency, phaseOffset, 'sine')).toBeCloseTo(amplitude, 5);
  });
});

describe('runTransientAnalysis', () => {
  it('simulates simple RC circuit with AC source', () => {
    const components: CircuitComponent[] = [
      {
        id: 'ac1',
        type: 'ac_source',
        x: 100, y: 100,
        rotation: 0,
        value: 5, // 5V amplitude
        unit: 'V',
        label: 'V1',
        ports: [
          { id: 'ac1-p0', name: '+', offsetX: 0, offsetY: -40 },
          { id: 'ac1-p1', name: '-', offsetX: 0, offsetY: 40 },
        ],
        frequency: 60,
        phase: 0,
        waveformType: 'sine',
      },
      {
        id: 'r1',
        type: 'resistor',
        x: 200, y: 100,
        rotation: 0,
        value: 1000, // 1kΩ
        unit: 'Ω',
        label: 'R1',
        ports: [
          { id: 'r1-p0', name: '1', offsetX: -40, offsetY: 0 },
          { id: 'r1-p1', name: '2', offsetX: 40, offsetY: 0 },
        ],
      },
      {
        id: 'gnd1',
        type: 'ground',
        x: 200, y: 200,
        rotation: 0,
        label: 'GND',
        ports: [
          { id: 'gnd1-p0', name: 'gnd', offsetX: 0, offsetY: -15 },
        ],
      },
    ];

    const wires: Wire[] = [
      {
        id: 'w1',
        fromComponentId: 'ac1',
        fromPortId: 'ac1-p0',
        toComponentId: 'r1',
        toPortId: 'r1-p0',
        points: [],
      },
      {
        id: 'w2',
        fromComponentId: 'r1',
        fromPortId: 'r1-p1',
        toComponentId: 'gnd1',
        toPortId: 'gnd1-p0',
        points: [],
      },
      {
        id: 'w3',
        fromComponentId: 'ac1',
        fromPortId: 'ac1-p1',
        toComponentId: 'gnd1',
        toPortId: 'gnd1-p0',
        points: [],
      },
    ];

    const result = runTransientAnalysis(components, wires, {
      startTime: 0,
      endTime: 0.05, // 50ms (3 週期 @ 60Hz)
      timeStep: 0.001, // 1ms
    });

    expect(result.success).toBe(true);
    expect(result.timePoints.length).toBeGreaterThan(0);
    expect(result.branchCurrentHistory.size).toBeGreaterThan(0);

    // 檢查電流歷史存在
    const resistorCurrent = result.branchCurrentHistory.get('r1');
    expect(resistorCurrent).toBeDefined();
    expect(resistorCurrent!.length).toBe(result.timePoints.length);

    // 電流應該隨時間變化（AC 源）
    const currents = resistorCurrent!;
    const hasVariation = currents.some((c, i) => i > 0 && Math.abs(c - currents[0]!) > 1e-6);
    expect(hasVariation).toBe(true);
  });

  it('returns error for circuit without ground', () => {
    const components: CircuitComponent[] = [
      {
        id: 'ac1',
        type: 'ac_source',
        x: 100, y: 100,
        rotation: 0,
        value: 5,
        unit: 'V',
        label: 'V1',
        ports: [
          { id: 'ac1-p0', name: '+', offsetX: 0, offsetY: -40 },
          { id: 'ac1-p1', name: '-', offsetX: 0, offsetY: 40 },
        ],
      },
    ];

    const result = runTransientAnalysis(components, []);

    expect(result.success).toBe(false);
    expect(result.error).toContain('接地');
  });
});
