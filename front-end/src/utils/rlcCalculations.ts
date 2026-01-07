/**
 * rlcCalculations.ts - RLC 電路分析計算工具
 */

/**
 * 串聯 RLC 電路參數
 */
export interface SeriesRLCParams {
  R: number;  // 電阻 (Ω)
  L: number;  // 電感 (H)
  C: number;  // 電容 (F)
}

/**
 * 並聯 RLC 電路參數
 */
export interface ParallelRLCParams {
  R: number;  // 電阻 (Ω)
  L: number;  // 電感 (H)
  C: number;  // 電容 (F)
}

/**
 * RLC 電路分析結果
 */
export interface RLCAnalysisResult {
  /** 共振頻率 (Hz) */
  resonantFrequency: number;
  /** 共振角頻率 (rad/s) */
  omega0: number;
  /** 品質因數 Q */
  qFactor: number;
  /** 頻寬 (Hz) */
  bandwidth: number;
  /** 下截止頻率 (Hz) */
  lowerCutoff: number;
  /** 上截止頻率 (Hz) */
  upperCutoff: number;
  /** 阻尼因數 ζ */
  dampingRatio: number;
  /** 電路類型 */
  circuitType: 'underdamped' | 'critically_damped' | 'overdamped';
}

/**
 * 計算共振頻率
 * f₀ = 1 / (2π√(LC))
 * @param L 電感 (H)
 * @param C 電容 (F)
 * @returns 共振頻率 (Hz)
 */
export function calculateResonantFrequency(L: number, C: number): number {
  if (L <= 0 || C <= 0) return 0;
  return 1 / (2 * Math.PI * Math.sqrt(L * C));
}

/**
 * 計算共振角頻率
 * ω₀ = 1 / √(LC)
 * @param L 電感 (H)
 * @param C 電容 (F)
 * @returns 共振角頻率 (rad/s)
 */
export function calculateOmega0(L: number, C: number): number {
  if (L <= 0 || C <= 0) return 0;
  return 1 / Math.sqrt(L * C);
}

/**
 * 計算串聯 RLC 電路的 Q 值
 * Q = (1/R) * √(L/C) = ω₀L/R = 1/(ω₀CR)
 * @param params 串聯 RLC 參數
 * @returns Q 值
 */
export function calculateSeriesQFactor(params: SeriesRLCParams): number {
  const { R, L, C } = params;
  if (R <= 0 || L <= 0 || C <= 0) return 0;
  return (1 / R) * Math.sqrt(L / C);
}

/**
 * 計算並聯 RLC 電路的 Q 值
 * Q = R * √(C/L) = R/(ω₀L) = ω₀CR
 * @param params 並聯 RLC 參數
 * @returns Q 值
 */
export function calculateParallelQFactor(params: ParallelRLCParams): number {
  const { R, L, C } = params;
  if (R <= 0 || L <= 0 || C <= 0) return 0;
  return R * Math.sqrt(C / L);
}

/**
 * 計算頻寬
 * BW = f₀ / Q
 * @param f0 共振頻率 (Hz)
 * @param Q 品質因數
 * @returns 頻寬 (Hz)
 */
export function calculateBandwidth(f0: number, Q: number): number {
  if (Q <= 0) return Infinity;
  return f0 / Q;
}

/**
 * 計算截止頻率
 * @param f0 共振頻率 (Hz)
 * @param Q 品質因數
 * @returns { low: 下截止頻率, high: 上截止頻率 }
 */
export function calculateCutoffFrequencies(f0: number, Q: number): { low: number; high: number } {
  if (Q <= 0) return { low: 0, high: Infinity };

  const bandwidth = f0 / Q;

  // 精確公式考慮非對稱性
  // f_low = f0 * (√(1 + 1/(4Q²)) - 1/(2Q))
  // f_high = f0 * (√(1 + 1/(4Q²)) + 1/(2Q))
  const factor = Math.sqrt(1 + 1 / (4 * Q * Q));
  const offset = 1 / (2 * Q);

  return {
    low: f0 * (factor - offset),
    high: f0 * (factor + offset),
  };
}

/**
 * 計算阻尼因數
 * ζ = R / (2√(L/C)) (串聯) 或 1/(2R) * √(L/C) (並聯)
 * @param params RLC 參數
 * @param type 電路類型
 * @returns 阻尼因數
 */
export function calculateDampingRatio(
  params: SeriesRLCParams | ParallelRLCParams,
  type: 'series' | 'parallel'
): number {
  const { R, L, C } = params;
  if (R <= 0 || L <= 0 || C <= 0) return 0;

  if (type === 'series') {
    return R / (2 * Math.sqrt(L / C));
  } else {
    return (1 / (2 * R)) * Math.sqrt(L / C);
  }
}

/**
 * 判斷電路阻尼類型
 * @param dampingRatio 阻尼因數
 * @returns 電路類型
 */
