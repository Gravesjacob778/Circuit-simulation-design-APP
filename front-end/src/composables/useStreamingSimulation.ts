/**
 * useStreamingSimulation.ts - 串流模擬動畫控制
 *
 * 負責：
 * - 管理 StreamingTransientSolver 的生命週期
 * - 使用 requestAnimationFrame 驅動動畫迴圈
 * - 處理時間縮放（讓高頻訊號可視化）
 * - 將模擬結果推送到 waveformStore
 */

import { ref, computed, onUnmounted } from 'vue';
import { StreamingTransientSolver, type StreamingPoint } from '@/lib/simulation/StreamingTransientSolver';
import { useWaveformStore } from '@/stores/waveformStore';
import type { CircuitComponent, Wire } from '@/types/circuit';
import type { WaveformUnit, WaveformDataPoint } from '@/types/waveform';

/**
 * 串流模擬選項
 */
export interface StreamingSimulationOptions {
  /** 時間縮放因子（模擬時間 / 顯示時間） */
  timeScale?: number;
  /** 目標幀率 (預設: 60) */
  targetFps?: number;
  /** 每幀模擬步數 (預設: 自動計算) */
  stepsPerFrame?: number;
  /** 最大保留點數 (預設: 7200) */
  maxPoints?: number;
}

/**
 * 探針配置
 */
export interface ProbeConfig {
  /** 元件 ID */
  componentId: string;
  /** 顯示標籤 */
  label: string;
  /** 測量單位 */
  unit: WaveformUnit;
  /** 顏色 (可選) */
  color?: string;
  /** 測量類型: 'current' | 'voltage' */
  measureType: 'current' | 'voltage';
}

/**
 * 自動計算時間縮放
 * 目標：在視窗內顯示約 4 個週期
 * @param frequency 訊號頻率 (Hz)
 * @param windowSec 顯示視窗寬度 (秒)
 */
export function autoTimeScale(frequency: number, windowSec: number = 10): number {
  const period = 1 / frequency;
  const targetCycles = 4;
  const visibleSimTime = targetCycles * period;
  return visibleSimTime / windowSec;
}

/**
 * 串流模擬 Composable
 */
