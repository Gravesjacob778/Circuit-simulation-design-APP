/**
 * useBodePlot - Bode 圖狀態管理 Composable
 *
 * 負責：
 * - 管理頻率軸和增益/相位軸的視圖狀態
 * - 處理游標邏輯
 * - 提供縮放和平移操作
 * - 計算頻率響應特徵點（共振、截止頻率等）
 */

import { ref, computed, watch, type Ref } from 'vue';
import type {
  BodePlotTrace,
  FrequencyDataPoint,
  ResonanceMarker,
  CursorReading,
  BodePlotOptions,
  DEFAULT_BODE_PLOT_OPTIONS,
} from '@/types/frequencyAnalysis';

export interface UseBodePlotOptions {
  /** 預設起始頻率 (Hz) */
  defaultStartFrequency?: number;
  /** 預設終止頻率 (Hz) */
  defaultEndFrequency?: number;
  /** 預設增益範圍 (dB) */
  defaultMagnitudeRange?: { min: number; max: number };
  /** 預設相位範圍 (度) */
  defaultPhaseRange?: { min: number; max: number };
  /** 是否自動縮放 */
  autoScale?: boolean;
}

const DEFAULT_OPTIONS: Required<UseBodePlotOptions> = {
  defaultStartFrequency: 1,
  defaultEndFrequency: 1e6,
  defaultMagnitudeRange: { min: -60, max: 20 },
  defaultPhaseRange: { min: -180, max: 180 },
  autoScale: true,
};

export interface FrequencyAxisConfig {
  /** 起始頻率 (Hz) */
  start: number;
  /** 終止頻率 (Hz) */
  end: number;
  /** 是否使用對數刻度 */
  logScale: boolean;
}

export interface BodePlotViewport {
  frequency: FrequencyAxisConfig;
  magnitude: { min: number; max: number };
  phase: { min: number; max: number };
  autoScale: boolean;
}

