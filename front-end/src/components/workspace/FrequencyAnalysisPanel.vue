<script setup lang="ts">
/**
 * FrequencyAnalysisPanel - 頻率分析面板
 *
 * 包含：
 * - 掃頻參數設定
 * - Bode 圖顯示
 * - 阻抗圖顯示
 * - 測量結果表格
 */

import { ref, computed, watch } from 'vue';
import { useCircuitStore } from '@/stores/circuitStore';
import BodePlot from './BodePlot.vue';
import ImpedancePlot from './ImpedancePlot.vue';
import type { BodePlotTrace, ImpedancePlotTrace, ResonanceMarker } from '@/types/frequencyAnalysis';
import { formatFrequency, formatImpedance, formatQFactor } from '@/utils/frequencyFormat';
import { TRACE_COLORS } from '@/types/frequencyAnalysis';

const store = useCircuitStore();

// ========== 掃頻設定 ==========

const startFrequency = ref(store.acSweepOptions.startFrequency ?? 1);
const endFrequency = ref(store.acSweepOptions.endFrequency ?? 1e6);
const pointsPerDecade = ref(store.acSweepOptions.pointsPerDecade ?? 10);

// ========== 計算屬性 ==========

/**
 * 將 AC 掃頻結果轉換為 Bode 圖軌跡
 */
const bodePlotTraces = computed<BodePlotTrace[]>(() => {
  const result = store.acSweepResult;
  if (!result?.success || result.frequencyPoints.length === 0) {
    return [];
  }

  const traces: BodePlotTrace[] = [];
  let colorIndex = 0;

  // 為每個節點電壓創建軌跡
  const firstPoint = result.frequencyPoints[0]!;
  for (const [nodeId] of firstPoint.nodeVoltages) {
    const magnitudeData: { frequency: number; value: number }[] = [];
    const phaseData: { frequency: number; value: number }[] = [];

    for (const point of result.frequencyPoints) {
      const phasor = point.nodeVoltages.get(nodeId);
      if (phasor) {
        // 計算 dB（相對於 1V）
        const db = 20 * Math.log10(Math.max(phasor.magnitude, 1e-12));
        magnitudeData.push({ frequency: point.frequency, value: db });
        phaseData.push({ frequency: point.frequency, value: phasor.phaseDegrees });
      }
    }

    traces.push({
      traceId: `voltage-${nodeId}`,
      label: `V(${nodeId.substring(0, 8)})`,
      color: TRACE_COLORS[colorIndex % TRACE_COLORS.length]!,
      visible: true,
      magnitudeData,
      phaseData,
    });

    colorIndex++;
  }

  return traces;
});

/**
 * 將 AC 掃頻結果轉換為阻抗圖軌跡
 */
const impedancePlotTraces = computed<ImpedancePlotTrace[]>(() => {
  const result = store.acSweepResult;
  if (!result?.success || result.impedanceData.length === 0) {
    return [];
  }

  return result.impedanceData.map((data, index) => ({
    traceId: `impedance-${data.componentId}`,
    componentId: data.componentId,
    label: `|Z(${data.label})|`,
    color: TRACE_COLORS[index % TRACE_COLORS.length]!,
    visible: true,
    magnitudeData: data.frequencies.map((f, i) => ({
      frequency: f,
      value: data.magnitudeOhms[i]!,
    })),
    phaseData: data.frequencies.map((f, i) => ({
      frequency: f,
      value: data.phaseDegrees[i]!,
    })),
  }));
});

/**
 * 共振標記
 */
const resonanceMarkers = computed<ResonanceMarker[]>(() => {
  const result = store.acSweepResult;
  if (!result?.success) return [];

  return result.resonances.map((res) => ({
    frequency: res.frequency,
    label: `f₀=${formatFrequency(res.frequency, 2)}`,
    type: res.type === 'series' ? 'resonance' as const : 'peak' as const,
    value: res.qFactor,
  }));
});

/**
 * 測量結果
 */
const measurements = computed(() => {
  const result = store.acSweepResult;
  if (!result?.success) return [];

  const items: { label: string; value: string }[] = [];

  // 共振資訊
  for (const res of result.resonances) {
    items.push({
      label: '共振頻率',
      value: formatFrequency(res.frequency),
    });
    items.push({
      label: 'Q 值',
      value: formatQFactor(res.qFactor),
    });
    items.push({
      label: '頻寬',
      value: formatFrequency(res.bandwidth),
    });
    items.push({
      label: '下截止頻率',
      value: formatFrequency(res.lowerCutoff),
    });
    items.push({
      label: '上截止頻率',
      value: formatFrequency(res.upperCutoff),
    });
  }

  return items;
});

// ========== 方法 ==========

