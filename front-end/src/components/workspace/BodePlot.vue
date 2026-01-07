<script setup lang="ts">
/**
 * BodePlot - Bode 圖視覺化元件
 *
 * 職責：
 * - 渲染頻率響應曲線（增益 dB + 相位度數）
 * - 雙 Y 軸：左側增益(dB)，右側相位(°)
 * - 對數 X 軸（頻率）
 * - 支援縮放、平移、游標
 */

import { ref, computed, watch, onMounted, onUnmounted, type PropType } from 'vue';
import type { BodePlotTrace, ResonanceMarker } from '@/types/frequencyAnalysis';
import { useBodePlot } from '@/composables/useBodePlot';
import { formatFrequency, formatDecibels, formatPhase } from '@/utils/frequencyFormat';

// ========== Props ==========

const props = defineProps({
  traces: {
    type: Array as PropType<BodePlotTrace[]>,
    required: true,
  },
  markers: {
    type: Array as PropType<ResonanceMarker[]>,
    default: () => [],
  },
  height: {
    type: Number,
    default: 300,
  },
  showMagnitude: {
    type: Boolean,
    default: true,
  },
  showPhase: {
    type: Boolean,
    default: true,
  },
  showGrid: {
    type: Boolean,
    default: true,
  },
  showLegend: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits<{
  (e: 'cursor-moved', payload: { frequency: number; magnitudeDB: number; phaseDegrees: number }): void;
}>();

// ========== Refs ==========

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const tracesRef = ref(props.traces);

// ========== Composable ==========

const {
  frequencyAxis,
  magnitudeRange,
  phaseRange,
  hoverFrequency,
  hoverValues,
  autoMarkers,
  visibleTraces,
  zoomFrequency,
  panFrequency,
  resetZoom,
  setHoverFrequency,
} = useBodePlot(tracesRef);

// ========== 佈局常數 ==========

const MARGIN = { top: 20, right: 60, bottom: 40, left: 60 };

// ========== 計算屬性 ==========

const canvasWidth = ref(800);
const canvasHeight = computed(() => props.height);

const plotWidth = computed(() => canvasWidth.value - MARGIN.left - MARGIN.right);
const plotHeight = computed(() => canvasHeight.value - MARGIN.top - MARGIN.bottom);

// ========== 座標轉換 ==========

function freqToX(freq: number): number {
  const logMin = Math.log10(frequencyAxis.value.start);
  const logMax = Math.log10(frequencyAxis.value.end);
  const logFreq = Math.log10(freq);
  return MARGIN.left + ((logFreq - logMin) / (logMax - logMin)) * plotWidth.value;
}

function xToFreq(x: number): number {
  const logMin = Math.log10(frequencyAxis.value.start);
  const logMax = Math.log10(frequencyAxis.value.end);
  const ratio = (x - MARGIN.left) / plotWidth.value;
  return Math.pow(10, logMin + ratio * (logMax - logMin));
}

function magToY(db: number): number {
  const { min, max } = magnitudeRange.value;
  return MARGIN.top + (1 - (db - min) / (max - min)) * plotHeight.value;
}

function phaseToY(deg: number): number {
  const { min, max } = phaseRange.value;
  return MARGIN.top + (1 - (deg - min) / (max - min)) * plotHeight.value;
}

// ========== 繪圖 ==========

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasWidth.value * dpr;
  canvas.height = canvasHeight.value * dpr;
  ctx.scale(dpr, dpr);

  // 清除畫布
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);

  // 繪製網格
  if (props.showGrid) {
    drawGrid(ctx);
  }

  // 繪製軸線
  drawAxes(ctx);

  // 繪製曲線
  for (const trace of visibleTraces.value) {
    if (props.showMagnitude) {
      drawTrace(ctx, trace.magnitudeData, trace.color, 'magnitude');
    }
    if (props.showPhase) {
      drawTrace(ctx, trace.phaseData, trace.color, 'phase', true);
    }
  }

  // 繪製標記
  drawMarkers(ctx);

  // 繪製游標
  if (hoverFrequency.value !== null) {
    drawCursor(ctx);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#333355';
  ctx.lineWidth = 0.5;

  // 頻率網格線（每十倍頻）
  const logMin = Math.floor(Math.log10(frequencyAxis.value.start));
  const logMax = Math.ceil(Math.log10(frequencyAxis.value.end));

  for (let exp = logMin; exp <= logMax; exp++) {
    const freq = Math.pow(10, exp);
    if (freq >= frequencyAxis.value.start && freq <= frequencyAxis.value.end) {
      const x = freqToX(freq);
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.top);
      ctx.lineTo(x, MARGIN.top + plotHeight.value);
      ctx.stroke();
    }
  }

  // 增益網格線（每 20 dB）
  const { min: magMin, max: magMax } = magnitudeRange.value;
  for (let db = Math.ceil(magMin / 20) * 20; db <= magMax; db += 20) {
    const y = magToY(db);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + plotWidth.value, y);
    ctx.stroke();
  }
}

