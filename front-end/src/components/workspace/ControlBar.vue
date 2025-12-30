<script setup lang="ts">
/**
 * ControlBar - 底部工具列
 * 包含編輯工具與視圖控制
 */

import { useCircuitStore } from '@/stores/circuitStore';
import { Eye, Scissors, Undo2, Redo2, Scan, Zap, Square } from 'lucide-vue-next';
import { computed } from 'vue';

const circuitStore = useCircuitStore();

const ruleErrors = computed(() => circuitStore.ruleViolations.filter((v) => v.severity === 'ERROR'));
const ruleWarnings = computed(() => circuitStore.ruleViolations.filter((v) => v.severity === 'WARNING'));

const topAlert = computed(() => {
  if (ruleErrors.value.length > 0) {
    const first = ruleErrors.value[0]!;
    return {
      severity: 'ERROR',
      count: ruleErrors.value.length,
      text: `${first.ruleId}: ${first.message}`,
    } as const;
  }

  if (circuitStore.simulationError) {
    return {
      severity: 'ERROR',
      count: null,
      text: circuitStore.simulationError,
    } as const;
  }

  if (ruleWarnings.value.length > 0) {
    const first = ruleWarnings.value[0]!;
    return {
      severity: 'WARNING',
      count: ruleWarnings.value.length,
      text: `${first.ruleId}: ${first.message}`,
    } as const;
  }

  return null;
});

function handleUndo() {
  if (circuitStore.canUndo) {
    circuitStore.undo();
  }
}

function handleRedo() {
  if (circuitStore.canRedo) {
    circuitStore.redo();
  }
}

function handleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function handleCut() {
  // 優先刪除選取的導線
  if (circuitStore.selectedWireId) {
    circuitStore.removeWire(circuitStore.selectedWireId);
    console.log('Wire cut:', circuitStore.selectedWireId);
    return;
  }

  // 如果沒有選取導線，則刪除選取的元件
  if (circuitStore.selectedComponentId) {
    circuitStore.removeComponent(circuitStore.selectedComponentId);
    console.log('Component cut:', circuitStore.selectedComponentId);
  }
}

function handleToggleCurrentAnimation() {
  circuitStore.toggleCurrentAnimation();
}

function handleStopSimulation() {
  circuitStore.stopSimulation();
}
</script>

<template>
  <div class="footer-bar">
    <!-- 左側工具 -->
    <div class="left-group">
      <button class="icon-btn" title="View Options">
        <Eye :size="20" />
      </button>
      <button class="icon-btn" title="Cut" @click="handleCut">
        <Scissors :size="20" />
      </button>

      <!-- 開始/停止模擬（電流流動動畫） -->
      <button v-if="!circuitStore.isCurrentAnimating" class="icon-btn" title="Start Simulation"
        @click="handleToggleCurrentAnimation">
        <Zap :size="20" />
      </button>
      <button v-else class="icon-btn active" title="Stop Simulation" @click="handleStopSimulation">
        <Square :size="20" />
      </button>
    </div>

    <!-- 中間狀態 / 錯誤提示 -->
    <div class="center-group">
      <div v-if="topAlert"
        :class="topAlert.severity === 'ERROR' ? 'simulation-error' : 'simulation-warning'"
        role="alert">
        {{ topAlert.count && topAlert.count > 1 ? `(${topAlert.count}) ` : '' }}{{ topAlert.text }}
      </div>
    </div>

    <!-- 右側操作 -->
    <div class="right-group">
      <button class="icon-btn" @click="handleUndo" title="Undo" :disabled="!circuitStore.canUndo"
        :class="{ disabled: !circuitStore.canUndo }">
        <Undo2 :size="20" />
      </button>
      <button class="icon-btn" @click="handleRedo" title="Redo" :disabled="!circuitStore.canRedo"
        :class="{ disabled: !circuitStore.canRedo }">
        <Redo2 :size="20" />
      </button>
      <button class="icon-btn" @click="handleFullScreen" title="Full Screen">
        <Scan :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 var(--spacing-md);
  background-color: #222222;
  /* 配合圖片的深灰色 */
  border-top: 1px solid #333;
}

.left-group,
.center-group,
.right-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.center-group {
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.simulation-error {
  max-width: 100%;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-accent-red);
  background-color: var(--color-bg-secondary);
  color: var(--color-accent-red);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.simulation-warning {
  max-width: 100%;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid #ffb300;
  background-color: var(--color-bg-secondary);
  color: #ffb300;
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  border: none;
  color: #888888;
  /* 圖片中的灰色圖示 */
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.icon-btn:active {
  transform: scale(0.95);
}

.icon-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.icon-btn.active {
  color: #ffcc00;
  background-color: rgba(255, 204, 0, 0.15);
}

.icon-btn.active:hover {
  background-color: rgba(255, 204, 0, 0.25);
  color: #ffeb3b;
}
</style>
