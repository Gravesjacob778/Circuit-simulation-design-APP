<script setup lang="ts">
/**
 * WaveformViewer - 專業波形檢視器元件
 * 
 * 職責：
 * - 純展示元件，只消費 WaveformTrace[]
 * - 渲染時域波形 (X 軸 = 時間)
 * - 依單位分組 Y 軸（電壓與電流不共用 Y 軸）
 * - 支援縮放、平移、游標
 * - 視覺隱喻：數位示波器
 * 
 * 明確禁止：
 * - 不進行跨單位的正規化或自動縮放
 * - 不推斷或計算新的波形
 * - 不渲染語意狀態（如 LED 發光）
 */

import { ref, computed, watch, onMounted, onUnmounted, type PropType } from 'vue';
import type { WaveformTrace, WaveformUnit, YAxisConfig } from '@/types/waveform';
import { useWaveformViewer } from '@/composables/useWaveformViewer';
import { formatValue, formatTime, UNIT_CONFIGS, calculateStats } from '@/types/waveform';

// ========== Props & Emits ==========

const props = defineProps({
  /**
   * 波形描線資料
   */
  traces: {
    type: Array as PropType<WaveformTrace[]>,
    required: true,
  },
  /**
   * 高度 (px)
   */
  height: {
    type: Number,
    default: 300,
  },
  /**
   * 是否顯示圖例
   */
  showLegend: {
    type: Boolean,
    default: true,
  },
  /**
   * 是否顯示網格
   */
  showGrid: {
    type: Boolean,
    default: true,
  },
  /**
   * 是否顯示游標
   */
  showCursor: {
    type: Boolean,
    default: true,
  },
  /**
   * 串流模式：資料會持續追加，時間軸以固定視窗尾隨最新時間
   */
  streaming: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (e: 'trace-visibility-changed', payload: { traceId: string; visible: boolean }): void;
  (e: 'cursor-moved', payload: { cursorId: string; time: number }): void;
  (e: 'viewport-changed', payload: { start: number; end: number }): void;
}>();

// ========== Refs ==========

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const tracesRef = ref(props.traces);

// ========== 動畫狀態 ==========

/** 動畫進度 (0-1) */
const animationProgress = ref(1);
/** 動畫 ID */
let animationFrameId: number | null = null;
/** 是否正在動畫中 */
const isAnimating = ref(false);
/** 動畫持續時間 (ms) 
 * This param can revise , 
 * 500 
 * 1000 
 * 1200 
*/
const ANIMATION_DURATION = 800;
/** 上一次的 trace 數據指紋，用於檢測變化 */
let lastTraceFingerprint = '';

/**
 * 計算 trace 數據指紋
 */
function getTraceFingerprint(traces: typeof props.traces): string {
  return traces.map(t => `${t.traceId}:${t.data.length}:${t.data[0]?.value ?? 0}`).join('|');
}

/**
 * 開始波形掃描動畫
 */
function startAnimation() {
  // 取消現有動畫
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  
  animationProgress.value = 0;
  isAnimating.value = true;
  const startTime = performance.now();
  
  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
    
    // 使用 easeOutQuart 緩動函數，讓動畫更自然
    animationProgress.value = 1 - Math.pow(1 - progress, 4);
    
    draw();
    
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationProgress.value = 1;
      isAnimating.value = false;
      animationFrameId = null;
    }
  }
  
  animationFrameId = requestAnimationFrame(animate);
}

// 保持 traces ref 與 props 同步，並在數據變化時觸發動畫
watch(() => props.traces, (newTraces) => {
  const newFingerprint = getTraceFingerprint(newTraces);

  // 串流模式：避免每次 append 都觸發 800ms 掃描動畫
  if (props.streaming) {
    lastTraceFingerprint = newFingerprint;
    tracesRef.value = newTraces;
    animationProgress.value = 1;
    isAnimating.value = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }

  // 非串流：資料真正變化時才觸發掃描動畫
  if (newFingerprint !== lastTraceFingerprint && newTraces.length > 0) {
    lastTraceFingerprint = newFingerprint;
    tracesRef.value = newTraces;
    startAnimation();
  } else {
    tracesRef.value = newTraces;
  }
}, { deep: true, immediate: true });

