import type { CircuitComponent, Wire } from '@/types/circuit';
import type { DCSimulationResult } from './SimulationTypes';
import { CircuitGraph } from './CircuitGraph';
import { getRotatedPortPosition } from '@/lib/geometryUtils';

export type SimulationOverlayLabelKind = 'nodeVoltage' | 'componentCurrent';

export type SimulationOverlayLabel = {
  id: string;
  kind: SimulationOverlayLabelKind;
  x: number;
  y: number;
  text: string;
};

type Point = { x: number; y: number };

function meanPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function clampTiny(value: number, eps = 1e-9): number {
  return Math.abs(value) < eps ? 0 : value;
}

function formatSignificant(value: number, significantDigits: number): string {
  const v = clampTiny(value);
  if (v === 0) return '0';

  const absV = Math.abs(v);
  const integerDigits = Math.floor(Math.log10(absV)) + 1;
  const decimals = Math.max(0, significantDigits - integerDigits);

  const s = v.toFixed(decimals);
  return s.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
}

type SIPrefix = { factor: number; prefix: string };

function formatSI(value: number, unit: string, significantDigits = 3, preferred?: SIPrefix[]): string {
  const v = clampTiny(value);
  if (v === 0) return `0 ${unit}`;

  const table: SIPrefix[] =
    preferred ??
    [
      { factor: 1e9, prefix: 'G' },
      { factor: 1e6, prefix: 'M' },
      { factor: 1e3, prefix: 'k' },
      { factor: 1, prefix: '' },
      { factor: 1e-3, prefix: 'm' },
      { factor: 1e-6, prefix: 'μ' },
      { factor: 1e-9, prefix: 'n' },
    ];

  const absV = Math.abs(v);
  let chosen = table[3]!; // default 1
  for (const entry of table) {
    if (absV >= entry.factor) {
      chosen = entry;
      break;
    }
  }

  const scaled = v / chosen.factor;
  return `${formatSignificant(scaled, significantDigits)} ${chosen.prefix}${unit}`;
}

export function formatVoltageLabel(volts: number): string {
  // Prefer mV..kV range for readability
  return formatSI(volts, 'V', 3, [
    { factor: 1e3, prefix: 'k' },
    { factor: 1, prefix: '' },
    { factor: 1e-3, prefix: 'm' },
  ]);
}

export function formatCurrentLabel(amps: number): string {
  // Prefer μA..A range for readability
  return formatSI(amps, 'A', 3, [
    { factor: 1, prefix: '' },
    { factor: 1e-3, prefix: 'm' },
    { factor: 1e-6, prefix: 'μ' },
  ]);
}

function getPortWorldPosition(
  components: CircuitComponent[],
  componentId: string,
  portId: string
): Point | null {
  const comp = components.find((c) => c.id === componentId);
  if (!comp) return null;
  const port = comp.ports.find((p) => p.id === portId);
  if (!port) return null;

  return getRotatedPortPosition(comp.x, comp.y, port.offsetX, port.offsetY, comp.rotation);
}

function getComponentById(components: CircuitComponent[], componentId: string): CircuitComponent | null {
  return components.find((c) => c.id === componentId) ?? null;
}

