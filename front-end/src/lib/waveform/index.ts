/**
 * Waveform Module - 波形檢視器模組匯出
 * 
 * 此模組提供：
 * - WaveformViewer: 純展示元件
 * - useWaveformStore: 波形資料管理
 * - 相關類型定義
 */

// 類型匯出
export type {
    WaveformUnit,
    WaveformDataPoint,
    WaveformTrace,
    WaveformCursor,
    WaveformMeasurement,
    TimeAxisConfig,
    YAxisConfig,
    ViewportState,
    WaveformViewerState,
    WaveformViewerEvents,
} from '@/types/waveform';

// 常數與工具函式匯出
export {
    UNIT_CONFIGS,
    interpolateValue,
    calculateStats,
    formatValue,
    formatTime,
} from '@/types/waveform';

// Composable 匯出
export { useWaveformViewer } from '@/composables/useWaveformViewer';

// Store 匯出
export { useWaveformStore } from '@/stores/waveformStore';
export type { Probe } from '@/stores/waveformStore';
