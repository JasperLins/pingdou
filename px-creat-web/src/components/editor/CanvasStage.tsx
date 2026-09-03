import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  brushCells,
  diffOf,
  ellipseCells,
  floodFill,
  lineCells,
  mergeDiff,
  rectCells,
  type CellDiff,
} from '@/lib/cellOps';
import { loadPalette } from '@/lib/palettes';
import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { useThemeStore } from '@/store/theme';
import { useFinishStore } from '@/store/finish';

/**
 * 画布舞台：四层 canvas（参考/绘制/网格/交互）+ DPR + 指针中心缩放 +
 * 空格平移 + 网格缩放自适应 + rAF 脏区重绘（design.md §2）。
 *
 * 分层直接绘制（不建全图离屏缓冲）：104×104 在 48px/格的缓冲将逼近 100MB，
 * 改为视口裁剪 + 按色批量 Path2D，全量重绘实测在预算内（见任务报告）。
 * cells 变更走 lastDiff 脏区修补；视图/主题变更走全量重绘；指针预览只重绘交互层。
 *
 * 烫染预览态（M4）：previewing 时画布切只读效果图（隐藏网格/色号/参考/交互层），
 * 按住对比或渲染未就绪时显示平面图纸兜底；视图切换零副作用（不写 cells）。
 */

/** 格宽（CSS px）低于该值隐藏色号首字母。 */
const LETTER_MIN_SCALE = 8;
/** 格宽低于该值省略次级网格线（pixel-beads 采纳）。 */
const MINOR_LINE_MIN_SCALE = 4;
/** 色号首字母渲染的可见格数上限（保证 ≤16ms/帧）。 */
const LETTER_MAX_CELLS = 6000;
/** 视图内边距（fit 时的留白，CSS px）。 */
const FIT_PADDING = 24;

interface CellPoint {
  x: number;
  y: number;
}

