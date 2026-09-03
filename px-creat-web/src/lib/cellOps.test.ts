import { describe, expect, it } from 'vitest';

import {
  EMPTY_DIFF,
  applyDiff,
  brushCells,
  clearColor,
  createDiff,
  denoise,
  denoiseStats,
  diffOf,
  ellipseCells,
  floodFill,
  getConnectedRegions,
  lineCells,
  mapCellsToPalette,
  mergeDiff,
  paintCells,
  rectCells,
  replaceColor,
  revertDiff,
  swapColors,
} from './cellOps';
import { rgbToLab } from './color';
import type { Palette } from './palettes';
import type { BeadColor, BrandKey } from './types';

/** 便捷构造：w×h 网格。 */
function grid(w: number, h: number, fill: (x: number, y: number) => number): Int16Array {
  const cells = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells[y * w + x] = fill(x, y);
  }
  return cells;
}

describe('diff 基础', () => {
  it('createDiff 按 indices 排序并去重（首 before 末 after）', () => {
    const diff = createDiff([5, 1, 5], [10, 20, 30], [11, 21, 31]);
    expect(diff.indices).toEqual([1, 5]);
    // idx=5 首次出现于位置 0（before=10）、末次位置 2（after=31）
    expect([...diff.before]).toEqual([20, 10]);
    expect([...diff.after]).toEqual([21, 31]);
  });

  it('diffOf 剔除无变化项', () => {
    const cells = grid(2, 2, () => 3);
    const diff = diffOf(cells, [0, 1], [4, 3]);
    expect(diff.indices).toEqual([0]);
    expect([...diff.before]).toEqual([3]);
    expect([...diff.after]).toEqual([4]);
  });

  it('applyDiff / revertDiff 往返还原', () => {
    const cells = grid(3, 3, () => 1);
    const diff = diffOf(cells, [0, 4, 8], [2, -1, 2]);
    const applied = applyDiff(cells, diff);
    expect([...applied]).toEqual([2, 1, 1, 1, -1, 1, 1, 1, 2]);
    expect([...revertDiff(applied, diff)]).toEqual([...cells]);
  });

  it('applyDiff 不修改入参（不可变）', () => {
    const cells = grid(2, 1, () => 0);
    applyDiff(cells, diffOf(cells, [0], [7]));
    expect(cells[0]).toBe(0);
  });

  it('mergeDiff：后写覆盖前写，before 取最早', () => {
    const cells = grid(4, 1, () => 1);
    const a = diffOf(cells, [0, 1], [2, 2]);
    const b = diffOf(applyDiff(cells, a), [1, 2], [3, 3]);
    const merged = mergeDiff(a, b);
    expect(merged.indices).toEqual([0, 1, 2]);
    expect([...merged.before]).toEqual([1, 1, 1]);
    expect([...merged.after]).toEqual([2, 3, 3]);
  });

  it('mergeDiff 与空 diff 互为恒等', () => {
    const cells = grid(2, 1, () => 1);
    const a = diffOf(cells, [0], [5]);
    expect(mergeDiff(a, EMPTY_DIFF)).toBe(a);
    expect(mergeDiff(EMPTY_DIFF, a)).toBe(a);
  });

  it('paintCells 统一值并跳过同值格', () => {
    const cells = grid(2, 1, () => 1);
    const diff = paintCells(cells, [0, 1], 1);
    expect(diff.indices).toHaveLength(0);
  });
});

