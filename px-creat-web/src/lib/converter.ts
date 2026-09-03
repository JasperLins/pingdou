/**
 * 图片转图纸转换管线（§4.3.4 调研选型结论的落地实现）。
 *
 * 阶段：边界校验 → 纯色背景移除（可选）→ 阶梯式减半 + 区域平均降采样 →
 * 每格代表色（平滑 = 区域平均 / 卡通 = 量化取众数主导色）→（可选）目标色数
 * 色板子集选择 → CIEDE2000 最近色匹配（代表色量化 5bit 后缓存）。
 *
 * 输入为 RGBA 像素数组（解码由调用方负责），本模块不依赖 DOM。
 * 大图转换请经 converterClient.ts 在 Worker 中调用（§4.10 性能红线）。
 */

import { ciede2000, rgbToHsl, rgbToLab, type Lab } from './color';
import type { Palette } from './palettes';
import type { Rgb } from './types';

// ---------------------------------------------------------------------------
// 输入 / 输出契约
// ---------------------------------------------------------------------------

/** RGBA 像素图（行优先，stride 4），与 ImageData 数据布局一致。 */
export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** 代表色双模式：平滑（区域内平均，适合照片）/ 卡通（量化后取众数主导色，保硬边）。 */
export type ConvertMode = 'smooth' | 'cartoon';

/** 纯色背景移除选项（边缘扩散式：从图边洪泛，与主背景色 ΔE00 ≤ tolerance 的连通区域透空）。 */
export interface BackgroundOptions {
  /** 是否移除纯色背景。 */
  remove: boolean;
  /** 容差，CIEDE2000 单位（建议 5–20，默认 10）。 */
  tolerance: number;
}

/** 转换参数。 */
export interface ConvertOptions {
  mode: ConvertMode;
  /** 目标色数（色板子集聚类上限）；0 = 不限（§4.3：Q版默认 16，标准/写真不限）。 */
  targetColors: number;
  background: BackgroundOptions;
  /** 格子平均 alpha 低于该阈值（0–255）输出空格。 */
  alphaThreshold: number;
}

/** 转换参数缺省值（卡通 + 不限色数 + 不移除背景）。 */
export const DEFAULT_CONVERT_OPTIONS: Readonly<ConvertOptions> = Object.freeze({
  mode: 'cartoon',
  targetColors: 0,
  background: Object.freeze({ remove: false, tolerance: 10 }),
  alphaThreshold: 128,
});

/** 可判别错误码：低分辨率 / 近纯色为 §4.3.5 边界提示；internal_error 为管线异常兜底。 */
export type ConvertErrorCode = 'low_resolution' | 'near_solid_color' | 'internal_error';

/** 转换成功结果。 */
export interface ConvertSuccess {
  ok: true;
  w: number;
  h: number;
  /** 色板下标（行优先），-1 = 空格。 */
  cells: Int16Array;
  /** 实际使用的色号数。 */
  usedCodes: number;
}

/** 转换失败结果。 */
export interface ConvertFailure {
  ok: false;
  code: ConvertErrorCode;
  message: string;
}

/** 转换结果。 */
export type ConvertResult = ConvertSuccess | ConvertFailure;

/** 边界红线：低于该分辨率的源图直接拒绝（§4.3.5）。 */
export const MIN_SOURCE_SIZE = 100;

/**
 * 近纯色判定要求的不透明覆盖率下限：透明底剪影（低覆盖率单色）是合法素材，
 * 只有画面几乎全不透明且只有一个颜色时才判"近乎纯色"。
 */
const NEAR_SOLID_MIN_OPAQUE_RATIO = 0.9;

// ---------------------------------------------------------------------------
// 5bit 量化与匹配缓存
// ---------------------------------------------------------------------------

/**
 * 颜色量化到 5bit/通道（32 级）的缓存键。
 * 匹配以桶中心（q×8+4）进行，保证同一桶结果确定一致（缓存粒度 = 5bit）。
 */
