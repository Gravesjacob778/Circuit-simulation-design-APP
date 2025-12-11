<script setup lang="ts">
/**
 * App.vue - 主應用程式入口
 * 整合所有 Layout 與 Workspace 元件
 */

import { ref } from 'vue';
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
    <AppHeader
      app-name="CircuitLab AI"
      @new-circuit="handleNewCircuit"
      @open-gallery="handleOpenGallery"
    />

    <!-- 2. Main Content Grid -->
    <main class="main-content">
      <!-- Left Sidebar: Examples -->
      <aside
        v-if="uiStore.leftSidebarOpen"
        class="sidebar-left"
      >
        <LeftSidebar @select-example="handleSelectExample" />
      </aside>

      <!-- Center: Workbench -->
      <section class="workbench">
        <!-- Simulation View (Plotly) -->
        <div
          v-if="uiStore.showSimulationGraph"
          class="simulation-view"
        >
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
      <aside
        v-if="uiStore.rightSidebarOpen"
        class="sidebar-right"
      >
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
  /* Left Sidebar | Center Workbench | Right Sidebar */
  grid-template-columns: var(--sidebar-left-width) 1fr var(--sidebar-right-width);
  overflow: hidden;
}

/* 當 Sidebar 關閉時調整 Grid */
.main-content:has(.sidebar-left:not(:first-child)) {
  grid-template-columns: 1fr var(--sidebar-right-width);
}

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
