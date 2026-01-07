/**
 * TransientSolver.ts - 瞬態分析求解器
 * 實作時域瞬態分析，支援 AC 電壓源、電容和電感的動態行為
 * 使用 Backward Euler 積分方法
 */

import type { CircuitComponent, Wire, WaveformType } from '@/types/circuit';
import type {
  TransientSimulationResult,
  TransientOptions,
  ComponentState,
  ComponentStamp,
} from './SimulationTypes';
import { CircuitGraph } from './CircuitGraph';
import { createMatrix, createVector, gaussianElimination } from './Matrix';
import { AC_SOURCE_DEFAULTS } from '@/config/componentDefinitions';

/**
 * 波形產生函數
 * @param t 當前時間 (秒)
 * @param amplitude 振幅 (峰值)
 * @param frequency 頻率 (Hz)
 * @param phase 相位 (rad)
 * @param waveformType 波形類型
 * @returns 瞬時電壓值
 */
export function generateWaveform(
  t: number,
  amplitude: number,
  frequency: number,
  phase: number,
  waveformType: WaveformType
): number {
  const omega = 2 * Math.PI * frequency;
  const theta = omega * t + phase;

  switch (waveformType) {
    case 'sine':
      return amplitude * Math.sin(theta);

    case 'square': {
      // 方波：正半週期為 +amplitude，負半週期為 -amplitude
      const normalizedPhase = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return normalizedPhase < Math.PI ? amplitude : -amplitude;
    }

    case 'triangle': {
      // 三角波：線性上升和下降
      const normalizedPhase = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (normalizedPhase < Math.PI) {
        // 上升段：0 到 π，從 -amplitude 到 +amplitude
        return amplitude * (2 * normalizedPhase / Math.PI - 1);
      } else {
        // 下降段：π 到 2π，從 +amplitude 到 -amplitude
        return amplitude * (3 - 2 * normalizedPhase / Math.PI);
      }
    }

    case 'sawtooth': {
      // 鋸齒波：線性上升後瞬間下降
      const normalizedPhase = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return amplitude * (normalizedPhase / Math.PI - 1);
    }

    default:
      return amplitude * Math.sin(theta);
  }
}

/**
 * 瞬態分析求解器類
 */
export class TransientSolver {
  private graph: CircuitGraph;

  constructor() {
    this.graph = new CircuitGraph();
  }

