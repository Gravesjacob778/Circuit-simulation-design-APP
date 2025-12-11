<script setup lang="ts">
/**
 * ComponentToolbar - 元件圖示列
 * 僅包含可拖曳的元件列表
 */

import { ref } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { getToolbarComponents } from '@/config/componentDefinitions';
import type { ComponentType } from '@/types/circuit';

const uiStore = useUIStore();
const toolbarComponents = getToolbarComponents();
const hoveredType = ref<ComponentType | null>(null);

// Icon 映射
const iconMap: Record<string, string> = {
  'dc-source': '⎓',
  'ac-source': '∿',
  resistor: '⌇',
  capacitor: '┤├',
  inductor: '∼∼',
  ground: '⏚',
  opamp: '△',
  diode: '▷|',
  led: '💡',
  npn: 'NPN',
  pnp: 'PNP',
  switch: '⇆',
  ammeter: 'A',
  voltmeter: 'V',
};

function getIcon(iconName: string): string {
  return iconMap[iconName] || '?';
}

function handleDragStart(event: DragEvent, type: ComponentType) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('component-type', type);
    event.dataTransfer.effectAllowed = 'copy';
  }
  uiStore.setDraggingComponent(type);
}

function handleDragEnd() {
  uiStore.setDraggingComponent(null);
}
</script>

<template>
  <div class="component-toolbar">
    <!-- Component Tools (Main) -->
    <div class="tool-group component-tools">
      <div
        v-for="comp in toolbarComponents"
        :key="comp.type"
        class="tool-btn component-btn"
        draggable="true"
        :title="comp.label"
        @dragstart="handleDragStart($event, comp.type)"
        @dragend="handleDragEnd"
        @mouseenter="hoveredType = comp.type"
        @mouseleave="hoveredType = null"
      >
        <span class="tool-icon">{{ getIcon(comp.icon) }}</span>
      </div>
    </div>

    <!-- Tooltip -->
    <div v-if="hoveredType" class="tooltip">
      {{ toolbarComponents.find((c) => c.type === hoveredType)?.label }}
    </div>
  </div>
</template>

<style scoped>
.component-toolbar {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  background-color: transparent; /* 透明背景 */
  position: relative;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px; /* 增加間距 */
  padding: 0 12px;
}

.tool-btn {
  width: 48px; /* 放大按鈕區域 */
  height: 48px; 
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%; /* 圓形 hover 效果 */
  color: #aaa; /* 更亮的灰色 */
  font-size: 24px; /* 放大圖示 */
  transition: all 0.2s ease;
  cursor: grab;
  border: 1px solid transparent;
  background-color: transparent;
}

.tool-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
  transform: scale(1.1); /* 微幅放大效果 */
}

.tool-btn:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.tool-icon {
  font-family: var(--font-family-mono);
  font-weight: bold;
}

/* Tooltip */
.tooltip {
  position: absolute;
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background-color: #333;
  border: 1px solid #555;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

/* Component Tools 滾動 */
.component-tools {
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
</style>
