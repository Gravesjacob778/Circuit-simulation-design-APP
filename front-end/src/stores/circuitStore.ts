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
    SimulationData,
} from '@/types/circuit';
import { getComponentDefinition, AC_SOURCE_DEFAULTS } from '@/config/componentDefinitions';
import {
    evaluateCircuitDesignRules,
    runDCAnalysis,
    runTransientAnalysis,
    runACSweepAnalysis,
    DigitalLogicSimulator,
    LogicLevel,
    type CircuitRuleViolation,
    type DCSimulationResult,
    type TransientSimulationResult,
    type TransientOptions,
    type ACSweepResult,
    type ACSweepOptions,
    type DigitalSimulationResult,
} from '@/lib/simulation';
import type { AnalysisMode } from '@/types/frequencyAnalysis';

// ===== Utility Functions =====

/**
 * 防抖函數 - 用於即時更新時避免過度觸發模擬
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
}

export const useCircuitStore = defineStore('circuit', () => {
    // ===== State =====
    const components = ref<CircuitComponent[]>([]);
    const wires = ref<Wire[]>([]);
    const nodes = ref<NetNode[]>([]);
    const selectedComponentId = ref<string | null>(null);
    const selectedWireId = ref<string | null>(null);
    const simulationData = ref<SimulationData | null>(null);
    const isSimulating = ref(false);
    const isCurrentAnimating = ref(false); // 電流流動動畫狀態
    const dcResult = ref<DCSimulationResult | null>(null); // DC 模擬結果
    const transientResult = ref<TransientSimulationResult | null>(null); // 瞬態模擬結果
    const acSweepResult = ref<ACSweepResult | null>(null); // AC 掃頻結果
    const simulationError = ref<string | null>(null); // 模擬錯誤訊息
    const ruleViolations = ref<CircuitRuleViolation[]>([]); // CDRS v1 規則檢查結果
    const analysisMode = ref<AnalysisMode>('time'); // 分析模式：時域 or 頻域
    const acSweepOptions = ref<Partial<ACSweepOptions>>({
        startFrequency: 1,
        endFrequency: 1e6,
        pointsPerDecade: 10,
        sweepType: 'logarithmic',
    });

    // 數位邏輯模擬器和結果
    const digitalSimulator = new DigitalLogicSimulator();
    const digitalResult = ref<DigitalSimulationResult | null>(null);

    // 追蹤電壓變化事件（用於波形累積模式）
    const lastValueChange = ref<{
        componentId: string;
        timestamp: number;
    } | null>(null);

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
            // AC 源預設屬性
            ...(type === 'ac_source' && {
                frequency: AC_SOURCE_DEFAULTS.frequency,
                phase: AC_SOURCE_DEFAULTS.phase,
                waveformType: AC_SOURCE_DEFAULTS.waveformType,
            }),
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
     * 判斷電路是否需要瞬態分析（含有 AC 源）
     */
    function needsTransientAnalysis(): boolean {
        return components.value.some(c => c.type === 'ac_source');
    }

    /**
     * 防抖模擬觸發器 - 當電壓值變化時自動重新模擬
     * 使用 150ms 防抖避免快速輸入時過度計算
     */
    const triggerDebouncedSimulation = debounce(() => {
        if (isCurrentAnimating.value) {
            if (needsTransientAnalysis()) {
                runTransientSimulation();
            } else {
                runSimulation();
            }
        }
    }, 150);

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

            // 需要觸發重新模擬的屬性
            const simulationTriggerProps = ['value', 'frequency', 'phase', 'waveformType'];
            
            // 當這些屬性變化且動畫啟用時，自動重新模擬
            if (simulationTriggerProps.includes(property) && isCurrentAnimating.value) {
                lastValueChange.value = {
                    componentId,
                    timestamp: Date.now(),
                };
                triggerDebouncedSimulation();
            }
        }
    }

    /**
     * 旋轉元件
     */
    function rotateComponent(componentId: string, angle: number = 90): void {
        const component = components.value.find((c) => c.id === componentId);
        if (component) {
            let newRotation = (component.rotation + angle) % 360;
            // Handle negative rotation
            if (newRotation < 0) {
                newRotation += 360;
            }
            component.rotation = newRotation;
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

    /**
     * 停止模擬動畫（僅停止電流流動動畫；保留模擬結果/圖表/錯誤提示）
     */
    function stopSimulation(): void {
        isCurrentAnimating.value = false;
        isSimulating.value = false;
    }

    /**
     * 切換電流動畫並執行模擬
     * 自動判斷：有 AC 源時執行瞬態分析，否則執行 DC 分析
     */
    function toggleCurrentAnimation(): void {
        isCurrentAnimating.value = !isCurrentAnimating.value;

        if (isCurrentAnimating.value) {
            let ok: boolean;
            if (needsTransientAnalysis()) {
                // 有 AC 源，執行瞬態分析
                ok = runTransientSimulation();
            } else {
                // 純 DC 電路，執行 DC 分析
                ok = runSimulation();
            }
            if (!ok) {
                // 若模擬失敗，避免顯示「正在動畫」的錯覺
                isCurrentAnimating.value = false;
            }
        } else {
            stopSimulation();
        }
    }

    /**
     * 執行 DC 穩態模擬
     */
    function runSimulation(): boolean {
        isSimulating.value = true;
        simulationError.value = null;
        ruleViolations.value = evaluateCircuitDesignRules(components.value, wires.value);

        const blockingErrors = ruleViolations.value.filter((v) => v.severity === 'ERROR');
        if (blockingErrors.length > 0) {
            dcResult.value = null;
            simulationData.value = null;
            simulationError.value = blockingErrors[0]?.message ?? 'Circuit rule violation (ERROR)';
            isSimulating.value = false;
            return false;
        }

        try {
            const result = runDCAnalysis(components.value, wires.value);
            dcResult.value = result;

            if (result.success) {
                // 更新 simulationData 用於圖表顯示
                updateSimulationData(result);
                console.log('DC 模擬成功', result);
                return true;
            } else {
                simulationError.value = result.error || '未知錯誤';
                simulationData.value = null;
                console.warn('DC 模擬失敗:', result.error);
                return false;
            }
        } catch (error) {
            simulationError.value = error instanceof Error ? error.message : '模擬執行錯誤';
            simulationData.value = null;
            console.error('DC 模擬錯誤:', error);
            return false;
        } finally {
            isSimulating.value = false;
        }
    }

    /**
     * 更新模擬數據（用於圖表顯示）
     */
    function updateSimulationData(result: DCSimulationResult): void {
        const signals: SimulationData['signals'] = [];

        // 為每個元件建立電流訊號
        result.branchCurrents.forEach((current, componentId) => {
            const comp = components.value.find(c => c.id === componentId);
            if (comp) {
                signals.push({
                    name: `I(${comp.label || comp.type})`,
                    values: [current * 1000], // 轉換為 mA
                    unit: 'mA',
                    color: getSignalColor(signals.length),
                });
            }
        });

        // DC 分析只有單一時間點
        simulationData.value = {
            time: [0],
            signals,
        };
    }

    /**
     * 執行瞬態分析 (AC 時域模擬)
     * @param options 可選的瞬態分析選項
     * @returns 是否成功
     */
    function runTransientSimulation(options?: Partial<TransientOptions>): boolean {
        isSimulating.value = true;
        simulationError.value = null;
        ruleViolations.value = evaluateCircuitDesignRules(components.value, wires.value);

        const blockingErrors = ruleViolations.value.filter((v) => v.severity === 'ERROR');
        if (blockingErrors.length > 0) {
            transientResult.value = null;
            simulationError.value = blockingErrors[0]?.message ?? 'Circuit rule violation (ERROR)';
            isSimulating.value = false;
            return false;
        }

        try {
            const result = runTransientAnalysis(components.value, wires.value, options);
            transientResult.value = result;

            if (result.success) {
                // 更新 simulationData 用於波形顯示
                updateTransientSimulationData(result);
                console.log('瞬態模擬成功', result);
                return true;
            } else {
                simulationError.value = result.error || '未知錯誤';
                console.warn('瞬態模擬失敗:', result.error);
                return false;
            }
        } catch (error) {
            simulationError.value = error instanceof Error ? error.message : '模擬執行錯誤';
            console.error('瞬態模擬錯誤:', error);
            return false;
        } finally {
            isSimulating.value = false;
        }
    }

    /**
     * 更新瞬態模擬數據（用於波形顯示）
     */
    function updateTransientSimulationData(result: TransientSimulationResult): void {
        const signals: SimulationData['signals'] = [];

        // 為 AC 源建立電壓波形
        result.branchCurrentHistory.forEach((currents, componentId) => {
            const comp = components.value.find(c => c.id === componentId);
            if (comp && comp.type === 'ac_source') {
                // AC 源顯示電壓波形 (從節點電壓歷史取得)
                // 這裡我們可以用電流反推或直接用節點電壓
                signals.push({
                    name: `I(${comp.label || 'AC'})`,
                    values: currents.map(i => i * 1000), // mA
                    unit: 'mA',
                    color: getSignalColor(signals.length),
                });
            }
        });

        // 為其他元件建立電流波形
        result.branchCurrentHistory.forEach((currents, componentId) => {
            const comp = components.value.find(c => c.id === componentId);
            if (comp && comp.type !== 'ac_source' && comp.type !== 'dc_source' && comp.type !== 'ground') {
                signals.push({
                    name: `I(${comp.label || comp.type})`,
                    values: currents.map(i => i * 1000), // mA
                    unit: 'mA',
                    color: getSignalColor(signals.length),
                });
            }
        });

        simulationData.value = {
            time: result.timePoints,
            signals,
        };
    }

    /**
     * 取得訊號顏色
     */
    function getSignalColor(index: number): string {
        const colors = ['#42a5f5', '#66bb6a', '#ffa726', '#ef5350', '#ab47bc'];
        return colors[index % colors.length]!;
    }

    /**
     * 取得元件的電流值 (mA)
     */
    function getComponentCurrent(componentId: string): number | null {
        if (!dcResult.value?.success) return null;
        const current = dcResult.value.branchCurrents.get(componentId);
        return current !== undefined ? current * 1000 : null; // mA
    }

    /**
     * 取得元件兩端的電壓差 (V)
     */
    function getComponentVoltage(componentId: string): number | null {
        if (!dcResult.value?.success) return null;
        const comp = components.value.find(c => c.id === componentId);
        if (!comp || comp.ports.length < 2) return null;

        // 從節點電壓計算差值
        // 需要更複雜的邏輯來追蹤節點對應關係
        // 目前簡化：使用歐姆定律 V = I * R
        const current = dcResult.value.branchCurrents.get(componentId);
        if (current !== undefined && comp.value) {
            return current * comp.value;
        }
        return null;
    }

    /**
     * 執行 AC 掃頻分析
     * @param options 可選的掃頻選項
     * @returns 是否成功
     */
    function runACSweep(options?: Partial<ACSweepOptions>): boolean {
        isSimulating.value = true;
        simulationError.value = null;
        ruleViolations.value = evaluateCircuitDesignRules(components.value, wires.value);

        const blockingErrors = ruleViolations.value.filter((v) => v.severity === 'ERROR');
        if (blockingErrors.length > 0) {
            acSweepResult.value = null;
            simulationError.value = blockingErrors[0]?.message ?? 'Circuit rule violation (ERROR)';
            isSimulating.value = false;
            return false;
        }

        try {
            const sweepOpts = { ...acSweepOptions.value, ...options };
            const result = runACSweepAnalysis(components.value, wires.value, sweepOpts);
            acSweepResult.value = result;

            if (result.success) {
                console.log('AC 掃頻分析成功', result);
                return true;
            } else {
                simulationError.value = result.error || '未知錯誤';
                console.warn('AC 掃頻分析失敗:', result.error);
                return false;
            }
        } catch (error) {
            simulationError.value = error instanceof Error ? error.message : '模擬執行錯誤';
            console.error('AC 掃頻分析錯誤:', error);
            return false;
        } finally {
            isSimulating.value = false;
        }
    }

    /**
     * 設定分析模式
     */
    function setAnalysisMode(mode: AnalysisMode) {
        analysisMode.value = mode;
    }

    /**
     * 更新 AC 掃頻選項
     */
    function updateACSweepOptions(options: Partial<ACSweepOptions>) {
        acSweepOptions.value = { ...acSweepOptions.value, ...options };
    }

    // ========== 數位邏輯模擬功能 ==========

    /**
     * 判斷電路是否包含邏輯閘
     */
    function hasLogicGates(): boolean {
        return components.value.some(c => DigitalLogicSimulator.isLogicGate(c.type));
    }

    /**
     * 執行數位邏輯模擬
     * 計算所有邏輯閘的輸出狀態並更新元件屬性
     */
    function runDigitalSimulation(): boolean {
        if (!hasLogicGates()) {
            digitalResult.value = null;
            return true; // 沒有邏輯閘，視為成功（無需模擬）
        }

        try {
            const result = digitalSimulator.simulate(components.value);
            digitalResult.value = result;

            if (result.success) {
                // 將模擬結果更新到元件的 logicOutput 屬性
                result.gateStates.forEach((state, componentId) => {
                    const comp = components.value.find(c => c.id === componentId);
                    if (comp) {
                        comp.logicOutput = state.output === LogicLevel.HIGH;
                    }
                });
                console.log('數位邏輯模擬成功', result);
                return true;
            } else {
                simulationError.value = result.error || '數位邏輯模擬失敗';
                return false;
            }
        } catch (error) {
            simulationError.value = error instanceof Error ? error.message : '數位邏輯模擬錯誤';
            console.error('數位邏輯模擬錯誤:', error);
            return false;
        }
    }

    /**
     * 設定邏輯閘的輸入值
     * @param componentId 邏輯閘元件 ID
     * @param inputName 輸入名稱 ('A' 或 'B')
     * @param value 邏輯值 (true = HIGH, false = LOW)
     */
    function setLogicInput(componentId: string, inputName: 'A' | 'B', value: boolean): void {
        const comp = components.value.find(c => c.id === componentId);
        if (comp && DigitalLogicSimulator.isLogicGate(comp.type)) {
            if (inputName === 'A') {
                comp.logicInputA = value;
            } else {
                comp.logicInputB = value;
            }
            // 自動重新計算輸出
            runDigitalSimulation();
            saveState();
        }
    }

    /**
     * 切換邏輯閘的輸入值
     * @param componentId 邏輯閘元件 ID
     * @param inputName 輸入名稱 ('A' 或 'B')
     */
    function toggleLogicInput(componentId: string, inputName: 'A' | 'B'): void {
        const comp = components.value.find(c => c.id === componentId);
        if (comp && DigitalLogicSimulator.isLogicGate(comp.type)) {
            if (inputName === 'A') {
                comp.logicInputA = !(comp.logicInputA ?? false);
            } else {
                comp.logicInputB = !(comp.logicInputB ?? false);
            }
            // 自動重新計算輸出
            runDigitalSimulation();
            saveState();
        }
    }

    /**
     * 取得邏輯閘的完整狀態
     */
    function getLogicGateState(componentId: string) {
        return digitalResult.value?.gateStates.get(componentId) ?? null;
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
        isCurrentAnimating,
        dcResult,
        transientResult,
        acSweepResult,
        digitalResult,
        simulationError,
        ruleViolations,
        analysisMode,
        acSweepOptions,
        canUndo,
        canRedo,
        lastValueChange, // 電壓變化追蹤（用於波形累積模式）
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
        stopSimulation,
        toggleCurrentAnimation,
        runSimulation,
        runTransientSimulation,
        runACSweep,
        setAnalysisMode,
        updateACSweepOptions,
        getComponentCurrent,
        getComponentVoltage,
        undo,
        redo,
        // Digital Logic
        hasLogicGates,
        runDigitalSimulation,
        setLogicInput,
        toggleLogicInput,
        getLogicGateState,
    };
});
