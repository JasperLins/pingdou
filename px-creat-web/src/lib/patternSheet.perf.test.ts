import { describe, expect, it } from 'vitest';

import { loadPalette } from './palettes';
import {
  DEFAULT_SHEET_OPTIONS,
  computeBom,
  computeSheetLayout,
  renderPatternSheet,
  type Canvas2DLike,
} from './patternSheet';

/**
 * 104×104 图纸渲染指令路径性能冒烟（M5 design.md §2：同步绘制可接受，
 * 目标 <100ms 量级；若 >50ms 评估分片）。数字打到 stdout 供实测记录；
 * 浏览器端真实 canvas 光栅化帧预算留人工验收（主会话三件套下载走查）。
 */

const W = 104;
const H = 104;
const COLORS = 40;

function randomField(seed: number): Int16Array {
  let s = seed;
  const rand = (): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const cells = new Int16Array(W * H);
  for (let i = 0; i < cells.length; i++) {
    cells[i] = rand() < 0.12 ? -1 : Math.floor(rand() * COLORS);
  }
  return cells;
}

/** 只记指令数不落像素的接收端（测量绘制调度开销的下界）。 */
class CountingCanvas implements Canvas2DLike {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';
  fills = 0;
  strokes = 0;
  texts = 0;

  fillRect(): void {
    this.fills++;
  }

  strokeRect(): void {
    this.strokes++;
  }

  fillText(): void {
    this.texts++;
  }

  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }
}

function time<T>(label: string, budgetMs: number, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  console.log(`[perf] ${label}: ${ms.toFixed(1)}ms（预算 ≤${budgetMs}ms）`);
  expect(ms, `${label} 超出 ${budgetMs}ms 预算`).toBeLessThan(budgetMs);
  return result;
}

describe('patternSheet 104×104 性能冒烟', () => {
  const field = randomField(20260904);
  const palette = loadPalette('mard');

  it('computeBom / 版式布局 ≤50ms', () => {
    const bom = time('computeBom(104×104, 40 色)', 50, () => computeBom(field, W, H, palette));
    expect(bom).toHaveLength(COLORS);
    const layout = time('computeSheetLayout(sheet)', 50, () => computeSheetLayout(W, H, bom.length, DEFAULT_SHEET_OPTIONS));
    expect(layout.width).toBeGreaterThan(0);
  });

  it('完整版式绘制指令（含网格线 / 刻度 / 40 色图例）≤100ms', () => {
    const ctx = new CountingCanvas();
    const layout = time('renderPatternSheet(sheet)', 100, () =>
      renderPatternSheet(ctx, { cells: field, w: W, h: H, palette }, { ...DEFAULT_SHEET_OPTIONS, title: '性能冒烟' }),
    );
    // 非空格数：色块 fill 至少覆盖；网格细线约 2×104 条 + 每 5 格粗线
    expect(ctx.fills).toBeGreaterThan(W * H * 0.8);
    expect(layout.legend).not.toBeNull();
  });

  it('cellLabels 全开的最重路径 ≤100ms', () => {
    // 固定 cellPx=24：3 字色号（A10 等）在 mock 宽度下也放得下 → 无空格全标注
    const labeled = new Int16Array(W * H);
    for (let i = 0; i < labeled.length; i++) labeled[i] = i % 9;
    const ctx = new CountingCanvas();
    time('renderPatternSheet(cellLabels=true)', 100, () =>
      renderPatternSheet(
        ctx,
        { cells: labeled, w: W, h: H, palette },
        { ...DEFAULT_SHEET_OPTIONS, cellLabels: true, cellPx: 24 },
      ),
    );
    expect(ctx.texts).toBeGreaterThan(W * H);
  });
});
