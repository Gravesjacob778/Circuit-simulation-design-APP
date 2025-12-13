/**
 * SimulationTypes.ts - 模擬相關的類型定義
 */

/**
 * 模擬結果
 */
export interface DCSimulationResult {
  /** 節點電壓 (節點ID → 電壓值 V) */
  nodeVoltages: Map<string, number>;
  /** 支路電流 (元件ID → 電流值 A) */
  branchCurrents: Map<string, number>;
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 */
  error?: string;
}

/**
 * 電路節點
 */
export interface CircuitNode {
  id: string;
  /** 連接到此節點的端點 */
  connectedPorts: Array<{
    componentId: string;
    portId: string;
  }>;
  /** 是否為接地節點 */
  isGround: boolean;
}

/**
 * MNA 矩陣建構所需的元件印記
 */
export interface ComponentStamp {
  /** 元件 ID */
  componentId: string;
  /** 元件類型 */
  type: string;
  /** 節點 1 的索引 (-1 表示接地) */
  node1Index: number;
  /** 節點 2 的索引 (-1 表示接地) */
  node2Index: number;
  /** 元件值 (電阻值 Ω、電壓值 V 等) */
  value: number;
  /** 對於電壓源，額外電流變數的索引 */
  currentVarIndex?: number;
}
