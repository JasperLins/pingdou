import { useMemo, useState, type ReactNode } from 'react';
import { computeBom } from '@/lib/patternSheet';
import { loadPalette } from '@/lib/palettes';
import {
  clearColor,
  denoise,
  denoiseStats,
  mergeDiff,
  replaceColor,
  swapColors,
  EMPTY_DIFF,
  type CellDiff,
} from '@/lib/cellOps';
import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Swatch } from './Swatch';
import { boardCoverage, physicalCm } from './boardSpec';

/**
 * 用量面板（design.md §5）：Readiness 自检区 + 总览（cm/板数/豆数/色数）+
 * Top colors 点击高亮 + 已用/全部页签 + 全局换色/清除/互换/批量删色/一键去噪。
 */

const DENOISE_THRESHOLDS = [1, 2, 4] as const;

interface UsedRow {
  index: number;
  code: string;
  name: string;
  rgb: { r: number; g: number; b: number };
  count: number;
}

export function StatsPanel() {
  const brandKey = useProjectStore((s) => s.brandKey);
  const w = useProjectStore((s) => s.w);
  const h = useProjectStore((s) => s.h);
  const spec = useProjectStore((s) => s.spec);
  const cellsVersion = useProjectStore((s) => s.cellsVersion);
  const highlightIndex = useEditorStore((s) => s.highlightIndex);
  const colorIndex = useEditorStore((s) => s.colorIndex);
  const reviewColors = useEditorStore((s) => s.reviewColors);

  const [denoiseThreshold, setDenoiseThreshold] = useState<number>(1);
  const [sortMode, setSortMode] = useState<'count' | 'code'>('count');
  const [colorQuery, setColorQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const palette = useMemo(() => loadPalette(brandKey), [brandKey]);

  const stats = useMemo(() => {
    const state = useProjectStore.getState();
    const cells = state.cells;
    // BOM 复用 lib：computeBom 返回按颗数降序的行，再回填色板下标
    const bom = computeBom(Array.from(cells), state.w, state.h, palette);
    const indexOfCode = new Map(palette.colors.map((c, i) => [c.code, i]));
    const rows: UsedRow[] = bom.map((row) => ({
      index: indexOfCode.get(row.code) ?? -1,
      code: row.code,
      name: row.name,
      rgb: row.rgb,
      count: row.count,
    }));
    const beads = rows.reduce((sum, r) => sum + r.count, 0);
    const invalid = rows.filter((r) => r.index < 0).length;
    const orphan = denoiseStats(cells, state.w, state.h, 1);
    // store 快照读取：cellsVersion 变化即重算
    return { rows, beads, invalid, orphan };
  }, [cellsVersion, palette]);

  const coverage = boardCoverage(w, h, spec);
  const cmW = physicalCm(w, spec);
  const cmH = physicalCm(h, spec);

  const filteredRows = useMemo(() => {
    const q = colorQuery.trim().toLowerCase();
    let rows = q === '' ? stats.rows : stats.rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    rows = [...rows];
    if (sortMode === 'code') rows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return rows;
  }, [colorQuery, sortMode, stats.rows]);

  const applyOp = (diff: CellDiff, label: string): void => {
    if (diff.indices.length === 0) return;
    useProjectStore.getState().applyDiff(diff, label);
  };

  const onDenoise = (): void => {
    const { cells: cs, w: gw, h: gh } = useProjectStore.getState();
    applyOp(denoise(cs, gw, gh, denoiseThreshold), `一键去噪（阈值 ${denoiseThreshold}）`);
  };

  const onBatchDelete = (): void => {
    const { cells: cs } = useProjectStore.getState();
    let merged: CellDiff = EMPTY_DIFF;
    for (const idx of selected) merged = mergeDiff(merged, clearColor(cs, idx));
    applyOp(merged, `批量删色（${selected.size} 色）`);
    setSelected(new Set());
  };

  const onBatchReplace = (): void => {
    const { cells: cs } = useProjectStore.getState();
    let merged: CellDiff = EMPTY_DIFF;
    for (const idx of selected) merged = mergeDiff(merged, replaceColor(cs, idx, colorIndex));
    applyOp(merged, `批量换色（${selected.size} 色 → 当前色）`);
    setSelected(new Set());
  };

  const toggleSelect = (index: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const readiness = [
    {
      ok: stats.invalid === 0,
      text: stats.invalid === 0 ? '色号全部有效' : `${stats.invalid} 个色号无效`,
    },
    {
      ok: stats.orphan.cells === 0,
      text: stats.orphan.cells === 0 ? '无孤立碎色' : `孤立碎色 ${stats.orphan.cells} 格（${stats.orphan.regions} 处）`,
    },
    {
      ok: reviewColors.length === 0,
      text: reviewColors.length === 0 ? '无待确认品牌映射' : `${reviewColors.length} 个映射色待复查`,
    },
    { ok: stats.beads > 0, text: stats.beads > 0 ? '统计完整' : '画布为空' },
  ];
  const allReady = readiness.every((r) => r.ok);

  return (
    <Card className="flex min-h-0 flex-col gap-4" padded={false}>
      <div className="px-5 pt-5">
        <CardTitle>用量与检查</CardTitle>
      </div>

      {/* Readiness 导出前自检 */}
      <div className="mx-5 rounded-card bg-surface2 p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-ink">导出自检</h4>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${allReady ? 'bg-primaryFaint text-primaryStrong' : 'bg-ink/10 text-inkSoft'}`}
          >
            {allReady ? '无问题' : '有待处理'}
          </span>
        </div>
        <ul className="space-y-1.5">
          {readiness.map((item) => (
            <li key={item.text} className="flex items-center gap-2 text-xs text-inkSoft">
              <span aria-hidden className={item.ok ? 'text-primaryStrong' : 'text-inkSoft'}>
                {item.ok ? '●' : '○'}
              </span>
              {item.text}
            </li>
          ))}
        </ul>
        {stats.orphan.cells > 0 && (
          <Button size="sm" variant="soft" className="mt-2.5" onClick={onDenoise}>
            一键去噪清理
          </Button>
        )}
      </div>

      {/* 总览 */}
      <dl className="mx-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Stat label="规格" value={spec} />
        <Stat label="网格" value={`${w}×${h}`} />
        <Stat label="物理尺寸" value={`${cmW}×${cmH} cm`} />
        <Stat label="板数" value={`${coverage.cols}×${coverage.rows}（${coverage.total} 块）`} />
        <Stat label="豆数" value={stats.beads.toLocaleString()} />
        <Stat label="色数" value={`${stats.rows.length} / ${palette.colors.length}`} />
      </dl>

      {/* Top colors：点击高亮定位 */}
      <div className="mx-5">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-inkSoft">Top 颜色（点击高亮）</h4>
        <ul className="space-y-1.5">
          {stats.rows.slice(0, 8).map((row) => {
            const percent = stats.beads > 0 ? Math.round((row.count / stats.beads) * 100) : 0;
            const active = highlightIndex === row.index;
            return (
              <li key={row.code}>
                <button
                  type="button"
                  aria-label={`高亮 ${row.code}`}
                  onClick={() => useEditorStore.getState().setHighlight(active ? null : row.index)}
                  className={`flex w-full items-center gap-2.5 rounded-full px-2.5 py-1.5 text-left transition-colors ${
                    active ? 'bg-primaryFaint' : 'hover:bg-primaryFaint/60'
                  }`}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-md shadow-sticker"
                    style={{ backgroundColor: `rgb(${row.rgb.r},${row.rgb.g},${row.rgb.b})` }}
                    aria-hidden
                  />
                  <span className="w-14 shrink-0 text-xs font-bold text-ink">{row.code}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-inkSoft">{row.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-ink">{row.count.toLocaleString()}</span>
                  <span className="w-9 shrink-0 text-right text-xs text-inkSoft">{percent}%</span>
                </button>
              </li>
            );
          })}
          {stats.rows.length === 0 && <li className="py-2 text-center text-xs text-inkSoft">还没有用色</li>}
        </ul>
      </div>

      {/* 已用 / 全部 页签 */}
      <Tabs defaultValue="used" className="mx-5 min-h-0 flex-1 pb-5">
        <TabsList>
          <TabsTrigger value="used">已用 {stats.rows.length}</TabsTrigger>
          <TabsTrigger value="all">全部 {palette.colors.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="used" className="pt-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="search"
              value={colorQuery}
              onChange={(e) => setColorQuery(e.target.value)}
              placeholder="搜索已用色…"
              aria-label="搜索已用色"
              className="min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-inkSoft/70 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === 'count' ? 'code' : 'count'))}
              className="shrink-0 rounded-full bg-primaryFaint px-3 py-1.5 text-xs font-semibold text-primaryStrong transition-colors hover:bg-primarySoft/50"
            >
              {sortMode === 'count' ? '按颗数' : '按色号'}
            </button>
          </div>

          {selected.size > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-full bg-primaryFaint px-3 py-1.5">
              <span className="text-xs font-semibold text-primaryStrong">已选 {selected.size} 色</span>
              <Button size="sm" variant="ghost" onClick={onBatchReplace}>
                批量换为当前色
              </Button>
              <Button size="sm" variant="ghost" onClick={onBatchDelete}>
                批量删除
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                取消
              </Button>
            </div>
          )}

          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredRows.map((row) => (
              <li key={row.code} className="flex items-center gap-2 rounded-2xl px-1.5 py-1 hover:bg-primaryFaint/50">
                <input
                  type="checkbox"
                  aria-label={`选择 ${row.code}`}
                  checked={selected.has(row.index)}
                  onChange={() => toggleSelect(row.index)}
                  className="h-3.5 w-3.5 shrink-0 accent-primary"
                />
                <Swatch
                  rgb={row.rgb}
                  code={row.code}
                  name={row.name}
                  size="sm"
                  active={highlightIndex === row.index}
                  onClick={() => useEditorStore.getState().setHighlight(highlightIndex === row.index ? null : row.index)}
                />
                <span className="w-14 shrink-0 text-xs font-bold text-ink">{row.code}</span>
                <span className="shrink-0 text-xs text-inkSoft">{row.count}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <RowAction label={`把 ${row.code} 全部换成当前色`} onClick={() => applyOp(replaceColor(useProjectStore.getState().cells, row.index, colorIndex), `换色 ${row.code}`)}>
                    换
                  </RowAction>
                  <RowAction
                    label={`把 ${row.code} 与当前色互换`}
                    onClick={() => applyOp(swapColors(useProjectStore.getState().cells, row.index, colorIndex), `互换 ${row.code}`)}
                  >
                    换互
                  </RowAction>
                  <RowAction label={`清除 ${row.code} 全部格子`} onClick={() => applyOp(clearColor(useProjectStore.getState().cells, row.index), `清除 ${row.code}`)}>
                    清
                  </RowAction>
                </span>
              </li>
            ))}
            {filteredRows.length === 0 && <li className="py-3 text-center text-xs text-inkSoft">无匹配颜色</li>}
          </ul>
        </TabsContent>

        <TabsContent value="all" className="pt-3">
          <div className="max-h-72 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-1.5">
              {palette.colors.map((c, idx) => {
                const row = stats.rows.find((r) => r.index === idx);
                return (
                  <Swatch
                    key={c.code}
                    rgb={c.rgb}
                    code={c.code}
                    name={c.name}
                    size="sm"
                    active={highlightIndex === idx}
                    count={row?.count}
                    onClick={() => useEditorStore.getState().setHighlight(highlightIndex === idx ? null : idx)}
                  />
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 一键去噪 */}
      <div className="mx-5 mb-5 flex items-center gap-2 rounded-card bg-surface2 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink">一键去噪</p>
          <p className="text-[11px] leading-relaxed text-inkSoft">清除面积 ≤ 阈值的孤立色块（当前碎色 {stats.orphan.cells} 格）</p>
        </div>
        <select
          value={denoiseThreshold}
          onChange={(e) => setDenoiseThreshold(Number(e.target.value))}
          aria-label="去噪面积阈值"
          className="rounded-full border-2 border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink outline-none focus:border-primary"
        >
          {DENOISE_THRESHOLDS.map((t) => (
            <option key={t} value={t}>
              ≤{t} 格
            </option>
          ))}
        </select>
        <Button size="sm" variant="soft" onClick={onDenoise} disabled={stats.orphan.cells === 0}>
          执行
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-full bg-surface2 px-3 py-1.5">
      <dt className="shrink-0 text-inkSoft">{label}</dt>
      <dd className="truncate font-bold text-ink">{value}</dd>
    </div>
  );
}

function RowAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-full bg-primaryFaint px-2 py-0.5 text-[11px] font-bold text-primaryStrong transition-all hover:bg-primarySoft/60 active:scale-90"
    >
      {children}
    </button>
  );
}
