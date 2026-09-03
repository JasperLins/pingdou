import { describe, expect, it } from 'vitest';

import {
  brushCells,
  denoise,
  denoiseStats,
  diffOf,
  floodFill,
  getConnectedRegions,
  lineCells,
  mapCellsToPalette,
  mergeDiff,
  type CellDiff,
} from './cellOps';
import { loadPalette } from './palettes';

/**
 * 104×104 随机场性能冒烟（design.md §7：≤50ms）。
 * 数字同时打到 stdout，供性能实测记录（绘制数据路径；canvas 渲染帧预算留浏览器人工验收）。
 */

const W = 104;
const H = 104;
const COLORS = 24;

function randomField(seed: number): Int16Array {
  // 线性同余伪随机：可复现
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

function time<T>(label: string, budgetMs: number, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  console.log(`[perf] ${label}: ${ms.toFixed(1)}ms（预算 ≤${budgetMs}ms）`);
  expect(ms, `${label} 超出 ${budgetMs}ms 预算`).toBeLessThan(budgetMs);
  return result;
}

describe('cellOps 104×104 性能冒烟', () => {
  const field = randomField(20260904);

  it('连通域 / 去噪 / 干跑 ≤50ms', () => {
    const regions = time('getConnectedRegions', 50, () => getConnectedRegions(field, W, H));
    expect(regions.length).toBeGreaterThan(0);
    time('denoiseStats(threshold=2)', 50, () => denoiseStats(field, W, H, 2));
    const diff = time('denoise(threshold=2)', 50, () => denoise(field, W, H, 2));
    expect(diff.indices.length).toBeGreaterThan(0);
  });

  it('油漆桶全图填充 ≤50ms', () => {
    const empty = new Int16Array(W * H).fill(-1);
    const diff = time('floodFill(整图空格填充)', 50, () => floodFill(empty, W, H, 0, 0, 5));
    expect(diff.indices).toHaveLength(W * H);
  });

  it('品牌映射（24 色 → MARD 291）≤50ms', () => {
    const mard = loadPalette('mard');
    const coco = loadPalette('coco');
    const result = time('mapCellsToPalette(24→mard)', 50, () => mapCellsToPalette(field, coco, mard));
    expect(result.mapping).toHaveLength(COLORS);
    expect(result.diff.indices.length).toBeGreaterThan(0);
  });

  it('一笔长笔画数据路径（Bresenham×200 段 + diff 合成）≤50ms', () => {
    const cells = new Int16Array(field);
    const stroke = time('stroke(200 段连线 + mergeDiff)', 50, (): CellDiff | null => {
      let acc: CellDiff | null = null;
      for (let seg = 0; seg < 200; seg++) {
        const x0 = (seg * 13) % W;
        const y0 = (seg * 7) % H;
        const x1 = (x0 + 9) % W;
        const y1 = (y0 + 5) % H;
        const indices = lineCells(x0, y0, x1, y1, W, H).flatMap((i) => brushCells(i % W, Math.floor(i / W), 2, W, H));
        const unique = [...new Set(indices)];
        const segDiff = diffOf(cells, unique, unique.map(() => 3));
        for (const i of segDiff.indices) cells[i] = 3; // 模拟实时落笔
        acc = acc ? mergeDiff(acc, segDiff) : segDiff;
      }
      return acc;
    });
    expect(stroke).not.toBeNull();
    expect(stroke?.indices.length).toBeGreaterThan(0);
  });
});