  /**
   * 執行瞬態分析
   * @param components 電路元件列表
   * @param wires 導線列表
   * @param options 瞬態分析選項
   * @returns 瞬態分析結果
   */
  public solve(
    components: CircuitComponent[],
    wires: Wire[],
    options: Partial<TransientOptions> = {}
  ): TransientSimulationResult {
    // 驗證電路
    const validation = this.validateCircuit(components, wires);
    if (!validation.valid) {
      return {
        timePoints: [],
        nodeVoltageHistory: new Map(),
        branchCurrentHistory: new Map(),
        success: false,
        error: validation.error,
        options: this.buildOptions(components, options),
      };
    }

    // 建立電路圖
    this.graph.build(components, wires);

    const nodeCount = this.graph.getNodeCount();
    const vsCount = this.graph.getVoltageSourceCount();

    if (nodeCount === 0) {
      return {
        timePoints: [],
        nodeVoltageHistory: new Map(),
        branchCurrentHistory: new Map(),
        success: false,
        error: '電路中沒有可分析的節點',
        options: this.buildOptions(components, options),
      };
    }

    // 計算模擬選項
    const fullOptions = this.buildOptions(components, options);
    const { startTime, endTime, timeStep } = fullOptions;
    const dt = timeStep!;

    // 初始化結果容器
    const timePoints: number[] = [];
    const nodeVoltageHistory = new Map<string, number[]>();
    const branchCurrentHistory = new Map<string, number[]>();

    // 初始化節點電壓歷史
    for (const [nodeId] of this.graph.getNodes()) {
      nodeVoltageHistory.set(nodeId, []);
    }

    // 初始化支路電流歷史
    const stamps = this.graph.getStamps();
    for (const stamp of stamps) {
      branchCurrentHistory.set(stamp.componentId, []);
    }

    // 初始化動態元件狀態 (電容電壓、電感電流)
    const state: ComponentState = {
      capacitorVoltages: new Map(),
      inductorCurrents: new Map(),
    };

    // 設定初始條件 (假設所有初始值為 0)
    for (const comp of components) {
      if (comp.type === 'capacitor') {
        state.capacitorVoltages.set(comp.id, 0);
      } else if (comp.type === 'inductor') {
        state.inductorCurrents.set(comp.id, 0);
      }
    }

    // 增強 stamps 以包含 AC 源的頻率/相位/波形資訊
    const enhancedStamps = this.enhanceStampsWithACInfo(stamps, components);

    // 二極體狀態
    const diodeStates = new Map<string, boolean>();
    for (const stamp of enhancedStamps) {
      if (stamp.type === 'diode' || stamp.type === 'led') {
        diodeStates.set(stamp.componentId, false);
      }
    }

    // 時間步進迴圈
    for (let t = startTime; t <= endTime; t += dt) {
      timePoints.push(t);

      // 在此時間點求解
      const result = this.solveAtTime(
        t,
        dt,
        enhancedStamps,
        nodeCount,
        vsCount,
        state,
        diodeStates,
        components
      );

      if (!result.success) {
        return {
          timePoints,
          nodeVoltageHistory,
          branchCurrentHistory,
          success: false,
          error: `在 t=${t.toFixed(6)}s 時求解失敗: ${result.error}`,
          options: fullOptions,
        };
      }

      // 儲存節點電壓
      for (const [nodeId, voltage] of result.nodeVoltages) {
        nodeVoltageHistory.get(nodeId)?.push(voltage);
      }

      // 儲存支路電流
      for (const [componentId, current] of result.branchCurrents) {
        branchCurrentHistory.get(componentId)?.push(current);
      }

      // 更新動態元件狀態
      this.updateComponentState(state, result.nodeVoltages, result.branchCurrents, enhancedStamps);
    }

    return {
      timePoints,
      nodeVoltageHistory,
      branchCurrentHistory,
      success: true,
      options: fullOptions,
    };
  }

  /**
   * 建立完整的選項物件
   */
  private buildOptions(
    components: CircuitComponent[],
    options: Partial<TransientOptions>
  ): TransientOptions {
    // 找出最高頻率的 AC 源來決定時間步長
    let maxFrequency = AC_SOURCE_DEFAULTS.frequency;
    for (const comp of components) {
      if (comp.type === 'ac_source') {
        const freq = comp.frequency ?? AC_SOURCE_DEFAULTS.frequency;
        if (freq > maxFrequency) maxFrequency = freq;
      }
    }

    // 預設模擬 3 個週期，時間步長為週期的 1/100
    const period = 1 / maxFrequency;
    const defaultEndTime = 3 * period;
    const defaultTimeStep = period / 100;

    return {
      startTime: options.startTime ?? 0,
      endTime: options.endTime ?? defaultEndTime,
      timeStep: options.timeStep ?? defaultTimeStep,
      maxIterations: options.maxIterations ?? 20,
    };
  }

  /**
   * 增強 stamps 以包含 AC 源資訊
   */
  private enhanceStampsWithACInfo(
    stamps: ComponentStamp[],
    components: CircuitComponent[]
  ): ComponentStamp[] {
    const componentMap = new Map(components.map(c => [c.id, c]));

    return stamps.map(stamp => {
      if (stamp.type === 'ac_source') {
        const comp = componentMap.get(stamp.componentId);
        return {
          ...stamp,
          frequency: comp?.frequency ?? AC_SOURCE_DEFAULTS.frequency,
          phase: comp?.phase ?? AC_SOURCE_DEFAULTS.phase,
          waveformType: comp?.waveformType ?? AC_SOURCE_DEFAULTS.waveformType,
        };
      }
      return stamp;
    });
  }