function runAnalysis() {
  store.updateACSweepOptions({
    startFrequency: startFrequency.value,
    endFrequency: endFrequency.value,
    pointsPerDecade: pointsPerDecade.value,
  });
  store.runACSweep();
}

// 監聯掃頻選項變化
watch(
  () => store.acSweepOptions,
  (opts) => {
    if (opts.startFrequency) startFrequency.value = opts.startFrequency;
    if (opts.endFrequency) endFrequency.value = opts.endFrequency;
    if (opts.pointsPerDecade) pointsPerDecade.value = opts.pointsPerDecade;
  },
  { immediate: true }
);
</script>

<template>
  <div class="frequency-analysis-panel">
    <!-- 控制列 -->
    <div class="config-bar">
      <div class="config-group">
        <label>
          起始頻率
          <input
            v-model.number="startFrequency"
            type="number"
            min="0.1"
            step="any"
          />
          <span class="unit">Hz</span>
        </label>
      </div>

      <div class="config-group">
        <label>
          終止頻率
          <input
            v-model.number="endFrequency"
            type="number"
            min="1"
            step="any"
          />
          <span class="unit">Hz</span>
        </label>
      </div>

      <div class="config-group">
        <label>
          每十倍頻點數
          <input
            v-model.number="pointsPerDecade"
            type="number"
            min="5"
            max="100"
          />
        </label>
      </div>

      <button
        class="run-btn"
        :disabled="store.isSimulating"
        @click="runAnalysis"
      >
        {{ store.isSimulating ? '分析中...' : '執行 AC 掃頻' }}
      </button>
    </div>

    <!-- 錯誤訊息 -->
    <div v-if="store.simulationError && store.analysisMode === 'frequency'" class="error-message">
      {{ store.simulationError }}
    </div>

    <!-- 圖表區域 -->
    <div v-if="store.acSweepResult?.success" class="plots-container">
      <!-- Bode 圖 -->
      <div class="plot-section">
        <h4 class="plot-title">Bode 圖</h4>
        <BodePlot
          :traces="bodePlotTraces"
          :markers="resonanceMarkers"
          :height="280"
          :show-magnitude="true"
          :show-phase="true"
        />
      </div>

      <!-- 阻抗圖 -->
      <div class="plot-section">
        <h4 class="plot-title">阻抗曲線</h4>
        <ImpedancePlot
          :traces="impedancePlotTraces"
          :markers="resonanceMarkers"
          :height="220"
          :log-y-scale="true"
          :show-phase="true"
        />
      </div>
    </div>

    <!-- 空狀態 -->
    <div v-else class="empty-state">
      <p>尚未執行 AC 掃頻分析</p>
      <p class="hint">請設定頻率範圍並點擊「執行 AC 掃頻」按鈕</p>
    </div>

    <!-- 測量結果 -->
    <div v-if="measurements.length > 0" class="measurements-panel">
      <h4 class="panel-title">測量結果</h4>
      <div class="measurements-grid">
        <div
          v-for="(m, index) in measurements"
          :key="index"
          class="measurement-item"
        >
          <span class="measurement-label">{{ m.label }}</span>
          <span class="measurement-value">{{ m.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frequency-analysis-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  background: #1e1e2e;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.config-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  padding: 12px;
  background: #252536;
  border-radius: 6px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #aaaacc;
}

.config-group input {
  width: 100px;
  padding: 6px 8px;
  background: #1a1a2e;
  border: 1px solid #444466;
  border-radius: 4px;
  color: #ffffff;
  font-size: 12px;
  font-family: monospace;
}

.config-group input:focus {
  outline: none;
  border-color: #6366f1;
}

.unit {
  color: #888899;
  font-size: 11px;
}

.run-btn {
  padding: 8px 16px;
  background: #6366f1;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.run-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  border-radius: 6px;
  color: #fca5a5;
  font-size: 13px;
}

.plots-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plot-section {
  background: #252536;
  border-radius: 8px;
  overflow: hidden;
}

.plot-title {
  margin: 0;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #ccccdd;
  border-bottom: 1px solid #333355;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666688;
  text-align: center;
}

.empty-state p {
  margin: 4px 0;
}

.empty-state .hint {
  font-size: 12px;
  color: #555577;
}

.measurements-panel {
  background: #252536;
  border-radius: 8px;
  padding: 12px;
}

.panel-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 500;
  color: #ccccdd;
}

.measurements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.measurement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #1a1a2e;
  border-radius: 4px;
}

.measurement-label {
  font-size: 12px;
  color: #888899;
}

.measurement-value {
  font-size: 13px;
  font-family: monospace;
  color: #66bb6a;
  font-weight: 500;
}
</style>
