/**
 * 品牌色板：五品牌 CSV 数据的解析、加载、分组与查询（§4.5）。
 *
 * 数据源文件见 src/data/（唯一权威来源），本模块负责在构建期内置后按需解析。
 */

import { rgbToHsl, rgbToLab, rgbDeltaE, type Lab } from './color';
import type { BeadColor, BrandInfo, BrandKey, Rgb } from './types';
import { BRAND_KEYS } from './types';

import mardCsv from '../data/mard.csv?raw';
import cocoCsv from '../data/coco.csv?raw';
import perlerCsv from '../data/perler.csv?raw';
import hamaCsv from '../data/hama.csv?raw';
import artkalRCsv from '../data/artkal_r.csv?raw';
import artkalSCsv from '../data/artkal_s.csv?raw';
import artkalACsv from '../data/artkal_a.csv?raw';
import artkalCCsv from '../data/artkal_c.csv?raw';

/** 一个品牌的已解析色板。 */
export interface Palette {
  readonly brand: BrandKey;
  readonly colors: readonly BeadColor[];
  /** 预计算 CIELAB（与 `colors` 同下标），供色差计算复用。 */
  readonly labs: readonly Lab[];
  /** 参与默认自动匹配的色板下标（排除特殊效果色）。 */
  readonly matchable: readonly number[];
}

/** 品牌元数据（展示顺序 = BRAND_KEYS：本土品牌优先）。 */
export const BRAND_INFOS: Readonly<Record<BrandKey, BrandInfo>> = {
  mard: { key: 'mard', label: 'MARD 码德', sizeNote: '2.6mm（291 全集）/ 5mm（221 子集）' },
  coco: { key: 'coco', label: 'COCO', sizeNote: '2.6mm' },
  perler: { key: 'perler', label: 'Perler 培乐', sizeNote: '5mm' },
  hama: { key: 'hama', label: 'Hama 哈马', sizeNote: '5mm Midi' },
  artkal: { key: 'artkal', label: 'Artkal', sizeNote: 'R/S 5mm；A/C 2.6mm' },
};

/** 各品牌对应的 CSV 文件（artkal 为 R/S/A/C 四系列合并）。 */
const CSV_SOURCES: Readonly<Record<BrandKey, string[]>> = {
  mard: [mardCsv],
  coco: [cocoCsv],
  perler: [perlerCsv],
  hama: [hamaCsv],
  artkal: [artkalRCsv, artkalSCsv, artkalACsv, artkalCCsv],
};

/**
 * 解析一份规范色板 CSV（格式见 src/data/README.md：`#` 注释行 + 表头
 * `code,name,r,g,b,color_type` + 数据行）。
 *
 * @param text CSV 全文
 * @param brand 归属品牌
 * @throws 数据行字段数不足或 RGB 越界时抛出
 */
export function parsePaletteCsv(text: string, brand: BrandKey): BeadColor[] {
  const colors: BeadColor[] = [];
  const codes = new Set<string>();
  let headerSeen = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (!headerSeen) {
      if (line.split(',')[0] !== 'code') throw new Error(`${brand}: 缺少表头行`);
      headerSeen = true;
      continue;
    }
    const parts = line.split(',');
    if (parts.length < 5) throw new Error(`${brand}: 字段不足：${line}`);
    const [code, name, rs, gs, bs, colorType] = parts;
    const rgb = { r: Number(rs), g: Number(gs), b: Number(bs) };
    if (![rgb.r, rgb.g, rgb.b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
      throw new Error(`${brand}: RGB 越界：${line}`);
    }
    if (codes.has(code)) throw new Error(`${brand}: 色号重复：${code}`);
    codes.add(code);
    colors.push({
      brand,
      code,
      name,
      rgb,
      ...(colorType ? { colorType: colorType as BeadColor['colorType'] } : {}),
    });
  }
  if (!headerSeen) throw new Error(`${brand}: 缺少表头行`);
  return colors;
}

const paletteCache = new Map<BrandKey, Palette>();

/**
 * 加载品牌色板（首次解析后缓存；同一品牌重复调用返回同一实例）。
 *
 * @param brand 品牌键
 */