// ========== Composable ==========

const {
  timeAxis,
  autoScale,
  hoverTime,
  visibleTraces,
  yAxes,
  hoverValues,
  zoomTime,
  resetZoom,
  setHoverTime,
} = useWaveformViewer(tracesRef);

// ========== Streaming viewport behavior ==========

const STREAM_WINDOW_SEC = 10;
const followLatest = ref(true);

function getLatestTimeSec(traces: WaveformTrace[]): number | null {
  let latest = -Infinity;
  for (const t of traces) {
    const last = t.data[t.data.length - 1];
    if (!last) continue;
    if (last.time > latest) latest = last.time;
  }
  return latest === -Infinity ? null : latest;
}

function applyStreamingTimeWindow() {
  const latest = getLatestTimeSec(visibleTraces.value);
  if (latest === null) return;

  const end = latest;
  const start = Math.max(0, end - STREAM_WINDOW_SEC);
  const divisions = timeAxis.value.divisions;

  // 避免在 watch(timeAxis, ...) 中每次都指派新物件造成遞迴更新
  if (timeAxis.value.start === start && timeAxis.value.end === end) {
    return;
  }

  timeAxis.value = {
    ...timeAxis.value,
    start,
    end,
    timePerDivision: (end - start) / divisions,
  };

}

watch(
  () => props.streaming,
  (streaming) => {
    if (streaming) {
      // 串流時由 viewer 控制時間視窗；避免 composable auto fit 一直擴張
      autoScale.value = false;
      followLatest.value = true;
      applyStreamingTimeWindow();
    }
  },
  { immediate: true }
);

// ========== 尺寸計算 ==========

const PADDING = { top: 30, right: 80, bottom: 40, left: 80 };
const AXIS_WIDTH = 60;

const canvasWidth = ref(800);
const canvasHeight = computed(() => props.height);

const plotArea = computed(() => ({
  x: PADDING.left + (yAxes.value.length > 1 ? (yAxes.value.length - 1) * AXIS_WIDTH : 0),
  y: PADDING.top,
  width: canvasWidth.value - PADDING.left - PADDING.right - (yAxes.value.length > 1 ? (yAxes.value.length - 1) * AXIS_WIDTH : 0),
  height: canvasHeight.value - PADDING.top - PADDING.bottom,
}));

// ========== 座標轉換 ==========

function timeToX(time: number): number {
  const { start, end } = timeAxis.value;
  const ratio = (time - start) / (end - start);
  return plotArea.value.x + ratio * plotArea.value.width;
}

function xToTime(x: number): number {
  const { start, end } = timeAxis.value;
  const ratio = (x - plotArea.value.x) / plotArea.value.width;
  return start + ratio * (end - start);
}

function valueToY(value: number, axis: YAxisConfig): number {
  const ratio = (value - axis.min) / (axis.max - axis.min);
  return plotArea.value.y + plotArea.value.height * (1 - ratio);
}

