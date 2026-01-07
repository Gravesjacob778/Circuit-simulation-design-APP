<script setup lang="ts">
/**
 * RightPanel - 右側電路詳情與 AI 解說面板
 * 對應圖片中右側的 "Circuit details" 區域
 */

import { computed } from 'vue';
import { useCircuitStore } from '@/stores/circuitStore';
import type { WaveformType } from '@/types/circuit';

const circuitStore = useCircuitStore();

// Props
interface Props {
  exampleTitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  exampleTitle: 'KCL and current divider',
});

// LED 顏色選項 (對應 LED_RULE.md 規範)
const LED_COLOR_OPTIONS = [
  { value: '', label: '(預設)', color: '#ffeb3b', vf: '2.0V' },
  { value: 'Red', label: '🔴 Red', color: '#ff4444', vf: '1.8V' },
  { value: 'Green', label: '🟢 Green', color: '#44ff44', vf: '2.1V' },
  { value: 'Blue', label: '🔵 Blue', color: '#4488ff', vf: '3.0V' },
  { value: 'White', label: '⚪ White', color: '#ffffff', vf: '3.0V' },
] as const;

// AC 波形類型選項
const WAVEFORM_TYPE_OPTIONS: { value: WaveformType; label: string; icon: string }[] = [
  { value: 'sine', label: '正弦波', icon: '∿' },
  { value: 'square', label: '方波', icon: '⊓' },
  { value: 'triangle', label: '三角波', icon: '△' },
  { value: 'sawtooth', label: '鋸齒波', icon: '⩘' },
];

// 選取的元件
const selectedComponent = computed(() => circuitStore.selectedComponent);

// 判斷是否為 LED 元件
const isLED = computed(() => selectedComponent.value?.type === 'led');

// 判斷是否為 AC 電源
const isACSource = computed(() => selectedComponent.value?.type === 'ac_source');

// 取得目前 LED 顏色
const currentLEDColor = computed(() => selectedComponent.value?.ledColor ?? '');

// 取得 AC 源參數
const acFrequency = computed(() => selectedComponent.value?.frequency ?? 60);
const acPhase = computed(() => selectedComponent.value?.phase ?? 0);
const acWaveformType = computed(() => selectedComponent.value?.waveformType ?? 'sine');

// 相位顯示轉換 (rad -> deg)
const acPhaseDegrees = computed(() => Math.round((acPhase.value * 180) / Math.PI));

function handleValueChange(newValue: number) {
  if (selectedComponent.value) {
    circuitStore.updateComponentProperty(selectedComponent.value.id, 'value', newValue);
  }
}

function handleLEDColorChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const color = target.value as 'Red' | 'Green' | 'Blue' | 'White' | '';
  if (selectedComponent.value) {
    // 如果選擇空值，則移除 ledColor 屬性；否則設定顏色
    circuitStore.updateComponentProperty(
      selectedComponent.value.id,
      'ledColor',
      color || undefined
    );
  }
}

// AC 源參數變更處理
function handleFrequencyChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const freq = Math.max(0.1, Number(target.value)); // 最小 0.1 Hz
  if (selectedComponent.value) {
    circuitStore.updateComponentProperty(selectedComponent.value.id, 'frequency', freq);
  }
}

function handlePhaseChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const degrees = Number(target.value);
  const radians = (degrees * Math.PI) / 180;
  if (selectedComponent.value) {
    circuitStore.updateComponentProperty(selectedComponent.value.id, 'phase', radians);
  }
}

function handleWaveformTypeChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const waveformType = target.value as WaveformType;
  if (selectedComponent.value) {
    circuitStore.updateComponentProperty(selectedComponent.value.id, 'waveformType', waveformType);
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
          <!-- LED Color Selector (僅 LED 元件顯示) -->
          <div class="prop-item" v-if="isLED">
            <label class="prop-label">Color</label>
            <select
              class="prop-select"
              :value="currentLEDColor"
              @change="handleLEDColorChange"
            >
              <option
                v-for="opt in LED_COLOR_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }} (Vf={{ opt.vf }})
              </option>
            </select>
          </div>
          <!-- AC Source Parameters (僅 AC 電源顯示) -->
          <template v-if="isACSource">
            <div class="prop-item">
              <label class="prop-label">Frequency</label>
              <div class="prop-input-group">
                <input
                  type="number"
                  :value="acFrequency"
                  class="prop-input"
                  min="0.1"
                  step="1"
                  @input="handleFrequencyChange"
                />
                <span class="prop-unit">Hz</span>
              </div>
            </div>
            <div class="prop-item">
              <label class="prop-label">Phase</label>
              <div class="prop-input-group">
                <input
                  type="number"
                  :value="acPhaseDegrees"
                  class="prop-input"
                  min="-360"
                  max="360"
                  step="15"
                  @input="handlePhaseChange"
                />
                <span class="prop-unit">°</span>
              </div>
            </div>
            <div class="prop-item">
              <label class="prop-label">Waveform</label>
              <select
                class="prop-select"
                :value="acWaveformType"
                @change="handleWaveformTypeChange"
              >
                <option
                  v-for="opt in WAVEFORM_TYPE_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.icon }} {{ opt.label }}
                </option>
              </select>
            </div>
          </template>
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

.prop-select {
  padding: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 100%;
}

.prop-select:hover {
  border-color: var(--color-text-muted);
}

.prop-select:focus {
  outline: none;
  border-color: var(--color-accent-blue);
  box-shadow: 0 0 0 2px rgba(66, 165, 245, 0.2);
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
