/**
 * StreamingTransientSolver.ts - 串流式瞬態分析求解器
 * 支援即時逐步計算，適合動畫顯示
 * 使用 Backward Euler 積分方法
 */

import type { CircuitComponent, Wire, WaveformType } from '@/types/circuit';
import type {
  ComponentState,
  ComponentStamp,
} from './SimulationTypes';
import { CircuitGraph } from './CircuitGraph';
import { createMatrix, createVector, gaussianElimination } from './Matrix';
import { AC_SOURCE_DEFAULTS } from '@/config/componentDefinitions';
import { generateWaveform } from './TransientSolver';

/**
 * 串流模擬點
 */
export interface StreamingPoint {
  /** 模擬時間 (秒) */
  time: number;
  /** 節點電壓 (節點ID → 電壓值 V) */
  nodeVoltages: Map<string, number>;
  /** 支路電流 (元件ID → 電流值 A) */
  branchCurrents: Map<string, number>;
}

/**
 * 串流求解器選項
 */
export interface StreamingOptions {
  /** 時間步長 (秒)，若未指定則自動計算 */
  timeStep?: number;
  /** 最大迭代次數 (用於非線性收斂) */
  maxIterations?: number;
}

/**
 * 初始化結果
 */
export interface InitializeResult {
  success: boolean;
  error?: string;
  /** 自動計算的時間步長 */
  timeStep: number;
  /** AC 源的最高頻率 */
  maxFrequency: number;
}

/**
 * 內部求解器狀態
 */
interface SolverState {
  graph: CircuitGraph;
  stamps: ComponentStamp[];
  nodeCount: number;
  vsCount: number;
  dt: number;
  componentState: ComponentState;
  diodeStates: Map<string, boolean>;
  components: CircuitComponent[];
}

/**
 * 串流式瞬態分析求解器
 * 支援逐步計算，不需要預先指定結束時間
 */
export class StreamingTransientSolver {
  private state: SolverState | null = null;
  private currentTime: number = 0;
  private initialized: boolean = false;