export function loadPalette(brand: BrandKey): Palette {
  const cached = paletteCache.get(brand);
  if (cached) return cached;
  const colors: BeadColor[] = [];
  for (const csv of CSV_SOURCES[brand]) {
    colors.push(...parsePaletteCsv(csv, brand));
  }
  const labs = colors.map((c) => rgbToLab(c.rgb));
  const matchable = colors.map((c, i) => (c.colorType === undefined ? i : -1)).filter((i) => i >= 0);
  const palette: Palette = { brand, colors, labs, matchable };
  paletteCache.set(brand, palette);
  return palette;
}

/** 全部品牌色板（品牌切换面板用）。 */
export function loadAllPalettes(): Readonly<Record<BrandKey, Palette>> {
  const out = {} as Record<BrandKey, Palette>;
  for (const key of BRAND_KEYS) out[key] = loadPalette(key);
  return out;
}

// ---------------------------------------------------------------------------
// 色系分组（按 hue 分桶）
// ---------------------------------------------------------------------------

/** 无彩色（低饱和度）色系名。 */
export const ACHROMATIC_FAMILY = '无彩色';

/** 12 个色相桶名称，桶 i 覆盖 hue ∈ [i×30, (i+1)×30)。 */
const HUE_FAMILIES = ['红', '橙', '黄', '黄绿', '绿', '青绿', '青', '蓝', '蓝紫', '紫', '品红', '玫红'] as const;

/** 判定为无彩色的饱和度阈值（HSL s）。 */
const ACHROMATIC_S = 0.08;

/**
 * 计算颜色所属色系（hue 12 桶 + 无彩色）。
 *
 * @param rgb 0–255 的 sRGB 颜色
 */
export function hueFamilyOf(rgb: Rgb): string {
  const { h, s } = rgbToHsl(rgb);
  if (s < ACHROMATIC_S) return ACHROMATIC_FAMILY;
  return HUE_FAMILIES[Math.min(11, Math.floor(h / 30))];
}

/** 一个色系分组（组内保持色板原顺序）。 */
export interface ColorFamily {
  /** 色系名。 */
  name: string;
  /** 组内色板下标。 */
  indices: number[];
  colors: BeadColor[];
}

/**
 * 按色系分组色板（色板面板展示用）。
 * 组顺序：色相环顺序（红→玫红）在前，无彩色殿后。
 *
 * @param palette 品牌色板
 */
export function groupByFamily(palette: Palette): ColorFamily[] {
  const byName = new Map<string, ColorFamily>();
  for (const name of HUE_FAMILIES) byName.set(name, { name, indices: [], colors: [] });
  byName.set(ACHROMATIC_FAMILY, { name: ACHROMATIC_FAMILY, indices: [], colors: [] });
  palette.colors.forEach((color, index) => {
    const family = byName.get(hueFamilyOf(color.rgb));
    if (family) {
      family.indices.push(index);
      family.colors.push(color);
    }
  });
  return [...byName.values()].filter((f) => f.colors.length > 0);
}

// ---------------------------------------------------------------------------
// 搜索
// ---------------------------------------------------------------------------

/**
 * 按色号 / 名称搜索（大小写不敏感的包含匹配；空查询返回全量）。
 *
 * @param palette 品牌色板
 * @param query 查询串
 */
export function searchColors(palette: Palette, query: string): BeadColor[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...palette.colors];
  return palette.colors.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// 近似色查找（跨品牌切换的近似色提示，§4.4.2 / §4.5.2）
// ---------------------------------------------------------------------------

/** 一个近似色候选。 */
export interface NearestColor {
  /** 色板下标。 */
  index: number;
  color: BeadColor;
  /** 与查询色的 CIEDE2000 色差。 */
  deltaE: number;
}

/**
 * 在色板中查找与指定颜色最接近的候选（按色差升序）。
 * 供编辑器取色辅助与跨品牌切换的一键映射（m2）复用。
 *
 * @param palette 目标色板
 * @param rgb 查询色（0–255）
 * @param limit 返回候选数（默认 8）
 * @param includeEffects 是否包含特殊效果色（默认 false，§4.5.2）
 */
export function findNearestColors(
  palette: Palette,
  rgb: Rgb,
  limit = 8,
  includeEffects = false,
): NearestColor[] {
  const candidates = includeEffects ? palette.colors.map((_, i) => i) : palette.matchable;
  const scored: NearestColor[] = candidates.map((index) => ({
    index,
    color: palette.colors[index],
    deltaE: rgbDeltaE(rgb, palette.colors[index].rgb),
  }));
  scored.sort((a, b) => a.deltaE - b.deltaE || a.color.code.localeCompare(b.color.code));
  return scored.slice(0, limit);
}