function lowerBoundByTime(data: { time: number }[], time: number): number {
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((data[mid]?.time ?? -Infinity) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBoundByTime(data: { time: number }[], time: number): number {
  let lo = 0;
  let hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((data[mid]?.time ?? Infinity) <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ========== 繪製函式 ==========

function draw() {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasWidth.value * dpr;
  canvas.height = canvasHeight.value * dpr;
  ctx.scale(dpr, dpr);

  // 清除畫布
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);

  // 繪製網格
  if (props.showGrid) {
    drawGrid(ctx);
  }

  // 繪製 Y 軸
  drawYAxes(ctx);

  // 繪製波形
  drawTraces(ctx);

  // 繪製游標
  if (props.showCursor && hoverTime.value !== null) {
    drawCursor(ctx);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  const { x, y, width, height } = plotArea.value;
  const { divisions } = timeAxis.value;

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;

  // 垂直線（時間分隔）
  for (let i = 0; i <= divisions; i++) {
    const xPos = x + (width / divisions) * i;
    ctx.beginPath();
    ctx.moveTo(xPos, y);
    ctx.lineTo(xPos, y + height);
    ctx.stroke();
  }

  // 水平線（數值分隔）
  const hDivisions = 8;
  for (let i = 0; i <= hDivisions; i++) {
    const yPos = y + (height / hDivisions) * i;
    ctx.beginPath();
    ctx.moveTo(x, yPos);
    ctx.lineTo(x + width, yPos);
    ctx.stroke();
  }

  // 中心十字線加粗
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1.5;
  
  // 垂直中線
  const centerX = x + width / 2;
  ctx.beginPath();
  ctx.moveTo(centerX, y);
  ctx.lineTo(centerX, y + height);
  ctx.stroke();
  
  // 水平中線
  const centerY = y + height / 2;
  ctx.beginPath();
  ctx.moveTo(x, centerY);
  ctx.lineTo(x + width, centerY);
  ctx.stroke();
}

function drawYAxes(ctx: CanvasRenderingContext2D) {
  const { y, height } = plotArea.value;

  yAxes.value.forEach((axis, index) => {
    const isLeft = axis.position === 'left';

    // 軸標題
    ctx.save();
    ctx.translate(
      isLeft ? 20 : canvasWidth.value - 20 - (yAxes.value.length - 1 - index) * AXIS_WIDTH,
      y + height / 2
    );
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = getAxisColor(axis.unit);
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = isLeft ? 'bottom' : 'top';
    ctx.fillText(UNIT_CONFIGS[axis.unit].axisLabel, 0, 0);
    ctx.restore();

    // 刻度 - 根據單位使用不同字體大小
    const numTicks = 5;
    const fontSize = axis.unit === 'A' ? 14 : 13; // 電流使用 14px，其他使用 13px
    ctx.font = `${fontSize}px JetBrains Mono, monospace`;
    ctx.fillStyle = getAxisColor(axis.unit);
    ctx.textAlign = isLeft ? 'right' : 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= numTicks; i++) {
      const ratio = i / numTicks;
      const value = axis.max - ratio * (axis.max - axis.min);
      const yPos = y + height * ratio;

      // 刻度線
      ctx.strokeStyle = getAxisColor(axis.unit);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (isLeft) {
        ctx.moveTo(plotArea.value.x - 5, yPos);
        ctx.lineTo(plotArea.value.x, yPos);
      } else {
        ctx.moveTo(plotArea.value.x + plotArea.value.width, yPos);
        ctx.lineTo(plotArea.value.x + plotArea.value.width + 5, yPos);
      }
      ctx.stroke();

      // 刻度值
      const label = formatAxisValue(value, axis.unit);
      const labelX = isLeft 
        ? plotArea.value.x - 10 
        : plotArea.value.x + plotArea.value.width + 10;
      ctx.fillText(label, labelX, yPos);
    }
  });
}

function drawTraces(ctx: CanvasRenderingContext2D) {
  const { x, width } = plotArea.value;
  const progress = animationProgress.value;

  for (const trace of visibleTraces.value) {
    if (trace.data.length === 0) continue;

    // 找到對應的 Y 軸
    const axis = yAxes.value.find(a => a.traceIds.includes(trace.traceId));
    if (!axis) continue;

    // 設定裁剪區域
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, plotArea.value.y, width, plotArea.value.height);
    ctx.clip();

    // 計算當前動畫應該繪製到的點數
    const totalPoints = trace.data.length;
    const revealedPoints = Math.ceil(totalPoints * progress);

    // 找出在目前時間軸可視範圍內的索引區間
    const startTime = timeAxis.value.start;
    const endTime = timeAxis.value.end;

    const startIndex = lowerBoundByTime(trace.data, startTime);
    const endIndexByTime = upperBoundByTime(trace.data, endTime);
    const endIndex = Math.min(endIndexByTime, revealedPoints);

    if (endIndex <= startIndex) {
      ctx.restore();
      continue;
    }

    // 繪製磷光效果（淡化的尾跡）- 只在動畫中顯示
    if (isAnimating.value && progress < 1) {
      ctx.strokeStyle = trace.color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.filter = 'blur(3px)';

      ctx.beginPath();
      let started = false;

      for (let i = startIndex; i < endIndex; i++) {
        const point = trace.data[i];
        if (!point) continue;
        
        const px = timeToX(point.time);
        const py = valueToY(point.value, axis);

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.stroke();
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }

    // 繪製主波形線
    ctx.strokeStyle = trace.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    let started = false;

    for (let i = startIndex; i < endIndex; i++) {
      const point = trace.data[i];
      if (!point) continue;
      
      const px = timeToX(point.time);
      const py = valueToY(point.value, axis);

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();

    // 繪製掃描線尖端發光效果
    if (isAnimating.value && progress < 1 && endIndex > startIndex) {
      const lastPoint = trace.data[endIndex - 1];
      if (lastPoint) {
        const px = timeToX(lastPoint.time);
        const py = valueToY(lastPoint.value, axis);

        // 發光效果
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 15);
        gradient.addColorStop(0, trace.color);
        gradient.addColorStop(0.5, trace.color + '80');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.fill();

        // 核心亮點
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 繪製資料點（當資料點數量較少且動畫完成時）
    if (!isAnimating.value && trace.data.length <= 50) {
      ctx.fillStyle = trace.color;
      for (const point of trace.data) {
        const px = timeToX(point.time);
        const py = valueToY(point.value, axis);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function drawCursor(ctx: CanvasRenderingContext2D) {
  if (hoverTime.value === null) return;

  const x = timeToX(hoverTime.value);
  const { y, height } = plotArea.value;

  // 垂直線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.stroke();
  ctx.setLineDash([]);

  // 繪製各 trace 在游標位置的點和數值
  hoverValues.value.forEach((value, traceId) => {
    const trace = visibleTraces.value.find(t => t.traceId === traceId);
    if (!trace) return;

    const axis = yAxes.value.find(a => a.traceIds.includes(traceId));
    if (!axis) return;

    const py = valueToY(value, axis);

    // 交點圓
    ctx.fillStyle = trace.color;
    ctx.beginPath();
    ctx.arc(x, py, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ========== 輔助函式 ==========

function getAxisColor(unit: WaveformUnit): string {
  switch (unit) {
    case 'V': return '#ffd740';
    case 'A': return '#4caf50';
    case 'W': return '#ab47bc';
    default: return '#888';
  }
}

function formatAxisValue(value: number, _unit: WaveformUnit): string {
  // _unit 保留供未來格式化擴展使用
  const absValue = Math.abs(value);
  
  if (absValue === 0) return '0';
  if (absValue >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (absValue >= 1) return value.toFixed(1);
  if (absValue >= 0.001) return `${(value * 1000).toFixed(1)}m`;
  if (absValue >= 0.000001) return `${(value * 1000000).toFixed(1)}μ`;
  return value.toExponential(1);
}

function formatTimeLabel(time: number): string {
  const absTime = Math.abs(time);
  
  if (absTime === 0) return '0';
  if (absTime >= 1) return `${time.toFixed(2)}s`;
  if (absTime >= 0.001) return `${(time * 1000).toFixed(1)}ms`;
  if (absTime >= 0.000001) return `${(time * 1000000).toFixed(1)}μs`;
  return `${(time * 1e9).toFixed(1)}ns`;
}

// ========== 事件處理 ==========

function handleMouseMove(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // 檢查是否在繪圖區域內
  if (
    x >= plotArea.value.x &&
    x <= plotArea.value.x + plotArea.value.width &&
    y >= plotArea.value.y &&
    y <= plotArea.value.y + plotArea.value.height
  ) {
    const time = xToTime(x);
    setHoverTime(time);
  } else {
    setHoverTime(null);
  }
}

function handleMouseLeave() {
  setHoverTime(null);
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = event.clientX - rect.left;
  const centerTime = xToTime(x);

  // 縮放因子
  const zoomFactor = event.deltaY > 0 ? 0.8 : 1.25;
  if (props.streaming) {
    followLatest.value = false;
  }
  zoomTime(zoomFactor, centerTime);
}

let isPanning = false;
let panStartX = 0;
let panStartTime = 0;

function handleMouseDown(event: MouseEvent) {
  if (event.button === 0) { // 左鍵
    isPanning = true;
    panStartX = event.clientX;
    panStartTime = timeAxis.value.start;
    
    if (props.streaming) {
      followLatest.value = false;
    }
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'grabbing';
    }
  }
}

function handleMouseUp() {
  isPanning = false;
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'crosshair';
  }
}

function handleGlobalMouseMove(event: MouseEvent) {
  if (!isPanning) return;

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const deltaX = event.clientX - panStartX;
  const timePerPixel = (timeAxis.value.end - timeAxis.value.start) / plotArea.value.width;
  const deltaTime = -deltaX * timePerPixel;

  const newStart = panStartTime + deltaTime;
  const duration = timeAxis.value.end - timeAxis.value.start;
  
  timeAxis.value = {
    ...timeAxis.value,
    start: newStart,
    end: newStart + duration,
  };
}

// ========== 生命週期 ==========

// 追蹤元件是否已掛載（避免卸載後仍執行繪圖操作）
let isMounted = false;

function handleResize() {
  if (!isMounted || !containerRef.value) return;
  canvasWidth.value = containerRef.value.clientWidth;
  draw();
}

onMounted(() => {
  isMounted = true;
  handleResize();
  window.addEventListener('resize', handleResize);
  window.addEventListener('mousemove', handleGlobalMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  
  // 初始繪製
  draw();
});

onUnmounted(() => {
  isMounted = false;
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('mousemove', handleGlobalMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  
  // 清除動畫
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // 清除排程中的繪圖
  drawScheduled = false;
});

// 使用 requestAnimationFrame 節流繪圖，避免多個響應式更新連鎖觸發導致 DOM 狀態不一致
let drawScheduled = false;
function scheduleDraw() {
  if (!isMounted) return;  // 元件已卸載，不執行
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    if (!isMounted) {  // 再次檢查，因為 rAF 是異步的
      drawScheduled = false;
      return;
    }
    drawScheduled = false;
    if (props.streaming && followLatest.value) {
      applyStreamingTimeWindow();
    }
    draw();
  });
}

// 監聽所有影響繪圖的響應式狀態，使用 flush: 'post' 確保 DOM 更新後再繪製
watch(
  () => [props.traces, props.streaming, hoverTime.value, timeAxis.value, yAxes.value] as const,
  () => {
    scheduleDraw();
  },
  { flush: 'post' }
);

// ========== 公開方法 ==========

defineExpose({
  resetZoom: () => {
    if (props.streaming) {
      followLatest.value = true;
      applyStreamingTimeWindow();
      return;
    }
    resetZoom();
  },
  zoomIn: () => {
    if (props.streaming) followLatest.value = false;
    zoomTime(1.5);
  },
  zoomOut: () => {
    if (props.streaming) followLatest.value = false;
    zoomTime(0.67);
  },
});
</script>

<template>
  <div 
    ref="containerRef" 
    class="waveform-viewer"
    :style="{ height: `${height}px` }"
  >
    <!-- 工具列 -->
    <div class="viewer-toolbar">
      <div class="toolbar-left">
        <span class="viewer-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          Waveform Viewer
        </span>
      </div>
      
      <div class="toolbar-center">
        <!-- 時間範圍顯示 -->
        <span class="time-display">
          {{ formatTimeLabel(timeAxis.start) }} - {{ formatTimeLabel(timeAxis.end) }}
        </span>
      </div>
      
      <div class="toolbar-right">
        <!-- 縮放控制 -->
        <button class="toolbar-btn" @click="zoomTime(1.5)" title="Zoom In">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="zoomTime(0.67)" title="Zoom Out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M8 11h6" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="resetZoom" title="Fit to Data">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 波形畫布區域 -->
    <div class="canvas-wrapper">
      <canvas
        ref="canvasRef"
        class="waveform-canvas"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @wheel="handleWheel"
        @mousedown="handleMouseDown"
      />
      
      <!-- Hover 資訊浮窗 -->
      <div 
        v-if="hoverTime !== null" 
        class="cursor-tooltip"
        :style="{
          left: `${timeToX(hoverTime)}px`,
          top: `${plotArea.y - 5}px`,
        }"
      >
        <div class="cursor-time">{{ formatTime(hoverTime) }}</div>
        <div 
          v-for="[traceId, value] of hoverValues" 
          :key="traceId"
          class="cursor-value"
          :style="{ color: visibleTraces.find(t => t.traceId === traceId)?.color }"
        >
          {{ visibleTraces.find(t => t.traceId === traceId)?.label }}:
          {{ formatValue(value, visibleTraces.find(t => t.traceId === traceId)?.unit || 'V') }}
        </div>
      </div>
    </div>

    <!-- 圖例 -->
    <div v-if="showLegend && visibleTraces.length > 0" class="legend">
      <div 
        v-for="trace in traces" 
        :key="trace.traceId"
        class="legend-item"
        :class="{ inactive: !trace.visible }"
        @click="$emit('trace-visibility-changed', { traceId: trace.traceId, visible: !trace.visible })"
      >
        <span 
          class="legend-color" 
          :style="{ backgroundColor: trace.color }"
        />
        <span class="legend-label">{{ trace.label }}</span>
        <span class="legend-unit">({{ trace.unit }})</span>
      </div>
    </div>

    <!-- 統計資訊面板 -->
    <div v-if="visibleTraces.length > 0" class="stats-panel">
      <div 
        v-for="trace in visibleTraces" 
        :key="`stats-${trace.traceId}`"
        class="stats-row"
        :style="{ borderLeftColor: trace.color }"
      >
        <span class="stats-label">{{ trace.label }}</span>
        <span class="stats-values">
          <span class="stat">
            <span class="stat-name">Max</span>
            <span class="stat-value">{{ formatValue(calculateStats(trace.data).max, trace.unit) }}</span>
          </span>
          <span class="stat">
            <span class="stat-name">Min</span>
            <span class="stat-value">{{ formatValue(calculateStats(trace.data).min, trace.unit) }}</span>
          </span>
          <span class="stat">
            <span class="stat-name">Pk-Pk</span>
            <span class="stat-value">{{ formatValue(calculateStats(trace.data).peakToPeak, trace.unit) }}</span>
          </span>
          <span class="stat">
            <span class="stat-name">RMS</span>
            <span class="stat-value">{{ formatValue(calculateStats(trace.data).rms, trace.unit) }}</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.waveform-viewer {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0c0c0c 0%, #0a0a0a 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
  font-family: var(--font-family-base);
}

/* 工具列 */
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-md);
  background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%);
  border-bottom: 1px solid var(--color-border);
  min-height: 36px;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.viewer-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.viewer-title .icon {
  width: 16px;
  height: 16px;
  color: var(--color-accent-green);
}

.time-display {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-accent-green);
}

.toolbar-btn svg {
  width: 16px;
  height: 16px;
}

/* 畫布區域 */
.canvas-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

/* 游標浮窗 */
.cursor-tooltip {
  position: absolute;
  transform: translateX(-50%) translateY(-100%);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-xs) var(--spacing-sm);
  pointer-events: none;
  z-index: 10;
  min-width: 120px;
  box-shadow: var(--shadow-lg);
}

.cursor-time {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

.cursor-value {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  padding: 2px 0;
}

/* 圖例 */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 2px 8px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.legend-item:hover {
  background: var(--color-bg-hover);
}

.legend-item.inactive {
  opacity: 0.4;
}

.legend-color {
  width: 12px;
  height: 3px;
  border-radius: 2px;
}

.legend-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
}

.legend-unit {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* 統計面板 */
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-xs) var(--spacing-md);
  background: #0d0d0d;
  border-top: 1px solid var(--color-border);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 4px 8px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  border-left: 3px solid;
}

.stats-label {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  min-width: 80px;
}

.stats-values {
  display: flex;
  gap: var(--spacing-lg);
  flex: 1;
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.stat-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.stat-value {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
