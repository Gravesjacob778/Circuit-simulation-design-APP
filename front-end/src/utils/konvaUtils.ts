/**
 * konvaUtils.ts
 * Konva.js 圖層繪製工具
 *
 * 這些函數只依賴 Konva 與傳入參數，不依賴 Vue 狀態。
 */

import Konva from 'konva';
import type { PortInfo } from './WiringStateManager';
import { calculateOrthogonalPath } from '@/lib/geometryUtils';

/**
 * 繪製對齊輔助線
 */
export function drawGuides(
  guideLayer: Konva.Layer | null,
  stage: Konva.Stage | null,
  x: number,
  y: number,
  gridSize: number
): void {
  if (!guideLayer || !stage) return;
  guideLayer.destroyChildren();

  const width = stage.width();
  const height = stage.height();

  const hGuide = new Konva.Rect({
    x: 0,
    y: y - gridSize / 2,
    width,
    height: gridSize,
    fill: '#ffffff',
    opacity: 0.1,
    listening: false,
  });

  const vGuide = new Konva.Rect({
    x: x - gridSize / 2,
    y: 0,
    width: gridSize,
    height,
    fill: '#ffffff',
    opacity: 0.1,
    listening: false,
  });

  guideLayer.add(hGuide, vGuide);
  guideLayer.batchDraw();
}

/**
 * 清除輔助線
 */
export function clearGuides(guideLayer: Konva.Layer | null): void {
  if (!guideLayer) return;
  guideLayer.destroyChildren();
  guideLayer.batchDraw();
}

/**
 * 繪製網格
 */
export function drawGrid(
  gridLayer: Konva.Layer | null,
  width: number,
  height: number,
  gridSize: number,
  showGrid: boolean
): void {
  if (!gridLayer) return;
  gridLayer.destroyChildren();

  if (showGrid) {
    for (let x = 0; x <= width; x += gridSize) {
      gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, height],
          stroke: '#333333',
          strokeWidth: 0.5,
          listening: false,
        })
      );
    }

    for (let y = 0; y <= height; y += gridSize) {
      gridLayer.add(
        new Konva.Line({
          points: [0, y, width, y],
          stroke: '#333333',
          strokeWidth: 0.5,
          listening: false,
        })
      );
    }
  }

  gridLayer.batchDraw();
}

/**
 * 繪製臨時接線預覽
 */
export function drawWiringPreview(
  tempLayer: Konva.Layer | null,
  startPort: PortInfo | null,
  targetX: number,
  targetY: number,
  gridSize: number
): void {
  if (!tempLayer || !startPort) return;
  tempLayer.destroyChildren();

  const points = calculateOrthogonalPath(
    startPort.x,
    startPort.y,
    targetX,
    targetY,
    gridSize
  );

  tempLayer.add(
    new Konva.Line({
      points,
      stroke: '#ffeb3b',
      strokeWidth: 2,
      dash: [6, 4],
      opacity: 0.8,
    })
  );

  tempLayer.add(
    new Konva.Circle({
      x: startPort.x,
      y: startPort.y,
      radius: 6,
      fill: '#ffeb3b',
    })
  );

  tempLayer.batchDraw();
}

/**
 * 清除臨時層
 */
export function clearTempLayer(tempLayer: Konva.Layer | null): void {
  if (!tempLayer) return;
  tempLayer.destroyChildren();
  tempLayer.batchDraw();
}

