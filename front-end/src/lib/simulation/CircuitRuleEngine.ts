import type { CircuitComponent, Wire } from '@/types/circuit';
import type { CircuitRuleViolation, CircuitRuleEngineOptions, RuleSeverity } from './SimulationTypes';

/**
 * Unique identifier for an electrical node.
 */
type NodeId = string;

/**
 * A component with exactly two terminals/ports.
 */
type TwoTerminalComponent = CircuitComponent & { ports: [CircuitComponent['ports'][number], CircuitComponent['ports'][number]] };

/**
 * Represents an edge in the component graph connecting two electrical nodes.
 */
type ComponentEdge = {
  componentId: string;
  type: CircuitComponent['type'];
  n1: NodeId;
  n2: NodeId;
  effectiveResistanceOhms: number | null;
};

const ZERO_OHM_THRESHOLD_OHMS = 0.01; // 10mΩ (PWR-002 Normative)
const DEFAULT_R_MIN_OHMS = 10; // CUR-001 Normative (overrideable)

/**
 * Checks if the component type allows it to be treated as an ideal voltage source.
 * Includes DC and AC sources.
 */
function isIdealVoltageSourceType(type: CircuitComponent['type']): boolean {
  return type === 'dc_source' || type === 'ac_source';
}

/**
 * Checks if the component type is a capacitor.
 */
function isCapacitorType(type: CircuitComponent['type']): boolean {
  return type === 'capacitor';
}

/**
 * Checks if the component type is an inductor.
 */
function isInductorType(type: CircuitComponent['type']): boolean {
  return type === 'inductor';
}

/**
 * Checks if the component type is an LED.
 */
function isLEDType(type: CircuitComponent['type']): boolean {
  return type === 'led';
}

/**
 * Checks if the component type is a non-linear device (Diode, LED, Transistor).
 */
function isNonLinearDeviceType(type: CircuitComponent['type']): boolean {
  return type === 'diode' || type === 'led' || type === 'transistor_npn' || type === 'transistor_pnp';
}

/**
 * Returns the effective resistance of a component for simulation rule checking.
 * Returns null if the component does not have a static linear resistance.
 */
function getEffectiveResistanceOhms(component: CircuitComponent): number | null {
  switch (component.type) {
    case 'resistor':
      return component.value ?? 1000;
    case 'switch':
      return 0.01;
    case 'ammeter':
      return 0.001;
    case 'voltmeter':
      return 1e12;
    default:
      return null;
  }
}

/**
 * Type guard to check if a component has at least 2 ports.
 */
function isTwoTerminalComponent(component: CircuitComponent): component is TwoTerminalComponent {
  return component.ports.length >= 2;
}

/**
 * Checks if a component is a two-terminal ideal voltage source.
 */
function isTwoTerminalIdealVoltageSource(component: CircuitComponent): component is TwoTerminalComponent {
  return isIdealVoltageSourceType(component.type) && isTwoTerminalComponent(component);
}

/**
 * Checks if a component is a two-terminal LED.
 */
function isTwoTerminalLED(component: CircuitComponent): component is TwoTerminalComponent {
  return isLEDType(component.type) && isTwoTerminalComponent(component);
}

/**
 * Helper to add a violation record to the violations list.
 */
function addViolation(
  out: CircuitRuleViolation[],
  ruleId: string,
  severity: RuleSeverity,
  componentIds: string[],
  message: string,
  recommendation?: string
): void {
  out.push({ ruleId, severity, componentIds, message, recommendation });
}

/**
 * Creates a Union-Find (Disjoint Set) data structure for a set of keys.
 */
function makeUnionFind(keys: string[]): {
  parent: Map<string, string>;
  find: (key: string) => string;
  union: (a: string, b: string) => void;
} {
  const parent = new Map<string, string>();
  for (const k of keys) parent.set(k, k);

  const find = (key: string): string => {
    let current = key;
    while (parent.get(current) !== current) {
      current = parent.get(current)!;
    }
    parent.set(key, current);
    return current;
  };

  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent.set(rb, ra);
  };

  return { parent, find, union };
}

/**
 * Groups connected ports into electrical nodes using Union-Find.
 * Returns mappings from ports to nodes, and identifies the ground node.
 */