export function useBodePlot(
  traces: Ref<BodePlotTrace[]>,
  options: UseBodePlotOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ========== 狀態 ==========

  /** 頻率軸配置 */
  const frequencyAxis = ref<FrequencyAxisConfig>({
    start: opts.defaultStartFrequency,
    end: opts.defaultEndFrequency,
    logScale: true,
  });

  /** 增益範圍 */
  const magnitudeRange = ref({ ...opts.defaultMagnitudeRange });

  /** 相位範圍 */
  const phaseRange = ref({ ...opts.defaultPhaseRange });

  /** 是否自動縮放 */
  const autoScale = ref(opts.autoScale);

  /** 當前 hover 的頻率位置 */
  const hoverFrequency = ref<number | null>(null);

  /** 游標 1 */
  const cursor1 = ref<CursorReading | null>(null);

  /** 游標 2 */
  const cursor2 = ref<CursorReading | null>(null);

  /** 是否顯示增益曲線 */
  const showMagnitude = ref(true);

  /** 是否顯示相位曲線 */
  const showPhase = ref(true);

  /** 是否正在拖曳 */
  const isDragging = ref(false);

  // ========== 計算屬性 ==========

  /**
   * 可見的 traces
   */
  const visibleTraces = computed(() =>
    traces.value.filter(t => t.visible)
  );

  /**
   * 計算所有資料的頻率範圍
   */
  const dataFrequencyRange = computed(() => {
    let minFreq = Infinity;
    let maxFreq = -Infinity;

    for (const trace of traces.value) {
      const allData = [...trace.magnitudeData, ...trace.phaseData];
      if (allData.length === 0) continue;

      for (const point of allData) {
        if (point.frequency < minFreq) minFreq = point.frequency;
        if (point.frequency > maxFreq) maxFreq = point.frequency;
      }
    }

    if (minFreq === Infinity) {
      return { min: 1, max: 1e6 };
    }

    return { min: minFreq, max: maxFreq };
  });

  /**
   * 計算所有資料的增益範圍
   */
  const dataMagnitudeRange = computed(() => {
    let minMag = Infinity;
    let maxMag = -Infinity;

    for (const trace of visibleTraces.value) {
      for (const point of trace.magnitudeData) {
        if (point.value < minMag) minMag = point.value;
        if (point.value > maxMag) maxMag = point.value;
      }
    }

    if (minMag === Infinity) {
      return { min: -60, max: 20 };
    }

    // 加上 10% 邊距
    const range = maxMag - minMag;
    const margin = range === 0 ? 10 : range * 0.1;

    return {
      min: minMag - margin,
      max: maxMag + margin,
    };
  });

  /**
   * 計算所有資料的相位範圍
   */
  const dataPhaseRange = computed(() => {
    let minPhase = Infinity;
    let maxPhase = -Infinity;

    for (const trace of visibleTraces.value) {
      for (const point of trace.phaseData) {
        if (point.value < minPhase) minPhase = point.value;
        if (point.value > maxPhase) maxPhase = point.value;
      }
    }

    if (minPhase === Infinity) {
      return { min: -180, max: 180 };
    }

    // 加上 10% 邊距
    const range = maxPhase - minPhase;
    const margin = range === 0 ? 10 : range * 0.1;

    return {
      min: minPhase - margin,
      max: maxPhase + margin,
    };
  });

  /**
   * 完整的 viewport 狀態
   */
  const viewport = computed<BodePlotViewport>(() => ({
    frequency: frequencyAxis.value,
    magnitude: magnitudeRange.value,
    phase: phaseRange.value,
    autoScale: autoScale.value,
  }));

  /**
   * 當前 hover 位置的數值
   */
  const hoverValues = computed(() => {
    const values = new Map<string, { magnitude: number; phase: number }>();

    if (hoverFrequency.value === null) return values;

    const freq = hoverFrequency.value;

    for (const trace of visibleTraces.value) {
      const mag = interpolateAtFrequency(trace.magnitudeData, freq);
      const ph = interpolateAtFrequency(trace.phaseData, freq);

      if (mag !== null && ph !== null) {
        values.set(trace.traceId, { magnitude: mag, phase: ph });
      }
    }

    return values;
  });

  /**
   * 自動檢測的標記點（共振、截止頻率等）
   */
  const autoMarkers = computed<ResonanceMarker[]>(() => {
    const markers: ResonanceMarker[] = [];

    for (const trace of visibleTraces.value) {
      // 尋找 -3dB 截止點
      const cutoffPoints = findCutoffPoints(trace.magnitudeData, -3);
      for (const point of cutoffPoints) {
        markers.push({
          frequency: point.frequency,
          label: `-3dB @ ${formatFreqShort(point.frequency)}`,
          type: 'cutoff',
          value: point.value,
        });
      }

      // 尋找峰值
      const peak = findPeak(trace.magnitudeData);
      if (peak) {
        markers.push({
          frequency: peak.frequency,
          label: `Peak @ ${formatFreqShort(peak.frequency)}`,
          type: 'peak',
          value: peak.value,
        });
      }

      // 尋找相位穿越 0 度的點（共振）
      const zeroCrossings = findZeroCrossings(trace.phaseData);
      for (const freq of zeroCrossings) {
        markers.push({
          frequency: freq,
          label: `Resonance @ ${formatFreqShort(freq)}`,
          type: 'resonance',
        });
      }
    }

    return markers;
  });

  // ========== 方法 ==========

  /**
   * 設定頻率範圍
   */
  function setFrequencyRange(start: number, end: number) {
    frequencyAxis.value = {
      ...frequencyAxis.value,
      start,
      end,
    };
    autoScale.value = false;
  }

  /**
   * 縮放頻率軸（對數縮放）
   */
  function zoomFrequency(factor: number, centerFreq?: number) {
    const current = frequencyAxis.value;
    const logStart = Math.log10(current.start);
    const logEnd = Math.log10(current.end);

    const logCenter = centerFreq
      ? Math.log10(centerFreq)
      : (logStart + logEnd) / 2;

    const newLogHalfRange = ((logEnd - logStart) / 2) / factor;
    const newLogStart = logCenter - newLogHalfRange;
    const newLogEnd = logCenter + newLogHalfRange;

    setFrequencyRange(
      Math.pow(10, newLogStart),
      Math.pow(10, newLogEnd)
    );
  }

  /**
   * 平移頻率軸（對數平移）
   */
  function panFrequency(logDelta: number) {
    const current = frequencyAxis.value;
    const logStart = Math.log10(current.start) + logDelta;
    const logEnd = Math.log10(current.end) + logDelta;

    setFrequencyRange(
      Math.pow(10, logStart),
      Math.pow(10, logEnd)
    );
  }

  /**
   * 設定增益範圍
   */
  function setMagnitudeRange(min: number, max: number) {
    magnitudeRange.value = { min, max };
    autoScale.value = false;
  }

  /**
   * 設定相位範圍
   */
  function setPhaseRange(min: number, max: number) {
    phaseRange.value = { min, max };
    autoScale.value = false;
  }

  /**
   * 重設為自動縮放
   */
  function resetZoom() {
    const freqRange = dataFrequencyRange.value;
    const magRange = dataMagnitudeRange.value;
    const phRange = dataPhaseRange.value;

    frequencyAxis.value = {
      start: freqRange.min,
      end: freqRange.max,
      logScale: true,
    };

    magnitudeRange.value = magRange;
    phaseRange.value = phRange;
    autoScale.value = true;
  }

  /**
   * 適應所有資料範圍
   */
  function fitToData() {
    resetZoom();
  }

  /**
   * 設定 hover 頻率
   */
  function setHoverFrequency(freq: number | null) {
    hoverFrequency.value = freq;
  }

  /**
   * 設定游標
   */
  function setCursor(cursorId: 1 | 2, frequency: number | null) {
    if (frequency === null) {
      if (cursorId === 1) cursor1.value = null;
      else cursor2.value = null;
      return;
    }

    const reading: CursorReading = {
      frequency,
    };

    // 找到第一個可見 trace 的數值
    for (const trace of visibleTraces.value) {
      const mag = interpolateAtFrequency(trace.magnitudeData, frequency);
      const ph = interpolateAtFrequency(trace.phaseData, frequency);

      if (mag !== null) reading.magnitudeDB = mag;
      if (ph !== null) reading.phaseDegrees = ph;
      break;
    }

    if (cursorId === 1) cursor1.value = reading;
    else cursor2.value = reading;
  }

  /**
   * 切換 trace 可見性
   */
  function toggleTraceVisibility(traceId: string) {
    const trace = traces.value.find(t => t.traceId === traceId);
    if (trace) {
      trace.visible = !trace.visible;
    }
  }

  // ========== 監聽自動縮放 ==========

  watch(
    () => traces.value.length,
    () => {
      if (autoScale.value && traces.value.length > 0) {
        resetZoom();
      }
    },
    { immediate: true }
  );

  return {
    // 狀態
    frequencyAxis,
    magnitudeRange,
    phaseRange,
    autoScale,
    hoverFrequency,
    cursor1,
    cursor2,
    showMagnitude,
    showPhase,
    isDragging,

    // 計算屬性
    visibleTraces,
    dataFrequencyRange,
    dataMagnitudeRange,
    dataPhaseRange,
    viewport,
    hoverValues,
    autoMarkers,

    // 方法
    setFrequencyRange,
    zoomFrequency,
    panFrequency,
    setMagnitudeRange,
    setPhaseRange,
    resetZoom,
    fitToData,
    setHoverFrequency,
    setCursor,
    toggleTraceVisibility,
  };
}