  /**
   * 初始化求解器
   * @param components 電路元件列表
   * @param wires 導線列表
   * @param options 選項
   * @returns 初始化結果
   */
  public initialize(
    components: CircuitComponent[],
    wires: Wire[],
    options: StreamingOptions = {}
  ): InitializeResult {
    // 驗證電路
    const validation = this.validateCircuit(components, wires);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        timeStep: 0,
        maxFrequency: 0,
      };
    }

    // 建立電路圖
    const graph = new CircuitGraph();
    graph.build(components, wires);

    const nodeCount = graph.getNodeCount();
    const vsCount = graph.getVoltageSourceCount();

    if (nodeCount === 0) {
      return {
        success: false,
        error: '電路中沒有可分析的節點',
        timeStep: 0,
        maxFrequency: 0,
      };
    }

    // 檢查是否有 AC 源
    const hasAC = components.some(c => c.type === 'ac_source');

    // 找出最高頻率的 AC 源來決定時間步長
    let maxFrequency = AC_SOURCE_DEFAULTS.frequency;
    for (const comp of components) {
      if (comp.type === 'ac_source') {
        const freq = comp.frequency ?? AC_SOURCE_DEFAULTS.frequency;
        if (freq > maxFrequency) maxFrequency = freq;
      }
    }

    // 計算時間步長
    // AC: 週期的 1/100（細緻模擬波形）
    // DC: 固定 1/60 秒（配合 60fps 顯示）
    let dt: number;
    if (options.timeStep) {
      dt = options.timeStep;
    } else if (hasAC) {
      const period = 1 / maxFrequency;
      dt = period / 100;
    } else {
      // DC 模式：每秒 60 個點，配合顯示刷新率
      dt = 1 / 60;
    }

    // 取得並增強 stamps
    const stamps = graph.getStamps();
    const enhancedStamps = this.enhanceStampsWithACInfo(stamps, components);

    // 初始化動態元件狀態 (電容電壓、電感電流)
    const componentState: ComponentState = {
      capacitorVoltages: new Map(),
      inductorCurrents: new Map(),
    };

    // 設定初始條件 (假設所有初始值為 0)
    for (const comp of components) {
      if (comp.type === 'capacitor') {
        componentState.capacitorVoltages.set(comp.id, 0);
      } else if (comp.type === 'inductor') {
        componentState.inductorCurrents.set(comp.id, 0);
      }
    }

    // 二極體狀態
    const diodeStates = new Map<string, boolean>();
    for (const stamp of enhancedStamps) {
      if (stamp.type === 'diode' || stamp.type === 'led') {
        diodeStates.set(stamp.componentId, false);
      }
    }

    // 儲存狀態
    this.state = {
      graph,
      stamps: enhancedStamps,
      nodeCount,
      vsCount,
      dt,
      componentState,
      diodeStates,
      components,
    };

    this.currentTime = 0;
    this.initialized = true;

    return {
      success: true,
      timeStep: dt,
      maxFrequency,
    };
  }

  /**
   * 計算下一批模擬點
   * @param batchSize 批次大小 (每批計算多少個時間點)
   * @returns 模擬點陣列
   */
  public stepBatch(batchSize: number = 1): StreamingPoint[] {
    if (!this.initialized || !this.state) {
      return [];
    }

    const points: StreamingPoint[] = [];
    const { stamps, nodeCount, vsCount, dt, componentState, diodeStates, graph } = this.state;

    for (let i = 0; i < batchSize; i++) {
      // 在此時間點求解
      const result = this.solveAtTime(
        this.currentTime,
        dt,
        stamps,
        nodeCount,
        vsCount,
        componentState,
        diodeStates,
        graph
      );

      if (!result.success) {
        // 求解失敗，返回已計算的點
        break;
      }

      points.push({
        time: this.currentTime,
        nodeVoltages: result.nodeVoltages,
        branchCurrents: result.branchCurrents,
      });

      // 更新動態元件狀態
      this.updateComponentState(componentState, result.nodeVoltages, result.branchCurrents, stamps);

      // 推進時間
      this.currentTime += dt;
    }

    return points;
  }

  /**
   * 取得當前模擬時間
   */
  public getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * 取得時間步長
   */
  public getTimeStep(): number {
    return this.state?.dt ?? 0;
  }

  /**
   * 重置模擬器到初始狀態 (t=0)
   */
  public reset(): void {
    if (!this.state) return;

    this.currentTime = 0;

    // 重置動態元件狀態
    for (const comp of this.state.components) {
      if (comp.type === 'capacitor') {
        this.state.componentState.capacitorVoltages.set(comp.id, 0);
      } else if (comp.type === 'inductor') {
        this.state.componentState.inductorCurrents.set(comp.id, 0);
      }
    }

    // 重置二極體狀態
    for (const stamp of this.state.stamps) {
      if (stamp.type === 'diode' || stamp.type === 'led') {
        this.state.diodeStates.set(stamp.componentId, false);
      }
    }
  }

  /**
   * 檢查求解器是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 釋放資源
   */
  public dispose(): void {
    this.state = null;
    this.initialized = false;
    this.currentTime = 0;
  }

  // ========== 私有方法 ==========

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
    graph: CircuitGraph
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
    const nodeVoltages = this.extractNodeVoltages(x, nodeCount, graph);
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
          const waveformType = (stamp.waveformType ?? AC_SOURCE_DEFAULTS.waveformType) as WaveformType;
          const voltage = generateWaveform(t, value, frequency, phase, waveformType);
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, voltage, nodeCount + currentVarIndex);
        }
        break;
      }

      case 'capacitor': {
        // 電容的 Backward Euler 伴隨模型
        const C = value;
        const Geq = C / dt;
        const Vc_prev = state.capacitorVoltages.get(stamp.componentId) ?? 0;
        const Ieq = Geq * Vc_prev;

        // 加入等效電導
        this.addResistorStamp(G, node1Index, node2Index, 1 / Geq);

        // 加入等效電流源
        if (node1Index >= 0 && I[node1Index] !== undefined) I[node1Index]! += Ieq;
        if (node2Index >= 0 && I[node2Index] !== undefined) I[node2Index]! -= Ieq;
        break;
      }

      case 'inductor': {
        // 電感的 Backward Euler 伴隨模型
        const L = value;
        const Req = L / dt;
        const IL_prev = state.inductorCurrents.get(stamp.componentId) ?? 0;
        const Veq = Req * IL_prev;

        if (currentVarIndex !== undefined) {
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
        // 開關根據 switchClosed 屬性決定導通或斷開
        if (stamp.switchClosed) {
          this.addResistorStamp(G, node1Index, node2Index, 0.01); // 10mΩ
        } else {
          this.addResistorStamp(G, node1Index, node2Index, 1e12); // 1TΩ
        }
        break;

      case 'ammeter':
        this.addResistorStamp(G, node1Index, node2Index, 0.001);
        break;

      case 'voltmeter':
        this.addResistorStamp(G, node1Index, node2Index, 1e12);
        break;

      default:
        // 處理邏輯閘：輸出端口視為對地電壓源，輸入端口視為高阻抗
        if (type.startsWith('logic_')) {
          const { outputNodeIndex, logicOutputVoltage } = stamp;
          if (outputNodeIndex !== undefined && currentVarIndex !== undefined) {
            // 邏輯閘輸出視為對地的電壓源
            // 輸出電壓由 logicOutputVoltage 決定（HIGH = 5V, LOW = 0V）
            const voltage = logicOutputVoltage ?? 0;
            this.addVoltageSourceStamp(G, I, outputNodeIndex, -1, voltage, nodeCount + currentVarIndex);
          }
          // 邏輯閘輸入端口 (node1Index, node2Index) 視為高阻抗輸入
          // 添加對地的高阻抗來避免浮動節點
          if (node1Index >= 0) {
            this.addResistorStamp(G, node1Index, -1, 1e12); // 輸入 A 對地 1TΩ
          }
          if (node2Index >= 0) {
            this.addResistorStamp(G, node2Index, -1, 1e12); // 輸入 B 對地 1TΩ
          }
        }
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
  private extractNodeVoltages(x: number[], nodeCount: number, graph: CircuitGraph): Map<string, number> {
    const voltages = new Map<string, number>();

    for (const [nodeId, node] of graph.getNodes()) {
      if (node.isGround) {
        voltages.set(nodeId, 0);
      } else {
        const index = graph.getNodeIndex(nodeId);
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

        case 'switch': {
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          const resistance = stamp.switchClosed ? 0.01 : 1e12;
          currents.set(componentId, (v1 - v2) / resistance);
          break;
        }

        case 'ammeter': {
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          currents.set(componentId, (v1 - v2) / 0.001);
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

        default: {
          // 處理邏輯閘：輸出電流從電流變數讀取
          if (type.startsWith('logic_')) {
            if (currentVarIndex !== undefined) {
              currents.set(componentId, x[nodeCount + currentVarIndex]!);
            }
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
        // 更新電容電壓：透過節點電壓差計算
        const v1 = this.getNodeVoltageByIndex(nodeVoltages, stamp.node1Index);
        const v2 = this.getNodeVoltageByIndex(nodeVoltages, stamp.node2Index);
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
  private getNodeVoltageByIndex(nodeVoltages: Map<string, number>, nodeIndex: number): number {
    if (nodeIndex < 0) return 0; // 接地

    // 從 nodeVoltages map 中查找對應的電壓
    // 由於 nodeVoltages 是用 nodeId 作為 key，我們需要透過 graph 找到對應的 nodeId
    if (this.state) {
      for (const [nodeId, node] of this.state.graph.getNodes()) {
        if (!node.isGround && this.state.graph.getNodeIndex(nodeId) === nodeIndex) {
          return nodeVoltages.get(nodeId) ?? 0;
        }
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

    // 檢查電路迴圈是否閉合（考慮開關狀態）
    const loopValidation = this.validateClosedLoop(components, wires);
    if (!loopValidation.valid) {
      return loopValidation;
    }

    return { valid: true };
  }

  /**
   * 驗證電路是否形成閉合迴圈（考慮開關狀態）
   */
  private validateClosedLoop(
    components: CircuitComponent[],
    wires: Wire[]
  ): { valid: boolean; error?: string } {
    const componentMap = new Map<string, CircuitComponent>();
    for (const comp of components) {
      componentMap.set(comp.id, comp);
    }

    const openSwitches = components.filter(c => c.type === 'switch' && !c.switchClosed);
    if (openSwitches.length === 0) {
      return { valid: true };
    }

    const adjacency = new Map<string, Set<string>>();
    for (const comp of components) {
      for (const port of comp.ports) {
        adjacency.set(`${comp.id}:${port.id}`, new Set());
      }
    }

    for (const wire of wires) {
      const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
      const toKey = `${wire.toComponentId}:${wire.toPortId}`;
      adjacency.get(fromKey)?.add(toKey);
      adjacency.get(toKey)?.add(fromKey);
    }

    for (const comp of components) {
      // 跳過斷開的開關
      if (comp.type === 'switch' && !comp.switchClosed) continue;
      // 跳過電源 - 電流不能直接從正極流到負極（內部）
      if (comp.type === 'dc_source' || comp.type === 'ac_source') continue;
      if (comp.ports.length >= 2) {
        const ports = comp.ports.map(p => `${comp.id}:${p.id}`);
        for (let i = 0; i < ports.length; i++) {
          for (let j = i + 1; j < ports.length; j++) {
            adjacency.get(ports[i]!)?.add(ports[j]!);
            adjacency.get(ports[j]!)?.add(ports[i]!);
          }
        }
      }
    }

    const powerSources = components.filter(c => c.type === 'dc_source' || c.type === 'ac_source');
    for (const source of powerSources) {
      if (source.ports.length < 2) continue;
      const positivePortKey = `${source.id}:${source.ports[0]!.id}`;
      const visited = new Set<string>();
      const queue: string[] = [positivePortKey];
      visited.add(positivePortKey);
      let canReachGround = false;

      while (queue.length > 0) {
        const current = queue.shift()!;
        const [compId] = current.split(':');
        if (componentMap.get(compId!)?.type === 'ground') {
          canReachGround = true;
          break;
        }
        const neighbors = adjacency.get(current);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }

      if (!canReachGround) {
        const openSwitchNames = openSwitches.map(s => s.label || s.id).join(', ');
        return {
          valid: false,
          error: `電路斷路：開關 ${openSwitchNames} 為關閉狀態，電路無法形成閉合迴圈`,
        };
      }
    }

    return { valid: true };
  }
}
