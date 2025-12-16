<script setup lang="ts">
/**
 * RightPanel - 右側電路詳情與 AI 解說面板
 * 對應圖片中右側的 "Circuit details" 區域
 */

import { ref, computed } from 'vue';
import { useCircuitStore } from '@/stores/circuitStore';

const circuitStore = useCircuitStore();

// Props
interface Props {
  exampleTitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  exampleTitle: 'KCL and current divider',
});

// 模擬 AI 訊息
const aiMessages = ref([
  {
    id: '1',
    type: 'info',
    content:
      "Kirchhoff's current law (KCL) states that the sum of currents flowing into a node is equal to the sum of currents flowing out of that node. KCL is based on the principle of charge conservation. KCL for the three branches of the top node is 3 A = 2 A + 1 A.",
  },
  {
    id: '2',
    type: 'highlight',
    content:
      'The simplest current divider consists of two resistors connected in parallel. Note that the same voltage exists across both resistors. The input current is divided such that less current flows through the larger resistor as it exhibits stronger opposition.',
  },
  {
    id: '3',
    type: 'tip',
    content:
      'Adjust resistances with the knob and note changes in currents. Add more resistors in series. To add a resistor to schematic, either click the "logo" button, then click the "resistor" button. Drag and drop the new resistor to the desired location. To make a connection between two nodes, select one node, then select the other node.',
  },
]);

// 選取的元件
const selectedComponent = computed(() => circuitStore.selectedComponent);

function handleValueChange(newValue: number) {
  if (selectedComponent.value) {
    circuitStore.updateComponentProperty(selectedComponent.value.id, 'value', newValue);
  }
}
</script>

<template>
  <aside class="right-panel">
    <!-- Header -->
    <div class="panel-header">
      <h3 class="panel-title">Circuit details</h3>
      <button class="btn btn-primary save-btn">SAVE A COPY</button>
    </div>

    <!-- Content Area (Scrollable) -->
    <div class="panel-content scrollable">
      <!-- Example Info -->
      <section class="section example-info">
        <span class="example-badge">Example:</span>
        <h2 class="example-title">{{ exampleTitle }}</h2>

        <!-- Mini Circuit Preview -->
        <div class="circuit-preview">
          <div class="preview-placeholder">
            <!-- 小電路預覽圖 -->
            <svg viewBox="0 0 100 60" class="mini-circuit">
              <line x1="20" y1="30" x2="80" y2="30" stroke="#666" stroke-width="2" />
              <rect x="35" y="25" width="30" height="10" fill="none" stroke="#888" stroke-width="2" />
            </svg>
          </div>
        </div>
      </section>
            <!-- Selected Component Properties -->
      <section v-if="selectedComponent" class="section component-props">
        <h4 class="section-title">Component Properties</h4>
        <div class="prop-grid">
          <div class="prop-item">
            <label class="prop-label">Type</label>
            <span class="prop-value">{{ selectedComponent.type }}</span>
          </div>
          <div class="prop-item">
            <label class="prop-label">Label</label>
            <input
              type="text"
              :value="selectedComponent.label"
              class="prop-input"
              @input="(e) => circuitStore.updateComponentProperty(selectedComponent!.id, 'label', (e.target as HTMLInputElement).value)"
            />
          </div>
          <div class="prop-item" v-if="selectedComponent.value !== undefined">
            <label class="prop-label">Value</label>
            <div class="prop-input-group">
              <input
                type="number"
                :value="selectedComponent.value"
                class="prop-input"
                @input="(e) => handleValueChange(Number((e.target as HTMLInputElement).value))"
              />
              <span class="prop-unit">{{ selectedComponent.unit }}</span>
            </div>
          </div>
          <div class="prop-item">
            <label class="prop-label">Rotation</label>
            <div class="rotation-control">
              <span class="prop-value">{{ selectedComponent.rotation }}°</span>
              <div class="rotate-actions">
                <button
                  class="icon-btn"
                  title="Rotate Left (-90°)"
                  @click="circuitStore.rotateComponent(selectedComponent!.id, -90)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="icon">
                    <path
                      d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M3 3v5h5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  class="icon-btn"
                  title="Rotate Right (+90°)"
                  @click="circuitStore.rotateComponent(selectedComponent!.id, 90)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="icon">
                    <path
                      d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M21 3v5h-5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- AI Explanation Messages
      <section class="section ai-messages">
        <div
          v-for="msg in aiMessages"
          :key="msg.id"
          class="ai-message"
          :class="msg.type"
        >
          <p>{{ msg.content }}</p>
        </div>
      </section> -->


    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg-panel);
  border-left: 1px solid var(--color-border);
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.save-btn {
  font-size: var(--font-size-xs);
  padding: var(--spacing-xs) var(--spacing-md);
}

/* Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.section {
  margin-bottom: var(--spacing-xl);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

/* Example Info */
.example-info {
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.example-badge {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.example-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: var(--spacing-sm) 0 var(--spacing-md);
}

.circuit-preview {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.preview-placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-circuit {
  width: 100%;
  height: 60px;
}

/* AI Messages */
.ai-messages {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.ai-message {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.ai-message.info {
  background-color: var(--color-bg-secondary);
  border-left: 3px solid var(--color-accent-blue);
}

.ai-message.highlight {
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 3px solid var(--color-accent-green);
}

.ai-message.tip {
  background-color: rgba(255, 152, 0, 0.1);
  border-left: 3px solid var(--color-accent-orange);
}

.ai-message p {
  margin: 0;
}

/* Component Properties */
.prop-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.prop-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.prop-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.prop-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
}

.prop-input {
  padding: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
}

.prop-input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.prop-unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
}

/* Rotation Controls */
.rotation-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rotate-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.icon-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  width: 28px;
  height: 28px;
}

.icon-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}

</style>