describe('栅格化', () => {
  it('lineCells：水平/垂直/对角线', () => {
    expect(lineCells(0, 0, 3, 0, 5, 5)).toEqual([0, 1, 2, 3]);
    expect(lineCells(1, 0, 1, 2, 5, 5)).toEqual([1, 6, 11]);
    expect(lineCells(0, 0, 2, 2, 5, 5)).toEqual([0, 6, 12]);
  });

  it('lineCells：反向按绘制序返回、单点', () => {
    expect(lineCells(3, 0, 0, 0, 5, 5)).toEqual([3, 2, 1, 0]);
    expect([...lineCells(3, 0, 0, 0, 5, 5)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(lineCells(2, 2, 2, 2, 5, 5)).toEqual([12]);
  });

  it('rectCells：含边框、反向下标、越界裁剪', () => {
    expect(rectCells(1, 1, 2, 2, 5, 5)).toEqual([6, 7, 11, 12]);
    expect(rectCells(2, 2, 1, 1, 5, 5)).toEqual([6, 7, 11, 12]);
    expect(rectCells(-1, -1, 1, 1, 3, 3)).toEqual([0, 1, 3, 4]);
  });

  it('ellipseCells：单格、2×2 全含与 3×3 十字盘', () => {
    expect(ellipseCells(0, 0, 0, 0, 3, 3)).toEqual([0]);
    expect(ellipseCells(0, 0, 1, 1, 3, 3)).toEqual([0, 1, 3, 4]);
    expect(ellipseCells(0, 0, 2, 2, 3, 3)).toEqual([1, 3, 4, 5, 7]);
  });

  it('ellipseCells：宽扁椭圆三段式', () => {
    const cells = ellipseCells(0, 0, 4, 2, 5, 3);
    expect(cells.filter((i) => i < 5)).toEqual([1, 2, 3]);
    expect(cells.filter((i) => i >= 5 && i < 10)).toEqual([5, 6, 7, 8, 9]);
    expect(cells.filter((i) => i >= 10)).toEqual([11, 12, 13]);
  });

  it('brushCells：1–4 尺寸锚定与越界裁剪（偶数尺寸向右下扩展）', () => {
    expect(brushCells(2, 2, 1, 5, 5)).toEqual([12]);
    expect(brushCells(2, 2, 2, 5, 5)).toEqual([12, 13, 17, 18]);
    expect(brushCells(2, 2, 3, 5, 5)).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
    expect(brushCells(2, 2, 4, 5, 5)).toEqual([6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24]);
    expect(brushCells(0, 0, 3, 4, 4)).toEqual([0, 1, 4, 5]);
  });
});

describe('floodFill', () => {
  it('同色连片填充且被异色边界阻断', () => {
    // 5×5：中间 3×3 的 0 区域被 1 包围
    const cells = grid(5, 5, (x, y) => (x >= 1 && x <= 3 && y >= 1 && y <= 3 ? 0 : 1));
    const diff = floodFill(cells, 5, 5, 2, 2, 9);
    expect(diff.indices).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
    expect([...diff.before]).toEqual(new Array(9).fill(0));
    expect([...diff.after]).toEqual(new Array(9).fill(9));
  });

  it('对空格区域同样适用（-1 连片）', () => {
    const cells = new Int16Array(4).fill(-1);
    const diff = floodFill(cells, 2, 2, 0, 0, 3);
    expect(diff.indices).toEqual([0, 1, 2, 3]);
  });

  it('与目标同色 / 越界 / 对角不连通', () => {
    const cells = grid(3, 3, (x, y) => (x === 0 && y === 0) || (x === 1 && y === 1) ? 5 : 0);
    expect(floodFill(cells, 3, 3, 0, 0, 5).indices).toHaveLength(0);
    expect(floodFill(cells, 3, 3, -1, 0, 5).indices).toHaveLength(0);
    // (0,0)=5 与 (1,1)=5 对角不连通：只填 (0,0)
    expect(floodFill(cells, 3, 3, 0, 0, 7).indices).toEqual([0]);
  });

  it('C 形区域整片填充（扫描线跨越凹部）', () => {
    const cells = grid(3, 3, (x, y) => (x === 1 && y === 1 ? 1 : 0));
    const diff = floodFill(cells, 3, 3, 0, 0, 2);
    expect(diff.indices).toHaveLength(8);
    expect(diff.indices).not.toContain(4);
  });

  it('填充结果与逐格参考实现一致', () => {
    const cells = grid(6, 6, (x, y) => ((x + y) % 2 === 0 ? 0 : 1));
    const diff = floodFill(cells, 6, 6, 0, 0, 8);
    // 参考实现：BFS 同色连片（偶数格为 0 的棋盘格互不相邻——本例只有 (0,0) 单格）
    expect(diff.indices).toEqual([0]);
    const wide = grid(6, 2, () => 4);
    const wideDiff = floodFill(wide, 6, 2, 0, 0, 9);
    expect(wideDiff.indices).toHaveLength(12);
  });
});

describe('连通域与去噪', () => {
  it('getConnectedRegions：4 邻接、按值分域、跳过空格', () => {
    const cells = grid(3, 2, (x, y) => (y === 0 ? (x === 0 ? 1 : 2) : 1));
    const regions = getConnectedRegions(cells, 3, 2);
    // 下行 1 与 (0,0) 的 1 连成一片；2 独立
    expect(regions).toHaveLength(2);
    expect(regions.map((r) => r.value).sort()).toEqual([1, 2]);
    expect(regions.find((r) => r.value === 1)?.indices).toEqual([0, 3, 4, 5]);
    expect(regions.find((r) => r.value === 2)?.indices).toEqual([1, 2]);
  });

  it('getConnectedRegions：skipEmpty=false 时空格也成域（对角空格不连通）', () => {
    const cells = new Int16Array([1, -1, -1, 1]);
    expect(getConnectedRegions(cells, 2, 2, { skipEmpty: false })).toHaveLength(4);
    expect(getConnectedRegions(cells, 2, 2, { skipEmpty: true })).toHaveLength(2);
  });

  it('denoise：面积 ≤ 阈值的非空域被清除', () => {
    // [0,0,7,0,0]：两个 0 域（各 2 格）+ 一个 7 域（1 格）
    const cells = grid(5, 1, (x) => (x === 2 ? 7 : 0));
    const diff = denoise(cells, 5, 1, 1);
    expect(diff.indices).toEqual([2]);
    expect([...diff.after]).toEqual([-1]);
    // 阈值 2 连两个 0 域一并清除
    const diff2 = denoise(cells, 5, 1, 2);
    expect(diff2.indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('denoise：全空网格无操作', () => {
    const cells = new Int16Array(16).fill(-1);
    expect(denoise(cells, 4, 4, 4).indices).toHaveLength(0);
  });

  it('denoiseStats 与 denoise 一致', () => {
    // [0,5,0,6]：四个单格域
    const cells = grid(4, 1, (x) => (x === 1 ? 5 : x === 3 ? 6 : 0));
    const stats = denoiseStats(cells, 4, 1, 1);
    expect(stats).toEqual({ regions: 4, cells: 4 });
    expect(denoise(cells, 4, 1, 1).indices).toHaveLength(stats.cells);
  });
});

describe('颜色级操作', () => {
  it('replaceColor：全量替换与清除语义', () => {
    const cells = grid(2, 2, () => 3);
    const diff = replaceColor(cells, 3, 8);
    expect(diff.indices).toEqual([0, 1, 2, 3]);
    expect([...applyDiff(cells, diff)]).toEqual([8, 8, 8, 8]);
    expect(clearColor(cells, 3).after.every((v) => v === -1)).toBe(true);
  });

  it('replaceColor：无命中与同色目标返回空', () => {
    const cells = grid(2, 1, () => 1);
    expect(replaceColor(cells, 9, 2).indices).toHaveLength(0);
    expect(replaceColor(cells, 1, 1).indices).toHaveLength(0);
  });

  it('swapColors：两色对调', () => {
    const cells = new Int16Array([1, 2, 1, 2, 0]);
    const diff = swapColors(cells, 1, 2);
    expect([...applyDiff(cells, diff)]).toEqual([2, 1, 2, 1, 0]);
    expect([...diff.before]).toEqual([1, 2, 1, 2]);
    expect(swapColors(cells, 1, 1).indices).toHaveLength(0);
  });
});

describe('mapCellsToPalette', () => {
  function fakePalette(brand: BrandKey, rgbList: [number, number, number][]): Palette {
    const colors: BeadColor[] = rgbList.map((rgb, i) => ({
      brand,
      code: `C${i}`,
      name: `色${i}`,
      rgb: { r: rgb[0], g: rgb[1], b: rgb[2] },
    }));
    const labs = colors.map((c) => rgbToLab(c.rgb));
    return { brand, colors, labs, matchable: colors.map((_, i) => i) };
  }

  const source = fakePalette('mard', [
    [255, 0, 0],
    [0, 0, 255],
  ]);
  const target = fakePalette('coco', [
    [0, 200, 0],
    [230, 230, 30],
  ]);

  it('按 CIEDE2000 映射到目标品牌最近色', () => {
    const cells = new Int16Array([0, 0, 1, -1]);
    const { diff, mapping } = mapCellsToPalette(cells, source, target);
    const toOf = new Map(mapping.map((m) => [m.from, m.to]));
    expect(toOf.get(0)).toBe(1); // 红 → 黄（暖色互近）
    expect(toOf.get(1)).toBe(0); // 蓝 → 绿（冷色互近）
    expect(mapping.every((m) => m.deltaE >= 0)).toBe(true);
    // 空格不产生映射
    expect(mapping).toHaveLength(2);
    // 两色映射后的下标都发生变化（目标色板下标重排）
    expect(diff.indices).toEqual([0, 1, 2]);
    const mapped = applyDiff(cells, diff);
    expect(mapped[0]).toBe(1);
    expect(mapped[2]).toBe(0);
  });

  it('目标下标恰好相同时不产生格子变更（品牌重解释）', () => {
    const twin = fakePalette('mard', [
      [255, 0, 0],
      [0, 200, 0],
    ]);
    const twin2 = fakePalette('coco', [
      [255, 0, 0],
      [0, 200, 0],
    ]);
    const cells = new Int16Array([0, 1, 1, -1]);
    const { diff, mapping } = mapCellsToPalette(cells, twin, twin2);
    expect(mapping.every((m) => m.to === m.from && m.deltaE === 0)).toBe(true);
    expect(diff.indices).toHaveLength(0);
  });

  it('同品牌映射为恒等（空 diff）', () => {
    const cells = new Int16Array([0, 1, 1, -1]);
    const { diff, mapping } = mapCellsToPalette(cells, source, source);
    expect(diff.indices).toHaveLength(0);
    expect(mapping.every((m) => m.to === m.from && m.deltaE === 0)).toBe(true);
  });

  it('映射明细按格数降序', () => {
    const cells = new Int16Array([1, 1, 1, 0]);
    const { mapping } = mapCellsToPalette(cells, source, target);
    expect(mapping[0].from).toBe(1);
    expect(mapping[0].count).toBe(3);
  });
});
