/**
 * frequencyAnalysis.ts - 頻率分析視覺化類型定義
 */

/**
 * Bode 圖軌跡
 */
export interface BodePlotTrace {
  /** 軌跡 ID */
  traceId: string;
  /** 顯示標籤 (例如 "V(out)/V(in)") */
  label: string;
  /** 顏色 */
  color: string;
  /** 是否可見 */
  visible: boolean;
  /** 增益數據 (dB) */
  magnitudeData: FrequencyDataPoint[];
  /** 相位數據 (度) */
  phaseData: FrequencyDataPoint[];
}

/**
 * 頻率數據點
 */
export interface FrequencyDataPoint {
  /** 頻率 (Hz) */
  frequency: number;
  /** 值 (dB 或度數) */
  value: number;
}

/**
 * 阻抗圖軌跡
 */
export interface ImpedancePlotTrace {
  /** 軌跡 ID */
  traceId: string;
  /** 元件 ID */
  componentId: string;
  /** 顯示標籤 (例如 "|Z(R1)|") */
  label: string;
  /** 顏色 */
  color: string;
  /** 是否可見 */
  visible: boolean;
  /** 阻抗大小數據 (Ω) */
  magnitudeData: FrequencyDataPoint[];
  /** 阻抗相位數據 (度) */
  phaseData: FrequencyDataPoint[];
}

/**
 * 頻率分析視圖範圍
 */
export interface FrequencyAnalysisViewport {
  /** 最小頻率 (Hz) */
  frequencyMin: number;
  /** 最大頻率 (Hz) */
  frequencyMax: number;
  /** 最小增益 (dB) */
  magnitudeMin: number;
  /** 最大增益 (dB) */
  magnitudeMax: number;
  /** 最小相位 (度) */
  phaseMin: number;
  /** 最大相位 (度) */
  phaseMax: number;
}

/**
 * 共振標記
 */
export interface ResonanceMarker {
  /** 共振頻率 (Hz) */
  frequency: number;
  /** 顯示標籤 */
  label: string;
  /** 標記類型 */
  type: 'resonance' | 'cutoff' | 'peak' | 'notch';
  /** 值 (dB 或 Ω) */
  value?: number;
}

/**
 * 游標讀值
 */
export interface CursorReading {
  /** 頻率 (Hz) */
  frequency: number;
  /** 增益 (dB) */
  magnitudeDB?: number;
  /** 相位 (度) */
  phaseDegrees?: number;
  /** 阻抗大小 (Ω) */
  impedanceOhms?: number;
}

/**
 * 頻率分析測量結果
 */
export interface FrequencyMeasurement {
  /** 測量 ID */
  id: string;
  /** 測量類型 */
  type: 'resonance' | 'cutoff_low' | 'cutoff_high' | 'bandwidth' | 'q_factor' | 'phase_margin' | 'gain_margin';
  /** 顯示標籤 */
  label: string;
  /** 值 */
  value: number;
  /** 單位 */
  unit: string;
}

/**
 * Bode 圖配置選項
 */
export interface BodePlotOptions {
  /** 是否顯示增益曲線 */
  showMagnitude: boolean;
  /** 是否顯示相位曲線 */
  showPhase: boolean;
  /** 是否顯示網格 */
  showGrid: boolean;
  /** 是否顯示標記 */
  showMarkers: boolean;
  /** 增益範圍 (dB) */
  magnitudeRange: { min: number; max: number };
  /** 相位範圍 (度) */
  phaseRange: { min: number; max: number };
}

/**
 * 阻抗圖配置選項
 */
export interface ImpedancePlotOptions {
  /** 是否使用對數 Y 軸 */
  logScale: boolean;
  /** 是否顯示相位 */
  showPhase: boolean;
  /** 是否顯示共振標記 */
  showResonanceMarkers: boolean;
}

/**
 * 預設 Bode 圖選項
 */
export const DEFAULT_BODE_PLOT_OPTIONS: BodePlotOptions = {
  showMagnitude: true,
  showPhase: true,
  showGrid: true,
  showMarkers: true,
  magnitudeRange: { min: -60, max: 20 },
  phaseRange: { min: -180, max: 180 },
};

/**
 * 預設阻抗圖選項
 */
export const DEFAULT_IMPEDANCE_PLOT_OPTIONS: ImpedancePlotOptions = {
  logScale: true,
  showPhase: true,
  showResonanceMarkers: true,
};

/**
 * 軌跡顏色調色板
 */
export const TRACE_COLORS = [
  '#2563eb', // 藍色
  '#dc2626', // 紅色
  '#16a34a', // 綠色
  '#9333ea', // 紫色
  '#ea580c', // 橙色
  '#0891b2', // 青色
  '#c026d3', // 洋紅
  '#65a30d', // 萊姆綠
];

/**
 * 分析模式
 */
export type AnalysisMode = 'time' | 'frequency';
