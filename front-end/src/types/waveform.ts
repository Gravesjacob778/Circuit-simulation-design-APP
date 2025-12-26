/**
 * Waveform Types - 波形檢視器純展示層資料模型
 * 
 * Viewer 遵循以下原則：
 * - 純展示元件 (Pure Presentation Component)
 * - 不知道「元件是什麼」、「LED 是什麼」、「數值如何計算」
 * - 僅消費 WaveformTrace[] 資料
 */

// ========== 單位類型 ==========

/**
 * 支援的電學量單位
 * 只允許求解器產生的電學量（電壓、電流、功率）
 */
export type WaveformUnit = 'V' | 'A' | 'W';

/**
 * 單位顯示配置
 */
export interface UnitConfig {
    /** 單位符號 */
    symbol: WaveformUnit;
    /** 完整名稱 */
    name: string;
    /** Y 軸標籤 */
    axisLabel: string;
    /** 預設顏色調色盤 */
    defaultColors: string[];
}

/**
 * 單位配置表
 */
export const UNIT_CONFIGS: Record<WaveformUnit, UnitConfig> = {
    V: {
        symbol: 'V',
        name: 'Voltage',
        axisLabel: 'Voltage (V)',
        defaultColors: ['#ffd740', '#ffab40', '#ff9100', '#ffca28', '#ffc107'],
    },
    A: {
        symbol: 'A',
        name: 'Current',
        axisLabel: 'Current (A)',
        defaultColors: ['#4caf50', '#66bb6a', '#81c784', '#8bc34a', '#00e676'],
    },
    W: {
        symbol: 'W',
        name: 'Power',
        axisLabel: 'Power (W)',
        defaultColors: ['#ab47bc', '#ba68c8', '#ce93d8', '#9c27b0', '#e040fb'],
    },
};

// ========== 波形描線資料 ==========

/**
 * 時間-數值資料點
 */
export interface WaveformDataPoint {
    /** 時間 (秒) */
    time: number;
    /** 數值 (依單位而定) */
    value: number;
}

/**
 * 波形描線 (Waveform Trace)
 * 這是 Viewer 消費的核心資料結構
 * 
 * 每個 WaveformTrace 對應一個 Probe
 */
export interface WaveformTrace {
    /** 唯一識別碼 (對應 Probe.probeId) */
    traceId: string;

    /** 顯示名稱 (例如 "V(N001)", "I(R1)") */
    label: string;

    /** 單位 */
    unit: WaveformUnit;

    /** 波形顏色 (Hex 格式) */
    color: string;

    /** 是否可見 */
    visible: boolean;

    /** 資料點陣列 */
    data: WaveformDataPoint[];
}

// ========== 游標與測量 ==========

/**
 * 游標資料
 */
export interface WaveformCursor {
    /** 游標 ID */
    id: 'cursor1' | 'cursor2';

    /** 是否啟用 */
    enabled: boolean;

    /** 時間位置 (秒) */
    time: number;

    /** 各個 trace 在此時間點的數值 */
    values: Map<string, number>;
}

/**
 * 測量讀數
 */
export interface WaveformMeasurement {
    /** 測量類型 */
    type: 'max' | 'min' | 'peak-to-peak' | 'average' | 'rms' | 'frequency' | 'period';

    /** 來源 trace ID */
    traceId: string;

    /** 測量值 */
    value: number;

    /** 單位 */
    unit: WaveformUnit;
}

// ========== 檢視器設定 ==========

/**
 * 時間軸設定
 */
export interface TimeAxisConfig {
    /** 起始時間 (秒) */
    start: number;

    /** 結束時間 (秒) */
    end: number;

    /** 時間/格 (秒/div) */
    timePerDivision: number;

    /** 格數 */
    divisions: number;
}

/**
 * Y 軸設定
 */
export interface YAxisConfig {
    /** 軸 ID */
    axisId: string;

    /** 關聯的單位 */
    unit: WaveformUnit;

    /** 最小值 */
    min: number;

    /** 最大值 */
    max: number;

    /** 單位/格 (value/div) */
    valuePerDivision: number;

    /** 位置 ('left' | 'right') */
    position: 'left' | 'right';

    /** 關聯的 trace IDs */
    traceIds: string[];
}

/**
 * 縮放與平移狀態
 */
export interface ViewportState {
    /** 時間軸 */
    timeAxis: TimeAxisConfig;