function buildElectricalNodes(
  components: CircuitComponent[],
  wires: Wire[]
): {
  portToRoot: Map<string, string>;
  rootToNodeId: Map<string, NodeId>;
  groundRoot: string | null;
  nodeToConnectedComponents: Map<NodeId, Set<string>>;
} {
  const portKeys: string[] = [];
  for (const comp of components) {
    for (const port of comp.ports) {
      portKeys.push(`${comp.id}:${port.id}`);
    }
  }

  const uf = makeUnionFind(portKeys);

  for (const wire of wires) {
    const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
    const toKey = `${wire.toComponentId}:${wire.toPortId}`;
    if (!uf.parent.has(fromKey) || !uf.parent.has(toKey)) continue;
    uf.union(fromKey, toKey);
  }

  let groundRoot: string | null = null;
  const ground = components.find((c) => c.type === 'ground');
  if (ground && ground.ports[0]) {
    const groundPortKey = `${ground.id}:${ground.ports[0].id}`;
    if (uf.parent.has(groundPortKey)) {
      groundRoot = uf.find(groundPortKey);
    }
  }

  const rootToNodeId = new Map<string, NodeId>();
  for (const key of uf.parent.keys()) {
    const root = uf.find(key);
    if (!rootToNodeId.has(root)) {
      rootToNodeId.set(root, root === groundRoot ? '0' : root);
    }
  }

  const nodeToConnectedComponents = new Map<NodeId, Set<string>>();
  for (const comp of components) {
    for (const port of comp.ports) {
      const portKey = `${comp.id}:${port.id}`;
      if (!uf.parent.has(portKey)) continue;
      const root = uf.find(portKey);
      const nodeId = rootToNodeId.get(root)!;
      if (!nodeToConnectedComponents.has(nodeId)) nodeToConnectedComponents.set(nodeId, new Set());
      nodeToConnectedComponents.get(nodeId)!.add(comp.id);
    }
  }

  return { portToRoot: uf.parent, rootToNodeId, groundRoot, nodeToConnectedComponents };
}

/**
 * Resolves the NodeId for a specific port on a component.
 */
function getNodeIdForPort(
  rootToNodeId: Map<string, NodeId>,
  findRoot: (key: string) => string,
  componentId: string,
  portId: string
): NodeId | null {
  const key = `${componentId}:${portId}`;
  const root = findRoot(key);
  return rootToNodeId.get(root) ?? null;
}

/**
 * Constructs graph edges representing components connecting electrical nodes.
 */
function buildComponentEdges(
  components: CircuitComponent[],
  findRoot: (key: string) => string,
  rootToNodeId: Map<string, NodeId>
): ComponentEdge[] {
  const edges: ComponentEdge[] = [];
  for (const comp of components) {
    if (!isTwoTerminalComponent(comp)) continue;
    if (!comp.ports[0] || !comp.ports[1]) continue;

    const n1 = getNodeIdForPort(rootToNodeId, findRoot, comp.id, comp.ports[0].id);
    const n2 = getNodeIdForPort(rootToNodeId, findRoot, comp.id, comp.ports[1].id);
    if (!n1 || !n2) continue;

    edges.push({
      componentId: comp.id,
      type: comp.type,
      n1,
      n2,
      effectiveResistanceOhms: getEffectiveResistanceOhms(comp),
    });
  }
  return edges;
}

/**
 * Adds an undirected edge to an adjacency list.
 */
function addUndirectedEdge<T>(
  adjacency: Map<NodeId, T[]>,
  from: NodeId,
  entry: T
): void {
  if (!adjacency.has(from)) adjacency.set(from, []);
  adjacency.get(from)!.push(entry);
}

/**
 * Performs BFS to find all reachable nodes from a start node in the given adjacency graph.
 * Optionally skips edges belonging to a specific component.
 */
function bfsReachable(
  adjacency: Map<NodeId, Array<{ to: NodeId; componentId: string }>>,
  start: NodeId,
  skipComponentId?: string
): Set<NodeId> {
  const visited = new Set<NodeId>();
  const queue: NodeId[] = [];
  visited.add(start);
  queue.push(start);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const edges = adjacency.get(cur) ?? [];
    for (const e of edges) {
      if (skipComponentId && e.componentId === skipComponentId) continue;
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      queue.push(e.to);
    }
  }

  return visited;
}

/**
 * Builds an adjacency graph considering only 0-Ohm (or near 0-Ohm) components.
 * Used for detecting short circuits.
 */
