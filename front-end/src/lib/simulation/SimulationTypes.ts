/**
 * SimulationTypes.ts - 模擬相關的類型定義
 */

// ========== LED-001 規範常數 (Circuit Design Rule Specification v1.1) ==========
/**
 * LED 顏色類型
 */
export type LEDColor = 'Red' | 'Green' | 'Blue' | 'White';

/**
 * LED 順向電壓預設值 (單位: Volt)
 * 參照 LED_RULE.md Section 8.1
 */
export const LED_VF_DEFAULT: Record<LEDColor, number> = {
  Red: 1.8,
  Green: 2.1,
  Blue: 3.0,
  White: 3.0,
};

/**
 * LED 最小可見發光電流門檻 (單位: Ampere)
 * I_LED < I_emit_min 時，LED 導通但不可見發光
 * 參照 LED_RULE.md Section 8.1
 */
export const I_EMIT_MIN = 0.001; // 1mA

/**
 * 模擬結果
 */
export interface DCSimulationResult {
  /** 節點電壓 (節點ID → 電壓值 V) */
  nodeVoltages: Map<string, number>;
  /** 支路電流 (元件ID → 電流值 A) */
  branchCurrents: Map<string, number>;
  /** CDRS v1 rule violations (pre-simulation checks) */
  ruleViolations?: CircuitRuleViolation[];
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 */
  error?: string;
}

/**
 * Circuit Design Rules (CDRS v1)
 */
export type RuleSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface CircuitRuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  componentIds: string[];
  message: string;
  recommendation?: string;
}

export interface CircuitRuleEngineOptions {
  /** CUR-001 Normative: default R_min = 10Ω (overrideable by system parameter). */
  rMinOhms?: number;
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
