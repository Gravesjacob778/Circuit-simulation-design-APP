<script setup lang="ts">
/**
 * WaveformViewerDemo - 波形檢視器示範元件
 * 
 * 這個元件示範如何使用 WaveformViewer：
 * 1. 使用 waveformStore 管理資料
 * 2. 將 waveformTraces 傳遞給 WaveformViewer
 * 3. 處理 Viewer 發出的事件
 */

import { ref, onMounted } from 'vue';
import WaveformViewer from './WaveformViewer.vue';
import { useWaveformStore } from '@/stores/waveformStore';

const waveformStore = useWaveformStore();
const viewerRef = ref<InstanceType<typeof WaveformViewer> | null>(null);

// 是否顯示示範資料
const showDemo = ref(true);

// 載入示範資料
onMounted(() => {
  if (showDemo.value) {
    waveformStore.loadDemoData();
  }
});

// 事件處理
function handleTraceVisibilityChanged(payload: { traceId: string; visible: boolean }) {
  waveformStore.toggleProbeVisibility(payload.traceId);
}

function handleCursorMoved(payload: { cursorId: string; time: number }) {
  console.log('Cursor moved:', payload);
}

function handleViewportChanged(payload: { start: number; end: number }) {
  console.log('Viewport changed:', payload);
}

// 控制方法
function loadDemoData() {
  waveformStore.loadDemoData();
}

function clearData() {
  waveformStore.clearAll();
}

function resetZoom() {
  viewerRef.value?.resetZoom();
}

function zoomIn() {
  viewerRef.value?.zoomIn();
}

function zoomOut() {
  viewerRef.value?.zoomOut();
}

// 新增自訂波形用於測試
function addCustomWave() {
  const numPoints = 500;
  const duration = 0.02; // 20ms
  const timePoints = Array.from({ length: numPoints }, (_, i) => (i / numPoints) * duration);
  
  // 建立一個三角波
  const values = timePoints.map(t => {
    const period = 0.004; // 4ms period = 250Hz
    const phase = (t % period) / period;
    return phase < 0.5 ? phase * 2 * 2 - 1 : (1 - phase) * 2 * 2 - 1;
  });

  waveformStore.loadFromSimulation(timePoints, [
    ...waveformStore.waveformTraces.map(t => ({
      componentId: t.traceId.split('-')[0] || 'unknwon',
      channelId: '+',
      unit: t.unit,
      values: t.data.map(d => d.value),
      label: t.label,
      color: t.color,
    })),
    {
      componentId: 'TRI',
      channelId: '+',
      unit: 'V' as const,
      values,
      label: 'V(TRI)',
      color: '#e91e63',
    },
  ]);
}
</script>

<template>
  <div class="demo-container">
    <!-- 控制按鈕 -->
    <div class="demo-controls">
      <span class="demo-title">Waveform Viewer Demo</span>
      <div class="control-buttons">
        <button class="control-btn" @click="loadDemoData">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Load Demo
        </button>
        <button class="control-btn" @click="addCustomWave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Wave
        </button>
        <button class="control-btn" @click="clearData">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 6l-14 14M5 6l14 14" stroke-linecap="round"/>
          </svg>
          Clear
        </button>
        <div class="divider" />
        <button class="control-btn" @click="zoomIn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </button>
        <button class="control-btn" @click="zoomOut">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M8 11h6" />
          </svg>
        </button>
        <button class="control-btn" @click="resetZoom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Fit
        </button>
      </div>
    </div>

    <!-- 波形檢視器 -->
    <WaveformViewer
      ref="viewerRef"
      :traces="waveformStore.waveformTraces"
      :height="350"
      :show-legend="true"
      :show-grid="true"
      :show-cursor="true"
      @trace-visibility-changed="handleTraceVisibilityChanged"
      @cursor-moved="handleCursorMoved"
      @viewport-changed="handleViewportChanged"
    />

    <!-- 說明 -->
    <div class="demo-info">
      <h3>使用說明</h3>
      <ul>
        <li><strong>縮放</strong>：使用滑鼠滾輪或右上角按鈕</li>
        <li><strong>平移</strong>：按住左鍵拖曳</li>
        <li><strong>游標</strong>：將滑鼠移到波形區域查看數值</li>
        <li><strong>圖例</strong>：點擊圖例項目切換 trace 可見性</li>
      </ul>
      <h3>架構特點</h3>
      <ul>
        <li>WaveformViewer 是純展示元件，只接收 <code>WaveformTrace[]</code></li>
        <li>不同單位 (V, A, W) 使用獨立的 Y 軸，不會混在一起</li>
        <li>支援未來擴展：觸發、測量讀數等功能</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg-primary);
  min-height: 100%;
}

.demo-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-panel);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.demo-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.control-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-accent-green);
}

.control-btn svg {
  width: 16px;
  height: 16px;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 var(--spacing-xs);
}

.demo-info {
  padding: var(--spacing-md);
  background: var(--color-bg-panel);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.demo-info h3 {
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  margin-bottom: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.demo-info h3:first-child {
  margin-top: 0;
}

.demo-info ul {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding-left: var(--spacing-lg);
  margin: 0;
}

.demo-info li {
  margin-bottom: var(--spacing-xs);
}

.demo-info code {
  background: var(--color-bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-accent-green);
}
</style>
