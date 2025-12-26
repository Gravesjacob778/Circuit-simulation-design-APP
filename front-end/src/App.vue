<script setup lang="ts">
/**
 * App.vue - 主應用程式入口
 * 整合所有 Layout 與 Workspace 元件
 */

import { ref, computed, watch } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import LeftSidebar from '@/components/layout/LeftSidebar.vue';
import RightPanel from '@/components/layout/RightPanel.vue';
import SimulationGraph from '@/components/workspace/SimulationGraph.vue';
import WaveformViewer from '@/components/workspace/WaveformViewer.vue';
import CircuitCanvas from '@/components/workspace/CircuitCanvas.vue';
import ControlBar from '@/components/workspace/ControlBar.vue';
import { useUIStore } from '@/stores/uiStore';
import { useWaveformStore } from '@/stores/waveformStore';
import { useCircuitStore } from '@/stores/circuitStore';

const uiStore = useUIStore();
const waveformStore = useWaveformStore();
const circuitStore = useCircuitStore();

// 當前範例標題
const currentExampleTitle = ref('KCL and current divider');

// 是否使用新的 WaveformViewer（可切換）
const useNewWaveformViewer = ref(true);

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
let colorIndex = 0;

/**
 * 監聽選取元件的變化
 * 當模擬正在運行且有元件被選取時，顯示該元件的電流波形
 */
watch(
  () => circuitStore.selectedComponentId,
  (newId) => {
    // 只有在模擬運行中才顯示波形
    if (!circuitStore.isCurrentAnimating) {
      return;
    }

    if (newId) {
      const component = circuitStore.selectedComponent;
      if (!component) return;

      // 取得該元件的電流值 (mA -> A)
      const currentMA = circuitStore.getComponentCurrent(newId);
      if (currentMA === null) {
        console.log(`元件 ${component.label} 沒有電流資料`);
        return;
      }

      const currentA = currentMA / 1000; // 轉換為 A

      // 取得顏色
      const color = COMPONENT_COLORS[colorIndex++ % COMPONENT_COLORS.length];

      // 顯示該元件的電流波形
      waveformStore.showOnlyComponentWaveform({
        componentId: newId,
        label: `I(${component.label || component.type})`,
        unit: 'A',
        currentValue: currentA,
        color,
      });

      console.log(`顯示元件 ${component.label} 的電流波形: ${currentMA.toFixed(3)} mA`);
    } else {
      // 取消選取時清除波形
      waveformStore.clearAll();
    }
  }
);

/**
 * 監聽模擬動畫狀態變化
 * 當模擬停止時，清除波形
 */
watch(
  () => circuitStore.isCurrentAnimating,
  (isAnimating) => {
    if (!isAnimating) {
      waveformStore.clearAll();
    }
  }
);

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
        <!-- Waveform Viewer (New Implementation) -->
        <div v-if="uiStore.showSimulationGraph && useNewWaveformViewer" class="simulation-view waveform-view">
          <WaveformViewer
            :traces="waveformStore.waveformTraces"
            :height="350"
            :show-legend="true"
            :show-grid="true"
            :show-cursor="true"
            @trace-visibility-changed="handleTraceVisibilityChanged"
          />
        </div>
        <!-- Legacy Simulation Graph (Plotly) -->
        <div v-else-if="uiStore.showSimulationGraph" class="simulation-view">
          <SimulationGraph />
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
