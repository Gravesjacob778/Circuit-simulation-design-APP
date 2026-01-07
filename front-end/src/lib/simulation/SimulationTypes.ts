/**
 * SimulationTypes.ts - 模擬相關的類型定義
 */

import type { WaveformType } from '@/types/circuit';

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
  /** AC 源頻率 (Hz) */
  frequency?: number;
  /** AC 源相位 (rad) */
  phase?: number;
  /** AC 源波形類型 */
  waveformType?: WaveformType;
}

// ========== 瞬態分析類型定義 ==========

/**
 * 瞬態分析選項
 */
export interface TransientOptions {
  /** 模擬開始時間 (秒) */
  startTime: number;
  /** 模擬結束時間 (秒) */
  endTime: number;
  /** 時間步長 (秒)，若未指定則自動計算 */
  timeStep?: number;
  /** 最大迭代次數 (用於非線性收斂) */
  maxIterations?: number;
}

/**
 * 動態元件狀態 (電容電壓、電感電流)
 */
export interface ComponentState {
  /** 電容元件 ID → 電壓 (V) */
  capacitorVoltages: Map<string, number>;
  /** 電感元件 ID → 電流 (A) */
  inductorCurrents: Map<string, number>;
}

/**
 * 瞬態分析結果
 */
export interface TransientSimulationResult {
  /** 時間點陣列 (秒) */
  timePoints: number[];
  /** 節點電壓歷史 (節點ID → 電壓陣列) */
  nodeVoltageHistory: Map<string, number[]>;
  /** 支路電流歷史 (元件ID → 電流陣列) */
  branchCurrentHistory: Map<string, number[]>;
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 */
  error?: string;
  /** 模擬選項 (用於記錄) */
  options: TransientOptions;
}
