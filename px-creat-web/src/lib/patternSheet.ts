/**
 * 图纸 PNG 渲染：版式布局计算 + 绘制指令执行（§4.7 导出与编辑器预览共用）。
 *
 * 本模块只做数据准备与绘制调度：canvas 上下文通过 {@link Canvas2DLike} 注入，
 * lib 层自身不依赖 DOM 运行时（便于单测与跨端复用）。
 */

import type { Palette } from './palettes';
import { BRAND_INFOS } from './palettes';
import type { BomRow, Rgb } from './types';

// ---------------------------------------------------------------------------
// BOM 统计
// ---------------------------------------------------------------------------

/**
 * 统计图纸用色（BOM）：按颗数降序、同颗数按色号字典序，保证结果确定。
 *
 * @param cells 色板下标数组（行优先，-1 = 空格）
 * @param w 网格宽
 * @param h 网格高
 * @param palette 品牌色板
 */
export function computeBom(
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  palette: Palette,
): BomRow[] {
  if (cells.length < w * h) throw new Error(`cells 长度 ${cells.length} 小于 ${w}×${h}`);
  const counts = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    const v = cells[i];
    if (v < 0) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const rows: BomRow[] = [];
  for (const [index, count] of counts) {
    const color = palette.colors[index];
    if (!color) throw new Error(`色板下标越界：${index}`);
    rows.push({ brand: color.brand, code: color.code, name: color.name, rgb: color.rgb, count });
  }
  rows.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, undefined, { numeric: true }));
  return rows;
}

// ---------------------------------------------------------------------------
// 版式布局
// ---------------------------------------------------------------------------

/** 图纸版式：Pattern sheet（完整版式：标题 + 网格 + 刻度 + 图例）/ Pattern only（仅图案区）。 */
export type SheetLayoutKind = 'sheet' | 'pattern_only';

/** 图纸渲染选项。 */
export interface PatternSheetOptions {
  /** 版式（默认 sheet）。 */
  layout: SheetLayoutKind;
  /** 格子色号标注开关（高倍率格内直接印色号）。 */
  cellLabels: boolean;
  /** 作者署名（空串 = 不署名）。 */
  author: string;
  /** 标题（空串 = 不渲染标题行）。 */
  title: string;
  /** 每格像素，0 = 自动（按 sheetMaxWidth 适配）。 */
  cellPx: number;
  /** 图纸整图宽度上限（px），自动选取 cellPx 时不超过它。 */
  sheetMaxWidth: number;
}

/** 图纸渲染选项缺省值。 */
export const DEFAULT_SHEET_OPTIONS: Readonly<PatternSheetOptions> = Object.freeze({
  layout: 'sheet',
  cellLabels: false,
  author: '',
  title: '',
  cellPx: 0,
  sheetMaxWidth: 2200,
});

/** 供自动选取的 cellPx 档位（从大到小取第一个不超宽的）。 */
const CELL_PX_STEPS = [28, 24, 20, 18, 16, 14, 12, 10, 8] as const;

/** 网格四周留白（含坐标刻度区）。 */
const PADDING = 36;
/** 刻度数字字号。 */
const TICK_FONT_SIZE = 12;
/** 图例行高。 */
const LEGEND_ROW_HEIGHT = 24;
/** 图例每列可容纳的行项宽度（色块 + 色号 + 颗数）。 */
const LEGEND_COLUMN_WIDTH = 260;
/** 图例与网格间距 + 标题区高度。 */
const HEADER_HEIGHT = 56;
const LEGEND_GAP = 24;

/** 计算后的图纸版式（全部为像素坐标，供渲染与测试断言）。 */
export interface SheetLayout {
  /** 整图宽 / 高。 */
  width: number;
  height: number;
  /** 每格像素。 */
  cellPx: number;
  /** 图案区（含 1px 边框）。 */
  grid: { x: number; y: number; w: number; h: number };
  /** 标题区（pattern_only 为 null）。 */
  header: { x: number; y: number; height: number } | null;
  /** 图例区（pattern_only 为 null）。 */
  legend: { x: number; y: number; w: number; rowHeight: number; columns: number } | null;
  /** x 方向刻度所在的列（0 基格坐标，每 5 格一处）。 */
  xTicks: number[];
  /** y 方向刻度所在的行。 */
  yTicks: number[];
}

