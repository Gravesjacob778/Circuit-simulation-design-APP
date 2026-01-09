/**
 * Complex.ts - 複數運算模組
 * 提供 AC 電路分析所需的複數數學運算
 */

/**
 * 複數介面
 */
export interface Complex {
  re: number;  // 實部
  im: number;  // 虛部
}

/**
 * 建立複數
 */
export function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

/**
 * 從極座標建立複數
 * @param magnitude 大小
 * @param angleRad 角度（弧度）
 */
export function fromPolar(magnitude: number, angleRad: number): Complex {
  return {
    re: magnitude * Math.cos(angleRad),
    im: magnitude * Math.sin(angleRad),
  };
}

/**
 * 複數加法
 */
export function add(a: Complex, b: Complex): Complex {
  return {
    re: a.re + b.re,
    im: a.im + b.im,
  };
}

/**
 * 複數減法
 */
export function subtract(a: Complex, b: Complex): Complex {
  return {
    re: a.re - b.re,
    im: a.im - b.im,
  };
}

/**
 * 複數乘法
 * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
 */
export function multiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/**
 * 複數除法
 * (a + bi)/(c + di) = [(ac + bd) + (bc - ad)i] / (c² + d²)
 */
export function divide(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  if (denominator === 0) {
    throw new Error('Division by zero in complex division');
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

/**
 * 複數共軛
 */
export function conjugate(c: Complex): Complex {
  return { re: c.re, im: -c.im };
}

/**
 * 複數大小（模）
 * |z| = sqrt(re² + im²)
 */
export function magnitude(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

/**
 * 複數相位（弧度）
 * angle = atan2(im, re)
 */
export function phase(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

/**
 * 複數相位（度數）
 */
export function phaseDegrees(c: Complex): number {
  return phase(c) * (180 / Math.PI);
}

/**
 * 複數取負
 */
export function negate(c: Complex): Complex {
  return { re: -c.re, im: -c.im };
}

/**
 * 複數乘以純量
 */
export function scale(c: Complex, scalar: number): Complex {
  return { re: c.re * scalar, im: c.im * scalar };
}

/**
 * 複數倒數 1/z
 */
export function reciprocal(c: Complex): Complex {
  const magSq = c.re * c.re + c.im * c.im;
  if (magSq === 0) {
    throw new Error('Cannot compute reciprocal of zero');
  }
  return {
    re: c.re / magSq,
    im: -c.im / magSq,
  };
}

/**
 * 檢查是否為零
 */
export function isZero(c: Complex, tolerance: number = 1e-12): boolean {
  return Math.abs(c.re) < tolerance && Math.abs(c.im) < tolerance;
}

/**
 * 複製複數
 */
export function clone(c: Complex): Complex {
  return { re: c.re, im: c.im };
}


// ============================================
// 阻抗計算函數
// ============================================

/**
 * 電阻的阻抗
 * Z_R = R + j0
 */
export function impedanceResistor(R: number): Complex {
  return complex(R, 0);
}

/**
 * 電容的阻抗
 * Z_C = 1 / (jωC) = -j / (ωC)
 * @param C 電容值（法拉）
 * @param omega 角頻率 ω = 2πf
 */
export function impedanceCapacitor(C: number, omega: number): Complex {
  if (omega === 0 || C === 0) {
    // DC 時電容為開路（無限大阻抗）
    return complex(1e12, 0);
  }
  return complex(0, -1 / (omega * C));
}

/**
 * 電感的阻抗
 * Z_L = jωL
 * @param L 電感值（亨利）
 * @param omega 角頻率 ω = 2πf
 */
export function impedanceInductor(L: number, omega: number): Complex {
  return complex(0, omega * L);
}

/**
 * 電容的導納（複數）
 * Y_C = jωC
 * @param C 電容值（法拉）
 * @param omega 角頻率 ω = 2πf
 */
export function admittanceCapacitor(C: number, omega: number): Complex {
  return complex(0, omega * C);
}

/**
 * 電感的導納（複數）
 * Y_L = 1 / (jωL) = -j / (ωL)
 * @param L 電感值（亨利）
 * @param omega 角頻率 ω = 2πf
 */
export function admittanceInductor(L: number, omega: number): Complex {
  if (omega === 0 || L === 0) {
    // DC 時電感為短路（無限大導納）
    return complex(1e12, 0);
  }
  return complex(0, -1 / (omega * L));
}

/**
 * 串聯阻抗
 * Z_total = Z1 + Z2 + ... + Zn
 */
export function seriesImpedance(...impedances: Complex[]): Complex {
  return impedances.reduce((acc, z) => add(acc, z), complex(0, 0));
}

/**
 * 並聯阻抗
 * 1/Z_total = 1/Z1 + 1/Z2 + ... + 1/Zn
 */
export function parallelImpedance(...impedances: Complex[]): Complex {
  const totalAdmittance = impedances.reduce(
    (acc, z) => add(acc, reciprocal(z)),
    complex(0, 0)
  );
  return reciprocal(totalAdmittance);
}

// ============================================
// RLC 電路計算
// ============================================

/**
 * 串聯 RLC 電路總阻抗
 * Z = R + j(ωL - 1/ωC)
 */
export function seriesRLCImpedance(
  R: number,
  L: number,
  C: number,
  omega: number
): Complex {
  const XL = omega * L;
  const XC = omega > 0 && C > 0 ? 1 / (omega * C) : 0;
  return complex(R, XL - XC);
}

/**
 * 並聯 RLC 電路總阻抗
 */
export function parallelRLCImpedance(
  R: number,
  L: number,
  C: number,
  omega: number
): Complex {
  const ZR = impedanceResistor(R);
  const ZL = impedanceInductor(L, omega);
  const ZC = impedanceCapacitor(C, omega);
  return parallelImpedance(ZR, ZL, ZC);
}

// ============================================
// 除錯與格式化
// ============================================

/**
 * 格式化複數為字串
 */
export function formatComplex(c: Complex, precision: number = 4): string {
  const reStr = c.re.toFixed(precision);
  const imAbs = Math.abs(c.im);
  const imStr = imAbs.toFixed(precision);

  if (Math.abs(c.im) < 1e-12) {
    return reStr;
  }
  if (Math.abs(c.re) < 1e-12) {
    return c.im >= 0 ? `j${imStr}` : `-j${imStr}`;
  }
  return c.im >= 0 ? `${reStr} + j${imStr}` : `${reStr} - j${imStr}`;
}

/**
 * 格式化為極座標形式
 */
export function formatPolar(c: Complex, precision: number = 4): string {
  const mag = magnitude(c);
  const ang = phaseDegrees(c);
  return `${mag.toFixed(precision)} ∠ ${ang.toFixed(1)}°`;
}
