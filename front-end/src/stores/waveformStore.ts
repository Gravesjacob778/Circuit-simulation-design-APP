/**
 * Waveform Store - 波形資料管理
 * 
 * 負責：
 * - 管理 Probe 定義
 * - 將模擬結果轉換為 WaveformTrace
 * - 提供給 WaveformViewer 的資料介面
 * 
 * 這是業務邏輯層（知道 Probe、Component），
 * WaveformViewer 只接收處理過的 WaveformTrace[]
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WaveformTrace, WaveformUnit, WaveformDataPoint } from '@/types/waveform';
import type { TransientSimulationResult } from '@/lib/simulation';

// ========== Probe 定義 ==========

/**
 * 探針定義
 * 每個 Probe 對應一個測量點
 */
export interface Probe {
    /** 探針 ID */
    probeId: string;

    /** 關聯的元件 ID */
    componentId: string;

    /** 通道 ID (例如 '+', '-', 'out') */
    channelId: string;

    /** 測量單位 */
    unit: WaveformUnit;

    /** 顯示顏色 */
    color: string;

    /** 是否可見 */
    visible: boolean;

    /** 顯示標籤 */
    label: string;
}

/**
 * 預設顏色調色盤
 */
const DEFAULT_COLORS = [
    '#4caf50', // 綠色
    '#ffd740', // 黃色
    '#42a5f5', // 藍色
    '#ab47bc', // 紫色
    '#ff9800', // 橙色
    '#f44336', // 紅色
    '#00bcd4', // 青色
    '#e91e63', // 粉色
];