  /**
   * 在特定時間點求解
   */
  private solveAtTime(
    t: number,
    dt: number,
    stamps: ComponentStamp[],
    nodeCount: number,
    vsCount: number,
    state: ComponentState,
    diodeStates: Map<string, boolean>,
    _components: CircuitComponent[]
  ): { success: boolean; nodeVoltages: Map<string, number>; branchCurrents: Map<string, number>; error?: string } {
    const maxIterations = 20;
    let iterations = 0;
    let x: number[] | null = null;

    while (iterations < maxIterations) {
      const matrixSize = nodeCount + vsCount;
      const G = createMatrix(matrixSize);
      const I = createVector(matrixSize);

      // 加入元件印記
      for (const stamp of stamps) {
        this.addTransientStamp(G, I, stamp, nodeCount, t, dt, state, diodeStates);
      }

      // 求解
      x = gaussianElimination(G, I);

      if (!x) {
        return {
          success: false,
          nodeVoltages: new Map(),
          branchCurrents: new Map(),
          error: '矩陣奇異',
        };
      }

      // 檢查二極體狀態收斂
      let stateChanged = false;
      for (const stamp of stamps) {
        if (stamp.type === 'diode' || stamp.type === 'led') {
          const { componentId, node1Index, node2Index, value, currentVarIndex } = stamp;
          const isCurrentlyOn = diodeStates.get(componentId) || false;

          const v1 = node1Index >= 0 ? x[node1Index]! : 0;
          const v2 = node2Index >= 0 ? x[node2Index]! : 0;
          const vDrop = v1 - v2;
          const forwardVoltage = value;

          if (isCurrentlyOn) {
            if (currentVarIndex !== undefined) {
              const current = x[nodeCount + currentVarIndex]!;
              if (current < -1e-9) {
                diodeStates.set(componentId, false);
                stateChanged = true;
              }
            }
          } else {
            if (vDrop > forwardVoltage) {
              diodeStates.set(componentId, true);
              stateChanged = true;
            }
          }
        }
      }

      if (!stateChanged) {
        break;
      }
      iterations++;
    }

    if (!x) {
      return {
        success: false,
        nodeVoltages: new Map(),
        branchCurrents: new Map(),
        error: '求解失敗',
      };
    }

    // 提取結果
    const nodeVoltages = this.extractNodeVoltages(x, nodeCount);
    const branchCurrents = this.extractBranchCurrents(x, stamps, nodeCount, dt, state, diodeStates);

    return {
      success: true,
      nodeVoltages,
      branchCurrents,
    };
  }

  /**
   * 加入瞬態分析的元件印記
   */
  private addTransientStamp(
    G: number[][],
    I: number[],
    stamp: ComponentStamp,
    nodeCount: number,
    t: number,
    dt: number,
    state: ComponentState,
    diodeStates: Map<string, boolean>
  ): void {
    const { type, node1Index, node2Index, value, currentVarIndex } = stamp;

    switch (type) {
      case 'resistor':
        this.addResistorStamp(G, node1Index, node2Index, value);
        break;

      case 'dc_source':
        if (currentVarIndex !== undefined) {
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, value, nodeCount + currentVarIndex);
        }
        break;

      case 'ac_source': {
        // AC 源：計算當前時間的瞬時電壓
        if (currentVarIndex !== undefined) {
          const frequency = stamp.frequency ?? AC_SOURCE_DEFAULTS.frequency;
          const phase = stamp.phase ?? AC_SOURCE_DEFAULTS.phase;
          const waveformType = stamp.waveformType ?? AC_SOURCE_DEFAULTS.waveformType;
          const voltage = generateWaveform(t, value, frequency, phase, waveformType);
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, voltage, nodeCount + currentVarIndex);
        }
        break;
      }

      case 'capacitor': {
        // 電容的 Backward Euler 伴隨模型
        // G_eq = C / dt
        // I_eq = G_eq * V_c(t-dt)
        const C = value;
        const Geq = C / dt;
        const Vc_prev = state.capacitorVoltages.get(stamp.componentId) ?? 0;
        const Ieq = Geq * Vc_prev;

        // 加入等效電導
        this.addResistorStamp(G, node1Index, node2Index, 1 / Geq);

        // 加入等效電流源 (從 node1 流向 node2)
        if (node1Index >= 0 && I[node1Index] !== undefined) I[node1Index]! += Ieq;
        if (node2Index >= 0 && I[node2Index] !== undefined) I[node2Index]! -= Ieq;
        break;
      }

