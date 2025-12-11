<script setup lang="ts">
/**
 * AppHeader - 頂部主要工具列
 * 仿照 EveryCircuit 風格：左側為工作區管理，右側為元件圖示列
 */

import { ref } from 'vue';
import ComponentToolbar from '@/components/workspace/ComponentToolbar.vue';

defineProps<{
  appName?: string;
}>();

const emit = defineEmits<{
  (e: 'new-circuit'): void;
  (e: 'open-gallery'): void;
}>();

// 左側工具按鈕狀態
const workspaceTools = [
  { id: 'gallery', icon: '📖', title: 'Examples' },
  { id: 'home', icon: '🏠', title: 'Home', active: true },
  { id: 'community', icon: '🌐', title: 'Community' },
  { id: 'bookmarks', icon: '🔖', title: 'Bookmarks' },
  { id: 'trash', icon: '🗑', title: 'Trash' },
];

const activeToolId = ref('home');

function handleToolClick(id: string) {
  activeToolId.value = id;
  if (id === 'gallery') {
    emit('open-gallery');
  }
}
</script>

<template>
  <header class="app-header">
    <!-- Left Section: Workspace Management -->
    <div class="header-section left-controls">
      <button class="workspace-btn">
        <span class="refresh-icon">↻</span>
        Workspace
      </button>
      
      <div class="nav-icons">
        <button 
          v-for="tool in workspaceTools" 
          :key="tool.id"
          class="nav-icon-btn"
          :class="{ active: activeToolId === tool.id }"
          :title="tool.title"
          @click="handleToolClick(tool.id)"
        >
          {{ tool.icon }}
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="section-divider"></div>

    <!-- Right Section: Component Toolbar -->
    <div class="header-section right-components">
      <ComponentToolbar />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 64px; /* 加高 Header 以容納更大的圖示 */
  background-color: #1e1e1e; /* 深灰色背景 */
  border-bottom: 1px solid #000;
  display: flex;
  align-items: center;
  padding: 0;
  flex-shrink: 0;
  overflow: hidden;
}

/* Common Section Styles */
.header-section {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 var(--spacing-md);
}

/* Left Controls */
.left-controls {
  flex-shrink: 0;
  background-color: #252525; /* 稍微不同的深色以區分區塊 */
  gap: var(--spacing-lg);
  padding-left: var(--spacing-lg);
}

.workspace-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: #42a5f5; /* 藍色文字 */
  font-size: 15px;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
}

.workspace-btn:hover {
  background-color: rgba(66, 165, 245, 0.1);
}

.refresh-icon {
  font-size: 16px;
}

.nav-icons {
  display: flex;
  gap: var(--spacing-md);
}

.nav-icon-btn {
  font-size: 22px; /* 放大圖示 */
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.2s;
  position: relative;
}

.nav-icon-btn:hover {
  color: #fff;
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-icon-btn.active {
  color: #fff;
  opacity: 1;
}

/* Active Indicator underline */
.nav-icon-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 4px;
  right: 4px;
  height: 3px;
  background-color: var(--color-accent-yellow);
  border-radius: 2px;
}

/* Divider */
.section-divider {
  width: 2px;
  height: 40px;
  background-color: #000;
  border-right: 1px solid #333;
}

/* Right Components */
.right-components {
  flex: 1;
  overflow-x: auto; /* 允許水平滾動 */
  background-color: #1e1e1e;
  /* 隱藏滾動條但保持功能 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.right-components::-webkit-scrollbar {
  display: none;
}
</style>
