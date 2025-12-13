/**
 * Matrix.ts - 矩陣運算工具
 * 提供線性代數運算，用於 MNA 求解
 */

/**
 * 建立 n x n 零矩陣
 */
export function createMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

/**
 * 建立長度 n 的零向量
 */
export function createVector(n: number): number[] {
  return Array(n).fill(0);
}

/**
 * 使用高斯消去法（帶部分主元選取）求解線性方程組 Ax = b
 * @param A 係數矩陣 (n x n)
 * @param b 常數向量 (n)
 * @returns 解向量 x (n)，若無解則回傳 null
 */
export function gaussianElimination(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  
  // 複製矩陣和向量，避免修改原始資料
  const augmented: number[][] = A.map((row, i) => [...row, b[i]!]);
  
  // 前向消去
  for (let col = 0; col < n; col++) {
    // 部分主元選取：找到當前列中絕對值最大的元素
    let maxRow = col;
    let maxVal = Math.abs(augmented[col]![col]!);
    
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(augmented[row]![col]!);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }
    
    // 檢查是否為奇異矩陣
    if (maxVal < 1e-12) {
      console.warn('Matrix is singular or nearly singular');
      return null;
    }
    
    // 交換行
    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow]!, augmented[col]!];
    }
    
    // 消去
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row]![col]! / augmented[col]![col]!;
      for (let j = col; j <= n; j++) {
        augmented[row]![j]! -= factor * augmented[col]![j]!;
      }
    }
  }
  
  // 回代
  const x = createVector(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = augmented[row]![n]!;
    for (let col = row + 1; col < n; col++) {
      sum -= augmented[row]![col]! * x[col]!;
    }
    x[row] = sum / augmented[row]![row]!;
  }
  
  return x;
}

/**
 * 列印矩陣（用於除錯）
 */
export function printMatrix(A: number[][], label?: string): void {
  if (label) console.log(label);
  A.forEach((row) => {
    console.log(`  [${row.map(v => v.toFixed(4).padStart(10)).join(', ')}]`);
  });
}

/**
 * 列印向量（用於除錯）
 */
export function printVector(v: number[], label?: string): void {
  if (label) console.log(label);
  console.log(`  [${v.map(x => x.toFixed(4).padStart(10)).join(', ')}]`);
}
