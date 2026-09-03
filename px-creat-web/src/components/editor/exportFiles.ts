/**
 * 导出三件套的浏览器侧支撑（Blob 下载锚点 / canvas 落 PNG 属 DOM 运行时，不进 lib）：
 *
 * - 文件名清洗：Windows 非法字符 `[\\/:*?"<>|]` → `_`，中文文件名直接随 Blob 落盘；
 * - `downloadBlob`：a[download] 触发保存，URL 用后即回收；
 * - `drawPatternSheetToCanvas` / `sheetPngBlob`：patternSheet 绘制指令 →
 *   （离屏）canvas → PNG，无 2D 上下文环境（jsdom / SSR）安全降级。
 */

import { loadPalette } from '@/lib/palettes';
import {
  computeBom,
  computeSheetLayout,
  renderPatternSheet,
  type PatternSheetOptions,
  type RenderPatternArgs,
} from '@/lib/patternSheet';
import type { BrandKey } from '@/lib/types';

/** 清洗作品标题为安全文件名（非法字符 → `_`；全空白回退默认名）。 */
export function sanitizeFilename(name: string, fallback = '未命名作品'): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned === '' ? fallback : cleaned;
}

/** Blob 下载（Blob URL + a[download]，中文文件名不经 URL 编码）。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 按版式把图纸渲染到给定 canvas（先计算布局定尺寸，再下发绘制指令）。
 *
 * @returns 无 2D 上下文环境（jsdom / SSR）返回 false，调用方据此降级提示
 */
export function drawPatternSheetToCanvas(
  canvas: HTMLCanvasElement,
  args: RenderPatternArgs,
  options: Readonly<PatternSheetOptions>,
): boolean {
  const bomCount = computeBom(args.cells, args.w, args.h, args.palette).length;
  const layout = computeSheetLayout(args.w, args.h, bomCount, options);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  renderPatternSheet(ctx, args, options);
  return true;
}

/**
 * 渲染完整图纸并编码为 PNG Blob（导出主路径；绘制为指令式同步执行，
 * 104×104 目标 <100ms 量级，实测见 patternSheet.perf.test.ts）。
 *
 * @returns 无 2D 上下文 / toBlob 不可用环境返回 null
 */
export async function sheetPngBlob(
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  brandKey: BrandKey,
  options: Readonly<PatternSheetOptions>,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (!drawPatternSheetToCanvas(canvas, { cells, w, h, palette: loadPalette(brandKey) }, options)) {
    return null;
  }
  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
