/**
 * UI Store - 介面狀態管理 (Pinia)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ComponentType } from '@/types/circuit';

export type ToolMode = 'select' | 'wire' | 'pan' | 'zoom';

export const useUIStore = defineStore('ui', () => {
    // ===== State =====

    // 當前工具模式
    const currentTool = ref<ToolMode>('select');

    // 當前拖曳中的元件類型
    const draggingComponentType = ref<ComponentType | null>(null);

    // 畫布縮放與平移
    const canvasScale = ref(1);
    const canvasOffsetX = ref(0);
    const canvasOffsetY = ref(0);

    // 網格設定
    const gridSize = ref(20);
    const snapToGrid = ref(true);
    const showGrid = ref(true);

    // 側邊欄狀態
    const leftSidebarOpen = ref(true);
    const rightSidebarOpen = ref(true);

    // 模擬圖表可見性
    const showSimulationGraph = ref(true);

    // 正在繪製導線
    const isDrawingWire = ref(false);
    const wireStartPoint = ref<{ componentId: string; portId: string } | null>(null);

    // ===== Getters =====

    const canvasTransform = computed(() => ({
        scale: canvasScale.value,
        offsetX: canvasOffsetX.value,
        offsetY: canvasOffsetY.value,
    }));

    // ===== Actions =====

    function setTool(tool: ToolMode): void {
        currentTool.value = tool;
        // 切換工具時重置導線繪製狀態
        if (tool !== 'wire') {
            isDrawingWire.value = false;
            wireStartPoint.value = null;
        }
    }

    function setDraggingComponent(type: ComponentType | null): void {
        draggingComponentType.value = type;
    }

    function setCanvasScale(scale: number): void {
        // 限制縮放範圍
        canvasScale.value = Math.max(0.25, Math.min(4, scale));
    }

    function zoomIn(): void {
        setCanvasScale(canvasScale.value * 1.2);
    }

    function zoomOut(): void {
        setCanvasScale(canvasScale.value / 1.2);
    }

    function resetZoom(): void {
        canvasScale.value = 1;
        canvasOffsetX.value = 0;
        canvasOffsetY.value = 0;
    }

    function panCanvas(deltaX: number, deltaY: number): void {
        canvasOffsetX.value += deltaX;
        canvasOffsetY.value += deltaY;
    }

    function toggleLeftSidebar(): void {
        leftSidebarOpen.value = !leftSidebarOpen.value;
    }

    function toggleRightSidebar(): void {
        rightSidebarOpen.value = !rightSidebarOpen.value;
    }

    function toggleSimulationGraph(): void {
        showSimulationGraph.value = !showSimulationGraph.value;
    }

    function toggleSnapToGrid(): void {
        snapToGrid.value = !snapToGrid.value;
    }

    function toggleShowGrid(): void {
        showGrid.value = !showGrid.value;
    }

    function startWireDrawing(componentId: string, portId: string): void {
        isDrawingWire.value = true;
        wireStartPoint.value = { componentId, portId };
    }

    function endWireDrawing(): void {
        isDrawingWire.value = false;
        wireStartPoint.value = null;
    }

    /**
     * 將座標吸附到網格
     */
    function snapPosition(x: number, y: number): { x: number; y: number } {
        if (!snapToGrid.value) {
            return { x, y };
        }
        return {
            x: Math.round(x / gridSize.value) * gridSize.value,
            y: Math.round(y / gridSize.value) * gridSize.value,
        };
    }

    return {
        // State
        currentTool,
        draggingComponentType,
        canvasScale,
        canvasOffsetX,
        canvasOffsetY,
        gridSize,
        snapToGrid,
        showGrid,
        leftSidebarOpen,
        rightSidebarOpen,
        showSimulationGraph,
        isDrawingWire,
        wireStartPoint,
        // Getters
        canvasTransform,
        // Actions
        setTool,
        setDraggingComponent,
        setCanvasScale,
        zoomIn,
        zoomOut,
        resetZoom,
        panCanvas,
        toggleLeftSidebar,
        toggleRightSidebar,
        toggleSimulationGraph,
        toggleSnapToGrid,
        toggleShowGrid,
        startWireDrawing,
        endWireDrawing,
        snapPosition,
    };
});