interface EngineState {
  cssW: number;
  cssH: number;
  dpr: number;
  hover: CellPoint | null;
  shapeStart: CellPoint | null;
  shapeEnd: CellPoint | null;
  panning: { lastX: number; lastY: number } | null;
  stroke: CellDiff | null;
  strokePrev: CellPoint | null;
  imgEl: HTMLImageElement | null;
}

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cellCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const refCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const cells = useProjectStore((s) => s.cells);
  const cellsVersion = useProjectStore((s) => s.cellsVersion);
  const w = useProjectStore((s) => s.w);
  const h = useProjectStore((s) => s.h);
  const brandKey = useProjectStore((s) => s.brandKey);
  const refImage = useProjectStore((s) => s.refImage);

  const view = useEditorStore((s) => s.view);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const refVisible = useEditorStore((s) => s.refVisible);
  const refMode = useEditorStore((s) => s.refMode);
  const refOpacity = useEditorStore((s) => s.refOpacity);
  const highlightIndex = useEditorStore((s) => s.highlightIndex);
  const reviewColors = useEditorStore((s) => s.reviewColors);
  const spaceHeld = useEditorStore((s) => s.spaceHeld);

  const finishPreviewing = useFinishStore((s) => s.previewing);
  const finishComparing = useFinishStore((s) => s.comparing);
  const finishPreview = useFinishStore((s) => s.preview);
  const finishPreviewKey = useFinishStore((s) => s.previewKey);

  const themeKey = useThemeStore((s) => `${s.accent}:${s.dark}`);

  /** 色板渲染数据（品牌切换时重建）。 */
  const paletteData = useMemo(() => {
    const palette = loadPalette(brandKey);
    return {
      rgbs: palette.colors.map((c) => `${c.rgb.r},${c.rgb.g},${c.rgb.b}`),
      codes: palette.colors.map((c) => c.code),
      lum: palette.colors.map((c) => 0.299 * c.rgb.r + 0.587 * c.rgb.g + 0.114 * c.rgb.b),
    };
  }, [brandKey]);

  /** 渲染引擎读取的最新快照（每次渲染刷新，事件回调内取值）。 */
  const stateRef = useRef({
    w,
    h,
    view,
    paletteData,
    gridVisible,
    refMode,
    refVisible,
    refOpacity,
    highlightIndex,
    reviewColors: new Set(reviewColors),
    finishPreviewing,
    finishComparing,
    finishPreview,
    finishPreviewKey,
  });
  // 渲染后同步快照（layout 阶段，先于 rAF 回调与浏览器绘制）
  useLayoutEffect(() => {
    stateRef.current = {
      w,
      h,
      view,
      paletteData,
      gridVisible,
      refMode,
      refVisible,
      refOpacity,
      highlightIndex,
      reviewColors: new Set(reviewColors),
      finishPreviewing,
      finishComparing,
      finishPreview,
      finishPreviewKey,
    };
  });

  const engine = useRef<EngineState>({
    cssW: 0,
    cssH: 0,
    dpr: 1,
    hover: null,
    shapeStart: null,
    shapeEnd: null,
    panning: null,
    stroke: null,
    strokePrev: null,
    imgEl: null,
  });

  const rafRef = useRef(0);
  const dirtyRef = useRef({ view: true, cells: false, grid: true, refLayer: true, overlay: true });
  /** 烫染预览位图 → 离屏 canvas 缓存（按 previewKey 失效重建）。 */
  const finishCanvasRef = useRef<{ key: string | null; canvas: HTMLCanvasElement | null }>({
    key: null,
    canvas: null,
  });

  // -------------------------------------------------------------------------
  // 渲染原语
  // -------------------------------------------------------------------------

  const cssVar = useCallback((name: string): string => {
    if (typeof window === 'undefined') return '0 0 0';
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || '0 0 0';
  }, []);

  /** 下透写模式且参考图在场时，绘制层不铺不透明底色，空格透出参考图。 */
  const refUnderlayActive = useCallback((): boolean => {
    const { refMode: rm, refVisible: rv } = stateRef.current;
    return rm === 'under' && rv && !!engine.current.imgEl;
  }, []);

  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null, cssW: number, cssH: number, dpr: number) => {
    if (!canvas) return null;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }, []);

  const cellRectCss = useCallback((idx: number): [number, number, number, number] => {
    const { w: gw, view: v } = stateRef.current;
    const x = idx % gw;
    const y = Math.floor(idx / gw);
    return [v.offsetX + x * v.scale, v.offsetY + y * v.scale, v.scale, v.scale];
  }, []);

  const drawCell = useCallback(
    (ctx: CanvasRenderingContext2D, idx: number, colorIdx: number) => {
      const { paletteData: pd, view: v } = stateRef.current;
      const [px, py, s] = cellRectCss(idx);
      if (colorIdx < 0 || colorIdx >= pd.rgbs.length) {
        // 空格底色与全量路径保持一致：透写模式透出参考图，否则铺 surface
        ctx.clearRect(px, py, s, s);
        if (!refUnderlayActive()) {
          ctx.fillStyle = `rgb(${cssVar('--c-surface')})`;
          ctx.fillRect(px, py, s, s);
        }
        return;
      }
      ctx.clearRect(px, py, s, s);
      const rgb = pd.rgbs[colorIdx];
      // 方块底
      ctx.fillStyle = `rgba(${rgb},0.32)`;
      ctx.fillRect(px + 0.5, py + 0.5, s - 1, s - 1);
      // 圆形珠点
      const r = s * 0.36;
      const cx = px + s / 2;
      const cy = py + s / 2;
      ctx.beginPath();
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      if (s >= 20) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.arc(cx - r * 0.35, cy - r * 0.35, Math.max(1, s * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
      if (v.scale >= LETTER_MIN_SCALE) {
        const code = pd.codes[colorIdx];
        if (code) {
          ctx.font = `600 ${Math.max(7, Math.floor(s * 0.4))}px Poppins, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = pd.lum[colorIdx] < 140 ? 'rgba(255,255,255,0.92)' : 'rgba(20,16,20,0.75)';
          ctx.fillText(code[0].toUpperCase(), cx, cy + 0.5);
        }
      }
    },
    [cellRectCss, cssVar, refUnderlayActive],
  );

  const visibleRange = useCallback((): { x0: number; x1: number; y0: number; y1: number } | null => {
    const { w: gw, h: gh, view: v } = stateRef.current;
    const e = engine.current;
    if (e.cssW === 0 || e.cssH === 0) return null;
    return {
      x0: Math.max(0, Math.floor(-v.offsetX / v.scale)),
      x1: Math.min(gw - 1, Math.ceil((e.cssW - v.offsetX) / v.scale)),
      y0: Math.max(0, Math.floor(-v.offsetY / v.scale)),
      y1: Math.min(gh - 1, Math.ceil((e.cssH - v.offsetY) / v.scale)),
    };
  }, []);

  const renderCellsFull = useCallback(() => {
    const canvas = cellCanvasRef.current;
    const e = engine.current;
    const ctx = setupCanvas(canvas, e.cssW, e.cssH, e.dpr);
    if (!ctx) return;
    const { w: gw, h: gh, view: v, paletteData: pd } = stateRef.current;
    ctx.clearRect(0, 0, e.cssW, e.cssH);
    // 网格区域底色（surface）；下透写且有参考图时留空，空格透出参考层
    if (!refUnderlayActive()) {
      ctx.fillStyle = `rgb(${cssVar('--c-surface')})`;
      ctx.fillRect(v.offsetX, v.offsetY, gw * v.scale, gh * v.scale);
    }

    const range = visibleRange();
    if (!range || range.x1 < range.x0 || range.y1 < range.y0) return;
    const showLetters = v.scale >= LETTER_MIN_SCALE && (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) <= LETTER_MAX_CELLS;

    // 按色批量：方块底与珠点各一条 Path2D
    const squares = new Map<number, Path2D>();
    const beads = new Map<number, Path2D>();
    const letters: number[] = [];
    for (let y = range.y0; y <= range.y1; y++) {
      for (let x = range.x0; x <= range.x1; x++) {
        const idx = y * gw + x;
        const value = useProjectStore.getState().cells[idx];
        if (value < 0 || value >= pd.rgbs.length) continue;
        const px = v.offsetX + x * v.scale;
        const py = v.offsetY + y * v.scale;
        const s = v.scale;
        let sq = squares.get(value);
        if (!sq) {
          sq = new Path2D();
          squares.set(value, sq);
        }
        sq.rect(px + 0.5, py + 0.5, s - 1, s - 1);
        let bd = beads.get(value);
        if (!bd) {
          bd = new Path2D();
          beads.set(value, bd);
        }
        const r = s * 0.36;
        const cx = px + s / 2;
        const cy = py + s / 2;
        bd.moveTo(cx + r, cy);
        bd.arc(cx, cy, r, 0, Math.PI * 2);
        if (showLetters) letters.push(idx);
      }
    }
    for (const [value, path] of squares) {
      ctx.fillStyle = `rgba(${pd.rgbs[value]},0.32)`;
      ctx.fill(path);
    }
    for (const [value, path] of beads) {
      ctx.fillStyle = `rgb(${pd.rgbs[value]})`;
      ctx.fill(path);
    }
    if (showLetters) {
      ctx.font = `600 ${Math.max(7, Math.floor(v.scale * 0.4))}px Poppins, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cellsNow = useProjectStore.getState().cells;
      for (const idx of letters) {
        const value = cellsNow[idx];
        const px = v.offsetX + (idx % gw) * v.scale;
        const py = v.offsetY + Math.floor(idx / gw) * v.scale;
        ctx.fillStyle = pd.lum[value] < 140 ? 'rgba(255,255,255,0.92)' : 'rgba(20,16,20,0.75)';
        ctx.fillText(pd.codes[value][0].toUpperCase(), px + v.scale / 2, py + v.scale / 2 + 0.5);
      }
    }
  }, [cssVar, setupCanvas, visibleRange, refUnderlayActive]);

  const renderGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    const e = engine.current;
    const ctx = setupCanvas(canvas, e.cssW, e.cssH, e.dpr);
    if (!ctx) return;
    const { w: gw, h: gh, view: v, gridVisible: gv } = stateRef.current;
    ctx.clearRect(0, 0, e.cssW, e.cssH);
    if (!gv) return;
    const minor = `rgb(${cssVar('--c-line')})`;
    const major = `rgba(${cssVar('--c-ink-soft')},0.55)`;
    const gwPx = gw * v.scale;
    const ghPx = gh * v.scale;

    const drawLines = (step: number, style: string, width: number): void => {
      ctx.beginPath();
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      for (let x = 0; x <= gw; x += step) {
        const px = v.offsetX + x * v.scale;
        ctx.moveTo(px, v.offsetY);
        ctx.lineTo(px, v.offsetY + ghPx);
      }
      for (let y = 0; y <= gh; y += step) {
        const py = v.offsetY + y * v.scale;
        ctx.moveTo(v.offsetX, py);
        ctx.lineTo(v.offsetX + gwPx, py);
      }
      ctx.stroke();
    };

    // 缩放自适应：主刻度（每 5 格）常显，次级线在格宽足够时绘制
    drawLines(5, major, 1);
    if (v.scale >= MINOR_LINE_MIN_SCALE) drawLines(1, minor, 1);
    // 网格外框
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${cssVar('--c-ink-soft')},0.8)`;
    ctx.lineWidth = 1.5;
    ctx.rect(v.offsetX, v.offsetY, gwPx, ghPx);
    ctx.stroke();
  }, [cssVar, setupCanvas]);

  /** 预览位图 → 离屏 canvas（指纹缓存；jsdom 等无 2D 上下文环境返回 null）。 */
  const ensureFinishCanvas = useCallback((): HTMLCanvasElement | null => {
    const preview = stateRef.current.finishPreview;
    const key = stateRef.current.finishPreviewKey;
    if (!preview || !key) return null;
    if (finishCanvasRef.current.key === key && finishCanvasRef.current.canvas) {
      return finishCanvasRef.current.canvas;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = preview.w;
      canvas.height = preview.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(new ImageData(preview.rgba, preview.w, preview.h), 0, 0);
      finishCanvasRef.current = { key, canvas };
      return canvas;
    } catch {
      return null;
    }
  }, []);

  /** 平面图纸视图（对比 / 渲染未就绪兜底）：纯色块，无网格线、无色号、无珠点。 */
  const drawFlatCells = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { w: gw, view: v, paletteData: pd } = stateRef.current;
      const cells = useProjectStore.getState().cells;
      const range = visibleRange();
      if (!range) return;
      const squares = new Map<number, Path2D>();
      for (let y = range.y0; y <= range.y1; y++) {
        for (let x = range.x0; x <= range.x1; x++) {
          const value = cells[y * gw + x];
          if (value < 0 || value >= pd.rgbs.length) continue;
          let sq = squares.get(value);
          if (!sq) {
            sq = new Path2D();
            squares.set(value, sq);
          }
          sq.rect(v.offsetX + x * v.scale, v.offsetY + y * v.scale, v.scale, v.scale);
        }
      }
      for (const [value, path] of squares) {
        ctx.fillStyle = `rgb(${pd.rgbs[value]})`;
        ctx.fill(path);
      }
    },
    [visibleRange],
  );

  /** 烫染预览视图：效果图上屏（放大走平滑插值，呈现熔融质感）。 */
  const renderFinishView = useCallback(() => {
    const canvas = cellCanvasRef.current;
    const e = engine.current;
    const ctx = setupCanvas(canvas, e.cssW, e.cssH, e.dpr);
    if (!ctx) return;
    const { w: gw, h: gh, view: v, finishComparing: fc } = stateRef.current;
    ctx.clearRect(0, 0, e.cssW, e.cssH);
    ctx.fillStyle = `rgb(${cssVar('--c-surface')})`;
    ctx.fillRect(v.offsetX, v.offsetY, gw * v.scale, gh * v.scale);
    if (fc) {
      drawFlatCells(ctx);
      return;
    }
    const bmp = ensureFinishCanvas();
    if (!bmp) {
      drawFlatCells(ctx);
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, v.offsetX, v.offsetY, gw * v.scale, gh * v.scale);
  }, [cssVar, drawFlatCells, ensureFinishCanvas, setupCanvas]);

  const renderRefLayer = useCallback(() => {
    const canvas = refCanvasRef.current;
    const e = engine.current;
    const ctx = setupCanvas(canvas, e.cssW, e.cssH, e.dpr);
    if (!ctx) return;
    const { w: gw, h: gh, view: v, refVisible: rv, refOpacity: ro } = stateRef.current;
    ctx.clearRect(0, 0, e.cssW, e.cssH);
    if (!rv) return;
    const img = engine.current.imgEl;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    // 参考图 contain 适配网格区域
    const areaW = gw * v.scale;
    const areaH = gh * v.scale;
    const ratio = Math.min(areaW / img.naturalWidth, areaH / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    ctx.globalAlpha = ro / 100;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, v.offsetX + (areaW - dw) / 2, v.offsetY + (areaH - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }, [setupCanvas]);

  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const e = engine.current;
    const ctx = setupCanvas(canvas, e.cssW, e.cssH, e.dpr);
    if (!ctx) return;
    const { view: v, highlightIndex: hi, reviewColors: rc } = stateRef.current;
    const tool = useEditorStore.getState().tool;
    const brushSize = useEditorStore.getState().brushSize;
    ctx.clearRect(0, 0, e.cssW, e.cssH);

    // 颜色高亮遮罩（StatsPanel 点击定位）
    if (hi !== null) {
      const cells = useProjectStore.getState().cells;
      const path = new Path2D();
      for (let idx = 0; idx < cells.length; idx++) {
        if (cells[idx] !== hi) continue;
        const x = idx % stateRef.current.w;
        const y = Math.floor(idx / stateRef.current.w);
        path.rect(v.offsetX + x * v.scale + 1, v.offsetY + y * v.scale + 1, v.scale - 2, v.scale - 2);
      }
      ctx.fillStyle = `rgba(${cssVar('--c-primary')},0.45)`;
      ctx.fill(path);
    }

    // 品牌映射复查角标
    if (rc.size > 0) {
      const cells = useProjectStore.getState().cells;
      ctx.fillStyle = `rgba(${cssVar('--c-primary-strong')},0.95)`;
      for (let idx = 0; idx < cells.length; idx++) {
        if (!rc.has(cells[idx])) continue;
        const x = idx % stateRef.current.w;
        const y = Math.floor(idx / stateRef.current.w);
        const px = v.offsetX + x * v.scale;
        const py = v.offsetY + y * v.scale;
        const r = Math.max(2.5, v.scale * 0.16);
        ctx.beginPath();
        ctx.arc(px + v.scale - r - 1, py + r + 1, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 图形工具预览
    if (e.shapeStart && e.shapeEnd) {
      const indices = shapeIndices(tool, e.shapeStart, e.shapeEnd, stateRef.current.w, stateRef.current.h);
      const colorIdx = useEditorStore.getState().colorIndex;
      const rgb = stateRef.current.paletteData.rgbs[colorIdx] ?? '0 0 0';
      ctx.fillStyle = `rgba(${rgb},0.55)`;
      const path = new Path2D();
      for (const idx of indices) {
        const x = idx % stateRef.current.w;
        const y = Math.floor(idx / stateRef.current.w);
        path.rect(v.offsetX + x * v.scale + 0.5, v.offsetY + y * v.scale + 0.5, v.scale - 1, v.scale - 1);
      }
      ctx.fill(path);
    }

    // 笔刷光标
    if (e.hover && (tool === 'brush' || tool === 'eraser')) {
      const s = brushSize;
      const minX = e.hover.x - Math.floor((s - 1) / 2);
      const minY = e.hover.y - Math.floor((s - 1) / 2);
      ctx.strokeStyle = tool === 'eraser' ? `rgba(${cssVar('--c-ink-soft')},0.9)` : `rgb(${cssVar('--c-primary')})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        v.offsetX + minX * v.scale + 1,
        v.offsetY + minY * v.scale + 1,
        s * v.scale - 2,
        s * v.scale - 2,
      );
    } else if (e.hover) {
      ctx.strokeStyle = `rgba(${cssVar('--c-ink-soft')},0.8)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(v.offsetX + e.hover.x * v.scale + 1, v.offsetY + e.hover.y * v.scale + 1, v.scale - 2, v.scale - 2);
    }
  }, [cssVar, setupCanvas]);

  // -------------------------------------------------------------------------
  // rAF 调度
  // -------------------------------------------------------------------------

  const flush = useCallback(() => {
    rafRef.current = 0;
    const dirty = dirtyRef.current;
    const e = engine.current;
    // 烫染预览态：只渲染效果图层，网格/参考/交互层清空隐藏
    if (stateRef.current.finishPreviewing) {
      renderFinishView();
      const clearLayer = (canvas: HTMLCanvasElement | null): void => {
        const ctx = setupCanvas(canvas, e.cssW, e.cssH, e.dpr);
        ctx?.clearRect(0, 0, e.cssW, e.cssH);
      };
      clearLayer(gridCanvasRef.current);
      clearLayer(refCanvasRef.current);
      clearLayer(overlayCanvasRef.current);
      dirtyRef.current = { view: false, cells: false, grid: false, refLayer: false, overlay: false };
      return;
    }
    if (dirty.view) {
      renderCellsFull();
      renderGrid();
      renderRefLayer();
      renderOverlay();
    } else {
      if (dirty.cells) {
        const diff = useProjectStore.getState().lastDiff;
        if (diff && diff.indices.length > 0 && diff.indices.length < 512) {
          const ctx = setupCanvas(cellCanvasRef.current, engine.current.cssW, engine.current.cssH, engine.current.dpr);
          if (ctx) {
            const cellsNow = useProjectStore.getState().cells;
            for (const idx of diff.indices) drawCell(ctx, idx, cellsNow[idx]);
          }
        } else {
          renderCellsFull();
        }
      }
      if (dirty.grid) renderGrid();
      if (dirty.refLayer) renderRefLayer();
      if (dirty.overlay) renderOverlay();
    }
    dirtyRef.current = { view: false, cells: false, grid: false, refLayer: false, overlay: false };
  }, [drawCell, renderCellsFull, renderFinishView, renderGrid, renderRefLayer, renderOverlay, setupCanvas]);

  const schedule = useCallback(
    (kind: 'view' | 'cells' | 'grid' | 'refLayer' | 'overlay') => {
      dirtyRef.current[kind] = true;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  // 尺寸 / DPR / 主题 / 工程 / 视图 / 面板开关 → 调度重绘
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const applySize = (): void => {
      const rect = container.getBoundingClientRect();
      engine.current.cssW = rect.width;
      engine.current.cssH = rect.height;
      engine.current.dpr = window.devicePixelRatio || 1;
    };
    applySize();
    // jsdom 等无 ResizeObserver 环境（组件冒烟测试）跳过监听
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      applySize();
      schedule('view');
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [schedule]);

  useEffect(() => {
    schedule('view');
  }, [themeKey, w, h, brandKey, view, gridVisible, schedule]);

  // 烫染预览态/对比/新位图 → 效果图重绘
  useEffect(() => {
    schedule('view');
  }, [finishPreviewing, finishComparing, finishPreviewKey, finishPreview, schedule]);

  useEffect(() => {
    // 底色填充随透写开关变化，cells 层也要全量重绘
    schedule('refLayer');
    schedule('cells');
  }, [refImage, refVisible, refOpacity, refMode, schedule]);

  useEffect(() => {
    schedule('overlay');
  }, [highlightIndex, reviewColors, schedule]);

  useEffect(() => {
    schedule('cells');
  }, [cellsVersion, cells, schedule]);

  // 参考图加载（dataURL → HTMLImageElement）
  useEffect(() => {
    if (!refImage) {
      engine.current.imgEl = null;
      schedule('refLayer');
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (engine.current.imgEl === img) schedule('refLayer');
    };
    engine.current.imgEl = img;
    img.src = refImage.dataUrl;
    schedule('refLayer');
    return () => {
      if (engine.current.imgEl === img) engine.current.imgEl = null;
    };
  }, [refImage, schedule]);

  // 初始 fit + 工程尺寸变化时 fit
  useEffect(() => {
    if (w <= 0 || h <= 0) return;
    const e = engine.current;
    if (e.cssW === 0) return;
    const fitScale = Math.min((e.cssW - FIT_PADDING * 2) / w, (e.cssH - FIT_PADDING * 2) / h);
    if (fitScale > 0 && Number.isFinite(fitScale)) {
      const scale = Math.min(64, Math.max(2, fitScale));
      useEditorStore.getState().setView({
        scale,
        offsetX: (e.cssW - w * scale) / 2,
        offsetY: (e.cssH - h * scale) / 2,
      });
    }
    // 仅在工程尺寸（新建/导入）变化时自适应视图
  }, [w, h]);

  // -------------------------------------------------------------------------
  // 指针交互
  // -------------------------------------------------------------------------

  const toCell = useCallback((clientX: number, clientY: number): CellPoint | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const v = stateRef.current.view;
    return {
      x: Math.floor((clientX - rect.left - v.offsetX) / v.scale),
      y: Math.floor((clientY - rect.top - v.offsetY) / v.scale),
    };
  }, []);

  const inBounds = useCallback((p: CellPoint): boolean => {
    return p.x >= 0 && p.y >= 0 && p.x < stateRef.current.w && p.y < stateRef.current.h;
  }, []);

  const paintAt = useCallback((point: CellPoint) => {
    const { tool, brushSize, colorIndex } = useEditorStore.getState();
    if (tool !== 'brush' && tool !== 'eraser') return;
    const value = tool === 'eraser' ? -1 : colorIndex;
    const indices = brushCells(point.x, point.y, brushSize, stateRef.current.w, stateRef.current.h);
    const cells = useProjectStore.getState().cells;
    const seg = diffOf(cells, indices, indices.map(() => value));
    if (seg.indices.length > 0) {
      useProjectStore.getState().paintCells(seg.indices, [...seg.after]);
      engine.current.stroke = engine.current.stroke ? mergeDiff(engine.current.stroke, seg) : seg;
    }
  }, []);

  const strokeTo = useCallback(
    (point: CellPoint) => {
      const prev = engine.current.strokePrev;
      if (prev) {
        const { w: gw, h: gh } = stateRef.current;
        for (const p of lineCells(prev.x, prev.y, point.x, point.y, gw, gh)) {
          paintAt({ x: p % gw, y: Math.floor(p / gw) });
        }
      } else {
        paintAt(point);
      }
      engine.current.strokePrev = point;
    },
    [paintAt],
  );

  const commitStroke = useCallback(() => {
    const stroke = engine.current.stroke;
    if (stroke && stroke.indices.length > 0) {
      const tool = useEditorStore.getState().tool;
      useProjectStore.getState().recordStroke(stroke, tool === 'eraser' ? '橡皮擦除' : '画笔绘制');
    }
    engine.current.stroke = null;
    engine.current.strokePrev = null;
  }, []);

  const pickColorAt = useCallback((point: CellPoint) => {
    if (!inBounds(point)) return;
    const value = useProjectStore.getState().cells[point.y * stateRef.current.w + point.x];
    if (value >= 0) useEditorStore.getState().setColorIndex(value);
  }, [inBounds]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const container = containerRef.current;
      if (!container) return;
      if (useEditorStore.getState().spaceHeld || e.button === 1) {
        const rect = container.getBoundingClientRect();
        engine.current.panning = { lastX: e.clientX - rect.left, lastY: e.clientY - rect.top };
        return;
      }
      // 烫染预览态为只读视图：不落笔、不取色、不拉形状（仅中键平移）
      if (stateRef.current.finishPreviewing) return;
      if (e.button !== 0) return;
      const cell = toCell(e.clientX, e.clientY);
      if (!cell || !inBounds(cell)) return;
      const tool = useEditorStore.getState().tool;
      if (e.altKey || tool === 'picker') {
        pickColorAt(cell);
        return;
      }
      if (tool === 'brush' || tool === 'eraser') {
        engine.current.stroke = null;
        engine.current.strokePrev = null;
        strokeTo(cell);
        return;
      }
      if (tool === 'bucket') {
        const value = useEditorStore.getState().colorIndex;
        const { cells: cs, w: gw, h: gh } = useProjectStore.getState();
        const diff = floodFill(cs, gw, gh, cell.x, cell.y, value);
        if (diff.indices.length > 0) useProjectStore.getState().applyDiff(diff, '油漆桶填充');
        return;
      }
      // line / rect / ellipse：预览起点
      engine.current.shapeStart = cell;
      engine.current.shapeEnd = cell;
      schedule('overlay');
    },
    [inBounds, pickColorAt, schedule, strokeTo, toCell],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (engine.current.panning) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const v = useEditorStore.getState().view;
        useEditorStore.getState().setView({
          offsetX: v.offsetX + (px - engine.current.panning.lastX),
          offsetY: v.offsetY + (py - engine.current.panning.lastY),
        });
        engine.current.panning = { lastX: px, lastY: py };
        return;
      }
      // 预览态：无笔刷光标/形状预览/落笔（平移除外）
      if (stateRef.current.finishPreviewing) return;
      const cell = toCell(e.clientX, e.clientY);
      const prevHover = engine.current.hover;
      engine.current.hover = cell && inBounds(cell) ? cell : null;
      if (engine.current.shapeStart) {
        engine.current.shapeEnd = cell && inBounds(cell) ? cell : engine.current.shapeEnd;
      }
      if (
        engine.current.hover !== prevHover ||
        engine.current.shapeStart ||
        (prevHover && !engine.current.hover)
      ) {
        schedule('overlay');
      }
      if (engine.current.stroke !== null || engine.current.strokePrev) {
        if (cell && inBounds(cell)) strokeTo(cell);
      }
    },
    [inBounds, schedule, strokeTo, toCell],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (engine.current.panning) {
        engine.current.panning = null;
        return;
      }
      const cell = toCell(e.clientX, e.clientY);
      const start = engine.current.shapeStart;
      if (start) {
        const end = cell && inBounds(cell) ? cell : engine.current.shapeEnd ?? start;
        const tool = useEditorStore.getState().tool;
        const indices = shapeIndices(tool, start, end, stateRef.current.w, stateRef.current.h);
        const value = useEditorStore.getState().colorIndex;
        const cells = useProjectStore.getState().cells;
        const diff = diffOf(cells, indices, indices.map(() => value));
        if (diff.indices.length > 0) {
          useProjectStore.getState().applyDiff(diff, shapeLabel(tool));
        }
        engine.current.shapeStart = null;
        engine.current.shapeEnd = null;
        schedule('overlay');
        return;
      }
      commitStroke();
    },
    [commitStroke, inBounds, schedule, toCell],
  );

  const onPointerLeave = useCallback(() => {
    engine.current.hover = null;
    schedule('overlay');
  }, [schedule]);

  // 滚轮缩放（指针中心）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0012);
      useEditorStore.getState().zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // -------------------------------------------------------------------------
  // 视图控制条
  // -------------------------------------------------------------------------

  const onZoom = useCallback((factor: number) => {
    const e = engine.current;
    useEditorStore.getState().zoomAt(e.cssW / 2, e.cssH / 2, factor);
  }, []);

  const onFit = useCallback(() => {
    const e = engine.current;
    const scale = Math.min(
      64,
      Math.max(2, Math.min((e.cssW - FIT_PADDING * 2) / Math.max(1, w), (e.cssH - FIT_PADDING * 2) / Math.max(1, h))),
    );
    useEditorStore.getState().setView({
      scale,
      offsetX: (e.cssW - w * scale) / 2,
      offsetY: (e.cssH - h * scale) / 2,
    });
  }, [h, w]);

  const setRefImageFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      useProjectStore.getState().setRefImage({ name: file.name, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }, []);

  const canvasClass = 'pointer-events-none absolute inset-0 h-full w-full';
  const overlayCanvas = (
    <canvas
      ref={overlayCanvasRef}
      className={cn(canvasClass, 'pointer-events-auto touch-none', spaceHeld ? 'cursor-grab' : 'cursor-crosshair')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
  const refCanvas = <canvas ref={refCanvasRef} className={canvasClass} aria-hidden />;
  const cellCanvas = <canvas ref={cellCanvasRef} className={canvasClass} aria-hidden />;
  const gridCanvas = <canvas ref={gridCanvasRef} className={canvasClass} aria-hidden />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-card bg-bg-alt shadow-sticker"
      >
        {refMode === 'under' && refCanvas}
        {cellCanvas}
        {gridCanvas}
        {refMode === 'above' && refCanvas}
        {overlayCanvas}
      </div>

      {/* 视图/参考层浮动控制条 */}
      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap items-center gap-1.5 rounded-full bg-surface/90 p-1.5 shadow-sticker backdrop-blur">
        <ControlButton label="缩小" onClick={() => onZoom(1 / 1.25)}>−</ControlButton>
        <span className="min-w-14 text-center text-xs font-semibold text-inkSoft">{Math.round(view.scale)}px/格</span>
        <ControlButton label="放大" onClick={() => onZoom(1.25)}>＋</ControlButton>
        <ControlButton label="适应窗口" onClick={onFit}>⤢</ControlButton>
        <ControlButton label={gridVisible ? '隐藏网格' : '显示网格'} onClick={() => useEditorStore.getState().toggleGrid()}>
          {gridVisible ? '▦' : '▢'}
        </ControlButton>
      </div>

      <div className="pointer-events-auto absolute right-3 top-3 flex flex-wrap items-center gap-1.5 rounded-full bg-surface/90 p-1.5 shadow-sticker backdrop-blur">
        <label className="cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-primaryStrong transition-colors hover:bg-primaryFaint">
          {refImage ? '换参考图' : '加参考图'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              setRefImageFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {refImage && (
          <>
            <ControlButton label={refVisible ? '隐藏参考层' : '显示参考层'} onClick={() => useEditorStore.getState().setRefVisible(!refVisible)}>
              {refVisible ? '👁' : '🚫'}
            </ControlButton>
            <ControlButton
              label={refMode === 'under' ? '切换为上对照' : '切换为下透写'}
              onClick={() => useEditorStore.getState().setRefMode(refMode === 'under' ? 'above' : 'under')}
            >
              {refMode === 'under' ? '↓下' : '↑上'}
            </ControlButton>
            <input
              type="range"
              min={0}
              max={100}
              value={refOpacity}
              aria-label="参考层不透明度"
              onChange={(e) => useEditorStore.getState().setRefOpacity(Number(e.target.value))}
              className="h-1.5 w-20 cursor-pointer accent-primary"
            />
            <ControlButton label="移除参考图" onClick={() => useProjectStore.getState().setRefImage(null)}>✕</ControlButton>
          </>
        )}
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="h-7 w-7 rounded-full text-sm font-bold text-inkSoft transition-all hover:bg-primaryFaint hover:text-primaryStrong active:scale-90"
    >
      {children}
    </button>
  );
}

function shapeIndices(
  tool: string,
  start: CellPoint,
  end: CellPoint,
  w: number,
  h: number,
): number[] {
  if (tool === 'line') return lineCells(start.x, start.y, end.x, end.y, w, h);
  if (tool === 'rect') return rectCells(start.x, start.y, end.x, end.y, w, h);
  return ellipseCells(start.x, start.y, end.x, end.y, w, h);
}

function shapeLabel(tool: string): string {
  if (tool === 'line') return '直线绘制';
  if (tool === 'rect') return '矩形绘制';
  return '椭圆绘制';
}
