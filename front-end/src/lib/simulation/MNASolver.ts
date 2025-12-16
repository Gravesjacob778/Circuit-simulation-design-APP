/**
 * MNASolver.ts - 修正節點分析求解器
 * 實作 MNA (Modified Nodal Analysis) 方法進行 DC 穩態分析
 */

import type { CircuitComponent, Wire } from '@/types/circuit';
import type { DCSimulationResult, ComponentStamp } from './SimulationTypes';
import { CircuitGraph } from './CircuitGraph';
import { createMatrix, createVector, gaussianElimination } from './Matrix';

/**
 * MNA 求解器類
 */
export class MNASolver {
  private graph: CircuitGraph;

  constructor() {
    this.graph = new CircuitGraph();
  }

  /**
   * 執行 DC 穩態分析
   * @param components 電路元件列表
   * @param wires 導線列表
   * @returns 模擬結果
   */
  /**
   * 執行 DC 穩態分析
   * @param components 電路元件列表
   * @param wires 導線列表
   * @returns 模擬結果
   */
  public solve(components: CircuitComponent[], wires: Wire[]): DCSimulationResult {
    // 驗證電路
    const validation = this.validateCircuit(components, wires);
    if (!validation.valid) {
      return {
        nodeVoltages: new Map(),
        branchCurrents: new Map(),
        success: false,
        error: validation.error,
      };
    }

    // 建立電路圖
    this.graph.build(components, wires);

    const nodeCount = this.graph.getNodeCount();
    const vsCount = this.graph.getVoltageSourceCount();

    // 確保有節點可供分析
    if (nodeCount === 0) {
      return {
        nodeVoltages: new Map(),
        branchCurrents: new Map(),
        success: false,
        error: '電路中沒有可分析的節點（可能缺少接地或元件未連接）',
      };
    }

    // 迭代求解 (處理二極體/LED 非線性)
    // 初始猜測：所有二極體為關閉狀態 (OFF)
    // 如果電路中有電源且二極體順向偏壓大於閾值，則切換為開啟狀態 (ON)
    const diodeStates = new Map<string, boolean>(); // true = ON, false = OFF
    const stamps = this.graph.getStamps();

    // 初始化二極體狀態
    for (const stamp of stamps) {
      if (stamp.type === 'diode' || stamp.type === 'led') {
        diodeStates.set(stamp.componentId, false);
      }
    }

    let finalNodeVoltages: Map<string, number> = new Map();
    let finalBranchCurrents: Map<string, number> = new Map();
    let converged = false;
    let iterations = 0;
    const MAX_ITERATIONS = 20;

    while (iterations < MAX_ITERATIONS) {
      const matrixSize = nodeCount + vsCount;
      const G = createMatrix(matrixSize);
      const I = createVector(matrixSize);

      // 加入元件印記
      for (const stamp of stamps) {
        this.addStamp(G, I, stamp, nodeCount, diodeStates);
      }

      // 求解
      const x = gaussianElimination(G, I);

      if (!x) {
        return {
          nodeVoltages: new Map(),
          branchCurrents: new Map(),
          success: false,
          error: '無法求解電路（矩陣奇異，可能電路開路或短路）',
        };
      }

      // 提取本輪電壓
      const currentVoltages = this.extractNodeVoltages(x, nodeCount);

      // 檢查二極體狀態是否需要改變
      let stateChanged = false;

      for (const stamp of stamps) {
        if (stamp.type === 'diode' || stamp.type === 'led') {
          const { componentId, node1Index, node2Index, value } = stamp;
          const isCurrentlyOn = diodeStates.get(componentId) || false;

          // 取得節點電壓 (node1: 陽極, node2: 陰極)
          // 注意：nodeIndex -1 表示接地 (0V)
          // extractNodeVoltages 回傳的是 Map<nodeId, voltage>，但這裡我們需要用索引查 x
          // 修正：直接用 x 陣列查詢比較快，或是用 nodeVoltages Map 需要查表
          // 這裡直接用 x
          const v1 = node1Index >= 0 ? x[node1Index]! : 0;
          const v2 = node2Index >= 0 ? x[node2Index]! : 0;
          const vDrop = v1 - v2;

          const forwardVoltage = value; // 元件值即為順向電壓 (例如 0.7V 或 2.0V)

          if (isCurrentlyOn) {
            // 如果目前是 ON，若電流反向 (I < 0) 則應關閉
            // 這裡用電壓判斷：如果 Vdrop < Vf，支撐不住導通電壓？
            // 準確來說應用電流判斷，但混合模型中電流變數 x[nodeCount + currentVarIndex] 可用
            // 讓我們檢查電流
            if (stamp.currentVarIndex !== undefined) {
              const current = x[nodeCount + stamp.currentVarIndex]!;
              if (current < -1e-9) { // 允許微小誤差
                diodeStates.set(componentId, false);
                stateChanged = true;
              }
            }
          } else {
            // 如果目前是 OFF，若 Vdrop > Vf 則應開啟
            if (vDrop > forwardVoltage) {
              diodeStates.set(componentId, true);
              stateChanged = true;
            }
          }
        }
      }

      if (!stateChanged) {
        converged = true;
        finalNodeVoltages = currentVoltages;
        finalBranchCurrents = this.extractBranchCurrents(x, stamps, nodeCount, components, diodeStates);
        break;
      }

      iterations++;
    }

    if (!converged) {
      console.warn('DC 分析未收斂 (達到最大迭代次數)，回傳最後一次結果');
      // 仍然回傳最後一次結果，但要用以最後狀態計算電流
      // 注意：這裡如果沒收斂，變數可能不準確，但至少不會崩潰。實際應該用最後的 x
      // 簡單修復：直接宣告 x 在 scope 外或這裡不處理 (loop 外會有 return)
      // 但我們上面的 loop 結構是：如果 success -> break -> return. If iterations end -> warn -> continue.
    }

    // 如果 loop 結束但沒收斂， finalNodeVoltages 可能是空的
    if (finalNodeVoltages.size === 0 && stamps.length > 0) {
      // 重新執行最後一次計算以填入結果 (or simply grab from last iteration if we tracked it)
      // 這裡為了安全回傳最後一次的 x (假設 loop 跑完最後一次的 diodeStates 是可用的)
      // 為了簡化，我們假設至少跑了一次。
      const matrixSize = nodeCount + vsCount;
      const G = createMatrix(matrixSize);
      const I = createVector(matrixSize);
      for (const stamp of stamps) this.addStamp(G, I, stamp, nodeCount, diodeStates);
      const x = gaussianElimination(G, I);
      if (x) {
        finalNodeVoltages = this.extractNodeVoltages(x, nodeCount);
        finalBranchCurrents = this.extractBranchCurrents(x, stamps, nodeCount, components, diodeStates);
      }
    }

    return {
      nodeVoltages: finalNodeVoltages,
      branchCurrents: finalBranchCurrents,
      success: true,
    };
  }

