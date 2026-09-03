/**
 * 编辑器格子批量操作纯函数（m2）：floodFill / 连通域 / 去噪 / 换色 / 互换 /
 * 清除 / 品牌映射，以及画笔连线、矩形/椭圆/笔刷栅格化。
 *
 * 全部函数不可变：入参 cells 不被修改，返回新数组与 {@link CellDiff}。
 * `CellDiff` 是撤销重做的命令式 diff 单元（design.md §3：{indices, before, after}），
 * 栈内深拷贝语义由 Int16Array 的不可变使用保证。
 */

import { ciede2000, type Lab } from './color';
import type { Palette } from './palettes';

// ---------------------------------------------------------------------------
// 基础类型
// ---------------------------------------------------------------------------

/** cells 容器：工程内为 Int16Array（-1 = 空格），lib/转换产物为普通数组。 */
export type CellsLike = Int16Array | readonly number[];

/** 一笔格子变更（撤销重做的原子单元）。indices 升序，与 before/after 一一对齐。 */
export interface CellDiff {
  indices: number[];
  before: Int16Array;
  after: Int16Array;
}

/** 空 diff（无变更）。调用方可直接复用，不做防御性拷贝。 */
export const EMPTY_DIFF: CellDiff = { indices: [], before: new Int16Array(0), after: new Int16Array(0) };

function isEmptyDiff(diff: CellDiff): boolean {
  return diff.indices.length === 0;
}

/**
 * 构造 diff（内部按 indices 排序对齐，保证确定性）。
 *
 * @param indices 变更下标（任意顺序、允许重复，重复时保留 after 最后写入语义由调用方保证）
 * @param before 变更前值
 * @param after 变更后值
 */
export function createDiff(indices: readonly number[], before: readonly number[], after: readonly number[]): CellDiff {
  const order = [...indices].sort((a, b) => a - b);
  const n = order.length;
  const sortedBefore = new Int16Array(n);
  const sortedAfter = new Int16Array(n);
  // indices 中的重复下标：取首个 before、末个 after（与顺序写入语义一致）
  const firstAt = new Map<number, number>();
  const lastAt = new Map<number, number>();
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (!firstAt.has(idx)) firstAt.set(idx, i);
    lastAt.set(idx, i);
  }
  let out = 0;
  for (let i = 0; i < n; i++) {
    const idx = order[i];
    if (i > 0 && order[i - 1] === idx) continue;
    sortedBefore[out] = before[firstAt.get(idx) ?? 0];
    sortedAfter[out] = after[lastAt.get(idx) ?? 0];
    out++;
  }
  return { indices: order.slice(0, out), before: sortedBefore.slice(0, out), after: sortedAfter.slice(0, out) };
}

/**
 * 由当前 cells 与目标值构造 diff（before 取自 cells 现值，与当前值相同的项被剔除）。
 */
export function diffOf(cells: CellsLike, indices: readonly number[], afterValues: readonly number[]): CellDiff {
  if (indices.length !== afterValues.length) throw new Error('diffOf：indices 与 afterValues 长度不一致');
  const outIndices: number[] = [];
  const before: number[] = [];
  const after: number[] = [];
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const prev = cells[idx] ?? -1;
    if (prev === afterValues[i]) continue;
    outIndices.push(idx);
    before.push(prev);
    after.push(afterValues[i]);
  }
  return createDiff(outIndices, before, after);
}

/**
 * 用给定值涂一批格子（画笔/图形工具的公共落笔路径）。
 */
export function paintCells(cells: CellsLike, indices: readonly number[], value: number): CellDiff {
  return diffOf(cells, indices, indices.map(() => value));
}

/**
 * 应用 diff（重做方向）：返回新数组，不修改入参。
 */
export function applyDiff(cells: CellsLike, diff: CellDiff): Int16Array {
  if (isEmptyDiff(diff)) return toCells(cells);
  const out = toCells(cells);
  for (let i = 0; i < diff.indices.length; i++) out[diff.indices[i]] = diff.after[i];
  return out;
}

/**
 * 回滚 diff（撤销方向）：返回新数组，不修改入参。
 */
export function revertDiff(cells: CellsLike, diff: CellDiff): Int16Array {
  if (isEmptyDiff(diff)) return toCells(cells);
  const out = toCells(cells);
  for (let i = 0; i < diff.indices.length; i++) out[diff.indices[i]] = diff.before[i];
  return out;
}

