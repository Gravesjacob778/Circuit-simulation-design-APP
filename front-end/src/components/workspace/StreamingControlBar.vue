<script setup lang="ts">
/**
 * StreamingControlBar - 串流模擬控制列
 * 提供播放/暫停/停止/時間縮放控制
 */

import { computed, ref, watch } from 'vue';
import { Play, Pause, Square, RotateCcw, Gauge, Clock } from 'lucide-vue-next';
import { formatTimeScale } from '@/composables/useStreamingSimulation';

// 節流函數 - 限制函數調用頻率
function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  let scheduled = false;
  let lastArgs: Parameters<T> | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    } else if (!scheduled) {
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        lastCall = Date.now();
        if (lastArgs) fn(...lastArgs);
      }, ms - (now - lastCall));
    }
  }) as T;
}

const props = defineProps<{
  /** 是否正在運行 */
  isRunning: boolean;
  /** 是否已暫停 */
  isPaused: boolean;
  /** 當前模擬時間 (秒) */
  currentSimTime: number;
  /** 當前顯示時間 (秒) */
  currentDisplayTime: number;
  /** 時間縮放因子 */
  timeScale: number;
  /** 幀率 */
  fps: number;
  /** 錯誤訊息 */
  error: string | null;
}>();

const emit = defineEmits<{
  (e: 'play'): void;
  (e: 'pause'): void;
  (e: 'stop'): void;
  (e: 'reset'): void;
  (e: 'timeScaleChange', scale: number): void;
}>();

// 時間縮放對數滑桿 (-3 到 3 對應 0.001x 到 1000x)
const logScale = ref(Math.log10(props.timeScale));

// 監聽 props 變化來更新滑桿
watch(() => props.timeScale, (newScale) => {
  logScale.value = Math.log10(newScale);
});

// 節流發送時間縮放事件 (每 50ms 最多觸發一次)
const emitThrottledScaleChange = throttle((scale: number) => {
  emit('timeScaleChange', scale);
}, 50);

// 滑桿變化時更新時間縮放
function handleScaleChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const log = parseFloat(target.value);
  logScale.value = log;
  const scale = Math.pow(10, log);
  emitThrottledScaleChange(scale);
}

// 格式化時間
function formatTime(seconds: number): string {
  if (seconds < 1e-6) {
    return `${(seconds * 1e9).toFixed(2)} ns`;
  } else if (seconds < 1e-3) {
    return `${(seconds * 1e6).toFixed(2)} us`;
  } else if (seconds < 1) {
    return `${(seconds * 1e3).toFixed(2)} ms`;
  } else {
    return `${seconds.toFixed(3)} s`;
  }
}

// 計算屬性
const isActive = computed(() => props.isRunning || props.isPaused);
const formattedSimTime = computed(() => formatTime(props.currentSimTime));
const formattedScale = computed(() => formatTimeScale(props.timeScale));
// Note: formattedDisplayTime is available via formatTime(props.currentDisplayTime) if needed

// 處理播放/暫停
function handlePlayPause() {
  if (props.isRunning) {
    emit('pause');
  } else {
    emit('play');
  }
}
</script>

<template>
  <div class="streaming-control-bar">
    <!-- 播放控制 -->
    <div class="control-group">
      <!-- 播放/暫停按鈕 -->
      <button
        class="icon-btn"
        :class="{ active: isRunning }"
        :title="isRunning ? 'Pause' : 'Play'"
        @click="handlePlayPause"
      >
        <Pause v-if="isRunning" :size="18" />
        <Play v-else :size="18" />
      </button>

      <!-- 停止按鈕 -->
      <button
        class="icon-btn"
        :class="{ disabled: !isActive }"
        :disabled="!isActive"
        title="Stop"
        @click="$emit('stop')"
      >
        <Square :size="18" />
      </button>

      <!-- 重置按鈕 -->
      <button
        class="icon-btn"
        :class="{ disabled: !isActive }"
        :disabled="!isActive"
        title="Reset to t=0"
        @click="$emit('reset')"
      >
        <RotateCcw :size="18" />
      </button>
    </div>

    <!-- 時間顯示 -->
    <div class="time-display">
      <div class="time-item" title="Simulation Time">
        <Clock :size="14" />
        <span class="time-label">Sim:</span>
        <span class="time-value">{{ formattedSimTime }}</span>
      </div>
    </div>

    <!-- 時間縮放控制 -->
    <div class="scale-control">
      <Gauge :size="14" />
      <span class="scale-label">Speed:</span>
      <input
        type="range"
        class="scale-slider"
        :value="logScale"
        min="-3"
        max="1"
        step="0.1"
        title="Time Scale"
        @input="handleScaleChange"
      />
      <span class="scale-value">{{ formattedScale }}</span>
    </div>

    <!-- FPS 顯示 -->
    <div class="fps-display" :class="{ warning: fps < 30 }">
      {{ fps }} FPS
    </div>

    <!-- 錯誤訊息 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.streaming-control-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: 8px 12px;
  background-color: #1a1a1a;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid #333;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 4px);
  background-color: #2a2a2a;
  border: 1px solid #444;
  color: #aaa;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover:not(.disabled) {
  background-color: #3a3a3a;
  color: #fff;
  border-color: #555;
}

.icon-btn:active:not(.disabled) {
  transform: scale(0.95);
}

.icon-btn.active {
  color: #4caf50;
  background-color: rgba(76, 175, 80, 0.15);
  border-color: #4caf50;
}

.icon-btn.active:hover {
  background-color: rgba(76, 175, 80, 0.25);
}

.icon-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}

.time-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #888;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.time-label {
  color: #666;
}

.time-value {
  color: #4caf50;
  min-width: 80px;
}

.scale-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: #888;
  font-size: 12px;
}

.scale-label {
  color: #666;
}

.scale-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 2px;
  cursor: pointer;
}

.scale-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
}

.scale-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.scale-value {
  color: #ffd740;
  min-width: 70px;
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
}

.fps-display {
  padding: 4px 8px;
  background-color: #2a2a2a;
  border-radius: var(--radius-sm, 4px);
  color: #4caf50;
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.fps-display.warning {
  color: #ff9800;
}

.error-message {
  padding: 4px 8px;
  background-color: rgba(244, 67, 54, 0.1);
  border: 1px solid #f44336;
  border-radius: var(--radius-sm, 4px);
  color: #f44336;
  font-size: 11px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
