<script setup lang="ts">
/**
 * App.vue - 主應用程式入口
 * 整合所有 Layout 與 Workspace 元件
 */

import { ref, computed } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import LeftSidebar from '@/components/layout/LeftSidebar.vue';
import RightPanel from '@/components/layout/RightPanel.vue';
import SimulationGraph from '@/components/workspace/SimulationGraph.vue';
import CircuitCanvas from '@/components/workspace/CircuitCanvas.vue';
import ControlBar from '@/components/workspace/ControlBar.vue';
import { useUIStore } from '@/stores/uiStore';

const uiStore = useUIStore();

// 當前範例標題
const currentExampleTitle = ref('KCL and current divider');

// 計算 Grid 佈局
const gridTemplateColumns = computed(() => {
  // 動態計算 Grid 的列定義
  // 如果左側關閉，第一欄不應該佔空間。
  // 注意：grid-template-columns 的語法是 "col1 col2 col3".
  // 如果我們用 v-if 移除 DOM 元素，grid 裡的元素數量會改變。
  // 如果 leftSidebarOpen is false, <aside left> 不存在。 DOM 只有 Workbench 和 RightSidebar (or just Workbench).
  // Workbench 永遠是中間那格 (index 1 if 3 cols, index 0 if 2 cols?)

  // 更好做法：讓 Grid 始終定義區域，但寬度為 0？
  // 不，如果 v-if 移除，我們應該只定義存在的列。

  const cols = [];
  if (uiStore.leftSidebarOpen) cols.push('var(--sidebar-left-width)');
  cols.push('1fr'); // Workbench always exists
  if (uiStore.rightSidebarOpen) cols.push('var(--sidebar-right-width)');

  return cols.join(' ');
});

function handleSelectExample(id: string) {
  // TODO: 載入範例電路
  console.log('Selected example:', id);
  currentExampleTitle.value = id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function handleNewCircuit() {
  // TODO: 清空畫布
  console.log('New circuit');
}

function handleOpenGallery() {
  // TODO: 開啟 Gallery
  console.log('Open gallery');
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
        <!-- Simulation View (Plotly) -->
        <div v-if="uiStore.showSimulationGraph" class="simulation-view">
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
