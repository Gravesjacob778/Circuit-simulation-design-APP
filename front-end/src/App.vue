<script setup lang="ts">
/**
 * App.vue - 主應用程式入口
 * 整合所有 Layout 與 Workspace 元件
 */

import { ref, computed, watch } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import LeftSidebar from '@/components/layout/LeftSidebar.vue';
import RightPanel from '@/components/layout/RightPanel.vue';
import WaveformViewer from '@/components/workspace/WaveformViewer.vue';
import CircuitCanvas from '@/components/workspace/CircuitCanvas.vue';
import ControlBar from '@/components/workspace/ControlBar.vue';
import StreamingControlBar from '@/components/workspace/StreamingControlBar.vue';
import { useUIStore } from '@/stores/uiStore';
import { useWaveformStore } from '@/stores/waveformStore';
import { useCircuitStore } from '@/stores/circuitStore';
import { useStreamingSimulation, autoTimeScale, type ProbeConfig } from '@/composables/useStreamingSimulation';

const uiStore = useUIStore();
const waveformStore = useWaveformStore();
const circuitStore = useCircuitStore();

// 串流模擬控制
const streamingSimulation = useStreamingSimulation();

// 當前範例標題
const currentExampleTitle = ref('KCL and current divider');

// 是否使用新的 WaveformViewer（可切換）
const useNewWaveformViewer = ref(true);

// 檢查電路是否包含電源（AC 或 DC）
const hasPowerSource = computed(() => {
  return circuitStore.components.some(c => c.type === 'ac_source' || c.type === 'dc_source');
});

// 檢查電路是否包含 AC 電源
const hasACSource = computed(() => {
  return circuitStore.components.some(c => c.type === 'ac_source');
});

// 取得 AC 電源的頻率（用於自動時間縮放）
const acSourceFrequency = computed(() => {
  const acSource = circuitStore.components.find(c => c.type === 'ac_source');
  return acSource?.frequency ?? 60;
});

// 是否使用串流模擬模式（有電源時啟用）
const useStreamingMode = computed(() => {
  return hasPowerSource.value && streamingSimulation.isActive.value;
});

// 計算 Grid 佈局
const gridTemplateColumns = computed(() => {
  const cols = [];
  if (uiStore.leftSidebarOpen) cols.push('var(--sidebar-left-width)');
  cols.push('1fr'); // Workbench always exists
  if (uiStore.rightSidebarOpen) cols.push('var(--sidebar-right-width)');
  return cols.join(' ');
});

// 預設顏色調色盤（與 waveformStore 相同）
const COMPONENT_COLORS = [
  '#4caf50', // 綠色
  '#ffd740', // 黃色
  '#42a5f5', // 藍色
  '#ab47bc', // 紫色
  '#ff9800', // 橙色
  '#f44336', // 紅色
];

// ========== 串流模擬控制 (即時動畫) ==========

/** DC 模式的預設時間縮放（1:1 即時） */
const DC_DEFAULT_TIME_SCALE = 1;

/**
 * 啟動串流模擬（支援 AC 和 DC）
 */
function startStreamingSimulation() {
  if (!hasPowerSource.value) return;

  // 建立探針配置
  const probes: ProbeConfig[] = [];

  // 為所有電阻、電感、電容建立電流探針
  for (const component of circuitStore.components) {
    if (['resistor', 'capacitor', 'inductor', 'led', 'diode'].includes(component.type)) {
      probes.push({
        componentId: component.id,
        label: `I(${component.label || component.type})`,
        unit: 'A',
        measureType: 'current',
        color: COMPONENT_COLORS[probes.length % COMPONENT_COLORS.length],
      });
    }
  }

  // 如果沒有可測量的元件，測量電源
  if (probes.length === 0) {
    const powerSource = circuitStore.components.find(c => c.type === 'ac_source' || c.type === 'dc_source');
    if (powerSource) {
      probes.push({
        componentId: powerSource.id,
        label: `I(${powerSource.label || powerSource.type})`,
        unit: 'A',
        measureType: 'current',
        color: COMPONENT_COLORS[0] ?? '#4caf50',
      });
    }
  }

  // 計算時間縮放：AC 使用自動縮放，DC 使用即時（1:1）
  const timeScale = hasACSource.value
    ? autoTimeScale(acSourceFrequency.value)
    : DC_DEFAULT_TIME_SCALE;

  // 啟動串流模擬
  const success = streamingSimulation.start(
    circuitStore.components,
    circuitStore.wires,
    probes,
    { timeScale }
  );

  if (success) {
    console.log('串流模擬已啟動', {
      mode: hasACSource.value ? 'AC' : 'DC',
      frequency: hasACSource.value ? acSourceFrequency.value : 'N/A',
      timeScale,
      probes: probes.length,
    });
  }
}