function buildZeroOhmAdjacency(edges: ComponentEdge[]): Map<NodeId, Array<{ to: NodeId; componentId: string }>> {
  const adjacency = new Map<NodeId, Array<{ to: NodeId; componentId: string }>>();

  for (const e of edges) {
    if (e.type === 'inductor') continue; // PWR-002: Inductor is not a 0Ω element.

    const r = e.effectiveResistanceOhms;
    const isZeroOhm =
      e.type === 'switch' ||
      e.type === 'ammeter' ||
      (typeof r === 'number' && r <= ZERO_OHM_THRESHOLD_OHMS);

    if (!isZeroOhm) continue;

    addUndirectedEdge(adjacency, e.n1, { to: e.n2, componentId: e.componentId });
    addUndirectedEdge(adjacency, e.n2, { to: e.n1, componentId: e.componentId });
  }

  return adjacency;
}

/**
 * Builds a full adjacency graph including all component connections.
 */
function buildAllComponentAdjacency(edges: ComponentEdge[]): Map<NodeId, Array<{ to: NodeId; componentId: string }>> {
  const adjacency = new Map<NodeId, Array<{ to: NodeId; componentId: string }>>();
  for (const e of edges) {
    addUndirectedEdge(adjacency, e.n1, { to: e.n2, componentId: e.componentId });
    addUndirectedEdge(adjacency, e.n2, { to: e.n1, componentId: e.componentId });
  }
  return adjacency;
}

/**
 * Groups nodes that are connected by 0-Ohm paths into integer group IDs.
 */
function computeZeroOhmGroups(
  nodeIds: Iterable<NodeId>,
  zeroOhmAdjacency: Map<NodeId, Array<{ to: NodeId; componentId: string }>>
): Map<NodeId, number> {
  const groupByNode = new Map<NodeId, number>();
  let group = 0;

  for (const n of nodeIds) {
    if (groupByNode.has(n)) continue;
    groupByNode.set(n, group);
    const queue: NodeId[] = [n];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const edges = zeroOhmAdjacency.get(cur) ?? [];
      for (const e of edges) {
        if (groupByNode.has(e.to)) continue;
        groupByNode.set(e.to, group);
        queue.push(e.to);
      }
    }
    group++;
  }

  return groupByNode;
}

/**
 * Identifies nodes that are part of any closed loop (cycle) in the circuit graph.
 * Uses Tarjan's bridge-finding algorithm or similar DFS approach to find cycles.
 */
function computeNodesInAnyClosedLoop(
  nodeIds: NodeId[],
  edges: ComponentEdge[]
): Set<NodeId> {
  const adj = new Map<NodeId, Array<{ to: NodeId; edgeId: string }>>();
  for (const e of edges) {
    addUndirectedEdge(adj, e.n1, { to: e.n2, edgeId: e.componentId });
    addUndirectedEdge(adj, e.n2, { to: e.n1, edgeId: e.componentId });
  }

  let time = 0;
  const disc = new Map<NodeId, number>();
  const low = new Map<NodeId, number>();
  const bridges = new Set<string>();

  const dfs = (u: NodeId, parentEdgeId: string | null): void => {
    time += 1;
    disc.set(u, time);
    low.set(u, time);

    const neighbors = adj.get(u) ?? [];
    for (const { to: v, edgeId } of neighbors) {
      if (edgeId === parentEdgeId) continue;

      if (!disc.has(v)) {
        dfs(v, edgeId);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));
        if (low.get(v)! > disc.get(u)!) {
          bridges.add(edgeId);
        }
      } else {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  };

  for (const n of nodeIds) {
    if (disc.has(n)) continue;
    dfs(n, null);
  }

  const inLoop = new Set<NodeId>();
  for (const e of edges) {
    if (e.n1 === e.n2) {
      inLoop.add(e.n1);
      continue;
    }
    if (!bridges.has(e.componentId)) {
      inLoop.add(e.n1);
      inLoop.add(e.n2);
    }
  }

  return inLoop;
}

/**
 * Evaluates a set of design rules against the circuit.
 * Checks for issues like short circuits, floating nodes, and missing current limiting.
 */