/**
 * 计算图纸版式布局（纯函数，无需 canvas）。
 *
 * @param w 网格宽（格数）
 * @param h 网格高（格数）
 * @param bomRowCount 图例行数（BOM 色数）
 * @param options 渲染选项
 */
export function computeSheetLayout(
  w: number,
  h: number,
  bomRowCount: number,
  options: Readonly<PatternSheetOptions> = DEFAULT_SHEET_OPTIONS,
): SheetLayout {
  let cellPx = options.cellPx;
  if (cellPx <= 0) {
    cellPx = CELL_PX_STEPS[CELL_PX_STEPS.length - 1];
    for (const step of CELL_PX_STEPS) {
      if (w * step + PADDING * 2 <= options.sheetMaxWidth) {
        cellPx = step;
        break;
      }
    }
  }
  const gridW = w * cellPx;
  const gridH = h * cellPx;

  const xTicks: number[] = [];
  for (let x = 4; x < w; x += 5) xTicks.push(x);
  const yTicks: number[] = [];
  for (let y = 4; y < h; y += 5) yTicks.push(y);

  if (options.layout === 'pattern_only') {
    const gridX = PADDING;
    const gridY = PADDING;
    return {
      width: gridW + PADDING * 2,
      height: gridH + PADDING * 2,
      cellPx,
      grid: { x: gridX, y: gridY, w: gridW, h: gridH },
      header: null,
      legend: null,
      xTicks,
      yTicks,
    };
  }

  const header = options.title === '' ? null : { x: PADDING, y: PADDING / 2, height: HEADER_HEIGHT };
  const gridX = PADDING;
  const gridY = (header ? header.y + header.height : PADDING / 2) + TICK_FONT_SIZE + 4;
  const columns = Math.max(1, Math.floor(gridW / LEGEND_COLUMN_WIDTH));
  const legend = {
    x: PADDING,
    y: gridY + gridH + LEGEND_GAP,
    w: gridW,
    rowHeight: LEGEND_ROW_HEIGHT,
    columns,
  };
  const legendRows = Math.ceil(bomRowCount / columns);
  return {
    width: gridW + PADDING * 2,
    height: legend.y + legendRows * LEGEND_ROW_HEIGHT + PADDING,
    cellPx,
    grid: { x: gridX, y: gridY, w: gridW, h: gridH },
    header,
    legend,
    xTicks,
    yTicks,
  };
}

// ---------------------------------------------------------------------------
// 渲染（canvas 注入）
// ---------------------------------------------------------------------------

/** 文本对齐（canvas 属性的宽松字符串类型，兼容真实 2D 上下文与 mock）。 */
export type TextAlignLike = string;
export type TextBaselineLike = string;

/**
 * 最小 canvas 2D 绘制接口（结构兼容 CanvasRenderingContext2D：样式字段
 * 覆盖渐变/图案联合类型）。lib 通过它下发绘制指令，具体绘制由调用方
 * （DOM canvas / 测试 mock）执行。
 */
export interface Canvas2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: TextAlignLike;
  textBaseline: TextBaselineLike;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

/** 渲染参数。 */
export interface RenderPatternArgs {
  cells: Int16Array | readonly number[];
  w: number;
  h: number;
  palette: Palette;
}

/** css 颜色串。 */
function cssRgb(rgb: Rgb): string {
  return `rgb(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)})`;
}

/**
 * 在注入的 canvas 上下文上渲染图纸：标题/署名 → 网格底与边框 → 格子色块 →
 * 网格线（每 5 格加粗）→ 坐标刻度（每 5 格）→ 底部图例（色块/色号/颗数）。
 * pattern_only 版式跳过标题与图例；cellLabels 开启时在格内印色号。
 *
 * @param ctx 注入的 2D 上下文（坐标原点为图纸左上角，调用方负责画布尺寸 = layout.width×height）
 * @param args 图纸数据
 * @param options 渲染选项
 * @returns 实际使用的版式（调用方据此设置画布尺寸）
 */