      case 'inductor': {
        // 電感的 Backward Euler 伴隨模型
        // R_eq = L / dt
        // V_eq = R_eq * I_L(t-dt)
        const L = value;
        const Req = L / dt;
        const IL_prev = state.inductorCurrents.get(stamp.componentId) ?? 0;
        const Veq = Req * IL_prev;

        if (currentVarIndex !== undefined) {
          // 使用電壓源模型：V(n1) - V(n2) - R_eq * i = V_eq
          // 改寫為：V(n1) - V(n2) = R_eq * i + V_eq
          this.addVoltageSourceWithResistanceStamp(
            G, I, node1Index, node2Index, Veq, Req, nodeCount + currentVarIndex
          );
        }
        break;
      }

      case 'diode':
      case 'led': {
        const isOn = diodeStates.get(stamp.componentId) ?? false;

        if (isOn) {
          if (currentVarIndex !== undefined) {
            const forwardVoltage = value;
            const rOn = 0.1;
            this.addVoltageSourceWithResistanceStamp(
              G, I, node1Index, node2Index, forwardVoltage, rOn, nodeCount + currentVarIndex
            );
          }
        } else {
          this.addResistorStamp(G, node1Index, node2Index, 1e9);
          if (currentVarIndex !== undefined) {
            const idx = nodeCount + currentVarIndex;
            G[idx]![idx]! = 1;
            I[idx] = 0;
          }
        }
        break;
      }

      case 'switch':
        this.addResistorStamp(G, node1Index, node2Index, 0.01);
        break;

      case 'ammeter':
        this.addResistorStamp(G, node1Index, node2Index, 0.001);
        break;