export const useWaveformStore = defineStore('waveform', () => {
    // ========== State ==========

    /** 所有探針 */
    const probes = ref<Probe[]>([]);

    /** 時間序列資料 (probeId -> 資料點陣列) */
    const probeData = ref<Map<string, WaveformDataPoint[]>>(new Map());

    /** 當前時間範圍 */
    const timeRange = ref({ start: 0, end: 1 });

    /** 顏色計數器（用於自動分配顏色） */
    let colorIndex = 0;

    const DEFAULT_MAX_POINTS_PER_PROBE = 60 * 120; // ~2 minutes at 60Hz

    /** 累積模式狀態（保留歷史數據而非清除） */
    const accumulationMode = ref(false);

    // ========== Computed ==========

    /**
     * 將 Probes 轉換為 WaveformTraces（給 Viewer 使用）
     */
    const waveformTraces = computed<WaveformTrace[]>(() => {
        return probes.value.map(probe => ({
            traceId: probe.probeId,
            label: probe.label,
            unit: probe.unit,
            color: probe.color,
            visible: probe.visible,
            data: probeData.value.get(probe.probeId) ?? [],
        }));
    });

    /**
     * 可見的 traces
     */
    const visibleTraces = computed(() =>
        waveformTraces.value.filter(t => t.visible)
    );

    /**
     * 是否有資料
     */
    const hasData = computed(() =>
        probeData.value.size > 0 &&
        Array.from(probeData.value.values()).some(data => data.length > 0)
    );

    // ========== Actions ==========

    /**
     * 新增探針
     */
    function addProbe(config: {
        componentId: string;
        channelId: string;
        unit: WaveformUnit;
        label?: string;
        color?: string;
    }): Probe {
        const probeId = `probe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const defaultColor = DEFAULT_COLORS[colorIndex++ % DEFAULT_COLORS.length] ?? '#888888';
        const color = config.color ?? defaultColor;
        const label = config.label ?? generateDefaultLabel(config.componentId, config.channelId, config.unit);

        const probe: Probe = {
            probeId,
            componentId: config.componentId,
            channelId: config.channelId,
            unit: config.unit,
            color,
            visible: true,
            label,
        };

        probes.value.push(probe);
        probeData.value.set(probeId, []);

        return probe;
    }

    /**
     * 移除探針
     */
    function removeProbe(probeId: string): void {
        const index = probes.value.findIndex(p => p.probeId === probeId);
        if (index !== -1) {
            probes.value.splice(index, 1);
            probeData.value.delete(probeId);
        }
    }

    /**
     * 切換探針可見性
     */
    function toggleProbeVisibility(probeId: string): void {
        const probe = probes.value.find(p => p.probeId === probeId);
        if (probe) {
            probe.visible = !probe.visible;
        }
    }

    /**
     * 更新探針顏色
     */
    function updateProbeColor(probeId: string, color: string): void {
        const probe = probes.value.find(p => p.probeId === probeId);
        if (probe) {
            probe.color = color;
        }
    }

    /**
     * 更新探針資料
     */
    function updateProbeData(probeId: string, data: WaveformDataPoint[]): void {
        probeData.value.set(probeId, data);
        updateTimeRangeFromData();
    }

    /**
     * 批次更新多個探針資料
     */
    function batchUpdateData(updates: Map<string, WaveformDataPoint[]>): void {
        updates.forEach((data, probeId) => {
            probeData.value.set(probeId, data);
        });

        updateTimeRangeFromData();
    }

    /**
     * 追加探針資料（支援串流更新）
     */
    function appendProbeData(
        probeId: string,
        points: WaveformDataPoint[],
        options?: {
            /**
             * 每個 probe 允許保留的最大點數（超過會從舊資料裁切）
             */
            maxPoints?: number;
        }
    ): void {
        if (points.length === 0) return;

        const existing = probeData.value.get(probeId) ?? [];
        const combined = existing.concat(points);

        const maxPoints = options?.maxPoints ?? DEFAULT_MAX_POINTS_PER_PROBE;
        const trimmed =
            combined.length > maxPoints ? combined.slice(combined.length - maxPoints) : combined;

        probeData.value.set(probeId, trimmed);
        updateTimeRangeFromData();
    }

    /**
     * 從模擬結果載入資料
     * 這是與模擬層的橋接點
     */
    function loadFromSimulation(
        timePoints: number[],
        signals: Array<{
            componentId: string;
            channelId: string;
            unit: WaveformUnit;
            values: number[];
            label?: string;
            color?: string;
        }>
    ): void {
        // 清除現有探針
        clearAll();

        // 為每個訊號建立探針
        for (const signal of signals) {
            const probe = addProbe({
                componentId: signal.componentId,
                channelId: signal.channelId,
                unit: signal.unit,
                label: signal.label,
                color: signal.color,
            });

            // 建立資料點陣列
            const data: WaveformDataPoint[] = timePoints.map((time, i) => ({
                time,
                value: signal.values[i] ?? 0,
            }));

            updateProbeData(probe.probeId, data);
        }

        // 更新時間範圍
        updateTimeRangeFromData();
    }

    /**
     * 從瞬態模擬結果載入資料
     * 專門用於 AC 時域分析結果
     */
    function loadFromTransientResult(
        result: TransientSimulationResult,
        componentLabels: Map<string, string>
    ): void {
        // 清除現有探針
        clearAll();

        const timePoints = result.timePoints;

        // 為每個支路電流建立探針
        result.branchCurrentHistory.forEach((currents, componentId) => {
            const label = componentLabels.get(componentId) ?? componentId;
            
            const probe = addProbe({
                componentId,
                channelId: 'current',
                unit: 'A',
                label: `I(${label})`,
            });

            const data: WaveformDataPoint[] = timePoints.map((time, i) => ({
                time,
                value: currents[i] ?? 0,
            }));

            updateProbeData(probe.probeId, data);
        });

        // 更新時間範圍
        updateTimeRangeFromData();
    }

    /**
     * 建立示範資料（用於開發測試）
     */
    function loadDemoData(): void {
        const sampleRate = 1000; // 1kHz
        const duration = 0.01; // 10ms
        const numPoints = Math.floor(duration * sampleRate);

        const timePoints = Array.from({ length: numPoints }, (_, i) => i / sampleRate);

        // 模擬電壓波形（正弦波）
        const voltageValues = timePoints.map(t => 5 * Math.sin(2 * Math.PI * 100 * t)); // 100Hz sine

        // 模擬電流波形（相位偏移的正弦波）
        const currentValues = timePoints.map(t => 0.01 * Math.sin(2 * Math.PI * 100 * t + Math.PI / 4)); // 10mA peak

        // 模擬另一個電壓（方波）
        const voltage2Values = timePoints.map(t => {
            const period = 0.002; // 2ms period = 500Hz
            const phase = t % period;
            return phase < period / 2 ? 3.3 : 0;
        });

        loadFromSimulation(timePoints, [
            {
                componentId: 'V1',
                channelId: '+',
                unit: 'V',
                values: voltageValues,
                label: 'V(V1)',
                color: '#ffd740',
            },
            {
                componentId: 'R1',
                channelId: 'current',
                unit: 'A',
                values: currentValues,
                label: 'I(R1)',
                color: '#4caf50',
            },
            {
                componentId: 'V2',
                channelId: '+',
                unit: 'V',
                values: voltage2Values,
                label: 'V(V2)',
                color: '#42a5f5',
            },
        ]);
    }

    /**
     * 清除所有資料
     */
    function clearAll(): void {
        probes.value = [];
        probeData.value = new Map();
        colorIndex = 0;
        timeRange.value = { start: 0, end: 1 };
    }

    /**
     * 以「單一元件單一 trace」模式開始串流波形（會清除其他波形）
     */
    function startSingleComponentStream(config: {
        componentId: string;
        label: string;
        unit: WaveformUnit;
        initialValue: number;
        color?: string;
    }): Probe {
        clearAll();

        const probe = addProbe({
            componentId: config.componentId,
            channelId: 'current',
            unit: config.unit,
            label: config.label,
            color: config.color,
        });

        updateProbeData(probe.probeId, [{ time: 0, value: config.initialValue }]);
        return probe;
    }

    /**
     * 開始累積模式串流（保留歷史數據）
     * 與 startSingleComponentStream 不同，這個方法不會清除現有數據
     */
    function startAccumulationStream(config: {
        componentId: string;
        label: string;
        unit: WaveformUnit;
        color?: string;
    }): Probe {
        accumulationMode.value = true;

        // 檢查是否已存在該元件的探針
        const existingProbe = probes.value.find(
            p => p.componentId === config.componentId && p.unit === config.unit
        );

        if (existingProbe) {
            existingProbe.visible = true;
            return existingProbe;
        }

        // 創建新探針（不清除現有數據）
        const probe = addProbe({
            componentId: config.componentId,
            channelId: 'current',
            unit: config.unit,
            label: config.label,
            color: config.color,
        });

        return probe;
    }

    /**
     * 停止累積模式
     */
    function stopAccumulationStream(): void {
        accumulationMode.value = false;
    }

    // ========== 輔助函式 ==========

    function generateDefaultLabel(componentId: string, _channelId: string, unit: WaveformUnit): string {
        // _channelId 保留供未來使用（例如多通道元件）
        const prefix = unit === 'V' ? 'V' : unit === 'A' ? 'I' : 'P';
        return `${prefix}(${componentId})`;
    }

    /**
     * 為選取的元件添加電流波形
     * 當用戶點擊元件時，顯示該元件的電流波形
     */
    function addComponentWaveform(config: {
        componentId: string;
        label: string;
        unit: WaveformUnit;
        currentValue: number; // 電流值 (A)
        color?: string;
    }): Probe | null {
        // 檢查是否已存在相同的探針
        const existingProbe = probes.value.find(
            p => p.componentId === config.componentId && p.unit === config.unit
        );

        if (existingProbe) {
            // 如果已存在，更新資料並確保可見
            existingProbe.visible = true;

            // 產生穩態波形資料（用於 DC 分析）
            const duration = 0.01; // 10ms
            const numPoints = 100;
            const timePoints = Array.from({ length: numPoints }, (_, i) => (i / numPoints) * duration);
            const data: WaveformDataPoint[] = timePoints.map(time => ({
                time,
                value: config.currentValue,
            }));

            updateProbeData(existingProbe.probeId, data);

            // 更新時間範圍
            timeRange.value = { start: 0, end: duration };

            return existingProbe;
        }

        // 建立新探針
        const probe = addProbe({
            componentId: config.componentId,
            channelId: 'current',
            unit: config.unit,
            label: config.label,
            color: config.color,
        });

        // 產生穩態波形資料（用於 DC 分析）
        const duration = 0.01; // 10ms
        const numPoints = 100;
        const timePoints = Array.from({ length: numPoints }, (_, i) => (i / numPoints) * duration);
        const data: WaveformDataPoint[] = timePoints.map(time => ({
            time,
            value: config.currentValue,
        }));

        updateProbeData(probe.probeId, data);

        // 更新時間範圍
        timeRange.value = { start: 0, end: duration };

        return probe;
    }

    /**
     * 移除特定元件的波形探針
     */
    function removeComponentWaveform(componentId: string): void {
        const probesToRemove = probes.value.filter(p => p.componentId === componentId);
        probesToRemove.forEach(probe => removeProbe(probe.probeId));
    }

    /**
     * 清除並僅顯示指定元件的波形
     */
    function showOnlyComponentWaveform(config: {
        componentId: string;
        label: string;
        unit: WaveformUnit;
        currentValue: number;
        color?: string;
    }): Probe | null {
        // 清除所有現有探針
        clearAll();

        // 添加指定元件的波形
        return addComponentWaveform(config);
    }

    function updateTimeRangeFromData(): void {
        let minTime = Infinity;
        let maxTime = -Infinity;

        for (const data of probeData.value.values()) {
            if (data.length === 0) continue;
            const first = data[0];
            const last = data[data.length - 1];
            if (!first || !last) continue;
            if (first.time < minTime) minTime = first.time;
            if (last.time > maxTime) maxTime = last.time;
        }

        if (minTime === Infinity || maxTime === -Infinity) {
            timeRange.value = { start: 0, end: 1 };
            return;
        }

        timeRange.value = { start: minTime, end: maxTime };
    }

    return {
        // State
        probes,
        probeData,
        timeRange,
        accumulationMode, // 累積模式狀態

        // Computed
        waveformTraces,
        visibleTraces,
        hasData,

        // Actions
        addProbe,
        removeProbe,
        toggleProbeVisibility,
        updateProbeColor,
        updateProbeData,
        appendProbeData,
        batchUpdateData,
        loadFromSimulation,
        loadFromTransientResult,
        loadDemoData,
        clearAll,
        addComponentWaveform,
        removeComponentWaveform,
        showOnlyComponentWaveform,
        startSingleComponentStream,
        startAccumulationStream, // 累積模式串流
        stopAccumulationStream,  // 停止累積模式
    };
});