// ========== 輔助函式 ==========

/**
 * 在頻率數據中插值
 */
function interpolateAtFrequency(
  data: FrequencyDataPoint[],
  frequency: number
): number | null {
  if (data.length === 0) return null;

  // 找到最接近的兩個點
  let left = 0;
  let right = data.length - 1;

  // 二分搜尋
  while (left < right - 1) {
    const mid = Math.floor((left + right) / 2);
    if (data[mid]!.frequency < frequency) {
      left = mid;
    } else {
      right = mid;
    }
  }

  const p1 = data[left]!;
  const p2 = data[right]!;

  // 如果頻率在範圍外，返回邊界值
  if (frequency <= p1.frequency) return p1.value;
  if (frequency >= p2.frequency) return p2.value;

  // 對數插值（因為頻率軸是對數的）
  const logF = Math.log10(frequency);
  const logF1 = Math.log10(p1.frequency);
  const logF2 = Math.log10(p2.frequency);

  const t = (logF - logF1) / (logF2 - logF1);
  return p1.value + t * (p2.value - p1.value);
}

/**
 * 尋找截止點（特定 dB 值相對於最大值）
 */
function findCutoffPoints(
  data: FrequencyDataPoint[],
  relativeDB: number
): FrequencyDataPoint[] {
  if (data.length < 2) return [];

  // 找到最大值
  let maxValue = -Infinity;
  for (const point of data) {
    if (point.value > maxValue) maxValue = point.value;
  }

  const threshold = maxValue + relativeDB;
  const cutoffs: FrequencyDataPoint[] = [];

  // 尋找穿越閾值的點
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]!;
    const curr = data[i]!;

    if ((prev.value > threshold && curr.value <= threshold) ||
        (prev.value < threshold && curr.value >= threshold)) {
      // 線性插值找到精確位置
      const t = (threshold - prev.value) / (curr.value - prev.value);
      const logF = Math.log10(prev.frequency) + t * (Math.log10(curr.frequency) - Math.log10(prev.frequency));

      cutoffs.push({
        frequency: Math.pow(10, logF),
        value: threshold,
      });
    }
  }

  return cutoffs;
}

/**
 * 尋找峰值
 */
function findPeak(data: FrequencyDataPoint[]): FrequencyDataPoint | null {
  if (data.length === 0) return null;

  let peak = data[0]!;
  for (const point of data) {
    if (point.value > peak.value) {
      peak = point;
    }
  }

  return peak;
}

/**
 * 尋找零穿越點
 */
function findZeroCrossings(data: FrequencyDataPoint[]): number[] {
  const crossings: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]!;
    const curr = data[i]!;

    if ((prev.value < 0 && curr.value >= 0) ||
        (prev.value > 0 && curr.value <= 0)) {
      // 線性插值
      const t = Math.abs(prev.value) / (Math.abs(prev.value) + Math.abs(curr.value));
      const logF = Math.log10(prev.frequency) + t * (Math.log10(curr.frequency) - Math.log10(prev.frequency));
      crossings.push(Math.pow(10, logF));
    }
  }

  return crossings;
}

/**
 * 簡短格式化頻率
 */
function formatFreqShort(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(1)}M`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)}k`;
  return `${hz.toFixed(1)}`;
}