      case 'voltmeter':
        this.addResistorStamp(G, node1Index, node2Index, 1e12);
        break;
    }
  }

  /**
   * 加入電阻印記
   */
  private addResistorStamp(G: number[][], n1: number, n2: number, resistance: number): void {
    if (resistance <= 0) return;
    const g = 1 / resistance;

    if (n1 >= 0) G[n1]![n1]! += g;
    if (n2 >= 0) G[n2]![n2]! += g;
    if (n1 >= 0 && n2 >= 0) {
      G[n1]![n2]! -= g;
      G[n2]![n1]! -= g;
    }
  }

  /**
   * 加入電壓源印記
   */
  private addVoltageSourceStamp(
    G: number[][],
    I: number[],
    n1: number,
    n2: number,
    voltage: number,
    currentVarIndex: number
  ): void {
    if (n1 >= 0) G[currentVarIndex]![n1]! += 1;
    if (n2 >= 0) G[currentVarIndex]![n2]! -= 1;
    if (n1 >= 0) G[n1]![currentVarIndex]! += 1;
    if (n2 >= 0) G[n2]![currentVarIndex]! -= 1;
    I[currentVarIndex] = voltage;
  }

  /**
   * 加入帶串聯電阻的電壓源印記
   */
  private addVoltageSourceWithResistanceStamp(
    G: number[][],
    I: number[],
    n1: number,
    n2: number,
    voltage: number,
    resistance: number,
    currentVarIndex: number
  ): void {
    if (n1 >= 0) G[currentVarIndex]![n1]! += 1;
    if (n2 >= 0) G[currentVarIndex]![n2]! -= 1;
    G[currentVarIndex]![currentVarIndex]! -= resistance;
    I[currentVarIndex] = voltage;

    if (n1 >= 0) G[n1]![currentVarIndex]! += 1;
    if (n2 >= 0) G[n2]![currentVarIndex]! -= 1;
  }

  /**
   * 提取節點電壓
   */
  private extractNodeVoltages(x: number[], nodeCount: number): Map<string, number> {
    const voltages = new Map<string, number>();

    for (const [nodeId, node] of this.graph.getNodes()) {
      if (node.isGround) {
        voltages.set(nodeId, 0);
      } else {
        const index = this.graph.getNodeIndex(nodeId);
        if (index >= 0 && index < nodeCount) {
          voltages.set(nodeId, x[index]!);
        }
      }
    }

    return voltages;
  }

  /**
   * 提取支路電流
   */
  private extractBranchCurrents(
    x: number[],
    stamps: ComponentStamp[],
    nodeCount: number,
    dt: number,
    state: ComponentState,
    diodeStates: Map<string, boolean>
  ): Map<string, number> {
    const currents = new Map<string, number>();
    const nodeVoltages = x.slice(0, nodeCount);

    for (const stamp of stamps) {
      const { componentId, type, node1Index, node2Index, value, currentVarIndex } = stamp;

      switch (type) {
        case 'resistor':
        case 'voltmeter': {
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          const resistance = type === 'voltmeter' ? 1e12 : value;
          currents.set(componentId, (v1 - v2) / resistance);
          break;
        }

        case 'capacitor': {
          // 電容電流: i = C * dV/dt ≈ C * (V - V_prev) / dt
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          const Vc = v1 - v2;
          const Vc_prev = state.capacitorVoltages.get(componentId) ?? 0;
          const C = value;
          currents.set(componentId, C * (Vc - Vc_prev) / dt);
          break;
        }

        case 'diode':
        case 'led': {
          const isOn = diodeStates?.get(componentId) ?? false;
          if (isOn && currentVarIndex !== undefined) {
            currents.set(componentId, x[nodeCount + currentVarIndex]!);
          } else {
            const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
            const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
            currents.set(componentId, (v1 - v2) / 1e9);
          }
          break;
        }

        case 'switch':
        case 'ammeter': {
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          const resistance = type === 'switch' ? 0.01 : 0.001;
          currents.set(componentId, (v1 - v2) / resistance);
          break;
        }

        case 'dc_source':
        case 'ac_source':
        case 'inductor': {
          if (currentVarIndex !== undefined) {
            currents.set(componentId, x[nodeCount + currentVarIndex]!);
          }
          break;
        }
      }
    }

    return currents;
  }

  /**
   * 更新動態元件狀態
   */
  private updateComponentState(
    state: ComponentState,
    nodeVoltages: Map<string, number>,
    branchCurrents: Map<string, number>,
    stamps: ComponentStamp[]
  ): void {
    for (const stamp of stamps) {
      if (stamp.type === 'capacitor') {
        // 更新電容電壓
        const v1 = this.getNodeVoltage(nodeVoltages, stamp.node1Index);
        const v2 = this.getNodeVoltage(nodeVoltages, stamp.node2Index);
        state.capacitorVoltages.set(stamp.componentId, v1 - v2);
      } else if (stamp.type === 'inductor') {
        // 更新電感電流
        const current = branchCurrents.get(stamp.componentId) ?? 0;
        state.inductorCurrents.set(stamp.componentId, current);
      }
    }
  }

  /**
   * 根據節點索引取得電壓
   */
  private getNodeVoltage(nodeVoltages: Map<string, number>, nodeIndex: number): number {
    if (nodeIndex < 0) return 0; // 接地

    for (const [nodeId, node] of this.graph.getNodes()) {
      if (!node.isGround && this.graph.getNodeIndex(nodeId) === nodeIndex) {
        return nodeVoltages.get(nodeId) ?? 0;
      }
    }
    return 0;
  }

  /**
   * 驗證電路
   */
  private validateCircuit(
    components: CircuitComponent[],
    wires: Wire[]
  ): { valid: boolean; error?: string } {
    if (components.length === 0) {
      return { valid: false, error: '電路為空' };
    }

    const hasGround = components.some(c => c.type === 'ground');
    if (!hasGround) {
      return { valid: false, error: '電路缺少接地（Ground）元件' };
    }

    const groundIds = new Set(components.filter(c => c.type === 'ground').map(c => c.id));
    const hasGroundConnection = wires.some(w =>
      (groundIds.has(w.fromComponentId) && !groundIds.has(w.toComponentId)) ||
      (groundIds.has(w.toComponentId) && !groundIds.has(w.fromComponentId))
    );
    if (!hasGroundConnection) {
      return { valid: false, error: '接地（Ground）元件未連接到電路' };
    }

    const hasPowerSource = components.some(
      c => c.type === 'dc_source' || c.type === 'ac_source'
    );
    if (!hasPowerSource) {
      return { valid: false, error: '電路缺少電源（DC/AC Source）' };
    }

    if (wires.length === 0) {
      return { valid: false, error: '電路元件未連接（無導線）' };
    }

    return { valid: true };
  }
}

/**
 * 執行瞬態分析的便利函數
 */
export function runTransientAnalysis(
  components: CircuitComponent[],
  wires: Wire[],
  options?: Partial<TransientOptions>
): TransientSimulationResult {
  const solver = new TransientSolver();
  return solver.solve(components, wires, options);
}