    /** Y 軸列表 (依單位分組) */
    yAxes: YAxisConfig[];

    /** 是否自動縮放 */
    autoScale: boolean;
}

/**
 * 波形檢視器狀態
 */
export interface WaveformViewerState {
    /** 所有波形描線 */
    traces: WaveformTrace[];

    /** 檢視區狀態 */
    viewport: ViewportState;

    /** 游標 */
    cursors: [WaveformCursor, WaveformCursor];

    /** 測量值 */
    measurements: WaveformMeasurement[];

    /** 當前游標時間 (hover 時顯示) */
    hoverTime: number | null;

    /** 是否正在拖曳 */
    isDragging: boolean;
}

// ========== 事件類型 ==========

/**
 * Viewer 發出的事件
 */
export interface WaveformViewerEvents {
    /** 可見性切換 */
    'trace-visibility-changed': { traceId: string; visible: boolean };

    /** 游標移動 */
    'cursor-moved': { cursorId: string; time: number };

    /** 檢視區變更 */
    'viewport-changed': ViewportState;

    /** 點擊波形 */
    'trace-clicked': { traceId: string; time: number; value: number };
}

// ========== 工具函式 ==========

/**
 * 在資料點中插值取得指定時間的數值
 */
export function interpolateValue(
    data: WaveformDataPoint[],
    time: number
): number | null {
    if (data.length === 0) return null;

    // 邊界檢查 (非空斷言安全，因為 data.length > 0 已於上方確認)
    if (time <= data[0]!.time) return data[0]!.value;
    if (time >= data[data.length - 1]!.time) return data[data.length - 1]!.value;

    // 二分搜尋找到區間
    let left = 0;
    let right = data.length - 1;

    while (right - left > 1) {
        const mid = Math.floor((left + right) / 2);
        if (data[mid]!.time <= time) {
            left = mid;
        } else {
            right = mid;
        }
    }

    // 線性插值
    const t0 = data[left]!.time;
    const t1 = data[right]!.time;
    const v0 = data[left]!.value;
    const v1 = data[right]!.value;

    const ratio = (time - t0) / (t1 - t0);
    return v0 + (v1 - v0) * ratio;
}

/**
 * 計算資料的統計量
 */
export function calculateStats(data: WaveformDataPoint[]): {
    min: number;
    max: number;
    average: number;
    rms: number;
    peakToPeak: number;
} {
    if (data.length === 0) {
        return { min: 0, max: 0, average: 0, rms: 0, peakToPeak: 0 };
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;

    for (const point of data) {
        const v = point.value;
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        sumSq += v * v;
    }

    const n = data.length;
    const average = sum / n;
    const rms = Math.sqrt(sumSq / n);
    const peakToPeak = max - min;

    return { min, max, average, rms, peakToPeak };
}

/**
 * 格式化數值（自動選擇合適的工程單位前綴）
 */
export function formatValue(value: number, unit: WaveformUnit): string {
    const absValue = Math.abs(value);

    if (absValue === 0) return `0 ${unit}`;

    const prefixes = [
        { factor: 1e-12, symbol: 'p' },
        { factor: 1e-9, symbol: 'n' },
        { factor: 1e-6, symbol: 'μ' },
        { factor: 1e-3, symbol: 'm' },
        { factor: 1, symbol: '' },
        { factor: 1e3, symbol: 'k' },
        { factor: 1e6, symbol: 'M' },
    ];

    const prefix = prefixes.find(p => absValue < p.factor * 1000) ?? prefixes[prefixes.length - 1];
    const scaledValue = value / prefix.factor;

    return `${scaledValue.toPrecision(4)} ${prefix.symbol}${unit}`;
}

/**
 * 格式化時間（自動選擇合適的單位）
 */
export function formatTime(seconds: number): string {
    const absSeconds = Math.abs(seconds);

    if (absSeconds === 0) return '0 s';

    if (absSeconds >= 1) {
        return `${seconds.toPrecision(4)} s`;
    } else if (absSeconds >= 1e-3) {
        return `${(seconds * 1e3).toPrecision(4)} ms`;
    } else if (absSeconds >= 1e-6) {
        return `${(seconds * 1e6).toPrecision(4)} μs`;
    } else if (absSeconds >= 1e-9) {
        return `${(seconds * 1e9).toPrecision(4)} ns`;
    } else {
        return `${(seconds * 1e12).toPrecision(4)} ps`;
    }
}
