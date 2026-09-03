/**
 * 烫染渲染的 UI 层支撑（非 hook、无 React）：色板数据构建、缩略图降采样、
 * 预览降级口径、RGBA → dataURL、Worker 执行器注入。
 *
 * 纯计算与 DOM 守卫集中在这一处，供 useFinishPreview / useFinishThumbnails /
 * useFinishCover 与面板共用；管线本体在 lib/finish（Worker 执行）。
 */

import { runFinishInWorker } from '@/lib/finishClient';
import type { FinishInput, FinishOutput, FinishPaletteData } from '@/lib/finish';
import { loadPalette } from '@/lib/palettes';
import { computeSheetLayout, DEFAULT_SHEET_OPTIONS, renderPatternSheet } from '@/lib/patternSheet';
import type { BrandKey } from '@/lib/types';

/** Worker 执行器（注入点；默认浏览器 Worker，测试/降级环境注入假实现）。 */
export type FinishRunner = (input: FinishInput) => Promise<FinishOutput>;

/** 默认执行器：无 Worker 运行时（测试/降级环境）返回可判别错误而非崩溃。 */
export const defaultFinishRunner: FinishRunner = (input) => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new Error('当前环境不支持烫染渲染线程'));
  }
  return runFinishInWorker(
    input.cells,
    input.w,
    input.h,
    input.paletteData,
    input.preset,
    input.intensity,
    input.pxPerCell,
  );
};

/** 画布预览的基准每格像素。 */
export const PREVIEW_PX_PER_CELL = 8;
/** 预览降级（>100×100 或低端设备）后的每格像素。 */
export const PREVIEW_PX_PER_CELL_LOW = 4;

/** 预览降级判定：网格 >100×100 或设备并发核 ≤4 时减半渲染再放大。 */
export function previewPxPerCell(w: number, h: number): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 8) : 8;
  return w > 100 || h > 100 || cores <= 4 ? PREVIEW_PX_PER_CELL_LOW : PREVIEW_PX_PER_CELL;
}

/** 效果封面的每格像素（全分辨率；仅受 2048px 输出上限约束，导出不受预览降级影响）。 */
export function coverPxPerCell(w: number, h: number): number {
  return Math.max(4, Math.min(12, Math.floor(2048 / Math.max(1, w, h))));
}

/** 构建管线所需的色板渲染数据（品牌切换时重建）。 */
export function buildFinishPaletteData(brandKey: BrandKey): FinishPaletteData {
  const palette = loadPalette(brandKey);
  const rgbs: number[] = [];
  const lum: number[] = [];
  for (const c of palette.colors) {
    rgbs.push(c.rgb.r, c.rgb.g, c.rgb.b);
    lum.push(0.299 * c.rgb.r + 0.587 * c.rgb.g + 0.114 * c.rgb.b);
  }
  return { rgbs, lum };
}

/** 最近邻降采样（缩略图快照：maxSide 以内，保持长宽比）。 */
export function downsampleCells(
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  maxSide: number,
): { cells: Int16Array; w: number; h: number } {
  const step = Math.max(1, Math.ceil(Math.max(w, h) / maxSide));
  const sw = Math.max(1, Math.floor(w / step));
  const sh = Math.max(1, Math.floor(h / step));
  const out = new Int16Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    const sy = Math.min(h - 1, y * step);
    for (let x = 0; x < sw; x++) {
      out[y * sw + x] = cells[sy * w + Math.min(w - 1, x * step)];
    }
  }
  return { cells: out, w: sw, h: sh };
}

/** RGBA → PNG dataURL（无 2D 上下文环境返回 null）。 */
export function rgbaToDataUrl(rgba: Uint8ClampedArray, w: number, h: number): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
  return canvas.toDataURL('image/png');
}

/** 平面图纸 PNG dataURL（封面降级路径；无 2D 上下文环境返回 null）。 */
export function flatPatternDataUrl(
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  brandKey: BrandKey,
): string | null {
  if (typeof document === 'undefined') return null;
  const options = {
    ...DEFAULT_SHEET_OPTIONS,
    layout: 'pattern_only' as const,
    title: '',
    cellPx: Math.min(24, Math.max(8, Math.floor(2048 / Math.max(1, w, h)))),
  };
  const layout = computeSheetLayout(w, h, 0, options);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  renderPatternSheet(ctx, { cells, w, h, palette: loadPalette(brandKey) }, options);
  return canvas.toDataURL('image/png');
}

/** 空闲调度（requestIdleCallback 优先，无支持退化为 setTimeout；返回不透明句柄）。 */
export function scheduleIdle(cb: () => void): unknown {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(() => cb());
  return window.setTimeout(cb, 0);
}

export function cancelIdle(id: unknown): void {
  if (typeof id !== 'number') return;
  if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
  else window.clearTimeout(id);
}

/** 缩略图指纹（品牌 + cellsVersion；两者任一变化即过期重算）。 */
export function thumbVersion(brandKey: BrandKey, cellsVersion: number): string {
  return `${brandKey}:${cellsVersion}`;
}
