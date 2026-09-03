import { describe, expect, it } from 'vitest';

import { loadPalette } from './palettes';
import {
  DEFAULT_SHEET_OPTIONS,
  computeBom,
  computeSheetLayout,
  renderPatternSheet,
  type Canvas2DLike,
} from './patternSheet';

/** 55×63 的两色网格：右半与底部交叉处为空格。 */
const W = 55;
const H = 63;
function makeCells(): number[] {
  const cells: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= 48 && y >= 60) cells.push(-1);
      else cells.push(x < 27 ? 0 : 5);
    }
  }
  return cells;
}

/** 记录绘制指令的 mock 上下文。 */
class MockCanvas implements Canvas2DLike {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';
  rects: Array<{ op: 'fill' | 'stroke'; x: number; y: number; w: number; h: number; style: string }> = [];
  texts: Array<{ text: string; x: number; y: number; font: string }> = [];

  fillRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ op: 'fill', x, y, w, h, style: this.fillStyle });
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ op: 'stroke', x, y, w, h, style: this.strokeStyle });
  }

  fillText(text: string, x: number, y: number): void {
    this.texts.push({ text, x, y, font: this.font });
  }

  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }
}

describe('computeBom', () => {
  it('统计颗数与空格数对齐，按颗数降序', () => {
    const palette = loadPalette('mard');
    const cells = makeCells();
    const bom = computeBom(cells, W, H, palette);
    const nonEmpty = cells.filter((c) => c >= 0).length;
    expect(bom.reduce((s, r) => s + r.count, 0)).toBe(nonEmpty);
    expect(bom).toHaveLength(2);
    // index 5（x≥27 侧，28 列减角部空格）用量高于 index 0（27 列），降序在前
    expect(bom[0].code).toBe(palette.colors[5].code);
    expect(bom[0].count).toBe(28 * 63 - 7 * 3);
    expect(bom[1].code).toBe(palette.colors[0].code);
    expect(bom[1].count).toBe(27 * 63);
    expect(bom[0].brand).toBe('mard');
    expect(bom[0].rgb).toEqual(palette.colors[5].rgb);
  });

  it('全空格图纸 BOM 为空', () => {
    expect(computeBom(new Array(25).fill(-1), 5, 5, loadPalette('hama'))).toHaveLength(0);
  });

  it('cells 长度不足抛错', () => {
    expect(() => computeBom([0, 0], 5, 5, loadPalette('hama'))).toThrow();
  });
});

describe('computeSheetLayout', () => {
  it('sheet 版式：标题区 + 图案区 + 图例区，刻度每 5 格', () => {
    const layout = computeSheetLayout(W, H, 10, { ...DEFAULT_SHEET_OPTIONS, title: '测试图纸' });
    expect(layout.header).not.toBeNull();
    expect(layout.legend).not.toBeNull();
    // 55 列 → 刻度在 4,9,...,54 之外：x < 55 → 4,9,...,54 → 共 11 个？4+5k < 55 → k ≤ 10 → 11 个？4+50=54 → 11 个
    expect(layout.xTicks).toEqual([4, 9, 14, 19, 24, 29, 34, 39, 44, 49, 54]);
    expect(layout.yTicks).toHaveLength(12); // 63 行 → 4,9,...,59
    expect(layout.grid.w).toBe(W * layout.cellPx);
    expect(layout.grid.h).toBe(H * layout.cellPx);
    expect(layout.height).toBeGreaterThan(layout.grid.h);
    expect(layout.width).toBeGreaterThan(layout.grid.w);
  });

  it('pattern_only 版式：无标题、无图例、无刻度数字依赖', () => {
    const layout = computeSheetLayout(W, H, 10, { ...DEFAULT_SHEET_OPTIONS, layout: 'pattern_only' });
    expect(layout.header).toBeNull();
    expect(layout.legend).toBeNull();
    expect(layout.width).toBe(W * layout.cellPx + 72); // PADDING×2
    expect(layout.height).toBe(H * layout.cellPx + 72);
  });

  it('自动 cellPx 不超过 sheetMaxWidth', () => {
    const layout = computeSheetLayout(104, 104, 30, { ...DEFAULT_SHEET_OPTIONS, sheetMaxWidth: 1500 });
    expect(104 * layout.cellPx + 72).toBeLessThanOrEqual(1500);
    const wide = computeSheetLayout(104, 104, 30, { ...DEFAULT_SHEET_OPTIONS, sheetMaxWidth: 4000 });
    expect(wide.cellPx).toBeGreaterThan(layout.cellPx);
  });

  it('图例多列排布：行数按列数收敛', () => {
    const single = computeSheetLayout(29, 29, 6, { ...DEFAULT_SHEET_OPTIONS });
    if (single.legend === null) throw new Error('legend 不应为 null');
    expect(single.legend.columns).toBeGreaterThanOrEqual(1);
    expect(Math.ceil(6 / single.legend.columns)).toBeGreaterThanOrEqual(1);
  });
});

