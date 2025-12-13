<script setup lang="ts">
/**
 * LeftSidebar - 左側範例與教學選單
 * 對應圖片中左側的 "Examples" 區域
 */

import { ref } from 'vue';

interface ExampleItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const examples = ref<ExampleItem[]>([
  {
    id: 'current',
    title: 'Current',
    description: 'Current is a flow of electric charge, such as electrons moving through a wire. It is...',
    icon: '→',
  },
  {
    id: 'voltage-ground',
    title: 'Voltage and ground',
    description: 'Electrons have electric potential energy. An electron located at ground node has...',
    icon: '⏚',
  },
  {
    id: 'resistance-ohm',
    title: "Resistance and Ohm's",
    description: "Resistance (R) of an electrical conductor is its opposition to the passage of current",
    icon: '⌇',
  },
  {
    id: 'kcl-divider',
    title: 'KCL and current divider',
    description: "Kirchhoff's current law (KCL) states that the sum of currents flowing into a node is equal...",
    icon: '⨁',
  },
  {
    id: 'kvl-divider',
    title: 'KVL and voltage divider',
    description: "Kirchhoff's voltage law (KVL) states that the sum of voltages across the components in...",
    icon: '∮',
  },
  {
    id: 'resistor-free',
    title: 'Resistor free',
    description: 'One way to calculate an equivalent resistance of a network is to apply a known...',
    icon: '∿',
  },
  {
    id: 'two-way-switch',
    title: 'Two way light switch',
    description: 'This circuit lets you turn the light on and off independently from two locations, such as...',
    icon: '⇆',
  },
  {
    id: 'capacitor',
    title: 'Capacitor',
    description: 'Capacitor is a two-terminal...',
    icon: '┤├',
  },
]);

const activeExampleId = ref<string | null>('kcl-divider');

const emit = defineEmits<{
  (e: 'select-example', id: string): void;
}>();

function handleSelectExample(id: string) {
  activeExampleId.value = id;
  emit('select-example', id);
}
</script>

<template>
  <aside class="left-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <span class="header-icon">📚</span>
      <span class="header-title">Examples</span>
      <!-- 不同視圖切換按鈕 -->
      <div class="view-toggle">
        <button class="toggle-btn active" title="List view">☰</button>
        <button class="toggle-btn" title="Grid view">⊞</button>
        <button class="toggle-btn" title="Search">🔍</button>
        <button class="toggle-btn" title="Bookmark">★</button>
      </div>
    </div>

    <!-- Examples List -->
    <div class="examples-list scrollable">
      <div v-for="example in examples" :key="example.id" class="example-item"
        :class="{ active: activeExampleId === example.id }" @click="handleSelectExample(example.id)">
        <div class="example-icon">{{ example.icon }}</div>
        <div class="example-content">
          <h4 class="example-title">{{ example.title }}</h4>
          <p class="example-desc">{{ example.description }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.left-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-icon {
  font-size: 16px;
}

.header-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  flex: 1;
}

.view-toggle {
  display: flex;
  gap: 2px;
}

.toggle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.toggle-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.toggle-btn.active {
  background-color: var(--color-bg-elevated);
  color: var(--color-text-primary);
}

/* Examples List */
.examples-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.example-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}

.example-item:hover {
  background-color: var(--color-bg-hover);
}

.example-item.active {
  background-color: var(--color-bg-elevated);
  border-color: var(--color-accent-green);
}

.example-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  font-size: 16px;
  color: var(--color-accent-green);
  flex-shrink: 0;
}

.example-content {
  flex: 1;
  overflow: hidden;
}

.example-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: 4px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.example-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
