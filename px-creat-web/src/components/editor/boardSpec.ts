import type { BrandKey } from '@/lib/types';
import type { BeadSpec } from '@/store/project';

/**
 * 规格与板型常量（m2 定案，PRD §新建项目）：
 * 规格 5mm/2.6mm × 板型档位 29/52/58/87/104 + 自定义 7–104 正方形。
 * 规格与板型联动：不匹配的组合禁用并给出原因。
 */

/** 板型档位。 */
export interface BoardPreset {
  size: number;
  label: string;
  note: string;
  /** 该板型支持的规格。 */
  specs: readonly BeadSpec[];
}

export const BOARD_PRESETS: readonly BoardPreset[] = [
  { size: 29, label: '29×29', note: '5mm 标准互锁小板', specs: ['5mm'] },
  { size: 52, label: '52×52', note: '2.6mm 迷你方板', specs: ['2.6mm'] },
  { size: 58, label: '58×58', note: '2.6mm 迷你大方板', specs: ['2.6mm'] },
  { size: 87, label: '87×87', note: '5mm 3×29 拼合', specs: ['5mm'] },
  { size: 104, label: '104×104', note: '双规格通用大图', specs: ['5mm', '2.6mm'] },
];

export const CUSTOM_SIZE_MIN = 7;
export const CUSTOM_SIZE_MAX = 104;

/** 各品牌支持的规格（与 BRAND_INFOS.sizeNote 口径一致）。 */
export const BRAND_SPEC_SUPPORT: Readonly<Record<BrandKey, readonly BeadSpec[]>> = {
  mard: ['2.6mm', '5mm'],
  coco: ['2.6mm'],
  perler: ['5mm'],
  hama: ['5mm'],
  artkal: ['2.6mm', '5mm'],
};

/** 新建对话框开放全部五品牌（规格不匹配的经 brandSupportsSpec 联动禁用）。 */
export const NEW_DIALOG_BRANDS: readonly BrandKey[] = ['mard', 'coco', 'perler', 'hama', 'artkal'];

/** 板型对规格的可用性：不可用时返回禁用原因文案。 */
export function boardDisableReason(preset: BoardPreset, spec: BeadSpec): string | null {
  if (preset.specs.includes(spec)) return null;
  return `${spec} 规格不能使用 ${preset.label} 板（${preset.specs.join('/')} 专用）`;
}

/** 品牌对规格的可用性。 */
export function brandSupportsSpec(brand: BrandKey, spec: BeadSpec): boolean {
  return BRAND_SPEC_SUPPORT[brand].includes(spec);
}

/** 规格对应的豆径（mm）。 */
export function specMm(spec: BeadSpec): number {
  return spec === '5mm' ? 5 : 2.6;
}

/** 物理边长（cm，保留 1 位小数）。 */
export function physicalCm(cells: number, spec: BeadSpec): number {
  return Math.round(((cells * specMm(spec)) / 10) * 10) / 10;
}

/** 板数计算的基准板边长（5mm → 29，2.6mm → 52）。 */
export function baseBoardSize(spec: BeadSpec): number {
  return spec === '5mm' ? 29 : 52;
}

/** 板覆盖数。 */
export interface BoardCoverage {
  cols: number;
  rows: number;
  total: number;
}

export function boardCoverage(w: number, h: number, spec: BeadSpec): BoardCoverage {
  const base = baseBoardSize(spec);
  const cols = Math.ceil(w / base);
  const rows = Math.ceil(h / base);
  return { cols, rows, total: cols * rows };
}