function getNodeLabelAnchor(
  graph: CircuitGraph,
  components: CircuitComponent[],
  nodeId: string
): Point | null {
  const node = graph.getNodes().get(nodeId);
  if (!node) return null;

  const groundComponentIds = new Set(
    components.filter((c) => c.type === 'ground').map((c) => c.id)
  );

  const preferredPorts = node.connectedPorts.filter((p) => !groundComponentIds.has(p.componentId));
  const portsToUse = preferredPorts.length > 0 ? preferredPorts : node.connectedPorts;

  const points: Point[] = [];
  for (const p of portsToUse) {
    const pos = getPortWorldPosition(components, p.componentId, p.portId);
    if (pos) points.push(pos);
  }

  // Fallback: use component centers if no ports resolved
  if (points.length === 0) {
    for (const p of portsToUse) {
      const comp = getComponentById(components, p.componentId);
      if (comp) points.push({ x: comp.x, y: comp.y });
    }
  }

  // Prefer the midpoint of the farthest pair of connected port positions.
  // This tends to land on the main wire run (looks closer to “label on wire”).
  if (points.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let bestD2 = -1;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = (points[j]!.x - points[i]!.x);
        const dy = (points[j]!.y - points[i]!.y);
        const d2 = dx * dx + dy * dy;
        if (d2 > bestD2) {
          bestD2 = d2;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const p1 = points[bestI]!;
    const p2 = points[bestJ]!;
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  return meanPoint(points);
}

function getComponentCurrentLabelAnchor(comp: CircuitComponent): Point {
  const rot = ((comp.rotation % 360) + 360) % 360;
  const isVertical = rot === 90 || rot === 270;
  // Place current label slightly off the component body
  if (isVertical) {
    return { x: comp.x - 55, y: comp.y - 10 };
  }
  return { x: comp.x - 10, y: comp.y - 55 };
}

function isCurrentLabelComponentType(type: CircuitComponent['type']): boolean {
  // Minimal overlay: only show current on the source + resistors.
  return type === 'dc_source' || type === 'resistor';
}

function nodeLabelOffset(
  graph: CircuitGraph,
  components: CircuitComponent[],
  nodeId: string
): Point {
  // Decide whether the node is predominantly horizontal or vertical.
  // We approximate using the farthest pair of connected port positions.
  const node = graph.getNodes().get(nodeId);
  if (!node) return { x: 0, y: -28 };

  const points: Point[] = [];
  for (const p of node.connectedPorts) {
    const pos = getPortWorldPosition(components, p.componentId, p.portId);
    if (pos) points.push(pos);
  }

  if (points.length < 2) return { x: 0, y: -28 };

  let bestI = 0;
  let bestJ = 1;
  let bestD2 = -1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j]!.x - points[i]!.x;
      const dy = points[j]!.y - points[i]!.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > bestD2) {
        bestD2 = d2;
        bestI = i;
        bestJ = j;
      }
    }
  }

  const dx = points[bestJ]!.x - points[bestI]!.x;
  const dy = points[bestJ]!.y - points[bestI]!.y;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  // Horizontal wires: place above. Vertical wires: place left.
  return isHorizontal ? { x: 0, y: -28 } : { x: -34, y: 0 };
}

export function buildDCSimulationOverlayLabels(
  components: CircuitComponent[],
  wires: Wire[],
  dcResult: DCSimulationResult
): SimulationOverlayLabel[] {
  if (!dcResult.success) return [];

  const labels: SimulationOverlayLabel[] = [];
  const graph = new CircuitGraph();
  graph.build(components, wires);

  // Node voltage labels
  for (const [nodeId, voltage] of dcResult.nodeVoltages.entries()) {
    const anchor = getNodeLabelAnchor(graph, components, nodeId);
    if (!anchor) continue;

    const offset = nodeLabelOffset(graph, components, nodeId);

    labels.push({
      id: `v:${nodeId}`,
      kind: 'nodeVoltage',
      x: anchor.x + offset.x,
      y: anchor.y + offset.y,
      text: formatVoltageLabel(voltage),
    });
  }

  // Component current labels
  for (const comp of components) {
    if (!isCurrentLabelComponentType(comp.type)) continue;
    const currentA = dcResult.branchCurrents.get(comp.id);
    if (currentA === undefined) continue;

    // Filter near-zero currents to reduce clutter.
    if (Math.abs(currentA) < 1e-9) continue;

    const anchor = getComponentCurrentLabelAnchor(comp);
    labels.push({
      id: `i:${comp.id}`,
      kind: 'componentCurrent',
      x: anchor.x,
      y: anchor.y,
      text: formatCurrentLabel(currentA),
    });
  }

  return labels;
}