  /**
   * 驗證電路
   */
  private validateCircuit(
    components: CircuitComponent[],
    wires: Wire[]
  ): { valid: boolean; error?: string } {
    // 檢查是否為空
    if (components.length === 0) {
      return { valid: false, error: '電路為空' };
    }

    // 檢查是否有接地
    const hasGround = components.some(c => c.type === 'ground');
    if (!hasGround) {
      return { valid: false, error: '電路缺少接地（Ground）元件' };
    }
    // 檢查接地是否有實際接入電路（至少要有一條導線把 GND 接到非接地元件）
    const groundIds = new Set(components.filter(c => c.type === 'ground').map(c => c.id));
    const hasGroundConnection = wires.some(w =>
      (groundIds.has(w.fromComponentId) && !groundIds.has(w.toComponentId)) ||
      (groundIds.has(w.toComponentId) && !groundIds.has(w.fromComponentId))
    );
    if (!hasGroundConnection) {
      return { valid: false, error: '接地（Ground）元件未連接到電路（請用導線將 GND 接到電路）' };
    }

    // 檢查是否有電源
    const hasPowerSource = components.some(
      c => c.type === 'dc_source' || c.type === 'ac_source'
    );
    if (!hasPowerSource) {
      return { valid: false, error: '電路缺少電源（DC/AC Source）' };
    }

    // 檢查是否有導線連接
    if (wires.length === 0) {
      return { valid: false, error: '電路元件未連接（無導線）' };
    }

    return { valid: true };
  }