export function renderPatternSheet(
  ctx: Canvas2DLike,
  args: RenderPatternArgs,
  options: Readonly<PatternSheetOptions> = DEFAULT_SHEET_OPTIONS,
): SheetLayout {
  const bom = computeBom(args.cells, args.w, args.h, args.palette);
  const layout = computeSheetLayout(args.w, args.h, bom.length, options);
  const { grid, cellPx } = layout;

  // 标题区：标题 +（品牌 · 规格 · 作者）副题
  if (layout.header) {
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(options.title, layout.header.x, layout.header.y + 28);
    const subtitle = [
      BRAND_INFOS[args.palette.brand].label,
      `${args.w}×${args.h}`,
      options.author === '' ? null : `by ${options.author}`,
      `${bom.length} 色`,
    ]
      .filter((s): s is string => s !== null)
      .join(' · ');
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(subtitle, layout.header.x, layout.header.y + 48);
  }

  // 网格底 + 外边框
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111827';
  ctx.strokeRect(grid.x, grid.y, grid.w, grid.h);

  // 格子色块（cellLabels 开启且格子足够大时印色号）
  const labelFontPx = Math.max(7, Math.floor(cellPx * 0.34));
  for (let y = 0; y < args.h; y++) {
    for (let x = 0; x < args.w; x++) {
      const idx = args.cells[y * args.w + x];
      if (idx < 0) continue;
      const color = args.palette.colors[idx];
      if (!color) continue;
      const px = grid.x + x * cellPx;
      const py = grid.y + y * cellPx;
      ctx.fillStyle = cssRgb(color.rgb);
      ctx.fillRect(px, py, cellPx, cellPx);
      if (options.cellLabels && cellPx >= 12) {
        ctx.font = `${labelFontPx}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111827';
        ctx.fillText(color.code, px + cellPx / 2, py + cellPx / 2);
      }
    }
  }

  // 网格线：细线每格，粗线每 5 格（均以 1–2px 填充矩形绘制）
  ctx.lineWidth = 1;
  ctx.fillStyle = '#e5e7eb';
  for (let x = 1; x < args.w; x++) {
    ctx.fillRect(grid.x + x * cellPx, grid.y, 1, grid.h);
  }
  for (let y = 1; y < args.h; y++) {
    ctx.fillRect(grid.x, grid.y + y * cellPx, grid.w, 1);
  }
  ctx.fillStyle = '#9ca3af';
  for (const x of layout.xTicks) {
    ctx.fillRect(grid.x + (x + 1) * cellPx - 1, grid.y, 2, grid.h);
  }
  for (const y of layout.yTicks) {
    ctx.fillRect(grid.x, grid.y + (y + 1) * cellPx - 1, grid.w, 2);
  }

  // 坐标刻度数字（1 基，每 5 格）
  if (options.layout === 'sheet') {
    ctx.font = `${TICK_FONT_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#6b7280';
    for (const x of layout.xTicks) {
      ctx.fillText(String(x + 1), grid.x + (x + 1) * cellPx, grid.y - 6);
    }
    ctx.textAlign = 'right';
    for (const y of layout.yTicks) {
      ctx.fillText(String(y + 1), grid.x - 8, grid.y + (y + 1) * cellPx + 4);
    }
  }

  // 图例：色块 + 色号 + 颗数（多列排布）
  const legend = layout.legend;
  if (legend) {
    const rowsPerColumn = Math.ceil(bom.length / legend.columns);
    ctx.font = '13px sans-serif';
    ctx.textBaseline = 'alphabetic';
    bom.forEach((row, i) => {
      const col = Math.floor(i / rowsPerColumn);
      const rowInCol = i % rowsPerColumn;
      const itemX = legend.x + col * LEGEND_COLUMN_WIDTH;
      const itemY = legend.y + rowInCol * legend.rowHeight;
      ctx.fillStyle = cssRgb(row.rgb);
      ctx.fillRect(itemX, itemY, 16, 16);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(itemX, itemY, 16, 16);
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.fillText(`${row.code} × ${row.count}`, itemX + 24, itemY + 13);
    });
  }
  return layout;
}
