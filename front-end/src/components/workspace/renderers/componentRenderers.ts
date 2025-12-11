/**
 * componentRenderers.ts
 * 電路元件繪製函數集合
 * 負責將不同類型的電路元件繪製成 Konva 圖形
 */

import Konva from 'konva';
import type { CircuitComponent } from '@/types/circuit';

/**
 * 繪製電阻符號
 */
export function drawResistor(group: Konva.Group, component: CircuitComponent) {
    // 如果選取，添加高亮背景
    if (component.selected) {
        const highlight = new Konva.Rect({
            x: -35,
            y: -15,
            width: 70,
            height: 30,
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4caf50',
            strokeWidth: 2,
            cornerRadius: 4,
            shadowColor: '#4caf50',
            shadowBlur: 10,
            shadowOpacity: 0.5,
        });
        group.add(highlight);
    }

    // 電阻本體 (鋸齒形狀)
    const zigzag = new Konva.Line({
        points: [-30, 0, -20, 0, -15, -8, -5, 8, 5, -8, 15, 8, 20, 0, 30, 0],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
        lineCap: 'round',
        lineJoin: 'round',
    });
    group.add(zigzag);

    // 端點
    const port1 = new Konva.Circle({
        x: -30,
        y: 0,
        radius: 4,
        fill: '#4caf50',
        stroke: '#4caf50',
        strokeWidth: 1,
        name: 'port',
    });
    const port2 = new Konva.Circle({
        x: 30,
        y: 0,
        radius: 4,
        fill: '#4caf50',
        stroke: '#4caf50',
        strokeWidth: 1,
        name: 'port',
    });
    group.add(port1, port2);

    // 標籤
    const label = new Konva.Text({
        x: -15,
        y: -25,
        text: `${component.label}\n${component.value}${component.unit}`,
        fontSize: 10,
        fill: '#888888',
        align: 'center',
    });
    group.add(label);
}

/**
 * 繪製電容符號
 */
export function drawCapacitor(group: Konva.Group, component: CircuitComponent) {
    // 如果選取，添加高亮背景
    if (component.selected) {
        const highlight = new Konva.Rect({
            x: -35,
            y: -20,
            width: 70,
            height: 40,
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4caf50',
            strokeWidth: 2,
            cornerRadius: 4,
            shadowColor: '#4caf50',
            shadowBlur: 10,
            shadowOpacity: 0.5,
        });
        group.add(highlight);
    }

    // 左側連線
    const line1 = new Konva.Line({
        points: [-30, 0, -5, 0],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
    });
    // 左極板
    const plate1 = new Konva.Line({
        points: [-5, -12, -5, 12],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
    });
    // 右極板
    const plate2 = new Konva.Line({
        points: [5, -12, 5, 12],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
    });
    // 右側連線
    const line2 = new Konva.Line({
        points: [5, 0, 30, 0],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
    });

    group.add(line1, plate1, plate2, line2);

    // 端點
    const port1 = new Konva.Circle({
        x: -30,
        y: 0,
        radius: 4,
        fill: '#ffeb3b',
        name: 'port',
    });
    const port2 = new Konva.Circle({
        x: 30,
        y: 0,
        radius: 4,
        fill: '#ffeb3b',
        name: 'port',
    });
    group.add(port1, port2);

    // 標籤
    const label = new Konva.Text({
        x: -15,
        y: -30,
        text: `${component.label}\n${component.value}${component.unit}`,
        fontSize: 10,
        fill: '#888888',
        align: 'center',
    });
    group.add(label);
}

/**
 * 繪製接地符號
 */
export function drawGround(group: Konva.Group, _component: CircuitComponent) {
    // 垂直線
    const line = new Konva.Line({
        points: [0, -15, 0, 0],
        stroke: '#888888',
        strokeWidth: 2,
    });
    // 接地橫線
    const line1 = new Konva.Line({
        points: [-12, 0, 12, 0],
        stroke: '#888888',
        strokeWidth: 2,
    });
    const line2 = new Konva.Line({
        points: [-8, 5, 8, 5],
        stroke: '#888888',
        strokeWidth: 2,
    });
    const line3 = new Konva.Line({
        points: [-4, 10, 4, 10],
        stroke: '#888888',
        strokeWidth: 2,
    });

    group.add(line, line1, line2, line3);

    // 端點
    const port = new Konva.Circle({
        x: 0,
        y: -15,
        radius: 4,
        fill: '#888888',
        name: 'port',
    });
    group.add(port);
}

/**
 * 繪製 DC 電源
 */