/**
 * 停止串流模擬
 */
function stopStreamingSimulation() {
  if (streamingSimulation.isActive.value) {
    streamingSimulation.stop();
    console.log('串流模擬已停止');
  }
}

/**
 * 處理串流控制事件
 */
function handleStreamingPlay() {
  if (streamingSimulation.isPaused.value) {
    streamingSimulation.resume();
  } else if (!streamingSimulation.isRunning.value) {
    startStreamingSimulation();
  }
}

function handleStreamingPause() {
  streamingSimulation.pause();
}

function handleStreamingStop() {
  stopStreamingSimulation();
}

function handleStreamingReset() {
  streamingSimulation.reset();
}

function handleTimeScaleChange(scale: number) {
  streamingSimulation.setTimeScale(scale);
}

/**
 * 監聽模擬動畫狀態變化 - 處理串流模式（AC 和 DC）
 */
watch(
  () => circuitStore.isCurrentAnimating,
  (isAnimating) => {
    if (isAnimating && hasPowerSource.value) {
      // 有電源，啟動串流模擬
      startStreamingSimulation();
    } else if (!isAnimating) {
      // 停止串流模擬
      stopStreamingSimulation();
    }
  }
);

/**
 * 監聽電路元件變化（電壓、頻率等參數改變）
 * 當模擬正在運行時，重新初始化求解器以反映新的參數
 */
watch(
  () => circuitStore.components.map(c => ({
    id: c.id,
    type: c.type,
    value: c.value,
    frequency: c.frequency,
    phase: c.phase,
    waveformType: c.waveformType,
  })),
  () => {
    // 只在串流模擬運行中時重新啟動
    if (streamingSimulation.isRunning.value) {
      console.log('電路參數已變更，重新啟動串流模擬');
      // 保存當前時間縮放
      const currentTimeScale = streamingSimulation.timeScale.value;
      // 停止並重新啟動
      streamingSimulation.stop();
      // 重新啟動時使用相同的時間縮放
      startStreamingSimulationWithScale(currentTimeScale);
    }
  },
  { deep: true }
);

/**
 * 使用指定的時間縮放啟動串流模擬
 */
function startStreamingSimulationWithScale(timeScale: number) {
  if (!hasPowerSource.value) return;

  // 建立探針配置
  const probes: ProbeConfig[] = [];

  // 為所有電阻、電感、電容建立電流探針
  for (const component of circuitStore.components) {
    if (['resistor', 'capacitor', 'inductor', 'led', 'diode'].includes(component.type)) {
      probes.push({
        componentId: component.id,
        label: `I(${component.label || component.type})`,
        unit: 'A',
        measureType: 'current',
        color: COMPONENT_COLORS[probes.length % COMPONENT_COLORS.length],
      });
    }
  }

  // 如果沒有可測量的元件，測量電源
  if (probes.length === 0) {
    const powerSource = circuitStore.components.find(c => c.type === 'ac_source' || c.type === 'dc_source');
    if (powerSource) {
      probes.push({
        componentId: powerSource.id,
        label: `I(${powerSource.label || powerSource.type})`,
        unit: 'A',
        measureType: 'current',
        color: COMPONENT_COLORS[0] ?? '#4caf50',
      });
    }
  }

  // 啟動串流模擬
  streamingSimulation.start(
    circuitStore.components,
    circuitStore.wires,
    probes,
    { timeScale }
  );
}

