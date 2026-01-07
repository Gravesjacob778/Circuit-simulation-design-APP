<script setup lang="ts">
/**
 * ImpedancePlot - 阻抗頻率響應圖元件
 *
 * 職責：
 * - 渲染各元件的阻抗 vs 頻率曲線
 * - 顯示阻抗大小 |Z| 和相位角
 * - 標記共振點
 * - 對數 X 軸（頻率）和可選對數 Y 軸（阻抗）
 */

import { ref, computed, watch, onMounted, type PropType } from 'vue';
import type { ImpedancePlotTrace, ResonanceMarker } from '@/types/frequencyAnalysis';
import { formatFrequency, formatImpedance, formatPhase } from '@/utils/frequencyFormat';

// ========== Props ==========

const props = defineProps({
  traces: {
    type: Array as PropType<ImpedancePlotTrace[]>,
    required: true,
  },
  markers: {
    type: Array as PropType<ResonanceMarker[]>,
    default: () => [],
  },
  height: {
    type: Number,
    default: 250,
  },
  logYScale: {
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

// ========== Refs ==========

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

// ========== 狀態 ==========

const frequencyRange = ref({ start: 1, end: 1e6 });
const impedanceRange = ref({ min: 1, max: 1e6 });
const phaseRange = ref({ min: -90, max: 90 });
const hoverFrequency = ref<number | null>(null);

// ========== 佈局常數 ==========

const MARGIN = { top: 20, right: 55, bottom: 40, left: 60 };

// ========== 計算屬性 ==========

const canvasWidth = ref(800);
const canvasHeight = computed(() => props.height);

const plotWidth = computed(() => canvasWidth.value - MARGIN.left - MARGIN.right);
const plotHeight = computed(() => canvasHeight.value - MARGIN.top - MARGIN.bottom);

const visibleTraces = computed(() => props.traces.filter(t => t.visible));

// ========== 初始化範圍 ==========

function updateRanges() {
  if (props.traces.length === 0) return;

  let minFreq = Infinity, maxFreq = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let minPh = Infinity, maxPh = -Infinity;

  for (const trace of props.traces) {
    for (const point of trace.magnitudeData) {
      if (point.frequency < minFreq) minFreq = point.frequency;
      if (point.frequency > maxFreq) maxFreq = point.frequency;
      if (point.value < minZ) minZ = point.value;
      if (point.value > maxZ) maxZ = point.value;
    }
    for (const point of trace.phaseData) {
      if (point.value < minPh) minPh = point.value;
      if (point.value > maxPh) maxPh = point.value;
    }
  }

  if (minFreq !== Infinity) {
    frequencyRange.value = { start: minFreq, end: maxFreq };
  }
  if (minZ !== Infinity) {
    // 對數刻度需要額外邊距
    const logMin = Math.log10(minZ);
    const logMax = Math.log10(maxZ);
    const margin = (logMax - logMin) * 0.1 || 1;
    impedanceRange.value = {
      min: Math.pow(10, logMin - margin),
      max: Math.pow(10, logMax + margin),
    };
  }
  if (minPh !== Infinity) {
    const margin = (maxPh - minPh) * 0.1 || 10;
    phaseRange.value = { min: minPh - margin, max: maxPh + margin };
  }
}

// ========== 座標轉換 ==========

function freqToX(freq: number): number {
  const logMin = Math.log10(frequencyRange.value.start);
  const logMax = Math.log10(frequencyRange.value.end);
  const logFreq = Math.log10(freq);
  return MARGIN.left + ((logFreq - logMin) / (logMax - logMin)) * plotWidth.value;
}

function xToFreq(x: number): number {
  const logMin = Math.log10(frequencyRange.value.start);
  const logMax = Math.log10(frequencyRange.value.end);
  const ratio = (x - MARGIN.left) / plotWidth.value;
  return Math.pow(10, logMin + ratio * (logMax - logMin));
}

function impedanceToY(z: number): number {
  const { min, max } = impedanceRange.value;
  if (props.logYScale) {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logZ = Math.log10(Math.max(z, 1e-12));
    return MARGIN.top + (1 - (logZ - logMin) / (logMax - logMin)) * plotHeight.value;
  } else {
    return MARGIN.top + (1 - (z - min) / (max - min)) * plotHeight.value;
  }
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
    drawTrace(ctx, trace.magnitudeData, trace.color, 'impedance');
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

  // 頻率網格線
  const logMin = Math.floor(Math.log10(frequencyRange.value.start));
  const logMax = Math.ceil(Math.log10(frequencyRange.value.end));

  for (let exp = logMin; exp <= logMax; exp++) {
    const freq = Math.pow(10, exp);
    if (freq >= frequencyRange.value.start && freq <= frequencyRange.value.end) {
      const x = freqToX(freq);
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.top);
      ctx.lineTo(x, MARGIN.top + plotHeight.value);
      ctx.stroke();
    }
  }

  // 阻抗網格線（對數刻度）
  if (props.logYScale) {
    const zLogMin = Math.floor(Math.log10(impedanceRange.value.min));
    const zLogMax = Math.ceil(Math.log10(impedanceRange.value.max));

    for (let exp = zLogMin; exp <= zLogMax; exp++) {
      const z = Math.pow(10, exp);
      const y = impedanceToY(z);
      if (y >= MARGIN.top && y <= MARGIN.top + plotHeight.value) {
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, y);
        ctx.lineTo(MARGIN.left + plotWidth.value, y);
        ctx.stroke();
      }
    }
  }
}

function drawAxes(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#aaaacc';
  ctx.font = '11px monospace';

  // 頻率軸標籤
  const logMin = Math.floor(Math.log10(frequencyRange.value.start));
  const logMax = Math.ceil(Math.log10(frequencyRange.value.end));

  for (let exp = logMin; exp <= logMax; exp++) {
    const freq = Math.pow(10, exp);
    if (freq >= frequencyRange.value.start && freq <= frequencyRange.value.end) {
      const x = freqToX(freq);
      ctx.textAlign = 'center';
      ctx.fillText(formatFrequencyShort(freq), x, canvasHeight.value - 10);
    }
  }

  // 阻抗軸標籤（左側）
  ctx.fillStyle = '#ff7043';
  if (props.logYScale) {
    const zLogMin = Math.floor(Math.log10(impedanceRange.value.min));
    const zLogMax = Math.ceil(Math.log10(impedanceRange.value.max));

    for (let exp = zLogMin; exp <= zLogMax; exp++) {
      const z = Math.pow(10, exp);
      const y = impedanceToY(z);
      if (y >= MARGIN.top && y <= MARGIN.top + plotHeight.value) {
        ctx.textAlign = 'right';
        ctx.fillText(formatImpedanceShort(z), MARGIN.left - 5, y + 4);
      }
    }
  }

  // 相位軸標籤（右側）
  if (props.showPhase) {
    ctx.fillStyle = '#42a5f5';
    for (let deg = -90; deg <= 90; deg += 45) {
      if (deg >= phaseRange.value.min && deg <= phaseRange.value.max) {
        const y = phaseToY(deg);
        ctx.textAlign = 'left';
        ctx.fillText(`${deg}°`, MARGIN.left + plotWidth.value + 5, y + 4);
      }
    }
  }

  // 軸標題
  ctx.save();
  ctx.fillStyle = '#ff7043';
  ctx.translate(15, canvasHeight.value / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('|Z| (Ω)', 0, 0);
  ctx.restore();

  if (props.showPhase) {
    ctx.save();
    ctx.fillStyle = '#42a5f5';
    ctx.translate(canvasWidth.value - 10, canvasHeight.value / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Phase (°)', 0, 0);
    ctx.restore();
  }

  ctx.fillStyle = '#aaaacc';
  ctx.textAlign = 'center';
  ctx.fillText('Frequency', canvasWidth.value / 2, canvasHeight.value - 5);
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  data: { frequency: number; value: number }[],
  color: string,
  type: 'impedance' | 'phase',
  dashed: boolean = false
) {
  if (data.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = type === 'impedance' ? 2 : 1.5;

  if (dashed) {
    ctx.setLineDash([5, 3]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();

  let started = false;
  for (const point of data) {
    const x = freqToX(point.frequency);
    const y = type === 'impedance' ? impedanceToY(point.value) : phaseToY(point.value);

    if (x >= MARGIN.left && x <= MARGIN.left + plotWidth.value &&
        y >= MARGIN.top && y <= MARGIN.top + plotHeight.value) {
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
  for (const marker of props.markers) {
    const x = freqToX(marker.frequency);

    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, MARGIN.top + plotHeight.value);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, x, MARGIN.top - 5);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D) {
  if (hoverFrequency.value === null) return;

  const x = freqToX(hoverFrequency.value);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(x, MARGIN.top);
  ctx.lineTo(x, MARGIN.top + plotHeight.value);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(formatFrequency(hoverFrequency.value), x, MARGIN.top + plotHeight.value + 25);
}

// ========== 事件處理 ==========

function handleMouseMove(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const freq = xToFreq(x);

  if (freq >= frequencyRange.value.start && freq <= frequencyRange.value.end) {
    hoverFrequency.value = freq;
  } else {
    hoverFrequency.value = null;
  }

  draw();
}

function handleMouseLeave() {
  hoverFrequency.value = null;
  draw();
}

function handleDoubleClick() {
  updateRanges();
  draw();
}

// ========== 輔助函數 ==========

function formatFrequencyShort(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(0)}M`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(0)}k`;
  return `${hz.toFixed(0)}`;
}

function formatImpedanceShort(ohms: number): string {
  if (ohms >= 1e6) return `${(ohms / 1e6).toFixed(0)}M`;
  if (ohms >= 1e3) return `${(ohms / 1e3).toFixed(0)}k`;
  return `${ohms.toFixed(0)}`;
}

// ========== 生命週期 ==========

watch(() => props.traces, () => {
  updateRanges();
  draw();
}, { deep: true, immediate: true });

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

  updateRanges();
  draw();
});
</script>

<template>
  <div ref="containerRef" class="impedance-plot-container">
    <canvas
      ref="canvasRef"
      :style="{ width: '100%', height: `${height}px` }"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.impedance-plot-container {
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
</style>