export function evaluateCircuitDesignRules(
  components: CircuitComponent[],
  wires: Wire[],
  options?: CircuitRuleEngineOptions
): CircuitRuleViolation[] {
  const violations: CircuitRuleViolation[] = [];
  const rMinOhms = options?.rMinOhms ?? DEFAULT_R_MIN_OHMS;

  const nodeBuild = buildElectricalNodes(components, wires);
  const findRoot = (key: string) => {
    const parent = nodeBuild.portToRoot.get(key);
    if (!parent) return key;
    let current = key;
    while (nodeBuild.portToRoot.get(current) !== current) {
      current = nodeBuild.portToRoot.get(current)!;
    }
    nodeBuild.portToRoot.set(key, current);
    return current;
  };

  // PWR-001: No ground reference (nodeId = 0) in circuit.
  // PWR-001: Circuit 中不存在 nodeId = 0
  if (!components.some((c) => c.type === 'ground')) {
    addViolation(
      violations,
      'PWR-001',
      'ERROR',
      [],
      'Circuit has no ground reference node (nodeId = 0).',
      'Add a Ground component and connect it to the circuit.'
    );
  }

  const edges = buildComponentEdges(components, findRoot, nodeBuild.rootToNodeId);

  const zeroOhmAdj = buildZeroOhmAdjacency(edges);
  const allAdj = buildAllComponentAdjacency(edges);
  const nodeIds = nodeBuild.nodeToConnectedComponents.keys();
  const zeroOhmGroup = computeZeroOhmGroups(nodeIds, zeroOhmAdj);

  const sources = components.filter(isTwoTerminalIdealVoltageSource);

  // PWR-002: Ideal voltage source shorted (including equivalent 0Ω path).
  // PWR-002: 理想電壓源短路（含等效 0Ω 路徑）
  for (const src of sources) {
    const nPos = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[0].id);
    const nNeg = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[1].id);
    if (!nPos || !nNeg) continue;

    if (nPos === nNeg) {
      addViolation(
        violations,
        'PWR-002',
        'ERROR',
        [src.id],
        'Ideal voltage source is shorted by a wire path between + and - terminals.',
        'Insert an explicit series resistor (e.g., >= 1Ω) or fix wiring.'
      );
      continue;
    }

    const reachable = bfsReachable(zeroOhmAdj, nPos);
    if (reachable.has(nNeg)) {
      addViolation(
        violations,
        'PWR-002',
        'ERROR',
        [src.id],
        'Ideal voltage source is shorted by an equivalent 0Ω path between + and - terminals.',
        'Insert an explicit series resistor (e.g., >= 1Ω) or fix wiring.'
      );
    }
  }

  // TOP-002: Open loop (no return path from source positive to negative terminal).
  // TOP-002: 未閉合回路（source 正端到負端無回路）
  for (const src of sources) {
    const nPos = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[0].id);
    const nNeg = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[1].id);
    if (!nPos || !nNeg) continue;

    const reachable = bfsReachable(allAdj, nPos, src.id);
    if (!reachable.has(nNeg)) {
      addViolation(
        violations,
        'TOP-002',
        'ERROR',
        [src.id],
        'Source has no closed loop (no return path from + to - terminals).',
        'Check for broken wires, floating terminals, or missing return path.'
      );
    }
  }

  // REA-001 / REA-002: Capacitor/Inductor connected directly to ideal voltage source (no series impedance).
  // REA-001 / REA-002: C/L 直接接理想電壓源（無串聯阻抗）
  for (const src of sources) {
    const nPos = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[0].id);
    const nNeg = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[1].id);
    if (!nPos || !nNeg) continue;

    const gPos = zeroOhmGroup.get(nPos);
    const gNeg = zeroOhmGroup.get(nNeg);
    if (gPos === undefined || gNeg === undefined) continue;

    for (const comp of components) {
      if (!isTwoTerminalComponent(comp)) continue;
      if (!isCapacitorType(comp.type) && !isInductorType(comp.type)) continue;

      const c1 = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, comp.id, comp.ports[0].id);
      const c2 = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, comp.id, comp.ports[1].id);
      if (!c1 || !c2) continue;

      const gc1 = zeroOhmGroup.get(c1);
      const gc2 = zeroOhmGroup.get(c2);
      if (gc1 === undefined || gc2 === undefined) continue;

      const directlyAcross =
        (gc1 === gPos && gc2 === gNeg) ||
        (gc1 === gNeg && gc2 === gPos);

      if (!directlyAcross) continue;

      if (isCapacitorType(comp.type)) {
        addViolation(
          violations,
          'REA-001',
          'WARNING',
          [src.id, comp.id],
          'Capacitor forms a direct loop with an ideal voltage source with no series impedance.',
          'Add a series resistor/impedance to limit inrush current.'
        );
      } else {
        addViolation(
          violations,
          'REA-002',
          'WARNING',
          [src.id, comp.id],
          'Inductor forms a direct loop with an ideal voltage source with no series impedance.',
          'Add a series resistor/impedance to limit di/dt.'
        );
      }
    }
  }

  // CUR-001: LED lacks computable current limiting.
  // CUR-001: LED 缺少可計算之電流限制
  const limitingComponentIds = new Set(
    edges
      .filter((e) => {
        const r = e.effectiveResistanceOhms;
        return typeof r === 'number' && r >= rMinOhms;
      })
      .map((e) => e.componentId)
  );

  const allowedAdjNoLimiting = new Map<NodeId, Array<{ to: NodeId; componentId: string }>>();
  for (const e of edges) {
    if (limitingComponentIds.has(e.componentId)) continue;
    addUndirectedEdge(allowedAdjNoLimiting, e.n1, { to: e.n2, componentId: e.componentId });
    addUndirectedEdge(allowedAdjNoLimiting, e.n2, { to: e.n1, componentId: e.componentId });
  }

  const leds = components.filter(isTwoTerminalLED);
  for (const src of sources) {
    const sPos = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[0].id);
    const sNeg = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[1].id);
    if (!sPos || !sNeg) continue;

    for (const led of leds) {
      const a = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, led.id, led.ports[0].id);
      const b = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, led.id, led.ports[1].id);
      if (!a || !b) continue;

      const reachFromPos = bfsReachable(allowedAdjNoLimiting, sPos, led.id);
      if (!reachFromPos.has(a) && !reachFromPos.has(b)) continue;
      const reachFromNeg = bfsReachable(allowedAdjNoLimiting, sNeg, led.id);

      const ledOnUnrestrictedPath =
        (reachFromPos.has(a) && reachFromNeg.has(b)) ||
        (reachFromPos.has(b) && reachFromNeg.has(a));

      if (!ledOnUnrestrictedPath) continue;

      addViolation(
        violations,
        'CUR-001',
        'ERROR',
        [led.id, src.id],
        'LED has no computable current limiting element on all source-to-LED paths.',
        `Add a series resistor with R >= ${rMinOhms}Ω between LED and the voltage source.`
      );
    }
  }

  // CUR-002: Non-linear device directly connected to ideal source (no obvious current limiting).
  // CUR-002: 非線性元件直接接理想源（無明顯限流元件）
  for (const src of sources) {
    const nPos = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[0].id);
    const nNeg = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, src.id, src.ports[1].id);
    if (!nPos || !nNeg) continue;
    const gPos = zeroOhmGroup.get(nPos);
    const gNeg = zeroOhmGroup.get(nNeg);
    if (gPos === undefined || gNeg === undefined) continue;

    for (const comp of components) {
      if (!isNonLinearDeviceType(comp.type)) continue;
      if (comp.ports.length < 2) continue;

      const terminalGroups: number[] = [];
      for (const port of comp.ports) {
        const node = getNodeIdForPort(nodeBuild.rootToNodeId, findRoot, comp.id, port.id);
        if (!node) continue;
        const g = zeroOhmGroup.get(node);
        if (g === undefined) continue;
        terminalGroups.push(g);
      }

      const touchesPos = terminalGroups.includes(gPos);
      const touchesNeg = terminalGroups.includes(gNeg);
      if (!touchesPos || !touchesNeg) continue;

      addViolation(
        violations,
        'CUR-002',
        'WARNING',
        [comp.id, src.id],
        'Non-linear device is directly connected to an ideal voltage source with no obvious current limiting element.',
        `Add a series resistor/impedance (e.g., R >= ${rMinOhms}Ω) in the device branch.`
      );
    }
  }

  // TOP-001: Floating node.
  // TOP-001: 浮接節點
  const groundNodeId = nodeBuild.groundRoot ? nodeBuild.rootToNodeId.get(nodeBuild.groundRoot) : null;
  const nodesInLoop = computeNodesInAnyClosedLoop(Array.from(nodeBuild.nodeToConnectedComponents.keys()), edges);
  for (const [nodeId, compsOnNode] of nodeBuild.nodeToConnectedComponents.entries()) {
    if (groundNodeId && nodeId === groundNodeId) continue;
    if (compsOnNode.size <= 1) {
      addViolation(
        violations,
        'TOP-001',
        'WARNING',
        Array.from(compsOnNode),
        'Floating node detected (node connects to only one component).',
        'Connect the node into a closed loop or reference network, or remove dangling wiring.'
      );
      continue;
    }

    if (!nodesInLoop.has(nodeId)) {
      addViolation(
        violations,
        'TOP-001',
        'WARNING',
        Array.from(compsOnNode),
        'Floating node detected (node is not part of any closed loop).',
        'Connect the node into a closed loop or reference network, or remove dangling wiring.'
      );
    }
  }

  return violations;
}