function handleSelectExample(id: string) {
  console.log('Selected example:', id);
  currentExampleTitle.value = id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function handleNewCircuit() {
  console.log('New circuit');
}

function handleOpenGallery() {
  console.log('Open gallery');
}

function handleTraceVisibilityChanged(payload: { traceId: string; visible: boolean }) {
  waveformStore.toggleProbeVisibility(payload.traceId);
}
</script>

<template>
  <div class="app-layout">
    <!-- 1. Top Header -->
    <AppHeader app-name="CircuitLab AI" @new-circuit="handleNewCircuit" @open-gallery="handleOpenGallery" />

    <!-- 2. Main Content Grid -->
    <main class="main-content">
      <!-- Left Sidebar: Examples -->
      <aside v-if="uiStore.leftSidebarOpen" class="sidebar-left">
        <LeftSidebar @select-example="handleSelectExample" />
      </aside>

      <!-- Center: Workbench -->
      <section class="workbench">
        <!-- Waveform Viewer (New Implementation) - 使用 v-show 保持 DOM 穩定，避免響應式更新時的 patch 錯誤 -->
        <div v-show="uiStore.showSimulationGraph && useNewWaveformViewer" class="simulation-view waveform-view">
          <!-- 串流模擬控制列 (AC 模式) -->
          <StreamingControlBar
            v-if="useStreamingMode || streamingSimulation.isActive.value"
            :is-running="streamingSimulation.isRunning.value"
            :is-paused="streamingSimulation.isPaused.value"
            :current-sim-time="streamingSimulation.currentSimTime.value"
            :current-display-time="streamingSimulation.currentDisplayTime.value"
            :time-scale="streamingSimulation.timeScale.value"
            :fps="streamingSimulation.fps.value"
            :error="streamingSimulation.error.value"
            @play="handleStreamingPlay"
            @pause="handleStreamingPause"
            @stop="handleStreamingStop"
            @reset="handleStreamingReset"
            @time-scale-change="handleTimeScaleChange"
          />
          <WaveformViewer
            :traces="waveformStore.waveformTraces"
            :height="350"
            :show-legend="true"
            :show-grid="true"
            :show-cursor="true"
            :streaming="circuitStore.isCurrentAnimating || streamingSimulation.isRunning.value"
            @trace-visibility-changed="handleTraceVisibilityChanged"
          />
        </div>

        <!-- Circuit Editor (Konva) -->
        <div class="canvas-container">
          <CircuitCanvas />
        </div>

        <!-- Bottom Controls -->
        <div class="bottom-controls">
          <ControlBar />
        </div>
      </section>

      <!-- Right Sidebar: Details & AI -->
      <aside v-if="uiStore.rightSidebarOpen" class="sidebar-right">
        <RightPanel :example-title="currentExampleTitle" />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}

.main-content {
  display: grid;
  flex: 1;
  /* Dynamic grid columns based on sidebar state */
  grid-template-columns: v-bind("gridTemplateColumns");
  overflow: hidden;
}

/* 當 Sidebar 關閉時調整 Grid - 移除舊的 CSS 規則，改用 dynamic binding */
/* .main-content:has(...) rules are no longer needed */

/* 當 Sidebar 關閉時調整 Grid - 已由 dynamic binding 處理 */

/* Sidebar Styling */
.sidebar-left {
  background-color: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.sidebar-right {
  background-color: var(--color-bg-panel);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
}

/* Center Workbench Logic */
.workbench {
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
  position: relative;
  overflow: hidden;
}

.simulation-view {
  height: 180px;
  min-height: 100px;
  border-bottom: 1px solid var(--color-border);
  background: #000;
  position: relative;
  flex-shrink: 0;
}

/* WaveformViewer 需要更多空間來顯示統計和圖例 */
.waveform-view {
  height: auto;
  min-height: 400px;
  max-height: 550px;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #050505;
}

.bottom-controls {
  height: var(--control-bar-height);
  background-color: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}
</style>