  /**
   * 加入元件印記到 MNA 矩陣
   */
  private addStamp(
    G: number[][],
    I: number[],
    stamp: ComponentStamp,
    nodeCount: number,
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

      case 'ac_source':
        // DC 分析時，AC 源視為短路（0V）
        if (currentVarIndex !== undefined) {
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, 0, nodeCount + currentVarIndex);
        }
        break;

      case 'capacitor':
        // DC 分析時，電容視為開路（極大電阻）
        this.addResistorStamp(G, node1Index, node2Index, 1e12); // 1TΩ 超高電阻
        break;

      case 'inductor':
        // DC 分析時，電感視為短路（零電壓）
        if (currentVarIndex !== undefined) {
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, 0, nodeCount + currentVarIndex);
        }
        break;

      case 'diode':
      case 'led':
        // 二極體/LED 模型
        const isOn = diodeStates.get(stamp.componentId) ?? false;

        if (isOn) {
          // ON 狀態：使用電壓源模型 (Vf) + 串聯小電阻 (Ron)
          // V1 - V2 - Ron * i = Vf
          // 這樣可以準確模擬二極體的電壓降
          if (currentVarIndex !== undefined) {
            const forwardVoltage = value; // 元件值
            // 這裡使用 0.1 歐姆作為導通電阻，避免理想電壓源並聯造成奇異矩陣
            const rOn = 0.1;
            this.addVoltageSourceWithResistanceStamp(
              G, I, node1Index, node2Index, forwardVoltage, rOn, nodeCount + currentVarIndex
            );
          }
        } else {
          // OFF 狀態：使用大電阻 (1GΩ)
          // 同時我們要處理未使用的 currentVarIndex，避免矩陣奇異
          this.addResistorStamp(G, node1Index, node2Index, 1e9);

          if (currentVarIndex !== undefined) {
            // 使未使用的電流變數方程為 dummy: 1 * i = 0
            const idx = nodeCount + currentVarIndex;
            G[idx]![idx]! = 1;
            I[idx] = 0;
          }
        }
        break;

      case 'switch':
        // 開關預設為關閉（導通）狀態，當作小電阻
        this.addResistorStamp(G, node1Index, node2Index, 0.01); // 10mΩ
        break;

      case 'ammeter':
        // 電流表當作短路（理想電流表內阻為 0）
        this.addResistorStamp(G, node1Index, node2Index, 0.001); // 1mΩ
        break;

      case 'voltmeter':
        // 電壓表當作開路（理想電壓表內阻為無窮）
        this.addResistorStamp(G, node1Index, node2Index, 1e12); // 1TΩ
        break;
    }
  }

  /**
   * 加入電阻印記
   * 電阻的電導 g = 1/R 加入到對應節點
   */
  private addResistorStamp(
    G: number[][],
    n1: number,
    n2: number,
    resistance: number
  ): void {
    if (resistance <= 0) {
      console.warn('電阻值必須為正');
      return;
    }

    const g = 1 / resistance; // 電導

    // 自電導（對角線）
    if (n1 >= 0) G[n1]![n1]! += g;
    if (n2 >= 0) G[n2]![n2]! += g;

    // 互電導（非對角線）
    if (n1 >= 0 && n2 >= 0) {
      G[n1]![n2]! -= g;
      G[n2]![n1]! -= g;
    }
  }

  /**
   * 加入電壓源印記
   * 電壓源需要額外的電流變數
   */
  private addVoltageSourceStamp(
    G: number[][],
    I: number[],
    n1: number, // 正極節點
    n2: number, // 負極節點
    voltage: number,
    currentVarIndex: number
  ): void {
    // 電壓源方程: V(n1) - V(n2) = voltage
    // 使用額外的電流變數 i_vs

    // 在電流變數行加入電壓約束
    if (n1 >= 0) G[currentVarIndex]![n1]! += 1;
    if (n2 >= 0) G[currentVarIndex]![n2]! -= 1;

    // 在節點方程中加入電流貢獻
    if (n1 >= 0) G[n1]![currentVarIndex]! += 1;
    if (n2 >= 0) G[n2]![currentVarIndex]! -= 1;

    // 電壓值
    I[currentVarIndex] = voltage;
  }

  /**
   * 加入帶有串聯電阻的電壓源印記 (用於二極體 ON 狀態)
   * V(n1) - V(n2) - R_on * i_vs = V_f
   */
  private addVoltageSourceWithResistanceStamp(
    G: number[][],
    I: number[],
    n1: number, // 陽極節點
    n2: number, // 陰極節點
    forwardVoltage: number,
    resistance: number,
    currentVarIndex: number
  ): void {
    // 電壓約束方程: V(n1) - V(n2) - R_on * i_vs = V_f
    if (n1 >= 0) G[currentVarIndex]![n1]! += 1;
    if (n2 >= 0) G[currentVarIndex]![n2]! -= 1;
    G[currentVarIndex]![currentVarIndex]! -= resistance; // -R_on * i_vs
    I[currentVarIndex] = forwardVoltage;

    // 在節點方程中加入電流貢獻
    if (n1 >= 0) G[n1]![currentVarIndex]! += 1;
    if (n2 >= 0) G[n2]![currentVarIndex]! -= 1;
  }

  /**
   * 提取節點電壓
   */
  private extractNodeVoltages(x: number[], nodeCount: number): Map<string, number> {
    console.log(x);
    console.log(nodeCount);
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
    console.log(voltages);
    return voltages;
  }

  /**
   * 提取支路電流
   */
  private extractBranchCurrents(
    x: number[],
    stamps: ComponentStamp[],
    nodeCount: number,
    _components: CircuitComponent[],
    diodeStates?: Map<string, boolean>
  ): Map<string, number> {
    const currents = new Map<string, number>();
    const nodeVoltages = x.slice(0, nodeCount);

    for (const stamp of stamps) {
      const { componentId, type, node1Index, node2Index, value, currentVarIndex } = stamp;

      switch (type) {
        case 'resistor':
        case 'capacitor':
        case 'voltmeter': {
          // 電流 = (V1 - V2) / R
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          // 對於電容，使用超高電阻；對於電壓表同理
          const resistance = type === 'capacitor' || type === 'voltmeter' ? 1e12 : value;
          const current = (v1 - v2) / resistance;
          currents.set(componentId, current);
          break;
        }

        case 'diode':
        case 'led': {
          // 檢查二極體狀態
          const isOn = diodeStates?.get(componentId) ?? false;

          if (isOn && currentVarIndex !== undefined) {
            // ON 狀態：電流為 MNA 變數值
            currents.set(componentId, x[nodeCount + currentVarIndex]!);
          } else {
            // OFF 狀態：電阻漏電流 (1GΩ)
            const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
            const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
            const current = (v1 - v2) / 1e9;
            currents.set(componentId, current);
          }
          break;
        }

        case 'switch':
        case 'ammeter': {
          // 小電阻計算電流
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          const resistance = type === 'switch' ? 0.01 : 0.001;
          const current = (v1 - v2) / resistance;
          currents.set(componentId, current);
          break;
        }

        case 'dc_source':
        case 'ac_source':
        case 'inductor': {
          // 電壓源和電感的電流是額外變數
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
   * 取得電路圖（用於除錯）
   */
  public getGraph(): CircuitGraph {
    return this.graph;
  }
}

/**
 * 建立並執行 DC 分析的便利函數
 */
export function runDCAnalysis(
  components: CircuitComponent[],
  wires: Wire[]
): DCSimulationResult {
  const solver = new MNASolver();
  return solver.solve(components, wires);
}