export function useStreamingSimulation() {
  // ========== 狀態 ==========

  const isRunning = ref(false);
  const isPaused = ref(false);
  const currentSimTime = ref(0);
  const currentDisplayTime = ref(0);
  const timeScale = ref(1);
  const fps = ref(0);
  const error = ref<string | null>(null);

  // ========== 內部變數 ==========

  let solver: StreamingTransientSolver | null = null;
  let animationFrameId: number | null = null;
  let lastFrameTime = 0;
  let frameCount = 0;
  let fpsUpdateTime = 0;
  let probeIds: Map<string, string> = new Map(); // componentId -> probeId

  const waveformStore = useWaveformStore();

  // ========== 計算屬性 ==========

  /** 模擬是否已啟動 */
  const isActive = computed(() => isRunning.value || isPaused.value);

  /** 格式化的模擬時間 */
  const formattedSimTime = computed(() => formatTime(currentSimTime.value));

  /** 格式化的顯示時間 */
  const formattedDisplayTime = computed(() => formatTime(currentDisplayTime.value));

  // ========== 方法 ==========

  /**
   * 啟動串流模擬
   */
  function start(
    components: CircuitComponent[],
    wires: Wire[],
    probes: ProbeConfig[],
    options: StreamingSimulationOptions = {}
  ): boolean {
    // 停止現有模擬
    stop();

    // 初始化求解器
    solver = new StreamingTransientSolver();
    const initResult = solver.initialize(components, wires, {
      timeStep: options.timeScale ? undefined : undefined,
    });

    if (!initResult.success) {
      error.value = initResult.error ?? '初始化失敗';
      return false;
    }

    // 設定時間縮放
    if (options.timeScale !== undefined) {
      timeScale.value = options.timeScale;
    } else {
      // 自動計算時間縮放
      timeScale.value = autoTimeScale(initResult.maxFrequency);
    }

    // 清除舊的波形資料
    waveformStore.clearAll();
    probeIds.clear();

    // 建立探針
    for (const probeConfig of probes) {
      const probe = waveformStore.addProbe({
        componentId: probeConfig.componentId,
        channelId: probeConfig.measureType,
        unit: probeConfig.unit,
        label: probeConfig.label,
        color: probeConfig.color,
      });
      probeIds.set(probeConfig.componentId, probe.probeId);
    }

    // 重置狀態
    error.value = null;
    currentSimTime.value = 0;
    currentDisplayTime.value = 0;
    fps.value = 0;
    frameCount = 0;
    fpsUpdateTime = performance.now();
    lastFrameTime = 0;
    isRunning.value = true;
    isPaused.value = false;

    // 啟動動畫迴圈
    animationFrameId = requestAnimationFrame(animationLoop);

    return true;
  }

  /**
   * 暫停模擬
   */
  function pause(): void {
    if (!isRunning.value) return;

    isRunning.value = false;
    isPaused.value = true;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * 恢復模擬
   */
  function resume(): void {
    if (!isPaused.value || !solver) return;

    isPaused.value = false;
    isRunning.value = true;
    lastFrameTime = 0; // 重置，避免跳幀

    animationFrameId = requestAnimationFrame(animationLoop);
  }

  /**
   * 停止模擬並重置
   */
  function stop(): void {
    isRunning.value = false;
    isPaused.value = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (solver) {
      solver.dispose();
      solver = null;
    }

    currentSimTime.value = 0;
    currentDisplayTime.value = 0;
    fps.value = 0;
    error.value = null;
  }

  /**
   * 重置模擬到初始狀態 (t=0)，但保持運行
   */
  function reset(): void {
    if (!solver) return;

    solver.reset();
    currentSimTime.value = 0;
    currentDisplayTime.value = 0;

    // 清除波形資料但保留探針定義
    for (const probeId of probeIds.values()) {
      waveformStore.updateProbeData(probeId, []);
    }
  }

  /**
   * 設定時間縮放
   */
  function setTimeScale(scale: number): void {
    if (scale > 0) {
      timeScale.value = scale;
    }
  }

  /**
   * 單步執行（用於調試或手動控制）
   */
  function stepOnce(): StreamingPoint[] | null {
    if (!solver) return null;

    const points = solver.stepBatch(1);
    if (points.length > 0) {
      currentSimTime.value = solver.getCurrentTime();
      pushPointsToStore(points);
    }
    return points;
  }

  // ========== 內部函數 ==========

  /**
   * 動畫迴圈
   */
  function animationLoop(timestamp: number): void {
    if (!isRunning.value || !solver) return;

    // 計算幀間隔
    const deltaMs = lastFrameTime ? timestamp - lastFrameTime : 16.67;
    lastFrameTime = timestamp;

    // 更新 FPS 計算
    frameCount++;
    if (timestamp - fpsUpdateTime >= 1000) {
      fps.value = Math.round(frameCount * 1000 / (timestamp - fpsUpdateTime));
      frameCount = 0;
      fpsUpdateTime = timestamp;
    }

    // 計算這一幀需要推進的模擬時間
    const displayTimeToAdvance = deltaMs / 1000; // 真實經過的時間（秒）
    const simTimeToAdvance = displayTimeToAdvance * timeScale.value; // 模擬時間（秒）

    // 計算需要多少個模擬步驟
    const dt = solver.getTimeStep();
    if (dt <= 0) {
      error.value = '無效的時間步長';
      stop();
      return;
    }

    const stepsNeeded = Math.max(1, Math.ceil(simTimeToAdvance / dt));

    // 限制每幀最大步數，避免阻塞
    const maxStepsPerFrame = 100;
    const actualSteps = Math.min(stepsNeeded, maxStepsPerFrame);

    // 執行模擬步驟
    const points = solver.stepBatch(actualSteps);

    if (points.length > 0) {
      // 更新時間
      currentSimTime.value = solver.getCurrentTime();
      currentDisplayTime.value += displayTimeToAdvance;

      // 推送資料到 store
      pushPointsToStore(points);
    }

    // 繼續下一幀
    animationFrameId = requestAnimationFrame(animationLoop);
  }

  /**
   * 將模擬點推送到 waveformStore
   */
  function pushPointsToStore(points: StreamingPoint[]): void {
    // 對每個 probe 收集資料點
    const dataByProbe = new Map<string, WaveformDataPoint[]>();

    for (const point of points) {
      // 處理電流探針
      for (const [componentId, current] of point.branchCurrents) {
        const probeId = probeIds.get(componentId);
        if (probeId) {
          if (!dataByProbe.has(probeId)) {
            dataByProbe.set(probeId, []);
          }
          // 使用顯示時間而非模擬時間
          const displayTime = point.time / timeScale.value;
          dataByProbe.get(probeId)!.push({
            time: displayTime,
            value: current,
          });
        }
      }
    }

    // 批次追加資料
    for (const [probeId, newPoints] of dataByProbe) {
      waveformStore.appendProbeData(probeId, newPoints, {
        maxPoints: 7200, // 約 2 分鐘 @ 60fps
      });
    }
  }

  // ========== 生命週期 ==========

  onUnmounted(() => {
    stop();
  });

  // ========== 返回 ==========

  return {
    // 狀態
    isRunning,
    isPaused,
    isActive,
    currentSimTime,
    currentDisplayTime,
    timeScale,
    fps,
    error,
    formattedSimTime,
    formattedDisplayTime,

    // 方法
    start,
    pause,
    resume,
    stop,
    reset,
    setTimeScale,
    stepOnce,
  };
}

// ========== 工具函數 ==========

/**
 * 格式化時間顯示
 */
function formatTime(seconds: number): string {
  if (seconds < 1e-6) {
    return `${(seconds * 1e9).toFixed(2)} ns`;
  } else if (seconds < 1e-3) {
    return `${(seconds * 1e6).toFixed(2)} µs`;
  } else if (seconds < 1) {
    return `${(seconds * 1e3).toFixed(2)} ms`;
  } else {
    return `${seconds.toFixed(3)} s`;
  }
}

/**
 * 格式化時間縮放顯示
 */
export function formatTimeScale(scale: number): string {
  if (scale >= 1) {
    return `${scale.toFixed(0)}x`;
  } else if (scale >= 0.001) {
    return `${(1 / scale).toFixed(0)}x slower`;
  } else {
    return `${(1 / scale).toExponential(1)}x slower`;
  }
}
