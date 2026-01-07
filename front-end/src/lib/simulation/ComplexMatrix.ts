/**
 * ComplexMatrix.ts - 複數矩陣運算工具
 * 提供複數線性代數運算，用於 AC 分析的 MNA 求解
 */

import type { Complex } from './Complex';
import { complex, magnitude, divide, subtract, multiply, negate, isZero, clone } from './Complex';

/**
 * 建立 n x n 複數零矩陣
 */
export function createComplexMatrix(n: number): Complex[][] {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => complex(0, 0))
  );
}

/**
 * 建立長度 n 的複數零向量
 */
export function createComplexVector(n: number): Complex[] {
  return Array.from({ length: n }, () => complex(0, 0));
}

/**
 * 複數矩陣加法（原地修改）
 */
export function addToMatrix(
  A: Complex[][],
  row: number,
  col: number,
  value: Complex
): void {
  A[row]![col]! = {
    re: A[row]![col]!.re + value.re,
    im: A[row]![col]!.im + value.im,
  };
}

/**
 * 複數向量加法（原地修改）
 */
export function addToVector(V: Complex[], index: number, value: Complex): void {
  V[index]! = {
    re: V[index]!.re + value.re,
    im: V[index]!.im + value.im,
  };
}

/**
 * 使用高斯消去法（帶部分主元選取）求解複數線性方程組 Ax = b
 * @param A 複數係數矩陣 (n x n)
 * @param b 複數常數向量 (n)
 * @returns 解向量 x (n)，若無解則回傳 null
 */
export function complexGaussianElimination(
  A: Complex[][],
  b: Complex[]
): Complex[] | null {
  const n = A.length;

  // 複製矩陣和向量，避免修改原始資料
  const augmented: Complex[][] = A.map((row, i) => [
    ...row.map((c) => clone(c)),
    clone(b[i]!),
  ]);

  // 前向消去
  for (let col = 0; col < n; col++) {
    // 部分主元選取：找到當前列中模最大的元素
    let maxRow = col;
    let maxMag = magnitude(augmented[col]![col]!);

    for (let row = col + 1; row < n; row++) {
      const mag = magnitude(augmented[row]![col]!);
      if (mag > maxMag) {
        maxMag = mag;
        maxRow = row;
      }
    }

    // 檢查是否為奇異矩陣
    if (maxMag < 1e-12) {
      console.warn('Complex matrix is singular or nearly singular');
      return null;
    }

    // 交換行
    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow]!, augmented[col]!];
    }

    // 消去
    for (let row = col + 1; row < n; row++) {
      const factor = divide(augmented[row]![col]!, augmented[col]![col]!);

      for (let j = col; j <= n; j++) {
        const product = multiply(factor, augmented[col]![j]!);
        augmented[row]![j]! = subtract(augmented[row]![j]!, product);
      }
    }
  }

  // 回代
  const x = createComplexVector(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = clone(augmented[row]![n]!);

    for (let col = row + 1; col < n; col++) {
      const product = multiply(augmented[row]![col]!, x[col]!);
      sum = subtract(sum, product);
    }

    x[row] = divide(sum, augmented[row]![row]!);
  }

  return x;
}

/**
 * LU 分解求解複數線性方程組（備用方法）
 * 用於需要多次求解同一矩陣不同右側向量的情況
 */
export interface ComplexLUDecomposition {
  L: Complex[][];
  U: Complex[][];
  P: number[]; // 置換向量
}

/**
 * 執行 LU 分解（帶部分主元選取）
 */
export function complexLUDecompose(A: Complex[][]): ComplexLUDecomposition | null {
  const n = A.length;

  // 複製矩陣
  const U: Complex[][] = A.map((row) => row.map((c) => clone(c)));
  const L: Complex[][] = createComplexMatrix(n);
  const P: number[] = Array.from({ length: n }, (_, i) => i);

  // 初始化 L 為單位矩陣
  for (let i = 0; i < n; i++) {
    L[i]![i]! = complex(1, 0);
  }

  for (let col = 0; col < n; col++) {
    // 部分主元選取
    let maxRow = col;
    let maxMag = magnitude(U[col]![col]!);

    for (let row = col + 1; row < n; row++) {
      const mag = magnitude(U[row]![col]!);
      if (mag > maxMag) {
        maxMag = mag;
        maxRow = row;
      }
    }

    if (maxMag < 1e-12) {
      return null; // 奇異矩陣
    }

    // 交換行
    if (maxRow !== col) {
      [U[col], U[maxRow]] = [U[maxRow]!, U[col]!];
      [P[col], P[maxRow]] = [P[maxRow]!, P[col]!];

      // 交換 L 中已計算的部分
      for (let j = 0; j < col; j++) {
        [L[col]![j], L[maxRow]![j]] = [L[maxRow]![j]!, L[col]![j]!];
      }
    }

    // 計算 L 和 U
    for (let row = col + 1; row < n; row++) {
      const factor = divide(U[row]![col]!, U[col]![col]!);
      L[row]![col]! = factor;

      for (let j = col; j < n; j++) {
        const product = multiply(factor, U[col]![j]!);
        U[row]![j]! = subtract(U[row]![j]!, product);
      }
    }
  }

  return { L, U, P };
}

/**
 * 使用 LU 分解求解 Ax = b
 */
export function complexLUSolve(
  lu: ComplexLUDecomposition,
  b: Complex[]
): Complex[] {
  const n = b.length;
  const { L, U, P } = lu;

  // 應用置換
  const pb: Complex[] = P.map((i) => clone(b[i]!));

  // 前向替代：Ly = Pb
  const y = createComplexVector(n);
  for (let i = 0; i < n; i++) {
    let sum = clone(pb[i]!);
    for (let j = 0; j < i; j++) {
      const product = multiply(L[i]![j]!, y[j]!);
      sum = subtract(sum, product);
    }
    y[i] = sum; // L[i][i] = 1
  }

  // 回代：Ux = y
  const x = createComplexVector(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = clone(y[i]!);
    for (let j = i + 1; j < n; j++) {
      const product = multiply(U[i]![j]!, x[j]!);
      sum = subtract(sum, product);
    }
    x[i] = divide(sum, U[i]![i]!);
  }

  return x;
}

// ============================================
// 除錯工具
// ============================================

/**
 * 列印複數矩陣（用於除錯）
 */
export function printComplexMatrix(A: Complex[][], label?: string): void {
  if (label) console.log(label);
  A.forEach((row) => {
    const rowStr = row
      .map((c) => {
        const re = c.re.toFixed(3).padStart(8);
        const im = c.im >= 0 ? `+${c.im.toFixed(3)}j` : `${c.im.toFixed(3)}j`;
        return `(${re}${im.padStart(9)})`;
      })
      .join(' ');
    console.log(`  [${rowStr}]`);
  });
}

/**
 * 列印複數向量（用於除錯）
 */
export function printComplexVector(v: Complex[], label?: string): void {
  if (label) console.log(label);
  const str = v
    .map((c) => {
      const re = c.re.toFixed(4);
      const im = c.im >= 0 ? `+${c.im.toFixed(4)}j` : `${c.im.toFixed(4)}j`;
      return `(${re}${im})`;
    })
    .join(', ');
  console.log(`  [${str}]`);
}
