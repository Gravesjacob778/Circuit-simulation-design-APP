/**
 * Component Definitions - 電路元件定義
 */

import type { ComponentDefinition, ComponentType, WaveformType } from '@/types/circuit';

// AC 源預設屬性
export const AC_SOURCE_DEFAULTS = {
    frequency: 60, // Hz
    phase: 0, // radians
    waveformType: 'sine' as WaveformType,
};

export const componentDefinitions: ComponentDefinition[] = [
    // 電源
    {
        type: 'dc_source',
        label: 'DC Source',
        icon: 'dc-source',
        defaultValue: 5,
        defaultUnit: 'V',
        ports: [
            { name: '+', offsetX: 0, offsetY: -40 },
            { name: '-', offsetX: 0, offsetY: 40 },
        ],
    },
    {
        type: 'ac_source',
        label: 'AC Source',
        icon: 'ac-source',
        defaultValue: 5,
        defaultUnit: 'V',
        ports: [
            { name: '+', offsetX: 0, offsetY: -40 },
            { name: '-', offsetX: 0, offsetY: 40 },
        ],
    },
    // 被動元件
    {
        type: 'resistor',
        label: 'Resistor',
        icon: 'resistor',
        defaultValue: 1000,
        defaultUnit: 'Ω',
        ports: [
            { name: '1', offsetX: -40, offsetY: 0 },
            { name: '2', offsetX: 40, offsetY: 0 },
        ],
    },
    {
        type: 'capacitor',
        label: 'Capacitor',
        icon: 'capacitor',
        defaultValue: 100,
        defaultUnit: 'μF',
        ports: [
            { name: '+', offsetX: -40, offsetY: 0 },
            { name: '-', offsetX: 40, offsetY: 0 },
        ],
    },
    {
        type: 'inductor',
        label: 'Inductor',
        icon: 'inductor',
        defaultValue: 10,
        defaultUnit: 'mH',
        ports: [
            { name: '1', offsetX: -40, offsetY: 0 },
            { name: '2', offsetX: 40, offsetY: 0 },
        ],
    },
    // 接地
    {
        type: 'ground',
        label: 'Ground',
        icon: 'ground',
        ports: [{ name: 'gnd', offsetX: 0, offsetY: -15 }],
    },
    // 主動元件
    {
        type: 'opamp',
        label: 'Op-Amp',
        icon: 'opamp',
        ports: [
            { name: '+', offsetX: -40, offsetY: -15 },
            { name: '-', offsetX: -40, offsetY: 15 },
            { name: 'out', offsetX: 40, offsetY: 0 },
            { name: 'V+', offsetX: 0, offsetY: -25 },
            { name: 'V-', offsetX: 0, offsetY: 25 },
        ],
    },
    {
        type: 'diode',
        label: 'Diode',
        icon: 'diode',
        ports: [
            { name: 'anode', offsetX: -40, offsetY: 0 },
            { name: 'cathode', offsetX: 40, offsetY: 0 },
        ],
    },
    {
        type: 'led',
        label: 'LED',
        icon: 'led',
        ports: [
            { name: 'anode', offsetX: -40, offsetY: 0 },
            { name: 'cathode', offsetX: 40, offsetY: 0 },
        ],
    },
    {
        type: 'transistor_npn',
        label: 'NPN Transistor',
        icon: 'npn',
        ports: [
            { name: 'base', offsetX: -25, offsetY: 0 },
            { name: 'collector', offsetX: 15, offsetY: -20 },
            { name: 'emitter', offsetX: 15, offsetY: 20 },
        ],
    },
    {
        type: 'transistor_pnp',
        label: 'PNP Transistor',
        icon: 'pnp',
        ports: [
            { name: 'base', offsetX: -25, offsetY: 0 },
            { name: 'collector', offsetX: 15, offsetY: 20 },
            { name: 'emitter', offsetX: 15, offsetY: -20 },
        ],
    },
    // 開關
    {
        type: 'switch',
        label: 'Switch',
        icon: 'switch',
        ports: [
            { name: '1', offsetX: -40, offsetY: 0 },
            { name: '2', offsetX: 40, offsetY: 0 },
        ],
    },
    // 測量儀器
    {
        type: 'ammeter',
        label: 'Ammeter',
        icon: 'ammeter',
        ports: [
            { name: '+', offsetX: -40, offsetY: 0 },
            { name: '-', offsetX: 40, offsetY: 0 },
        ],
    },
    {
        type: 'voltmeter',
        label: 'Voltmeter',
        icon: 'voltmeter',
        ports: [
            { name: '+', offsetX: -40, offsetY: 0 },
            { name: '-', offsetX: 40, offsetY: 0 },
        ],
    },
    // 數位邏輯閘
    {
        type: 'logic_and',
        label: 'AND Gate',
        icon: 'and-gate',
        ports: [
            { name: 'A', offsetX: -40, offsetY: -10 },
            { name: 'B', offsetX: -40, offsetY: 10 },
            { name: 'Y', offsetX: 40, offsetY: 0 },
        ],
    },
    {
        type: 'logic_or',
        label: 'OR Gate',
        icon: 'or-gate',
        ports: [
            { name: 'A', offsetX: -40, offsetY: -10 },
            { name: 'B', offsetX: -40, offsetY: 10 },
            { name: 'Y', offsetX: 40, offsetY: 0 },
        ],
    },
];

/**
 * 依類型取得元件定義
 */
export function getComponentDefinition(type: ComponentType): ComponentDefinition | undefined {
    return componentDefinitions.find((def) => def.type === type);
}

/**
 * 取得工具列用的元件分類
 */
export function getToolbarComponents(): ComponentDefinition[] {
    // 工具列顯示順序
    const toolbarOrder: ComponentType[] = [
        'dc_source',
        'ac_source',
        'resistor',
        'capacitor',
        'inductor',
        'ground',
        'opamp',
        'diode',
        'led',
        'transistor_npn',
        'transistor_pnp',
        'switch',
        'ammeter',
        'voltmeter',
        'logic_and',
        'logic_or',
    ];

    return toolbarOrder
        .map((type) => componentDefinitions.find((def) => def.type === type))
        .filter((def): def is ComponentDefinition => def !== undefined);
}