export function drawDCSource(group: Konva.Group, component: CircuitComponent) {
    // 如果選取，添加高亮背景
    if (component.selected) {
        const highlight = new Konva.Circle({
            x: 0,
            y: 0,
            radius: 40,
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4caf50',
            strokeWidth: 2,
            shadowColor: '#4caf50',
            shadowBlur: 10,
            shadowOpacity: 0.5,
        });
        group.add(highlight);
    }

    // 圓形
    const circle = new Konva.Circle({
        x: 0,
        y: 0,
        radius: 18,
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
        fill: 'transparent',
    });

    // + 符號
    const plus1 = new Konva.Line({
        points: [0, -12, 0, -4],
        stroke: '#ff5722',
        strokeWidth: 2,
    });
    const plus2 = new Konva.Line({
        points: [-4, -8, 4, -8],
        stroke: '#ff5722',
        strokeWidth: 2,
    });

    // - 符號
    const minus = new Konva.Line({
        points: [-4, 8, 4, 8],
        stroke: '#2196f3',
        strokeWidth: 2,
    });

    // 連接線
    const topLine = new Konva.Line({
        points: [0, -30, 0, -18],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: 2,
    });
    const bottomLine = new Konva.Line({
        points: [0, 18, 0, 30],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: 2,
    });

    group.add(circle, plus1, plus2, minus, topLine, bottomLine);

    // 端點
    const portPlus = new Konva.Circle({
        x: 0,
        y: -30,
        radius: 4,
        fill: '#ff5722',
        name: 'port',
    });
    const portMinus = new Konva.Circle({
        x: 0,
        y: 30,
        radius: 4,
        fill: '#2196f3',
        name: 'port',
    });
    group.add(portPlus, portMinus);

    // 標籤
    const label = new Konva.Text({
        x: 25,
        y: -8,
        text: `${component.value}${component.unit}`,
        fontSize: 11,
        fill: '#ffeb3b',
    });
    group.add(label);
}

/**
 * 繪製 AC 電源
 */
export function drawACSource(group: Konva.Group, component: CircuitComponent) {
    // 如果選取，添加高亮背景
    if (component.selected) {
        const highlight = new Konva.Circle({
            x: 0,
            y: 0,
            radius: 40,
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4caf50',
            strokeWidth: 2,
            shadowColor: '#4caf50',
            shadowBlur: 10,
            shadowOpacity: 0.5,
        });
        group.add(highlight);
    }

    // 圓形
    const circle = new Konva.Circle({
        x: 0,
        y: 0,
        radius: 18,
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: component.selected ? 3 : 2,
        fill: 'transparent',
    });

    // 正弦波符號
    const sine = new Konva.Line({
        points: [-10, 0, -5, -6, 0, 0, 5, 6, 10, 0],
        stroke: '#ab47bc',
        strokeWidth: 2,
        tension: 0.5,
    });

    // 連接線
    const topLine = new Konva.Line({
        points: [0, -30, 0, -18],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: 2,
    });
    const bottomLine = new Konva.Line({
        points: [0, 18, 0, 30],
        stroke: component.selected ? '#4caf50' : '#cccccc',
        strokeWidth: 2,
    });

    group.add(circle, sine, topLine, bottomLine);

    // 端點
    const portPlus = new Konva.Circle({
        x: 0,
        y: -30,
        radius: 4,
        fill: '#ab47bc',
        name: 'port',
    });
    const portMinus = new Konva.Circle({
        x: 0,
        y: 30,
        radius: 4,
        fill: '#ab47bc',
        name: 'port',
    });
    group.add(portPlus, portMinus);

    // 標籤
    const label = new Konva.Text({
        x: 25,
        y: -8,
        text: `${component.value}${component.unit}`,
        fontSize: 11,
        fill: '#ffeb3b',
    });
    group.add(label);
}

/**
 * 繪製通用元件
 */
export function drawGenericComponent(group: Konva.Group, component: CircuitComponent) {
    // 如果選取，添加高亮背景
    if (component.selected) {
        const highlight = new Konva.Rect({
            x: -35,
            y: -20,
            width: 70,
            height: 40,
            fill: 'rgba(76, 175, 80, 0.1)',
            stroke: '#4caf50',
            strokeWidth: 2,
            cornerRadius: 4,
            shadowColor: '#4caf50',
            shadowBlur: 10,
            shadowOpacity: 0.5,
        });
        group.add(highlight);
    }

    const rect = new Konva.Rect({
        x: -30,
        y: -15,
        width: 60,
        height: 30,
        stroke: component.selected ? '#4caf50' : '#666666',
        strokeWidth: component.selected ? 3 : 2,
        fill: 'transparent',
        cornerRadius: 4,
    });

    const text = new Konva.Text({
        x: -20,
        y: -6,
        text: component.type.substring(0, 3).toUpperCase(),
        fontSize: 12,
        fill: '#888888',
    });

    group.add(rect, text);

    // 通用端點
    const port1 = new Konva.Circle({
        x: -30,
        y: 0,
        radius: 4,
        fill: '#4caf50',
        name: 'port',
    });
    const port2 = new Konva.Circle({
        x: 30,
        y: 0,
        radius: 4,
        fill: '#4caf50',
        name: 'port',
    });
    group.add(port1, port2);
}

/**
 * 根據元件類型繪製對應的圖形
 */
export function drawComponentShape(group: Konva.Group, component: CircuitComponent) {
    switch (component.type) {
        case 'resistor':
            drawResistor(group, component);
            break;
        case 'capacitor':
            drawCapacitor(group, component);
            break;
        case 'ground':
            drawGround(group, component);
            break;
        case 'dc_source':
            drawDCSource(group, component);
            break;
        case 'ac_source':
            drawACSource(group, component);
            break;
        default:
            drawGenericComponent(group, component);
    }
}
