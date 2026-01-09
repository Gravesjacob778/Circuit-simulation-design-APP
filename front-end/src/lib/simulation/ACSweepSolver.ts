/**
 * ACSweepSolver.ts - AC 頻率掃描分析求解器
 * 實作複數 MNA (Modified Nodal Analysis) 方法進行 AC 穩態分析
 */

import type { CircuitComponent, Wire } from '@/types/circuit';
import type {
  ACSweepOptions,
  ACSweepResult,
  ACFrequencyPoint,
  ACPhasor,
  ImpedanceData,
  ResonanceInfo,
  ComponentStamp,
} from './SimulationTypes';
import { CircuitGraph } from './CircuitGraph';
import {
  createComplexMatrix,
  createComplexVector,
  complexGaussianElimination,
  addToMatrix,
  addToVector,
} from './ComplexMatrix';
import {
  complex,
  fromPolar,
  add,
  subtract,
  multiply,
  divide,
  magnitude,
  phase,
  phaseDegrees,
  admittanceCapacitor,
  admittanceInductor,
  type Complex,
} from './Complex';

/**
 * AC 掃頻求解器類
 */
export class ACSweepSolver {
  private graph: CircuitGraph;

  constructor() {
    this.graph = new CircuitGraph();
  }

  /**
   * 執行 AC 掃頻分析
   */
  public solve(
    components: CircuitComponent[],
    wires: Wire[],
    options: Partial<ACSweepOptions> = {}
  ): ACSweepResult {
    // 合併預設選項
    const sweepOptions: ACSweepOptions = {
      startFrequency: options.startFrequency ?? 1,
      endFrequency: options.endFrequency ?? 1e6,
      pointsPerDecade: options.pointsPerDecade ?? 10,
      sweepType: options.sweepType ?? 'logarithmic',
    };

    // 驗證電路
    const validation = this.validateCircuit(components, wires);
    if (!validation.valid) {
      return this.createErrorResult(validation.error!, sweepOptions);
    }

    // 建立電路圖
    this.graph.build(components, wires);

    const nodeCount = this.graph.getNodeCount();
    const vsCount = this.graph.getVoltageSourceCount();

    if (nodeCount === 0) {
      return this.createErrorResult(
        '電路中沒有可分析的節點（可能缺少接地或元件未連接）',
        sweepOptions
      );
    }

    // 生成頻率點
    const frequencies = this.generateFrequencyPoints(sweepOptions);
    const frequencyPoints: ACFrequencyPoint[] = [];
    const stamps = this.graph.getStamps();

    // 追蹤各元件的阻抗數據
    const impedanceDataMap = new Map<string, { magnitudes: number[]; phases: number[]; label: string }>();

    // 初始化阻抗追蹤
    for (const stamp of stamps) {
      if (stamp.type === 'resistor' || stamp.type === 'capacitor' || stamp.type === 'inductor') {
        impedanceDataMap.set(stamp.componentId, {
          magnitudes: [],
          phases: [],
          label: this.getComponentLabel(stamp, components),
        });
      }
    }

    // 對每個頻率點進行分析
    for (const freq of frequencies) {
      const omega = 2 * Math.PI * freq;
      const result = this.solveAtFrequency(
        stamps,
        nodeCount,
        vsCount,
        omega,
        components
      );

      if (!result) {
        return this.createErrorResult(
          `無法在頻率 ${freq} Hz 求解電路`,
          sweepOptions
        );
      }

      // 計算各元件阻抗
      const componentImpedances = this.calculateComponentImpedances(
        stamps,
        omega,
        components
      );

      // 記錄阻抗數據
      for (const [compId, impedance] of componentImpedances) {
        const data = impedanceDataMap.get(compId);
        if (data) {
          data.magnitudes.push(impedance.magnitude);
          data.phases.push(impedance.phaseDegrees);
        }
      }

      frequencyPoints.push({
        frequency: freq,
        omega,
        nodeVoltages: result.nodeVoltages,
        branchCurrents: result.branchCurrents,
        componentImpedances,
      });
    }

    // 轉換阻抗數據格式
    const impedanceData: ImpedanceData[] = [];
    for (const [compId, data] of impedanceDataMap) {
      impedanceData.push({
        componentId: compId,
        label: data.label,
        frequencies,
        magnitudeOhms: data.magnitudes,
        phaseDegrees: data.phases,
      });
    }

    // 檢測共振點
    const resonances = this.detectResonances(frequencyPoints, impedanceData);

    return {
      frequencyPoints,
      frequencies,
      impedanceData,
      resonances,
      success: true,
      options: sweepOptions,
    };
  }

