/**
 * Circuit Store - 電路狀態管理 (Pinia)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type {
    CircuitComponent,
    Wire,
    NetNode,
    Netlist,
    ComponentType,
    Port,
    SimulationData,
} from '@/types/circuit';
import { getComponentDefinition } from '@/config/componentDefinitions';

export const useCircuitStore = defineStore('circuit', () => {
    // ===== State =====
    const components = ref<CircuitComponent[]>([]);
    const wires = ref<Wire[]>([]);
    const nodes = ref<NetNode[]>([]);
    const selectedComponentId = ref<string | null>(null);
    const selectedWireId = ref<string | null>(null);
    const simulationData = ref<SimulationData | null>(null);
    const isSimulating = ref(false);

    // Undo/Redo History
    // 使用 JSON 字串儲存快照，避免物件參考問題
    const history = ref<string[]>([]);
    const historyIndex = ref(-1);

    // ===== Getters =====
    const netlist = computed<Netlist>(() => ({
        components: components.value,
        wires: wires.value,
        nodes: nodes.value,
    }));

    const selectedComponent = computed(() =>
        components.value.find((c) => c.id === selectedComponentId.value) || null
    );

    const componentCount = computed(() => components.value.length);

    const canUndo = computed(() => historyIndex.value > 0);
    const canRedo = computed(() => historyIndex.value < history.value.length - 1);

    // ===== Actions =====

    /**
     * 儲存當前狀態到歷史紀錄
     * 應在執行會改變狀態的動作 *之前* 或 *之後* 呼叫
     * 這裡我們採用：在動作發生「後」儲存新狀態，初始狀態為空或預設
     */
    function saveState() {
        // 如果目前不是在最新的位置，先切除後面的紀錄 (開創新分支)
        if (historyIndex.value < history.value.length - 1) {
            history.value = history.value.slice(0, historyIndex.value + 1);
        }

        const snapshot = JSON.stringify({
            components: components.value,
            wires: wires.value,
        });

        // 避免重複儲存相同的狀態
        if (history.value.length > 0 && history.value[history.value.length - 1] === snapshot) {
            return;
        }

        history.value.push(snapshot);
        historyIndex.value = history.value.length - 1;

        // 限制歷史長度 (例如 50 步)
        if (history.value.length > 50) {
            history.value.shift();
            historyIndex.value--;
        }
    }

    /**
     * 初始化狀態 (App 啟動時呼叫)
     */
    function initState() {
        if (history.value.length === 0) {
            saveState();
        }
    }

    /**
     * 復原 (Undo)
     */
    function undo() {
        if (historyIndex.value > 0) {
            historyIndex.value--;
            const snapshot = JSON.parse(history.value[historyIndex.value]!);
            components.value = snapshot.components;
            wires.value = snapshot.wires;

            // 清除選取，避免 ID 不存在
            selectedComponentId.value = null;
            selectedWireId.value = null;
        }
    }

    /**
     * 重做 (Redo)
     */
    function redo() {
        if (historyIndex.value < history.value.length - 1) {
            historyIndex.value++;
            const snapshot = JSON.parse(history.value[historyIndex.value]!);
            components.value = snapshot.components;
            wires.value = snapshot.wires;

            selectedComponentId.value = null;
            selectedWireId.value = null;
        }
    }

    /**
     * 新增元件到畫布
     */
    function addComponent(
        type: ComponentType,
        x: number,
        y: number,
        value?: number
    ): CircuitComponent {
        const definition = getComponentDefinition(type);
        const componentNumber = components.value.filter((c) => c.type === type).length + 1;

        // 定義需要垂直放置的元件類型（原本是水平的）
        const horizontalComponents: ComponentType[] = [
            'resistor',
            'capacitor',
            'inductor',
            'diode',
            'led',
            'switch',
            'ammeter',
            'voltmeter',
        ];

        // 如果是水平元件，初始旋轉 90 度使其垂直
        const initialRotation = horizontalComponents.includes(type) ? 90 : 0;

        const newComponent: CircuitComponent = {
            id: uuidv4(),
            type,
            x,
            y,
            rotation: initialRotation,
            value: value ?? definition?.defaultValue,
            unit: definition?.defaultUnit,
            label: `${type.charAt(0).toUpperCase()}${componentNumber}`,
            ports: (definition?.ports || []).map((p, index) => ({
                ...p,
                id: `${uuidv4()}-p${index}`,
            })),
            selected: false,
        };

        components.value.push(newComponent);
        saveState(); // 記錄操作
        return newComponent;
    }

    /**
     * 移除元件
     */
    function removeComponent(componentId: string): void {
        // 同時移除相關的導線
        wires.value = wires.value.filter(
            (w) => w.fromComponentId !== componentId && w.toComponentId !== componentId
        );
        components.value = components.value.filter((c) => c.id !== componentId);

        if (selectedComponentId.value === componentId) {
            selectedComponentId.value = null;
        }
        saveState(); // 記錄操作
    }

    /**
     * 更新元件位置
     */
    function updateComponentPosition(componentId: string, x: number, y: number): void {
        const component = components.value.find((c) => c.id === componentId);
        if (component) {
            // 只有當位置真正改變時才更新並儲存
            if (component.x !== x || component.y !== y) {
                component.x = x;
                component.y = y;
                saveState(); // 記錄操作
            }
        }
    }

    /**
     * 更新元件屬性
     */
    function updateComponentProperty(
        componentId: string,
        property: keyof CircuitComponent,
        value: unknown
    ): void {
        const component = components.value.find((c) => c.id === componentId);
        if (component) {
            (component as Record<string, unknown>)[property] = value;
            saveState(); // 記錄操作
        }
    }

    /**
     * 旋轉元件
     */
    function rotateComponent(componentId: string): void {
        const component = components.value.find((c) => c.id === componentId);
        if (component) {
            component.rotation = (component.rotation + 90) % 360;
            saveState(); // 記錄操作
        }
    }

    /**
     * 選取元件
     */
    function selectComponent(componentId: string | null): void {
        // 取消之前的選取
        components.value.forEach((c) => (c.selected = false));
        selectedWireId.value = null;

        if (componentId) {
            const component = components.value.find((c) => c.id === componentId);
            if (component) {
                component.selected = true;
            }
        }
        selectedComponentId.value = componentId;
        // 選取不改變電路結構，不需要 saveState
    }

    /**
     * 新增導線
     */
    function addWire(
        fromComponentId: string,
        fromPortId: string,
        toComponentId: string,
        toPortId: string,
        points: { x: number; y: number }[] = []
    ): Wire {
        const newWire: Wire = {
            id: uuidv4(),
            fromComponentId,
            fromPortId,
            toComponentId,
            toPortId,
            points,
        };

        wires.value.push(newWire);
        saveState(); // 記錄操作
        return newWire;
    }

    /**
     * 移除導線
     */
    function removeWire(wireId: string): void {
        wires.value = wires.value.filter((w) => w.id !== wireId);
        if (selectedWireId.value === wireId) {
            selectedWireId.value = null;
        }
        saveState(); // 記錄操作
    }

    /**
     * 選取導線
     */
    function selectWire(wireId: string | null): void {
        selectedComponentId.value = null;
        components.value.forEach((c) => (c.selected = false));
        selectedWireId.value = wireId;
    }

    /**
     * 清空畫布
     */
    function clearCanvas(): void {
        components.value = [];
        wires.value = [];
        nodes.value = [];
        selectedComponentId.value = null;
        selectedWireId.value = null;
        simulationData.value = null;
        saveState(); // 記錄操作
    }

    /**
     * 載入網表
     */
    function loadNetlist(netlistData: Netlist): void {
        components.value = netlistData.components;
        wires.value = netlistData.wires;
        nodes.value = netlistData.nodes;
        selectedComponentId.value = null;
        selectedWireId.value = null;
        simulationData.value = null;

        // 載入新專案時，重置歷史紀錄
        history.value = [];
        historyIndex.value = -1;
        saveState();
    }

    /**
     * 設定模擬資料
     */
    function setSimulationData(data: SimulationData | null): void {
        simulationData.value = data;
    }

    /**
     * 設定模擬狀態
     */
    function setSimulating(value: boolean): void {
        isSimulating.value = value;
    }

    // 初始化第一筆紀錄
    initState();

    return {
        // State
        components,
        wires,
        nodes,
        selectedComponentId,
        selectedWireId,
        simulationData,
        isSimulating,
        canUndo,
        canRedo,
        // Getters
        netlist,
        selectedComponent,
        componentCount,
        // Actions
        addComponent,
        removeComponent,
        updateComponentPosition,
        updateComponentProperty,
        rotateComponent,
        selectComponent,
        addWire,
        removeWire,
        selectWire,
        clearCanvas,
        loadNetlist,
        setSimulationData,
        setSimulating,
        undo,
        redo,
    };
});
