import { describe, it, expect } from 'vitest';
import type { CircuitComponent } from '@/types/circuit';
import { buildDCSimulationOverlayLabels, type SimulationOverlayItem } from '../simulationOverlay';
import type { DCSimulationResult } from '../SimulationTypes';

function createDCSource(id: string, currentA: number): { component: CircuitComponent; result: DCSimulationResult } {
  const component: CircuitComponent = {
    id,
    type: 'dc_source',
    x: 100,
    y: 100,
    rotation: 0,
    value: 5,
    unit: 'V',
    label: 'V1',
    ports: [
      { id: 'p+', name: '+', offsetX: 0, offsetY: -40 },
      { id: 'p-', name: '-', offsetX: 0, offsetY: 40 },
    ],
  };

  const result: DCSimulationResult = {
    success: true,
    nodeVoltages: new Map(),
    branchCurrents: new Map([[id, currentA]]),
  };

  return { component, result };
}

describe('simulationOverlay', () => {
  it('formats source current as magnitude and emits direction arrow for negative current', () => {
    const { component, result } = createDCSource('v1', -0.00163);
    const labels = buildDCSimulationOverlayLabels([component], [], result);

    const currentLabel = labels.find(
      (l): l is Extract<SimulationOverlayItem, { kind: 'componentCurrent' }> =>
        l.id === 'i:v1' && l.kind === 'componentCurrent'
    );
    expect(currentLabel).toBeTruthy();
    expect(currentLabel!.text).toBe('1.63 mA');
    expect(currentLabel!.rotation).toBe(-90);

    const arrow = labels.find(
      (l): l is Extract<SimulationOverlayItem, { kind: 'currentDirectionArrow' }> =>
        l.id === 'ia:v1' && l.kind === 'currentDirectionArrow'
    );
    expect(arrow).toBeTruthy();
    expect(arrow!.x).toBeCloseTo(100, 6);
    expect(arrow!.y).toBeLessThan(60);
    const rot = ((((arrow!.rotation % 360) + 360) % 360));
    expect(rot).toBeCloseTo(0, 6);
  });

  it('emits direction arrow on negative terminal for positive current', () => {
    const { component, result } = createDCSource('v1', 0.00163);
    const labels = buildDCSimulationOverlayLabels([component], [], result);

    const currentLabel = labels.find(
      (l): l is Extract<SimulationOverlayItem, { kind: 'componentCurrent' }> =>
        l.id === 'i:v1' && l.kind === 'componentCurrent'
    );
    expect(currentLabel).toBeTruthy();
    expect(currentLabel!.text).toBe('1.63 mA');

    const arrow = labels.find(
      (l): l is Extract<SimulationOverlayItem, { kind: 'currentDirectionArrow' }> =>
        l.id === 'ia:v1' && l.kind === 'currentDirectionArrow'
    );
    expect(arrow).toBeTruthy();
    expect(arrow!.x).toBeCloseTo(100, 6);
    expect(arrow!.y).toBeGreaterThan(140);
    const rot = ((((arrow!.rotation % 360) + 360) % 360));
    expect(rot).toBeCloseTo(180, 6);
  });
});