export function getDampingType(dampingRatio: number): 'underdamped' | 'critically_damped' | 'overdamped' {
  if (dampingRatio < 1) return 'underdamped';
  if (dampingRatio === 1) return 'critically_damped';
  return 'overdamped';
}

/**
 * 完整分析串聯 RLC 電路
 * @param params 串聯 RLC 參數
 * @returns 分析結果
 */
export function analyzeSeriesRLC(params: SeriesRLCParams): RLCAnalysisResult {
  const { R, L, C } = params;

  const omega0 = calculateOmega0(L, C);
  const resonantFrequency = calculateResonantFrequency(L, C);
  const qFactor = calculateSeriesQFactor(params);
  const bandwidth = calculateBandwidth(resonantFrequency, qFactor);
  const { low: lowerCutoff, high: upperCutoff } = calculateCutoffFrequencies(resonantFrequency, qFactor);
  const dampingRatio = calculateDampingRatio(params, 'series');
  const circuitType = getDampingType(dampingRatio);

  return {
    resonantFrequency,
    omega0,
    qFactor,
    bandwidth,
    lowerCutoff,
    upperCutoff,
    dampingRatio,
    circuitType,
  };
}

/**
 * 完整分析並聯 RLC 電路
 * @param params 並聯 RLC 參數
 * @returns 分析結果
 */
export function analyzeParallelRLC(params: ParallelRLCParams): RLCAnalysisResult {
  const { R, L, C } = params;

  const omega0 = calculateOmega0(L, C);
  const resonantFrequency = calculateResonantFrequency(L, C);
  const qFactor = calculateParallelQFactor(params);
  const bandwidth = calculateBandwidth(resonantFrequency, qFactor);
  const { low: lowerCutoff, high: upperCutoff } = calculateCutoffFrequencies(resonantFrequency, qFactor);
  const dampingRatio = calculateDampingRatio(params, 'parallel');
  const circuitType = getDampingType(dampingRatio);

  return {
    resonantFrequency,
    omega0,
    qFactor,
    bandwidth,
    lowerCutoff,
    upperCutoff,
    dampingRatio,
    circuitType,
  };
}

/**
 * 計算串聯 RLC 電路在特定頻率的阻抗
 * Z = R + j(ωL - 1/ωC)
 * @param params RLC 參數
 * @param frequency 頻率 (Hz)
 * @returns { magnitude: 阻抗大小, phase: 相位 (度) }
 */
export function calculateSeriesImpedanceAtFrequency(
  params: SeriesRLCParams,
  frequency: number
): { magnitude: number; phase: number } {
  const { R, L, C } = params;
  const omega = 2 * Math.PI * frequency;

  const XL = omega * L;           // 感抗
  const XC = 1 / (omega * C);     // 容抗
  const X = XL - XC;              // 總電抗

  const magnitude = Math.sqrt(R * R + X * X);
  const phase = Math.atan2(X, R) * (180 / Math.PI);

  return { magnitude, phase };
}

/**
 * 計算 RC 低通濾波器截止頻率
 * f_c = 1 / (2πRC)
 * @param R 電阻 (Ω)
 * @param C 電容 (F)
 * @returns 截止頻率 (Hz)
 */
export function calculateRCCutoff(R: number, C: number): number {
  if (R <= 0 || C <= 0) return 0;
  return 1 / (2 * Math.PI * R * C);
}

/**
 * 計算 RL 截止頻率
 * f_c = R / (2πL)
 * @param R 電阻 (Ω)
 * @param L 電感 (H)
 * @returns 截止頻率 (Hz)
 */
export function calculateRLCutoff(R: number, L: number): number {
  if (R <= 0 || L <= 0) return 0;
  return R / (2 * Math.PI * L);
}

/**
 * 計算時間常數
 * τ = RC (RC 電路) 或 τ = L/R (RL 電路)
 * @param R 電阻 (Ω)
 * @param COrL 電容 (F) 或電感 (H)
 * @param type 電路類型
 * @returns 時間常數 (秒)
 */
export function calculateTimeConstant(
  R: number,
  COrL: number,
  type: 'RC' | 'RL'
): number {
  if (R <= 0 || COrL <= 0) return 0;

  if (type === 'RC') {
    return R * COrL;
  } else {
    return COrL / R;
  }
}

/**
 * 從電路元件自動檢測 RLC 參數
 * @param components 電路元件陣列
 * @returns RLC 參數或 null
 */
export function detectRLCFromComponents(
  components: { type: string; value?: number; unit?: string }[]
): SeriesRLCParams | null {
  let R = 0;
  let L = 0;
  let C = 0;

  for (const comp of components) {
    const value = comp.value ?? 0;

    switch (comp.type) {
      case 'resistor':
        R += value;
        break;
      case 'inductor':
        // 假設值的單位是 mH，需要轉換為 H
        L += value * 1e-3;
        break;
      case 'capacitor':
        // 假設值的單位是 μF，需要轉換為 F
        C += value * 1e-6;
        break;
    }
  }

  if (R > 0 && L > 0 && C > 0) {
    return { R, L, C };
  }

  return null;
}