function quantizeKey(r: number, g: number, b: number): number {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

/** 量化键 → 桶中心色。 */
function quantizeCenter(key: number): Rgb {
  return { r: ((key >> 10) & 31) * 8 + 4, g: ((key >> 5) & 31) * 8 + 4, b: (key & 31) * 8 + 4 };
}

/** 最近色匹配器：限定候选集（palette.matchable 或其子集），带 5bit 量化缓存。 */
export interface NearestMatcher {
  /** 返回候选集中 CIEDE2000 最近色的下标；候选集为空返回 -1。 */
  nearestIndex(rgb: Rgb): number;
}

/**
 * 创建最近色匹配器。
 *
 * @param palette 品牌色板
 * @param subset 候选色板下标（缺省 = palette.matchable，排除特殊效果色）
 */
export function createNearestMatcher(palette: Palette, subset?: readonly number[]): NearestMatcher {
  const candidates = subset ?? palette.matchable;
  if (candidates.length === 0) {
    return { nearestIndex: () => -1 };
  }
  const labs: Lab[] = candidates.map((i) => palette.labs[i]);
  const cache = new Map<number, number>();
  return {
    nearestIndex(rgb: Rgb): number {
      const key = quantizeKey(rgb.r, rgb.g, rgb.b);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const center = quantizeCenter(key);
      const query = rgbToLab(center);
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < labs.length; i++) {
        const d = ciede2000(query, labs[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      cache.set(key, candidates[best]);
      return candidates[best];
    },
  };
}

// ---------------------------------------------------------------------------
// 阶段一：边界校验
// ---------------------------------------------------------------------------

/**
 * 源图边界校验（§4.3.5）：低分辨率与近纯色返回可判别错误码。
 *
 * @param img 源图像素
 * @returns null = 通过；否则失败原因
 */
export function validateSource(img: PixelImage): ConvertFailure | null {
  if (img.width < MIN_SOURCE_SIZE || img.height < MIN_SOURCE_SIZE) {
    return {
      ok: false,
      code: 'low_resolution',
      message: `源图分辨率 ${img.width}×${img.height} 低于 ${MIN_SOURCE_SIZE}×${MIN_SOURCE_SIZE}，请更换更大图片`,
    };
  }
  const counts = new Map<number, number>();
  const total = img.width * img.height;
  let opaque = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    if (img.data[o + 3] === 0) continue; // 透明像素不计入
    opaque += 1;
    const key = quantizeKey(img.data[o], img.data[o + 1], img.data[o + 2]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (opaque === 0) {
    return { ok: false, code: 'near_solid_color', message: '源图完全透明，请更换图片' };
  }
  if (opaque / total >= NEAR_SOLID_MIN_OPAQUE_RATIO) {
    if (counts.size === 1) {
      return { ok: false, code: 'near_solid_color', message: '源图近乎纯色，请更换内容更丰富的图片' };
    }
    let maxCount = 0;
    for (const c of counts.values()) maxCount = Math.max(maxCount, c);
    if (maxCount / opaque >= 0.999) {
      return { ok: false, code: 'near_solid_color', message: '源图近乎纯色，请更换内容更丰富的图片' };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 阶段二：边缘扩散式纯色背景移除
// ---------------------------------------------------------------------------

/**
 * 边缘扩散式纯色背景移除：取图边像素的主导色为种子，从图边洪泛（4 连通），
 * 与种子色 CIEDE2000 色差 ≤ tolerance 的连通像素置为透明。返回新图像素。
 *
 * @param img 源图像素
 * @param tolerance 容差（ΔE00 单位）
 */
export function removeSolidBackground(img: PixelImage, tolerance: number): PixelImage {
  const { width: w, height: h, data } = img;
  const data2 = new Uint8ClampedArray(data);

  // 图边主导色（5bit 桶计数，取桶内像素平均色为种子）
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const feed = (x: number, y: number): void => {
    const o = (y * w + x) * 4;
    if (data2[o + 3] === 0) return;
    const key = quantizeKey(data2[o], data2[o + 1], data2[o + 2]);
    const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    entry.n += 1;
    entry.r += data2[o];
    entry.g += data2[o + 1];
    entry.b += data2[o + 2];
    buckets.set(key, entry);
  };
  for (let x = 0; x < w; x++) {
    feed(x, 0);
    feed(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    feed(0, y);
    feed(w - 1, y);
  }
  let dominant: { n: number; r: number; g: number; b: number } | null = null;
  for (const entry of buckets.values()) {
    if (!dominant || entry.n > dominant.n) dominant = entry;
  }
  if (!dominant) return { width: w, height: h, data: data2 };
  const seedLab = rgbToLab({ r: dominant.r / dominant.n, g: dominant.g / dominant.n, b: dominant.b / dominant.n });

  // 从图边洪泛
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];
  const tryEnqueue = (x: number, y: number): void => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    const o = p * 4;
    if (data2[o + 3] === 0) {
      queue.push(p); // 已透明视作背景通路
      return;
    }
    const d = ciede2000(rgbToLab({ r: data2[o], g: data2[o + 1], b: data2[o + 2] }), seedLab);
    if (d <= tolerance) queue.push(p);
  };
  for (let x = 0; x < w; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(w - 1, y);
  }
  while (queue.length > 0) {
    const p = queue.pop() as number;
    const o = p * 4;
    data2[o] = 0;
    data2[o + 1] = 0;
    data2[o + 2] = 0;
    data2[o + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    tryEnqueue(x - 1, y);
    tryEnqueue(x + 1, y);
    tryEnqueue(x, y - 1);
    tryEnqueue(x, y + 1);
  }
  return { width: w, height: h, data: data2 };
}

// ---------------------------------------------------------------------------
// 阶段三：阶梯式减半 + 区域平均降采样
// ---------------------------------------------------------------------------

/**
 * 单次 2×2 box 减半（alpha 线性平均）。
 * - 平滑模式：RGB 取 alpha 加权平均（区域平均）；
 * - 卡通模式：RGB 取 2×2 内量化 5bit 众数桶的主导色——减半过程中不产生
 *   平涂边缘的混色（避免最终 1px/格 时边缘被背景染灰，§4.3.4 双模式依据）。
 */
function halveOnce(img: PixelImage, mode: ConvertMode): PixelImage {
  const w = Math.max(1, img.width >> 1);
  const h = Math.max(1, img.height >> 1);
  const src = img.data;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o0 = (y * 2 * img.width + x * 2) * 4;
      const o1 = o0 + 4;
      const o2 = o0 + img.width * 4;
      const o3 = o2 + 4;
      const a0 = src[o0 + 3];
      const a1 = src[o1 + 3];
      const a2 = src[o2 + 3];
      const a3 = src[o3 + 3];
      const aSum = a0 + a1 + a2 + a3;
      const o = (y * w + x) * 4;
      out[o + 3] = aSum / 4;
      if (aSum === 0) continue;

      if (mode === 'smooth') {
        out[o] = (src[o0] * a0 + src[o1] * a1 + src[o2] * a2 + src[o3] * a3) / aSum;
        out[o + 1] = (src[o0 + 1] * a0 + src[o1 + 1] * a1 + src[o2 + 1] * a2 + src[o3 + 1] * a3) / aSum;
        out[o + 2] = (src[o0 + 2] * a0 + src[o1 + 2] * a1 + src[o2 + 2] * a2 + src[o3 + 2] * a3) / aSum;
        continue;
      }

      // 卡通：2×2 内众数桶主导色
      const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
      const offsets = [o0, o1, o2, o3];
      const alphas = [a0, a1, a2, a3];
      for (let k = 0; k < 4; k++) {
        const a = alphas[k];
        if (a === 0) continue;
        const p = offsets[k];
        const key = quantizeKey(src[p], src[p + 1], src[p + 2]);
        const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        entry.n += a;
        entry.r += src[p] * a;
        entry.g += src[p + 1] * a;
        entry.b += src[p + 2] * a;
        buckets.set(key, entry);
      }
      let dom: { n: number; r: number; g: number; b: number } | null = null;
      for (const entry of buckets.values()) {
        if (!dom || entry.n > dom.n) dom = entry;
      }
      out[o] = dom ? dom.r / dom.n : 0;
      out[o + 1] = dom ? dom.g / dom.n : 0;
      out[o + 2] = dom ? dom.b / dom.n : 0;
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * 阶梯式减半降采样：反复 2×2 缩减，直到再减半会使任一维度低于目标
 * （避免一步大幅缩放的采样偏差与振铃，§4.3.4）。中间结果 ≥ 目标尺寸，
 * 最后一步区域映射由 {@link computeRepresentatives} 完成。
 *
 * @param img 源图像素
 * @param targetW 目标宽（格数）
 * @param targetH 目标高（格数）
 * @param mode 代表色模式（决定减半时的颜色合成方式）
 */
export function halveToNear(img: PixelImage, targetW: number, targetH: number, mode: ConvertMode): PixelImage {
  let cur = img;
  while (cur.width >> 1 >= targetW && cur.height >> 1 >= targetH) {
    cur = halveOnce(cur, mode);
  }
  return cur;
}

// ---------------------------------------------------------------------------
// 阶段四：目标网格代表色
// ---------------------------------------------------------------------------

/** 一个格子的代表色计算结果。 */
export interface CellRepresentative {
  /** 平均 alpha（0–255）。 */
  alpha: number;
  /** 代表色（alpha=0 时无意义）。 */
  rgb: Rgb;
}

/** 计算目标网格某一格覆盖的源图矩形范围（至少 1 像素，越界收敛到边界）。 */
function cellSourceRect(
  cx: number,
  cy: number,
  iw: number,
  ih: number,
  tw: number,
  th: number,
): { x0: number; x1: number; y0: number; y1: number } {
  const x0 = Math.min(iw - 1, Math.floor((cx * iw) / tw));
  const x1 = Math.max(x0 + 1, Math.min(iw, Math.floor(((cx + 1) * iw) / tw)));
  const y0 = Math.min(ih - 1, Math.floor((cy * ih) / th));
  const y1 = Math.max(y0 + 1, Math.min(ih, Math.floor(((cy + 1) * ih) / th)));
  return { x0, x1, y0, y1 };
}

/**
 * 计算目标网格每格的代表色。
 *
 * - 平滑模式：格子区域内 alpha 加权平均（照片渐变友好）；
 * - 卡通模式：区域内像素量化 5bit 后取众数桶，桶内 alpha 加权平均为主导色
 *   （平涂边缘不被背景色染灰，§4.3.4）。
 *
 * @param img 降采样后的中间图像素（尺寸 ≥ 目标网格）
 * @param targetW 目标宽（格数）
 * @param targetH 目标高（格数）
 * @param mode 代表色模式
 */
export function computeRepresentatives(
  img: PixelImage,
  targetW: number,
  targetH: number,
  mode: ConvertMode,
): CellRepresentative[] {
  const { width: iw, height: ih, data } = img;
  const reps: CellRepresentative[] = [];
  for (let cy = 0; cy < targetH; cy++) {
    for (let cx = 0; cx < targetW; cx++) {
      const { x0, x1, y0, y1 } = cellSourceRect(cx, cy, iw, ih, targetW, targetH);
      let aSum = 0;
      let aR = 0;
      let aG = 0;
      let aB = 0;
      let count = 0;
      const buckets = mode === 'cartoon' ? new Map<number, { n: number; r: number; g: number; b: number }>() : null;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * iw + x) * 4;
          const a = data[o + 3];
          count += 1;
          if (a === 0) continue;
          aSum += a;
          aR += data[o] * a;
          aG += data[o + 1] * a;
          aB += data[o + 2] * a;
          if (buckets) {
            const key = quantizeKey(data[o], data[o + 1], data[o + 2]);
            const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
            entry.n += a;
            entry.r += data[o] * a;
            entry.g += data[o + 1] * a;
            entry.b += data[o + 2] * a;
            buckets.set(key, entry);
          }
        }
      }
      const alpha = count > 0 ? aSum / count : 0;
      if (aSum === 0 || !buckets) {
        reps.push({
          alpha,
          rgb: aSum === 0 ? { r: 0, g: 0, b: 0 } : { r: aR / aSum, g: aG / aSum, b: aB / aSum },
        });
        continue;
      }
      // 卡通模式：众数桶（alpha 权重最大）内取主导色
      let dom: { n: number; r: number; g: number; b: number } | null = null;
      for (const entry of buckets.values()) {
        if (!dom || entry.n > dom.n) dom = entry;
      }
      reps.push({
        alpha,
        rgb: dom && dom.n > 0 ? { r: dom.r / dom.n, g: dom.g / dom.n, b: dom.b / dom.n } : { r: 0, g: 0, b: 0 },
      });
    }
  }
  return reps;
}

// ---------------------------------------------------------------------------
// 阶段五：目标色数（色板子集聚类）
// ---------------------------------------------------------------------------

/** 在候选集内按 CIEDE2000 查找与 Lab 最近色的色板下标（无候选返回 -1）。 */
function nearestLabIndex(palette: Palette, candidates: readonly number[], lab: Lab): number {
  let best = -1;
  let bestD = Infinity;
  for (const i of candidates) {
    const d = ciede2000(lab, palette.labs[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** 色相 × 明度分层桶的合并阈值（ΔE00）：质心距离小于该值的桶不再各占一个名额。 */
const SUBSET_MERGE_THRESHOLD = 10;

/**
 * 目标色数控制：对实际出现的代表色做色相（12 桶）× 明度（4 桶）分层，
 * 按桶内总权重贪心选取 ≤ n 个桶（质心相近的桶合并让出名额），桶质心映射为
 * 最近的普通色板色，去重后得到子集。再由调用方在子集内逐格匹配最近色，
 * 从而保证产出用色 ≤ n（§4.3 定案）。
 *
 * @param reps 目标网格代表色列表
 * @param palette 品牌色板
 * @param n 目标色数上限（> 0 时生效）
 * @returns 色板下标子集（可能少于 n）
 */
export function selectPaletteSubset(
  reps: readonly CellRepresentative[],
  palette: Palette,
  n: number,
): number[] {
  if (n <= 0) return [...palette.matchable];

  // 去重（5bit）累计权重，按 色相×明度 分层入桶
  const uniques = new Map<number, { lab: Lab; weight: number; bin: number }>();
  for (const rep of reps) {
    if (rep.alpha <= 0) continue;
    const key = quantizeKey(rep.rgb.r, rep.rgb.g, rep.rgb.b);
    let u = uniques.get(key);
    if (!u) {
      const center = quantizeCenter(key);
      const { h, s, l } = rgbToHsl(center);
      const hueIdx = s < 0.08 ? 12 : Math.min(11, Math.floor(h / 30));
      const lIdx = l < 0.25 ? 0 : l < 0.5 ? 1 : l < 0.75 ? 2 : 3;
      u = { lab: rgbToLab(center), weight: 0, bin: hueIdx * 4 + lIdx };
      uniques.set(key, u);
    }
    u.weight += 1;
  }
  const bins = new Map<number, { weight: number; l: number; a: number; b: number }>();
  for (const u of uniques.values()) {
    const bin = bins.get(u.bin) ?? { weight: 0, l: 0, a: 0, b: 0 };
    bin.weight += u.weight;
    bin.l += u.lab.l * u.weight;
    bin.a += u.lab.a * u.weight;
    bin.b += u.lab.b * u.weight;
    bins.set(u.bin, bin);
  }
  if (bins.size === 0) return [];

  // 按总权重降序贪心：质心与已选桶过近（< 阈值）的合并跳过，凑满 n 个为止
  const ordered = [...bins.values()].sort((x, y) => y.weight - x.weight);
  const selectedCentroids: Lab[] = [];
  const subset: number[] = [];
  for (const bin of ordered) {
    if (selectedCentroids.length >= n) break;
    const centroid: Lab = { l: bin.l / bin.weight, a: bin.a / bin.weight, b: bin.b / bin.weight };
    if (selectedCentroids.some((c) => ciede2000(c, centroid) < SUBSET_MERGE_THRESHOLD)) continue;
    selectedCentroids.push(centroid);
    const idx = nearestLabIndex(palette, palette.matchable, centroid);
    if (idx >= 0 && !subset.includes(idx)) subset.push(idx);
  }
  return subset;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 图片转图纸主管线。同步执行；104×104 网格的大图请在 Worker 中调用。
 *
 * @param img 源图像素（RGBA）
 * @param palette 品牌色板
 * @param targetW 目标宽（格数，7–104）
 * @param targetH 目标高（格数）
 * @param options 转换参数（缺省 = DEFAULT_CONVERT_OPTIONS）
 * @returns 转换结果（cells 为色板下标，-1 = 空格）
 */
export function convertImage(
  img: PixelImage,
  palette: Palette,
  targetW: number,
  targetH: number,
  options: Readonly<ConvertOptions> = DEFAULT_CONVERT_OPTIONS,
): ConvertResult {
  const invalid = validateSource(img);
  if (invalid) return invalid;

  let work = img;
  if (options.background.remove) {
    work = removeSolidBackground(work, options.background.tolerance);
  }
  const mid = halveToNear(work, targetW, targetH, options.mode);
  const reps = computeRepresentatives(mid, targetW, targetH, options.mode);

  const subset =
    options.targetColors > 0 ? selectPaletteSubset(reps, palette, options.targetColors) : undefined;
  const matcher = createNearestMatcher(palette, subset);

  const cells = new Int16Array(targetW * targetH);
  const used = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    const rep = reps[i];
    if (rep.alpha < options.alphaThreshold) {
      cells[i] = -1;
      continue;
    }
    const idx = matcher.nearestIndex(rep.rgb);
    cells[i] = idx;
    if (idx >= 0) used.add(idx);
  }
  return { ok: true, w: targetW, h: targetH, cells, usedCodes: used.size };
}
