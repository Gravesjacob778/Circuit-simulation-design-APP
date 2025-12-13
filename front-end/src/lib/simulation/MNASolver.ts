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
    
    // MNA 矩陣大小 = 節點數 + 電壓源數
    const matrixSize = nodeCount + vsCount;
    
    // 建立 MNA 矩陣和向量
    const G = createMatrix(matrixSize); // 電導矩陣
    const I = createVector(matrixSize); // 電流向量
    
    // 加入元件印記
    const stamps = this.graph.getStamps();
    for (const stamp of stamps) {
      this.addStamp(G, I, stamp, nodeCount);
    }
    
    // 求解 Gx = I
    const x = gaussianElimination(G, I);
    
    if (!x) {
      return {
        nodeVoltages: new Map(),
        branchCurrents: new Map(),
        success: false,
        error: '無法求解電路（矩陣奇異，可能電路開路或短路）',
      };
    }
    
    // 提取結果
    const nodeVoltages = this.extractNodeVoltages(x, nodeCount);
    const branchCurrents = this.extractBranchCurrents(x, stamps, nodeCount, components);
    
    return {
      nodeVoltages,
      branchCurrents,
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
    nodeCount: number
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
        // 使用很小的電導代替開路
        this.addResistorStamp(G, node1Index, node2Index, 1e12); // 1TΩ 超高電阻
        break;
        
      case 'inductor':
        // DC 分析時，電感視為短路（零電壓）
        // 使用電壓源印記，電壓為 0
        if (currentVarIndex !== undefined) {
          this.addVoltageSourceStamp(G, I, node1Index, node2Index, 0, nodeCount + currentVarIndex);
        }
        break;
        
      case 'diode':
      case 'led':
        // 簡化的二極體模型：當作順向電壓降 + 串聯電阻
        // 實際應該用 Newton-Raphson 迭代求解非線性
        // 這裡簡化為小電阻 + 大電阻並聯，假設已導通
        this.addDiodeStamp(G, node1Index, node2Index, value);
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
   * 加入二極體印記（簡化模型）
   * 使用分段線性模型：導通時為小電阻，截止時為大電阻
   * 假設二極體已導通（需要迭代求解來確定實際狀態）
   */
  private addDiodeStamp(
    G: number[][], 
    n1: number, // 陽極 (anode)
    n2: number, // 陰極 (cathode)
    _forwardVoltage: number // 順向電壓降（目前簡化模型未使用）
  ): void {
    // 簡化模型：使用小電阻表示導通狀態
    // 實際應用中需要 Newton-Raphson 迭代來處理非線性
    const conductingResistance = 10; // 10Ω 導通電阻
    this.addResistorStamp(G, n1, n2, conductingResistance);
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
    _components: CircuitComponent[]
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
          // 簡化模型：使用導通電阻計算電流
          const v1 = node1Index >= 0 ? (nodeVoltages[node1Index] ?? 0) : 0;
          const v2 = node2Index >= 0 ? (nodeVoltages[node2Index] ?? 0) : 0;
          const current = (v1 - v2) / 10; // 10Ω 導通電阻
          currents.set(componentId, current);
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
