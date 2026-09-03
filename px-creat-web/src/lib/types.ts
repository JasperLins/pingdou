/**
 * 核心类型定义：工程 JSON schema（需求文档 §4.8）、色板数据结构（§4.5）、BOM 行、编辑器工具。
 *
 * 本模块是 lib/ 层的数据契约单一来源，schema 变更必须同步需求文档 §4.8 与根 AGENTS.md。
 */

// ---------------------------------------------------------------------------
// 基础颜色类型
// ---------------------------------------------------------------------------

/** sRGB 颜色，分量 0–255。 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// ---------------------------------------------------------------------------
// 色板系统（§4.5）
// ---------------------------------------------------------------------------

/** 品牌键（工程内品牌锁定，单一品牌）。 */
export type BrandKey = 'mard' | 'coco' | 'perler' | 'hama' | 'artkal';

/** 全部品牌键的有序列表（编辑器品牌选择的展示顺序，本土品牌优先）。 */
export const BRAND_KEYS: readonly BrandKey[] = ['mard', 'coco', 'perler', 'hama', 'artkal'];

/** 品牌展示信息。 */
export interface BrandInfo {
  key: BrandKey;
  /** 展示名（保留商标提示，不暗示官方授权）。 */
  label: string;
  /** 尺寸口径说明（屏幕参考）。 */
  sizeNote: string;
}

/** 特殊效果色类型（RGB 不代表实观感，默认不参与自动匹配）。可随数据扩展。 */
export type ColorType = 'pearl';

/** 一颗豆的颜色定义（全生态唯一权威数据结构，源数据在 src/data/*.csv）。 */
export interface BeadColor {
  brand: BrandKey;
  /** 品牌色号，如 A1 / 80-15179 / R01。 */
  code: string;
  /** 颜色名称；上游无名称数据时回填为色号。 */
  name: string;
  /** 屏幕参考色（实物以色卡为准）。 */
  rgb: Rgb;
  /** 特殊效果色标记；缺省 = 普通色。 */
  colorType?: ColorType;
}

// ---------------------------------------------------------------------------
// 工程 JSON schema（§4.8）
// ---------------------------------------------------------------------------

/** 工程 JSON schema 版本。 */
export const PROJECT_SCHEMA_VERSION = 1 as const;

/** 烫染预设键（§4.6：P0 交付前 6 种，noflap/wrinkle 为 P2 预留）。 */
export type FinishPreset = 'normal' | 'towel' | 'glitter' | 'sequin' | 'waffle' | 'loofah' | 'noflap' | 'wrinkle';

/** 全部合法烫染预设键。 */
export const FINISH_PRESETS: readonly FinishPreset[] = [
  'normal',
  'towel',
  'glitter',
  'sequin',
  'waffle',
  'loofah',
  'noflap',
  'wrinkle',
];

/** 烫染效果设置。整体可缺省（等价于 normal + 100）。 */
export interface FinishSetting {
  preset: FinishPreset;
  /** 强度 0–100 整数。 */
  intensity: number;
}

/** 烫染设置的缺省值：正常烫 + 100 强度。 */
export const DEFAULT_FINISH: Readonly<FinishSetting> = Object.freeze({ preset: 'normal', intensity: 100 });

/**
 * 工程（图纸）数据，对齐需求文档 §4.8 的工程 JSON schema。
 *
 * - `cells` 为品牌色板的下标数组（行优先），`-1` 表示空格；
 * - `finish` 可缺省，缺省等价于 `{ preset: 'normal', intensity: 100 }`；
 * - 参考图不属于工程 JSON 本体（体积考虑），本地存 IndexedDB、导出文件内嵌 dataURL（见 storage.ts）。
 */
export interface Project {
  v: typeof PROJECT_SCHEMA_VERSION;
  title: string;
  brandKey: BrandKey;
  w: number;
  h: number;
  cells: number[];
  finish?: FinishSetting;
}

// ---------------------------------------------------------------------------
// BOM（§4.5.3：色号 = 等级 = 商品 = 权益费率 映射预留）
// ---------------------------------------------------------------------------

/** BOM 行：`brand`/`code`/`count` 为 P1 商业映射的契约字段，`name`/`rgb` 供图纸图例渲染。 */
export interface BomRow {
  brand: BrandKey;
  code: string;
  name: string;
  rgb: Rgb;
  count: number;
}

// ---------------------------------------------------------------------------
// 编辑器工具（§4.4.1，m2 编辑器使用；此处只定契约）
// ---------------------------------------------------------------------------

/** 绘制工具类型。 */
export type EditorTool = 'brush' | 'eraser' | 'bucket' | 'line' | 'rect' | 'ellipse' | 'picker';
