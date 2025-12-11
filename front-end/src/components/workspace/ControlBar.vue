<script setup lang="ts">
/**
 * ControlBar - 底部工具列
 * 包含編輯工具與視圖控制
 */

import { useCircuitStore } from '@/stores/circuitStore';
import { Eye, Scissors, Undo2, Redo2, Scan, Zap } from 'lucide-vue-next';

const circuitStore = useCircuitStore();

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

function handleFitToScreen() {
  // TODO: Implement fit to screen logic in canvas
  console.log('Fit to screen');
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
      <button 
        class="icon-btn" 
        :class="{ active: circuitStore.isCurrentAnimating }"
        title="Toggle Current Flow Animation"
        @click="handleToggleCurrentAnimation"
      >
        <Zap :size="20" />
      </button>
    </div>

    <!-- 右側操作 -->
    <div class="right-group">
      <button 
        class="icon-btn" 
        @click="handleUndo" 
        title="Undo"
        :disabled="!circuitStore.canUndo"
        :class="{ disabled: !circuitStore.canUndo }"
      >
        <Undo2 :size="20" />
      </button>
      <button 
        class="icon-btn" 
        @click="handleRedo" 
        title="Redo"
        :disabled="!circuitStore.canRedo"
        :class="{ disabled: !circuitStore.canRedo }"
      >
        <Redo2 :size="20" />
      </button>
      <button class="icon-btn" @click="handleFitToScreen" title="Fit to Screen">
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
  background-color: #222222; /* 配合圖片的深灰色 */
  border-top: 1px solid #333;
}

.left-group, .right-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
  color: #888888; /* 圖片中的灰色圖示 */
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