describe('renderPatternSheet（mock canvas 指令）', () => {
  const palette = loadPalette('mard');

  it('完整版式：网格、刻度数字、图例色块与颗数文本', () => {
    const cells = makeCells();
    const ctx = new MockCanvas();
    const layout = renderPatternSheet(ctx, { cells, w: W, h: H, palette }, { ...DEFAULT_SHEET_OPTIONS, title: '星之卡比', author: '拼豆娘' });
    // 标题与副题（署名出现）
    expect(ctx.texts.some((t) => t.text === '星之卡比')).toBe(true);
    expect(ctx.texts.some((t) => t.text.includes('拼豆娘'))).toBe(true);
    // 刻度数字（5,10,...）
    expect(ctx.texts.some((t) => t.text === '5')).toBe(true);
    expect(ctx.texts.some((t) => t.text === '55')).toBe(true);
    // 图例文本：色号 × 颗数（副题 "55×63" 无空格，不会命中）
    const legendTexts = ctx.texts.filter((t) => t.text.includes(' × '));
    expect(legendTexts).toHaveLength(2);
    expect(legendTexts.some((t) => t.text.startsWith(palette.colors[0].code))).toBe(true);
    // 格子色块以对应 css 颜色填充
    const color0Style = `rgb(${palette.colors[0].rgb.r},${palette.colors[0].rgb.g},${palette.colors[0].rgb.b})`;
    expect(ctx.rects.some((r) => r.op === 'fill' && r.style === color0Style && r.w === layout.cellPx)).toBe(true);
    // 外边框描边
    expect(ctx.rects.some((r) => r.op === 'stroke' && r.w === layout.grid.w && r.h === layout.grid.h)).toBe(true);
  });

  it('cellLabels 开关：开启时绘制色号文本', () => {
    const cells = [0, -1, 5, 5];
    const off = new MockCanvas();
    renderPatternSheet(off, { cells, w: 2, h: 2, palette }, { ...DEFAULT_SHEET_OPTIONS, cellPx: 24 });
    expect(off.texts.some((t) => t.text === palette.colors[0].code)).toBe(false);

    const on = new MockCanvas();
    renderPatternSheet(on, { cells, w: 2, h: 2, palette }, { ...DEFAULT_SHEET_OPTIONS, cellPx: 24, cellLabels: true });
    expect(on.texts.filter((t) => t.text === palette.colors[0].code).length).toBe(1);
  });

  it('pattern_only：无标题、无图例文本', () => {
    const ctx = new MockCanvas();
    renderPatternSheet(ctx, { cells: makeCells(), w: W, h: H, palette }, { ...DEFAULT_SHEET_OPTIONS, layout: 'pattern_only', title: '不该出现' });
    expect(ctx.texts.some((t) => t.text === '不该出现')).toBe(false);
    expect(ctx.texts.some((t) => t.text.includes('×'))).toBe(false);
  });
});