function drawAxes(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#aaaacc';
  ctx.font = '11px monospace';

  // 頻率軸標籤
  const logMin = Math.floor(Math.log10(frequencyAxis.value.start));
  const logMax = Math.ceil(Math.log10(frequencyAxis.value.end));

  for (let exp = logMin; exp <= logMax; exp++) {
    const freq = Math.pow(10, exp);
    if (freq >= frequencyAxis.value.start && freq <= frequencyAxis.value.end) {
      const x = freqToX(freq);
      ctx.textAlign = 'center';
      ctx.fillText(formatFrequencyShort(freq), x, canvasHeight.value - 10);
    }
  }

  // 增益軸標籤（左側）
  ctx.fillStyle = '#66bb6a';
  const { min: magMin, max: magMax } = magnitudeRange.value;
  for (let db = Math.ceil(magMin / 20) * 20; db <= magMax; db += 20) {
    const y = magToY(db);
    ctx.textAlign = 'right';
    ctx.fillText(`${db}dB`, MARGIN.left - 5, y + 4);
  }

  // 相位軸標籤（右側）
  ctx.fillStyle = '#42a5f5';
  const { min: phMin, max: phMax } = phaseRange.value;
  for (let deg = Math.ceil(phMin / 45) * 45; deg <= phMax; deg += 45) {
    const y = phaseToY(deg);
    ctx.textAlign = 'left';
    ctx.fillText(`${deg}°`, MARGIN.left + plotWidth.value + 5, y + 4);
  }

  // 軸標題
  ctx.save();
  ctx.fillStyle = '#66bb6a';
  ctx.translate(15, canvasHeight.value / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Magnitude (dB)', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#42a5f5';
  ctx.translate(canvasWidth.value - 10, canvasHeight.value / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Phase (°)', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#aaaacc';
  ctx.textAlign = 'center';
  ctx.fillText('Frequency', canvasWidth.value / 2, canvasHeight.value - 5);
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  data: { frequency: number; value: number }[],
  color: string,
  type: 'magnitude' | 'phase',
  dashed: boolean = false
) {
  if (data.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = type === 'magnitude' ? 2 : 1.5;

  if (dashed) {
    ctx.setLineDash([5, 3]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();

  let started = false;
  for (const point of data) {
    const x = freqToX(point.frequency);
    const y = type === 'magnitude' ? magToY(point.value) : phaseToY(point.value);

    // 只繪製在可見範圍內的點
    if (x >= MARGIN.left && x <= MARGIN.left + plotWidth.value) {
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }

  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMarkers(ctx: CanvasRenderingContext2D) {
  const allMarkers = [...props.markers, ...autoMarkers.value];

  for (const marker of allMarkers) {
    const x = freqToX(marker.frequency);

    // 垂直線
    ctx.strokeStyle = marker.type === 'resonance' ? '#ff9800' : '#e91e63';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, MARGIN.top + plotHeight.value);
    ctx.stroke();
    ctx.setLineDash([]);

    // 標籤
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, x, MARGIN.top - 5);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D) {
  if (hoverFrequency.value === null) return;

  const x = freqToX(hoverFrequency.value);

  // 垂直游標線
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(x, MARGIN.top);
  ctx.lineTo(x, MARGIN.top + plotHeight.value);
  ctx.stroke();
  ctx.setLineDash([]);

  // 頻率讀數
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(formatFrequency(hoverFrequency.value), x, MARGIN.top + plotHeight.value + 25);

  // 數值讀數
  let yOffset = MARGIN.top + 15;
  for (const [traceId, values] of hoverValues.value) {
    const trace = visibleTraces.value.find(t => t.traceId === traceId);
    if (!trace) continue;

    ctx.fillStyle = trace.color;
    ctx.textAlign = 'left';
    ctx.fillText(
      `${trace.label}: ${formatDecibels(values.magnitude)} / ${formatPhase(values.phase)}`,
      x + 10,
      yOffset
    );
    yOffset += 15;
  }
}

// ========== 事件處理 ==========

function handleMouseMove(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const freq = xToFreq(x);

  if (freq >= frequencyAxis.value.start && freq <= frequencyAxis.value.end) {
    setHoverFrequency(freq);
  } else {
    setHoverFrequency(null);
  }

  draw();
}

function handleMouseLeave() {
  setHoverFrequency(null);
  draw();
}

function handleWheel(e: WheelEvent) {
  e.preventDefault();

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const centerFreq = xToFreq(x);

  const factor = e.deltaY > 0 ? 0.8 : 1.25;
  zoomFrequency(factor, centerFreq);

  draw();
}

function handleDoubleClick() {
  resetZoom();
  draw();
}

// ========== 輔助函數 ==========

function formatFrequencyShort(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(0)}M`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(0)}k`;
  return `${hz.toFixed(0)}`;
}

// ========== 生命週期 ==========

watch(() => props.traces, (newTraces) => {
  tracesRef.value = newTraces;
  draw();
}, { deep: true });

watch([() => props.showMagnitude, () => props.showPhase], () => {
  draw();
});

onMounted(() => {
  if (containerRef.value) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvasWidth.value = entry.contentRect.width;
        draw();
      }
    });
    resizeObserver.observe(containerRef.value);
  }

  draw();
});
</script>

<template>
  <div ref="containerRef" class="bode-plot-container">
    <canvas
      ref="canvasRef"
      :style="{ width: '100%', height: `${height}px` }"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @wheel="handleWheel"
      @dblclick="handleDoubleClick"
    />

    <!-- 圖例 -->
    <div v-if="showLegend && traces.length > 0" class="legend">
      <div
        v-for="trace in traces"
        :key="trace.traceId"
        class="legend-item"
        :class="{ dimmed: !trace.visible }"
      >
        <span class="legend-color" :style="{ backgroundColor: trace.color }" />
        <span class="legend-label">{{ trace.label }}</span>
        <span class="legend-type">
          <span v-if="showMagnitude" class="type-mag">━</span>
          <span v-if="showPhase" class="type-phase">┈</span>
        </span>
      </div>
    </div>

    <!-- 控制列 -->
    <div class="controls">
      <button class="control-btn" @click="resetZoom" title="重設縮放">
        ⟲
      </button>
    </div>
  </div>
</template>

<style scoped>
.bode-plot-container {
  position: relative;
  width: 100%;
  background-color: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
}

canvas {
  display: block;
  cursor: crosshair;
}

.legend {
  position: absolute;
  top: 8px;
  left: 70px;
  display: flex;
  gap: 16px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #cccccc;
  cursor: pointer;
  transition: opacity 0.2s;
}

.legend-item.dimmed {
  opacity: 0.4;
}

.legend-color {
  width: 12px;
  height: 3px;
  border-radius: 1px;
}

.legend-label {
  font-family: monospace;
}

.legend-type {
  font-size: 10px;
  color: #888888;
}

.type-mag {
  color: #66bb6a;
}

.type-phase {
  color: #42a5f5;
}

.controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid #444444;
  border-radius: 4px;
  color: #cccccc;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
