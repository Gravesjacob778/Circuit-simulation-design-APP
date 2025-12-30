/**
 * useWaveformViewer - 波形檢視器狀態管理 Composable
 * 
 * 負責：
 * - 管理 viewport 狀態（縮放、平移）
 * - 處理游標邏輯
 * - 計算依單位分組的 Y 軸
 * - 提供互動操作方法
 */

import { ref, computed, watch, type Ref } from 'vue';
import type {
    WaveformTrace,
    WaveformUnit,
    ViewportState,
    TimeAxisConfig,
    YAxisConfig,
    WaveformCursor,
} from '@/types/waveform';
import { interpolateValue, calculateStats } from '@/types/waveform';

export interface UseWaveformViewerOptions {
    /** 預設每格時間 */
    defaultTimePerDiv?: number;
    /** 預設格數 */
    defaultDivisions?: number;
    /** 是否自動縮放 */
    autoScale?: boolean;
}

const DEFAULT_OPTIONS: Required<UseWaveformViewerOptions> = {
    defaultTimePerDiv: 0.001, // 1ms/div
    defaultDivisions: 10,
    autoScale: true,
};

export function useWaveformViewer(
    traces: Ref<WaveformTrace[]>,
    options: UseWaveformViewerOptions = {}
) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // ========== 狀態 ==========

    /** 時間軸配置 */
    const timeAxis = ref<TimeAxisConfig>({
        start: 0,
        end: opts.defaultTimePerDiv * opts.defaultDivisions,
        timePerDivision: opts.defaultTimePerDiv,
        divisions: opts.defaultDivisions,
    });

    /** 是否自動縮放 */
    const autoScale = ref(opts.autoScale);

    /** 當前 hover 的時間位置 */
    const hoverTime = ref<number | null>(null);

    /** 游標 */
    const cursor1 = ref<WaveformCursor>({
        id: 'cursor1',
        enabled: false,
        time: 0,
        values: new Map(),
    });

    const cursor2 = ref<WaveformCursor>({
        id: 'cursor2',
        enabled: false,
        time: 0,
        values: new Map(),
    });

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
     * 依單位分組的 traces
     */
    const tracesByUnit = computed(() => {
        const groups = new Map<WaveformUnit, WaveformTrace[]>();

        for (const trace of visibleTraces.value) {
            const existing = groups.get(trace.unit) ?? [];
            existing.push(trace);
            groups.set(trace.unit, existing);
        }

        return groups;
    });

    /**
     * 計算所有資料的時間範圍
     */
    const dataTimeRange = computed(() => {
        let minTime = Infinity;
        let maxTime = -Infinity;

        for (const trace of traces.value) {
            if (trace.data.length === 0) continue;

            const firstPoint = trace.data[0];
            const lastPoint = trace.data[trace.data.length - 1];

            // TypeScript 無法從 length 檢查推斷出非 undefined，需明確檢查
            if (firstPoint === undefined || lastPoint === undefined) continue;

            const first = firstPoint.time;
            const last = lastPoint.time;

            if (first < minTime) minTime = first;
            if (last > maxTime) maxTime = last;
        }

        if (minTime === Infinity) {
            return { min: 0, max: 1 };
        }

        return { min: minTime, max: maxTime };
    });

    /**
     * 計算 Y 軸配置
     * 不同單位使用不同的 Y 軸，絕對不混合
     */
    const yAxes = computed<YAxisConfig[]>(() => {
        const axes: YAxisConfig[] = [];
        let rightAxisCount = 0;

        const units: WaveformUnit[] = ['V', 'A', 'W'];

        for (const unit of units) {
            const unitTraces = tracesByUnit.value.get(unit);
            if (!unitTraces || unitTraces.length === 0) continue;

            // 計算此單位所有 traces 的範圍
            let globalMin = Infinity;
            let globalMax = -Infinity;

            for (const trace of unitTraces) {
                if (!trace.visible) continue;

                const stats = calculateStats(trace.data);
                if (stats.min < globalMin) globalMin = stats.min;
                if (stats.max > globalMax) globalMax = stats.max;
            }

            // 處理邊界情況
            if (globalMin === Infinity || globalMax === -Infinity) {
                globalMin = -1;
                globalMax = 1;
            }

            // 計算適當的邊距
            const range = globalMax - globalMin;
            let margin: number;

            if (range === 0) {
                // DC 恆定值：使用數值絕對值的 20% 作為邊距，最小為 0.1 倍的數值大小
                // 這樣能確保 3A 顯示在合理範圍內，而不是固定 ±1
                const absValue = Math.abs(globalMax);
                if (absValue === 0) {
                    margin = 1; // 值為 0 時，使用 ±1 的範圍
                } else {
                    margin = absValue * 0.2; // 使用值的 20% 作為邊距
                }
            } else {
                margin = range * 0.1; // 正常情況：使用範圍的 10%
            }

            const min = globalMin - margin;
            const max = globalMax + margin;

            // 計算合適的每格數值
            const valuePerDiv = calculateNiceStep(max - min, 8);

            // 決定軸的位置：第一個軸在左邊，其餘在右邊
            const position: 'left' | 'right' = axes.length === 0 ? 'left' : 'right';

            if (position === 'right') rightAxisCount++;

            axes.push({
                axisId: `y-${unit}`,
                unit,
                min,
                max,
                valuePerDivision: valuePerDiv,
                position,
                traceIds: unitTraces.map(t => t.traceId),
            });
        }

        return axes;
    });

    /**
     * 完整的 viewport 狀態
     */
    const viewport = computed<ViewportState>(() => ({
        timeAxis: timeAxis.value,
        yAxes: yAxes.value,
        autoScale: autoScale.value,
    }));

    /**
     * 當前 hover 位置的數值
     */
    const hoverValues = computed(() => {
        const values = new Map<string, number>();

        if (hoverTime.value === null) return values;

        for (const trace of visibleTraces.value) {
            const value = interpolateValue(trace.data, hoverTime.value);
            if (value !== null) {
                values.set(trace.traceId, value);
            }
        }

        return values;
    });

    // ========== 方法 ==========

    /**
     * 設定時間軸範圍
     */
    function setTimeRange(start: number, end: number) {
        const duration = end - start;
        const timePerDiv = duration / timeAxis.value.divisions;

        timeAxis.value = {
            ...timeAxis.value,
            start,
            end,
            timePerDivision: timePerDiv,
        };

        autoScale.value = false;
    }

    /**
     * 縮放時間軸（以中心為基準）
     */
    function zoomTime(factor: number, centerTime?: number) {
        const current = timeAxis.value;
        const center = centerTime ?? (current.start + current.end) / 2;

        const newHalfRange = ((current.end - current.start) / 2) / factor;
        const newStart = center - newHalfRange;
        const newEnd = center + newHalfRange;

        setTimeRange(newStart, newEnd);
    }

    /**
     * 平移時間軸
     */
    function panTime(deltaTime: number) {
        const current = timeAxis.value;
        setTimeRange(current.start + deltaTime, current.end + deltaTime);
    }

    /**
     * 重設為自動縮放
     */
    function resetZoom() {
        const range = dataTimeRange.value;
        const duration = range.max - range.min;

        // 加上 5% 邊距
        const margin = duration === 0 ? 0.5 : duration * 0.05;

        timeAxis.value = {
            start: range.min - margin,
            end: range.max + margin,
            timePerDivision: (duration + margin * 2) / opts.defaultDivisions,
            divisions: opts.defaultDivisions,
        };

        autoScale.value = true;
    }

    /**
     * 適應所有資料範圍
     */
    function fitToData() {
        resetZoom();
    }

    /**
     * 設定 hover 時間
     */
    function setHoverTime(time: number | null) {
        hoverTime.value = time;
    }

    /**
     * 切換游標
     */
    function toggleCursor(cursorId: 'cursor1' | 'cursor2') {
        const cursor = cursorId === 'cursor1' ? cursor1 : cursor2;
        cursor.value = {
            ...cursor.value,
            enabled: !cursor.value.enabled,
        };
    }

    /**
     * 移動游標
     */
    function moveCursor(cursorId: 'cursor1' | 'cursor2', time: number) {
        const cursor = cursorId === 'cursor1' ? cursor1 : cursor2;
        const values = new Map<string, number>();

        for (const trace of visibleTraces.value) {
            const value = interpolateValue(trace.data, time);
            if (value !== null) {
                values.set(trace.traceId, value);
            }
        }

        cursor.value = {
            ...cursor.value,
            time,
            values,
        };
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

    // ========== 監聯自動縮放 ==========

    // 只在 traces 數量或 ID 改變時才重設縮放（避免每次 data append 都觸發）
    let lastTraceIds = '';
    watch(
        () => traces.value.map(t => t.traceId).join(','),
        (newIds) => {
            if (newIds !== lastTraceIds) {
                lastTraceIds = newIds;
                if (autoScale.value) {
                    resetZoom();
                }
            }
        },
        { immediate: true }
    );

    // 初始化時執行一次 fit
    if (traces.value.length > 0) {
        resetZoom();
    }

    return {
        // 狀態
        timeAxis,
        autoScale,
        hoverTime,
        cursor1,
        cursor2,
        isDragging,

        // 計算屬性
        visibleTraces,
        tracesByUnit,
        dataTimeRange,
        yAxes,
        viewport,
        hoverValues,

        // 方法
        setTimeRange,
        zoomTime,
        panTime,
        resetZoom,
        fitToData,
        setHoverTime,
        toggleCursor,
        moveCursor,
        toggleTraceVisibility,
    };
}

// ========== 輔助函式 ==========

/**
 * 計算「漂亮」的步進值（1, 2, 5 的倍數）
 */
function calculateNiceStep(range: number, targetSteps: number): number {
    if (range === 0) return 1;

    const roughStep = range / targetSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;

    let niceStep: number;
    if (normalized <= 1) {
        niceStep = 1;
    } else if (normalized <= 2) {
        niceStep = 2;
    } else if (normalized <= 5) {
        niceStep = 5;
    } else {
        niceStep = 10;
    }

    return niceStep * magnitude;
}
