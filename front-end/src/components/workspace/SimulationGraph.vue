<script setup lang="ts">
/**
 * SimulationGraph - 模擬結果波形圖
 * 使用 Plotly.js 顯示電壓/電流時間序列
 * 對應圖片中畫布上方的波形區域
 */

import { ref, onMounted, watch, computed } from 'vue';
import Plotly from 'plotly.js-dist-min';
import { useCircuitStore } from '@/stores/circuitStore';

const circuitStore = useCircuitStore();
const graphContainer = ref<HTMLDivElement | null>(null);

// 模擬數據
const simulationData = computed(() => circuitStore.simulationData);

// 圖表統計
const stats = ref({
  max: 2,
  min: 2,
  range: 0,
  rms: 2,
});

// Plotly 配置
const layout: Partial<Plotly.Layout> = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  margin: { t: 10, r: 20, b: 30, l: 50 },
  xaxis: {
    showgrid: true,
    gridcolor: '#333',
    tickfont: { color: '#888', size: 10 },
    title: { text: 'Time (s)', font: { color: '#888', size: 10 } },
  },
  yaxis: {
    showgrid: true,
    gridcolor: '#333',
    tickfont: { color: '#888', size: 10 },
    title: { text: 'Current (A)', font: { color: '#888', size: 10 } },
  },
  showlegend: false,
};

const config: Partial<Plotly.Config> = {
  displayModeBar: false,
  responsive: true,
};

// 初始化圖表
function initGraph() {
  if (!graphContainer.value) return;

  // 產生模擬數據 (Demo)
  const timePoints = Array.from({ length: 200 }, (_, i) => i * 0.01);
  const currentValues = timePoints.map((t) => {
    // 模擬電流變化（階梯函數 + 小波動）
    if (t < 0.5) return 2 + Math.random() * 0.05;
    if (t < 1.0) return 1.5 + Math.random() * 0.05;
    return 1 + Math.random() * 0.05;
  });

  const traces: Plotly.Data[] = [
    {
      x: timePoints,
      y: currentValues,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#42a5f5', width: 2 },
      fill: 'tozeroy',
      fillcolor: 'rgba(66, 165, 245, 0.1)',
    },
  ];

  Plotly.newPlot(graphContainer.value, traces, layout, config);
}

// 更新圖表
function updateGraph() {
  if (!graphContainer.value || !simulationData.value) return;

  const traces: Plotly.Data[] = simulationData.value.signals.map((signal) => ({
    x: simulationData.value!.time,
    y: signal.values,
    type: 'scatter',
    mode: 'lines',
    name: signal.name,
    line: { color: signal.color || '#42a5f5', width: 2 },
  }));

  Plotly.react(graphContainer.value, traces, layout, config);
}

onMounted(() => {
  initGraph();
});

watch(simulationData, () => {
  updateGraph();
});
</script>

<template>
  <div class="simulation-graph">
    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-icon">▼</span>
        <span class="stat-label">Max:</span>
        <span class="stat-value">{{ stats.max }} A</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Min:</span>
        <span class="stat-value">{{ stats.min }} A</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Range:</span>
        <span class="stat-value">{{ stats.range }} A</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">RMS:</span>
        <span class="stat-value">{{ stats.rms }} A</span>
      </div>
      <div class="stat-spacer"></div>
      <button class="expand-btn" title="Expand Graph">▾</button>
    </div>

    <!-- Graph Container -->
    <div ref="graphContainer" class="graph-container"></div>

    <!-- Y-Axis Labels (Overlay) -->
    <div class="y-labels">
      <span class="y-label">2 A</span>
      <span class="y-label">1.5 A</span>
      <span class="y-label">1 A</span>
    </div>
  </div>
</template>

<style scoped>
.simulation-graph {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #000;
  position: relative;
}

/* Stats Bar */
.stats-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.stat-icon {
  color: var(--color-accent-blue);
  font-size: 10px;
}

.stat-label {
  color: var(--color-text-muted);
}

.stat-value {
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
}

.stat-spacer {
  flex: 1;
}

.expand-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
}

.expand-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Graph Container */
.graph-container {
  flex: 1;
  width: 100%;
  min-height: 100px;
}

/* Y-Axis Labels */
.y-labels {
  position: absolute;
  left: var(--spacing-sm);
  top: 50px;
  bottom: 30px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.y-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
}
</style>
