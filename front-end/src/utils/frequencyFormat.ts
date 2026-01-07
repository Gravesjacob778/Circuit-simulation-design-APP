/**
 * frequencyFormat.ts - 頻率相關格式化工具
 */

/**
 * 格式化頻率值
 * @param hz 頻率 (Hz)
 * @param precision 精確度 (預設 3)
 */
export function formatFrequency(hz: number, precision: number = 3): string {
  if (hz === 0) return '0 Hz';

  const absHz = Math.abs(hz);

  if (absHz >= 1e9) {
    return `${(hz / 1e9).toPrecision(precision)} GHz`;
  }
  if (absHz >= 1e6) {
    return `${(hz / 1e6).toPrecision(precision)} MHz`;
  }
  if (absHz >= 1e3) {
    return `${(hz / 1e3).toPrecision(precision)} kHz`;
  }
  if (absHz >= 1) {
    return `${hz.toPrecision(precision)} Hz`;
  }
  if (absHz >= 1e-3) {
    return `${(hz * 1e3).toPrecision(precision)} mHz`;
  }

  return `${hz.toExponential(precision - 1)} Hz`;
}

/**
 * 格式化阻抗值
 * @param ohms 阻抗 (Ω)
 * @param precision 精確度 (預設 3)
 */
export function formatImpedance(ohms: number, precision: number = 3): string {
  if (ohms === 0) return '0 Ω';

  const absOhms = Math.abs(ohms);

  if (absOhms >= 1e9) {
    return `${(ohms / 1e9).toPrecision(precision)} GΩ`;
  }
  if (absOhms >= 1e6) {
    return `${(ohms / 1e6).toPrecision(precision)} MΩ`;
  }
  if (absOhms >= 1e3) {
    return `${(ohms / 1e3).toPrecision(precision)} kΩ`;
  }
  if (absOhms >= 1) {
    return `${ohms.toPrecision(precision)} Ω`;
  }
  if (absOhms >= 1e-3) {
    return `${(ohms * 1e3).toPrecision(precision)} mΩ`;
  }

  return `${ohms.toExponential(precision - 1)} Ω`;
}

/**
 * 格式化分貝值
 * @param db 分貝值
 * @param precision 小數位數 (預設 1)
 */
export function formatDecibels(db: number, precision: number = 1): string {
  if (!Number.isFinite(db)) {
    return db > 0 ? '+∞ dB' : '-∞ dB';
  }

  const sign = db >= 0 ? '+' : '';
  return `${sign}${db.toFixed(precision)} dB`;
}

/**
 * 格式化相位值
 * @param degrees 相位 (度)
 * @param precision 小數位數 (預設 1)
 */
export function formatPhase(degrees: number, precision: number = 1): string {
  return `${degrees.toFixed(precision)}°`;
}

/**
 * 格式化角頻率
 * @param omega 角頻率 (rad/s)
 * @param precision 精確度 (預設 3)
 */
export function formatAngularFrequency(omega: number, precision: number = 3): string {
  if (omega === 0) return '0 rad/s';

  const absOmega = Math.abs(omega);

  if (absOmega >= 1e6) {
    return `${(omega / 1e6).toPrecision(precision)} Mrad/s`;
  }
  if (absOmega >= 1e3) {
    return `${(omega / 1e3).toPrecision(precision)} krad/s`;
  }

  return `${omega.toPrecision(precision)} rad/s`;
}

/**
 * 格式化 Q 值
 * @param q Q 值
 * @param precision 小數位數 (預設 2)
 */
export function formatQFactor(q: number, precision: number = 2): string {
  if (!Number.isFinite(q) || q < 0) {
    return 'N/A';
  }
  return q.toFixed(precision);
}

/**
 * 格式化時間常數
 * @param seconds 時間 (秒)
 * @param precision 精確度 (預設 3)
 */
export function formatTimeConstant(seconds: number, precision: number = 3): string {
  if (seconds === 0) return '0 s';

  const absSeconds = Math.abs(seconds);

  if (absSeconds >= 1) {
    return `${seconds.toPrecision(precision)} s`;
  }
  if (absSeconds >= 1e-3) {
    return `${(seconds * 1e3).toPrecision(precision)} ms`;
  }
  if (absSeconds >= 1e-6) {
    return `${(seconds * 1e6).toPrecision(precision)} μs`;
  }
  if (absSeconds >= 1e-9) {
    return `${(seconds * 1e9).toPrecision(precision)} ns`;
  }

  return `${seconds.toExponential(precision - 1)} s`;
}

/**
 * 解析頻率字串
 * @param str 頻率字串 (例如 "1.5 kHz", "100 MHz")
 * @returns 頻率 (Hz)
 */
export function parseFrequency(str: string): number | null {
  const match = str.trim().match(/^([-+]?[\d.]+)\s*(GHz|MHz|kHz|Hz|mHz)?$/i);

  if (!match) return null;

  const value = parseFloat(match[1]!);
  if (Number.isNaN(value)) return null;

  const unit = (match[2] || 'Hz').toLowerCase();

  const multipliers: Record<string, number> = {
    'ghz': 1e9,
    'mhz': 1e6,
    'khz': 1e3,
    'hz': 1,
    'mhz': 1e-3,
  };

  return value * (multipliers[unit] ?? 1);
}

/**
 * 產生對數頻率刻度標籤
 * @param startFreq 起始頻率 (Hz)
 * @param endFreq 終止頻率 (Hz)
 */
export function generateFrequencyTicks(startFreq: number, endFreq: number): number[] {
  const ticks: number[] = [];

  // 從最接近的十的冪次開始
  let decade = Math.pow(10, Math.floor(Math.log10(startFreq)));

  while (decade <= endFreq) {
    for (const multiplier of [1, 2, 5]) {
      const tick = decade * multiplier;
      if (tick >= startFreq && tick <= endFreq) {
        ticks.push(tick);
      }
    }
    decade *= 10;
  }

  return ticks;
}

/**
 * 產生分貝刻度標籤
 * @param minDb 最小 dB
 * @param maxDb 最大 dB
 * @param step 步長 (預設 20)
 */
export function generateDecibelTicks(minDb: number, maxDb: number, step: number = 20): number[] {
  const ticks: number[] = [];

  const start = Math.ceil(minDb / step) * step;
  const end = Math.floor(maxDb / step) * step;

  for (let db = start; db <= end; db += step) {
    ticks.push(db);
  }

  return ticks;
}

/**
 * 產生相位刻度標籤
 * @param minPhase 最小相位 (度)
 * @param maxPhase 最大相位 (度)
 * @param step 步長 (預設 45)
 */
export function generatePhaseTicks(minPhase: number, maxPhase: number, step: number = 45): number[] {
  const ticks: number[] = [];

  const start = Math.ceil(minPhase / step) * step;
  const end = Math.floor(maxPhase / step) * step;

  for (let phase = start; phase <= end; phase += step) {
    ticks.push(phase);
  }

  return ticks;
}