/**
 * 合成两笔 diff（后写覆盖前写）：一笔画多段提交时把分段 diff 合并为单条 undo 记录。
 */
export function mergeDiff(base: CellDiff, next: CellDiff): CellDiff {
  if (isEmptyDiff(base)) return next;
  if (isEmptyDiff(next)) return base;
  const map = new Map<number, [number, number]>();
  for (let i = 0; i < base.indices.length; i++) map.set(base.indices[i], [base.before[i], base.after[i]]);
  for (let i = 0; i < next.indices.length; i++) {
    const idx = next.indices[i];
    const prev = map.get(idx);
    map.set(idx, [prev ? prev[0] : next.before[i], next.after[i]]);
  }
  const indices = [...map.keys()].sort((a, b) => a - b);
  const before = new Int16Array(indices.length);
  const after = new Int16Array(indices.length);
  indices.forEach((idx, i) => {
    const pair = map.get(idx);
    if (pair) {
      before[i] = pair[0];
      after[i] = pair[1];
    }
  });
  return { indices, before, after };
}

function toCells(cells: CellsLike): Int16Array {
  if (cells instanceof Int16Array) return new Int16Array(cells);
  const out = new Int16Array(cells.length);
  for (let i = 0; i < cells.length; i++) out[i] = cells[i];
  return out;
}

// ---------------------------------------------------------------------------
// 栅格化：连线 / 矩形 / 椭圆 / 笔刷
// ---------------------------------------------------------------------------

/** Bresenham 直线经过的格子（含端点）。返回去重后的下标，越界格自动裁剪。 */
export function lineCells(x0: number, y0: number, x1: number, y1: number, w: number, h: number): number[] {
  const pts: number[] = [];
  const seen = new Set<number>();
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  // 上限防御：网格内合法直线最长 w*h 格
  for (let guard = 0; guard <= w * h; guard++) {
    pushPoint(pts, seen, cx, cy, w, h);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return pts;
}

/** 填充矩形（含边框，端点任意方向）。 */
export function rectCells(x0: number, y0: number, x1: number, y1: number, w: number, h: number): number[] {
  const pts: number[] = [];
  const seen = new Set<number>();
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(w - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(h - 1, Math.max(y0, y1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) pushPoint(pts, seen, x, y, w, h);
  }
  return pts;
}

/** 填充椭圆（外接矩形含端点，中心椭圆方程判定；半径加 0.25 格防退化）。 */
export function ellipseCells(x0: number, y0: number, x1: number, y1: number, w: number, h: number): number[] {
  const pts: number[] = [];
  const seen = new Set<number>();
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(w - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(h - 1, Math.max(y0, y1));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(0.5, (maxX - minX) / 2) + 0.25;
  const ry = Math.max(0.5, (maxY - minY) / 2) + 0.25;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) pushPoint(pts, seen, x, y, w, h);
    }
  }
  return pts;
}

/**
 * 方形笔刷覆盖的格子（size 1–4，中心锚定：偶数尺寸向左上偏半格）。
 */
export function brushCells(cx: number, cy: number, size: number, w: number, h: number): number[] {
  const s = Math.max(1, Math.min(4, Math.round(size)));
  const pts: number[] = [];
  const seen = new Set<number>();
  const minX = cx - Math.floor((s - 1) / 2);
  const minY = cy - Math.floor((s - 1) / 2);
  for (let y = minY; y < minY + s; y++) {
    for (let x = minX; x < minX + s; x++) pushPoint(pts, seen, x, y, w, h);
  }
  return pts;
}

function pushPoint(out: number[], seen: Set<number>, x: number, y: number, w: number, h: number): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const idx = y * w + x;
  if (seen.has(idx)) return;
  seen.add(idx);
  out.push(idx);
}

// ---------------------------------------------------------------------------
// 油漆桶 / 连通域 / 去噪
// ---------------------------------------------------------------------------

/**
 * 油漆桶：扫描线同色连片填充（4 邻接）。
 *
 * @param cells 网格数据
 * @param w h 网格尺寸
 * @param x y 起点（越界返回空 diff）
 * @param value 目标值（与起点同色时返回空 diff）
 */