  /**
   * 生成頻率點陣列
   */
  private generateFrequencyPoints(options: ACSweepOptions): number[] {
    const { startFrequency, endFrequency, pointsPerDecade, sweepType } = options;
    const frequencies: number[] = [];

    if (sweepType === 'logarithmic') {
      // 對數掃頻
      const decades = Math.log10(endFrequency / startFrequency);
      const totalPoints = Math.ceil(decades * pointsPerDecade);

      for (let i = 0; i <= totalPoints; i++) {
        const f = startFrequency * Math.pow(10, i / pointsPerDecade);
        if (f <= endFrequency) {
          frequencies.push(f);
        }
      }
    } else {
      // 線性掃頻
      const step = (endFrequency - startFrequency) / pointsPerDecade;
      for (let f = startFrequency; f <= endFrequency; f += step) {
        frequencies.push(f);
      }
    }

    return frequencies;
  }

  /**
   * 在特定頻率求解電路
   */
  private solveAtFrequency(
    stamps: ComponentStamp[],
    nodeCount: number,
    vsCount: number,
    omega: number,
    components: CircuitComponent[]
  ): { nodeVoltages: Map<string, ACPhasor>; branchCurrents: Map<string, ACPhasor> } | null {
    const matrixSize = nodeCount + vsCount;
    const G = createComplexMatrix(matrixSize);
    const I = createComplexVector(matrixSize);

    // 加入元件印記
    for (const stamp of stamps) {
      this.addComplexStamp(G, I, stamp, nodeCount, omega, components);
    }

    // 求解複數線性方程組
    const x = complexGaussianElimination(G, I);

    if (!x) {
      return null;
    }

    // 提取節點電壓相量
    const nodeVoltages = this.extractNodeVoltagePhasors(x, nodeCount);

    // 提取支路電流相量
    const branchCurrents = this.extractBranchCurrentPhasors(
      x,
      stamps,
      nodeCount,
      omega
    );

    return { nodeVoltages, branchCurrents };
  }

  /**
   * 加入複數元件印記到 MNA 矩陣
   */
  private addComplexStamp(
    G: Complex[][],
    I: Complex[],
    stamp: ComponentStamp,
    nodeCount: number,
    omega: number,
    components: CircuitComponent[]
  ): void {
    const { type, node1Index, node2Index, value, currentVarIndex } = stamp;

    switch (type) {
      case 'resistor':
        this.addResistorStamp(G, node1Index, node2Index, value);
        break;

      case 'capacitor':
        this.addCapacitorStamp(G, node1Index, node2Index, value, omega);
        break;

      case 'inductor':
        if (currentVarIndex !== undefined) {
          this.addInductorStamp(G, I, node1Index, node2Index, value, omega, nodeCount + currentVarIndex);
        }
        break;

      case 'dc_source':
        // DC 源在 AC 分析中視為短路
        if (currentVarIndex !== undefined) {
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, complex(0, 0), nodeCount + currentVarIndex);
        }
        break;

      case 'ac_source': {
        // AC 源：使用 V = V_peak * e^(j*phase)
        if (currentVarIndex !== undefined) {
          const comp = components.find(c => c.id === stamp.componentId);
          const amplitude = value;
          const phaseRad = comp?.phase ?? 0;
          const voltage = fromPolar(amplitude, phaseRad);
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, voltage, nodeCount + currentVarIndex);
        }
        break;
      }

      case 'switch':
      case 'ammeter':
        // 小電阻
        this.addResistorStamp(G, node1Index, node2Index, type === 'switch' ? 0.01 : 0.001);
        break;

      case 'voltmeter':
        // 大電阻
        this.addResistorStamp(G, node1Index, node2Index, 1e12);
        break;