export function floodFill(cells: CellsLike, w: number, h: number, x: number, y: number, value: number): CellDiff {
  if (x < 0 || y < 0 || x >= w || y >= h) return EMPTY_DIFF;
  const origin = cells[y * w + x];
  if (origin === value) return EMPTY_DIFF;
  const out = toCells(cells);
  const indices: number[] = [];
  const stack: number[] = [x, y];
  while (stack.length > 0) {
    const py = stack.pop() as number;
    const px = stack.pop() as number;
    // 同一行可能被多条相邻行重复入队：弹栈时校验起点仍是源色
    if (out[py * w + px] !== origin) continue;
    let lx = px;
    while (lx > 0 && out[py * w + lx - 1] === origin) lx--;
    let rx = px;
    while (rx < w - 1 && out[py * w + rx + 1] === origin) rx++;
    let spanUp = false;
    let spanDown = false;
    for (let i = lx; i <= rx; i++) {
      const idx = py * w + i;
      out[idx] = value;
      indices.push(idx);
      if (py > 0) {
        const upSame = out[(py - 1) * w + i] === origin;
        if (upSame && !spanUp) {
          stack.push(i, py - 1);
          spanUp = true;
        } else if (!upSame) spanUp = false;
      }
      if (py < h - 1) {
        const downSame = out[(py + 1) * w + i] === origin;
        if (downSame && !spanDown) {
          stack.push(i, py + 1);
          spanDown = true;
        } else if (!downSame) spanDown = false;
      }
    }
  }
  return { indices: indices.sort((a, b) => a - b), before: fillIndices(cells, indices), after: fillValue(indices.length, value) };
}

/** 一个连通域（值相同的 4 邻接格子集合）。 */
export interface ConnectedRegion {
  value: number;
  /** 升序下标。 */
  indices: number[];
}

/**
 * 提取连通域（值相同的 4 邻接区域；跳过空格可选，去噪/统计用）。
 *
 * @param opts.skipEmpty 是否忽略 -1 空格域（默认 true）
 */
export function getConnectedRegions(
  cells: CellsLike,
  w: number,
  h: number,
  opts: { skipEmpty?: boolean } = {},
): ConnectedRegion[] {
  const skipEmpty = opts.skipEmpty ?? true;
  const visited = new Uint8Array(w * h);
  const regions: ConnectedRegion[] = [];
  for (let start = 0; start < w * h; start++) {
    if (visited[start]) continue;
    const value = cells[start];
    if (skipEmpty && value < 0) {
      visited[start] = 1;
      continue;
    }
    const indices: number[] = [];
    const queue = [start];
    visited[start] = 1;
    while (queue.length > 0) {
      const idx = queue.pop() as number;
      indices.push(idx);
      const cx = idx % w;
      const cy = (idx - cx) / w;
      if (cx > 0 && !visited[idx - 1] && cells[idx - 1] === value) {
        visited[idx - 1] = 1;
        queue.push(idx - 1);
      }
      if (cx < w - 1 && !visited[idx + 1] && cells[idx + 1] === value) {
        visited[idx + 1] = 1;
        queue.push(idx + 1);
      }
      if (cy > 0 && !visited[idx - w] && cells[idx - w] === value) {
        visited[idx - w] = 1;
        queue.push(idx - w);
      }
      if (cy < h - 1 && !visited[idx + w] && cells[idx + w] === value) {
        visited[idx + w] = 1;
        queue.push(idx + w);
      }
    }
    regions.push({ value, indices: indices.sort((a, b) => a - b) });
  }
  return regions;
}

/**
 * 一键去噪：清除面积 ≤ threshold 的非空孤立连通域（置 -1）。
 *
 * @param threshold 面积阈值（1 = 单格碎色）
 */
export function denoise(cells: CellsLike, w: number, h: number, threshold = 1): CellDiff {
  if (threshold < 1) return EMPTY_DIFF;
  const indices: number[] = [];
  for (const region of getConnectedRegions(cells, w, h)) {
    if (region.value < 0) continue;
    if (region.indices.length <= threshold) indices.push(...region.indices);
  }
  if (indices.length === 0) return EMPTY_DIFF;
  return { indices: indices.sort((a, b) => a - b), before: fillIndices(cells, indices), after: fillValue(indices.length, -1) };
}

/** 去噪干跑统计（Readiness 自检区展示，不产生 diff）。 */
export interface DenoiseStats {
  /** 会被清除的连通域个数。 */
  regions: number;
  /** 会被清除的格子总数。 */
  cells: number;
}

/**
 * 去噪干跑：统计 threshold 下会被清除的域数与格数。
 */
export function denoiseStats(cells: CellsLike, w: number, h: number, threshold = 1): DenoiseStats {
  const stats: DenoiseStats = { regions: 0, cells: 0 };
  if (threshold < 1) return stats;
  for (const region of getConnectedRegions(cells, w, h)) {
    if (region.value < 0) continue;
    if (region.indices.length <= threshold) {
      stats.regions += 1;
      stats.cells += region.indices.length;
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// 颜色级操作
// ---------------------------------------------------------------------------

/** 全局换色：色号 from → to（含 to = -1 清除）。 */
export function replaceColor(cells: CellsLike, from: number, to: number): CellDiff {
  if (from === to) return EMPTY_DIFF;
  const indices: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === from) indices.push(i);
  }
  if (indices.length === 0) return EMPTY_DIFF;
  return { indices, before: fillValue(indices.length, from), after: fillValue(indices.length, to) };
}

/** 清除颜色：色号 value 的全部格子置空。 */
export function clearColor(cells: CellsLike, value: number): CellDiff {
  return replaceColor(cells, value, -1);
}

/** 两色互换：色号 a 与 b 的全部格子对调。 */
export function swapColors(cells: CellsLike, a: number, b: number): CellDiff {
  if (a === b) return EMPTY_DIFF;
  const indices: number[] = [];
  const before: number[] = [];
  const after: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v === a) {
      indices.push(i);
      before.push(a);
      after.push(b);
    } else if (v === b) {
      indices.push(i);
      before.push(b);
      after.push(a);
    }
  }
  if (indices.length === 0) return EMPTY_DIFF;
  return createDiff(indices, before, after);
}

// ---------------------------------------------------------------------------
// 品牌切换映射
// ---------------------------------------------------------------------------

/** 一次品牌映射中的单条颜色映射（源色 → 目标品牌最近色）。 */
export interface BrandMappingEntry {
  /** 源品牌色板下标。 */
  from: number;
  /** 目标品牌色板下标。 */
  to: number;
  /** CIEDE2000 色差。 */
  deltaE: number;
  /** 涉及格数。 */
  count: number;
}

/** 品牌映射结果：cells diff + 按格数降序的映射明细。 */
export interface BrandMapResult {
  diff: CellDiff;
  mapping: BrandMappingEntry[];
}

/**
 * 品牌切换批量映射：把 cells 中已用色号按 CIEDE2000 映射到目标品牌最近色
 * （特殊效果色不参与目标候选，§4.5.2）。
 *
 * @param cells 源 cells（色板下标基于 fromPalette）
 * @param fromPalette 当前品牌色板（提供源色 Lab）
 * @param toPalette 目标品牌色板
 */
export function mapCellsToPalette(cells: CellsLike, fromPalette: Palette, toPalette: Palette): BrandMapResult {
  const counts = new Map<number, number>();
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v < 0) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const mapping: BrandMappingEntry[] = [];
  const indexMap = new Map<number, number>();
  for (const [fromIndex, count] of counts) {
    const sourceLab: Lab | undefined = fromPalette.labs[fromIndex];
    if (!sourceLab) continue;
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (const cand of toPalette.matchable) {
      const delta = ciede2000(sourceLab, toPalette.labs[cand]);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = cand;
      }
    }
    if (bestIdx < 0) continue;
    indexMap.set(fromIndex, bestIdx);
    mapping.push({ from: fromIndex, to: bestIdx, deltaE: bestDelta, count });
  }
  mapping.sort((a, b) => b.count - a.count || a.from - b.from);
  const indices: number[] = [];
  const after: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    const next = v < 0 ? -1 : indexMap.get(v);
    if (next === undefined || next === v) continue;
    indices.push(i);
    after.push(next);
  }
  return { diff: diffOf(cells, indices, after), mapping };
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

function fillIndices(cells: CellsLike, indices: readonly number[]): Int16Array {
  const out = new Int16Array(indices.length);
  for (let i = 0; i < indices.length; i++) out[i] = cells[indices[i]];
  return out;
}

function fillValue(length: number, value: number): Int16Array {
  const out = new Int16Array(length);
  out.fill(value);
  return out;
}