      case 'diode':
      case 'led':
        // 簡化模型：AC 分析中使用小信號電阻
        // 實際應該用線性化的二極體模型，這裡簡化為固定電阻
        this.addResistorStamp(G, node1Index, node2Index, 100); // 假設 100Ω 動態電阻
        if (currentVarIndex !== undefined) {
          // 處理未使用的電流變數
          const idx = nodeCount + currentVarIndex;
          G[idx]![idx]! = complex(1, 0);
          I[idx] = complex(0, 0);
        }
        break;
    }
  }

  /**
   * 加入電阻印記 (複數版本)
   */
  private addResistorStamp(
    G: Complex[][],
    n1: number,
    n2: number,
    resistance: number
  ): void {
    if (resistance <= 0) return;

    const g = complex(1 / resistance, 0); // 純實數電導

    if (n1 >= 0) addToMatrix(G, n1, n1, g);
    if (n2 >= 0) addToMatrix(G, n2, n2, g);
    if (n1 >= 0 && n2 >= 0) {
      addToMatrix(G, n1, n2, complex(-g.re, 0));
      addToMatrix(G, n2, n1, complex(-g.re, 0));
    }
  }

  /**
   * 加入電容印記
   * Y_C = jωC
   */
  private addCapacitorStamp(
    G: Complex[][],
    n1: number,
    n2: number,
    capacitance: number,
    omega: number
  ): void {
    const Y = admittanceCapacitor(capacitance, omega); // jωC

    if (n1 >= 0) addToMatrix(G, n1, n1, Y);
    if (n2 >= 0) addToMatrix(G, n2, n2, Y);
    if (n1 >= 0 && n2 >= 0) {
      const negY = complex(-Y.re, -Y.im);
      addToMatrix(G, n1, n2, negY);
      addToMatrix(G, n2, n1, negY);
    }
  }

  /**
   * 加入電感印記
   * 使用電壓源模型：V = jωL * I
   */
  private addInductorStamp(
    G: Complex[][],
    I: Complex[],
    n1: number,
    n2: number,
    inductance: number,
    omega: number,
    currentVarIndex: number
  ): void {
    // 電感方程：V(n1) - V(n2) = jωL * I_L
    // 改寫為：V(n1) - V(n2) - jωL * I_L = 0

    const jOmegaL = complex(0, omega * inductance);

    // 電壓約束方程
    if (n1 >= 0) addToMatrix(G, currentVarIndex, n1, complex(1, 0));
    if (n2 >= 0) addToMatrix(G, currentVarIndex, n2, complex(-1, 0));
    addToMatrix(G, currentVarIndex, currentVarIndex, complex(-jOmegaL.re, -jOmegaL.im));

    // 節點電流貢獻
    if (n1 >= 0) addToMatrix(G, n1, currentVarIndex, complex(1, 0));
    if (n2 >= 0) addToMatrix(G, n2, currentVarIndex, complex(-1, 0));

    // 右側為 0
    I[currentVarIndex] = complex(0, 0);
  }

  /**
   * 加入電壓源印記 (複數版本)
   */
  private addVoltageSourceStamp(
    G: Complex[][],
    I: Complex[],
    n1: number,
    n2: number,
    voltage: Complex,
    currentVarIndex: number
  ): void {
    if (n1 >= 0) addToMatrix(G, currentVarIndex, n1, complex(1, 0));
    if (n2 >= 0) addToMatrix(G, currentVarIndex, n2, complex(-1, 0));

    if (n1 >= 0) addToMatrix(G, n1, currentVarIndex, complex(1, 0));
    if (n2 >= 0) addToMatrix(G, n2, currentVarIndex, complex(-1, 0));

    I[currentVarIndex] = voltage;
  }

  /**
   * 提取節點電壓相量
   */
  private extractNodeVoltagePhasors(
    x: Complex[],
    nodeCount: number
  ): Map<string, ACPhasor> {
    const voltages = new Map<string, ACPhasor>();

    for (const [nodeId, node] of this.graph.getNodes()) {
      if (node.isGround) {
        voltages.set(nodeId, this.createPhasor(complex(0, 0)));
      } else {
        const index = this.graph.getNodeIndex(nodeId);
        if (index >= 0 && index < nodeCount) {
          voltages.set(nodeId, this.createPhasor(x[index]!));
        }
      }
    }

    return voltages;
  }

  /**
   * 提取支路電流相量
   */
  private extractBranchCurrentPhasors(
    x: Complex[],
    stamps: ComponentStamp[],
    nodeCount: number,
    omega: number
  ): Map<string, ACPhasor> {
    const currents = new Map<string, ACPhasor>();

    for (const stamp of stamps) {
      const { componentId, type, node1Index, node2Index, value, currentVarIndex } = stamp;

      switch (type) {
        case 'resistor': {
          const v1 = node1Index >= 0 ? x[node1Index]! : complex(0, 0);
          const v2 = node2Index >= 0 ? x[node2Index]! : complex(0, 0);
          const vDiff = subtract(v1, v2);
          const current = divide(vDiff, complex(value, 0));
          currents.set(componentId, this.createPhasor(current));
          break;
        }

        case 'capacitor': {
          const v1 = node1Index >= 0 ? x[node1Index]! : complex(0, 0);
          const v2 = node2Index >= 0 ? x[node2Index]! : complex(0, 0);
          const vDiff = subtract(v1, v2);
          // I = jωC * V
          const Y = admittanceCapacitor(value, omega);
          const current = multiply(Y, vDiff);
          currents.set(componentId, this.createPhasor(current));
          break;
        }

        case 'inductor':
        case 'dc_source':
        case 'ac_source':
          if (currentVarIndex !== undefined) {
            currents.set(componentId, this.createPhasor(x[nodeCount + currentVarIndex]!));
          }
          break;

        case 'switch':
        case 'ammeter': {
          const v1 = node1Index >= 0 ? x[node1Index]! : complex(0, 0);
          const v2 = node2Index >= 0 ? x[node2Index]! : complex(0, 0);
          const vDiff = subtract(v1, v2);
          const resistance = type === 'switch' ? 0.01 : 0.001;
          const current = divide(vDiff, complex(resistance, 0));
          currents.set(componentId, this.createPhasor(current));
          break;
        }
      }
    }

    return currents;
  }

  /**
   * 計算各元件的阻抗
   */
  private calculateComponentImpedances(
    stamps: ComponentStamp[],
    omega: number,
    _components: CircuitComponent[]
  ): Map<string, ACPhasor> {
    const impedances = new Map<string, ACPhasor>();

    for (const stamp of stamps) {
      const { componentId, type, value } = stamp;

      switch (type) {
        case 'resistor':
          impedances.set(componentId, this.createPhasor(complex(value, 0)));
          break;

        case 'capacitor': {
          // Z_C = 1/(jωC) = -j/(ωC)
          const Xc = omega > 0 ? -1 / (omega * value) : -1e12;
          impedances.set(componentId, this.createPhasor(complex(0, Xc)));
          break;
        }

        case 'inductor': {
          // Z_L = jωL
          const Xl = omega * value;
          impedances.set(componentId, this.createPhasor(complex(0, Xl)));
          break;
        }
      }
    }

    return impedances;
  }

  /**
   * 從複數建立 ACPhasor
   */
  private createPhasor(c: Complex): ACPhasor {
    const mag = magnitude(c);
    return {
      magnitude: mag,
      phase: phase(c),
      phaseDegrees: phaseDegrees(c),
      complex: c,
      rms: mag / Math.sqrt(2),
    };
  }

  /**
   * 取得元件標籤
   */
  private getComponentLabel(stamp: ComponentStamp, components: CircuitComponent[]): string {
    const comp = components.find(c => c.id === stamp.componentId);
    return comp?.label ?? stamp.componentId;
  }

  /**
   * 檢測共振點
   */
  private detectResonances(
    frequencyPoints: ACFrequencyPoint[],
    impedanceData: ImpedanceData[]
  ): ResonanceInfo[] {
    const resonances: ResonanceInfo[] = [];

    // 尋找阻抗最小值（串聯共振）或最大值（並聯共振）
    // 這裡簡化為尋找相位穿越 0 度的點

    for (const data of impedanceData) {
      const { frequencies, phaseDegrees: phases, magnitudeOhms } = data;

      for (let i = 1; i < phases.length; i++) {
        const prev = phases[i - 1]!;
        const curr = phases[i]!;

        // 檢測相位從負變正（串聯共振）或從正變負（並聯共振）
        if ((prev < 0 && curr >= 0) || (prev > 0 && curr <= 0)) {
          // 線性插值找到精確的共振頻率
          const f1 = frequencies[i - 1]!;
          const f2 = frequencies[i]!;
          const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
          const resonantFreq = f1 + ratio * (f2 - f1);

          // 估算 Q 值和頻寬
          const resonantMag = (magnitudeOhms[i - 1]! + magnitudeOhms[i]!) / 2;
          const halfPowerMag = resonantMag * Math.sqrt(2); // -3dB 點

          // 找 -3dB 頻率點
          let lowerCutoff = frequencies[0]!;
          let upperCutoff = frequencies[frequencies.length - 1]!;

          // 簡化：使用估算公式
          // 這裡可以改進為更精確的搜尋
          const qFactor = resonantFreq / (upperCutoff - lowerCutoff) || 1;
          const bandwidth = resonantFreq / qFactor;

          resonances.push({
            frequency: resonantFreq,
            type: prev < 0 ? 'series' : 'parallel',
            qFactor: Math.max(1, qFactor),
            bandwidth,
            lowerCutoff: resonantFreq - bandwidth / 2,
            upperCutoff: resonantFreq + bandwidth / 2,
          });
        }
      }
    }

    return resonances;
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

  /**
   * 建立錯誤結果
   */
  private createErrorResult(error: string, options: ACSweepOptions): ACSweepResult {
    return {
      frequencyPoints: [],
      frequencies: [],
      impedanceData: [],
      resonances: [],
      success: false,
      error,
      options,
    };
  }

  /**
   * 取得電路圖（用於除錯）
   */
  public getGraph(): CircuitGraph {
    return this.graph;
  }
}

/**
 * 建立並執行 AC 掃頻分析的便利函數
 */
export function runACSweepAnalysis(
  components: CircuitComponent[],
  wires: Wire[],
  options?: Partial<ACSweepOptions>
): ACSweepResult {
  const solver = new ACSweepSolver();
  return solver.solve(components, wires, options);
}
