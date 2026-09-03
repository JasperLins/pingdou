import { useMemo, useState } from 'react';
import { groupByFamily, loadPalette, searchColors } from '@/lib/palettes';
import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { Card, CardTitle } from '@/components/ui/Card';
import { Swatch } from './Swatch';
import { quickColorIndices } from './quickColors';

/**
 * 色板面板：当前色大色块 + 常用色快捷行 + 最近使用 + 搜索 + 色系分组
 * （design.md §5）。
 */
export function PalettePanel() {
  const brandKey = useProjectStore((s) => s.brandKey);
  const cellsVersion = useProjectStore((s) => s.cellsVersion);
  const colorIndex = useEditorStore((s) => s.colorIndex);
  const recentColors = useEditorStore((s) => s.recentColors);
  const [query, setQuery] = useState('');

  const palette = useMemo(() => loadPalette(brandKey), [brandKey]);
  const quickIndices = useMemo(() => quickColorIndices(palette), [palette]);
  const families = useMemo(() => groupByFamily(palette), [palette]);

  // 已用颗数（色卡徽标）
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    const cells = useProjectStore.getState().cells;
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      if (v < 0) continue;
      map.set(v, (map.get(v) ?? 0) + 1);
    }
    return map;
  }, [cellsVersion]);

  const matchSet = useMemo(() => {
    if (query.trim() === '') return null;
    return new Set(searchColors(palette, query).map((c) => palette.colors.indexOf(c)));
  }, [palette, query]);

  const current = palette.colors[colorIndex];
  const setColorIndex = useEditorStore((s) => s.setColorIndex);

  return (
    <Card className="flex min-h-0 flex-col gap-4" padded={false}>
      <div className="px-5 pt-5">
        <CardTitle>色板</CardTitle>
      </div>

      {/* 当前色大色块 */}
      <div className="mx-5 flex items-center gap-3 rounded-card bg-surface2 p-3">
        {current && (
          <>
            <div
              className="h-12 w-12 shrink-0 rounded-xl shadow-sticker"
              style={{ backgroundColor: `rgb(${current.rgb.r},${current.rgb.g},${current.rgb.b})` }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{current.code}</p>
              <p className="truncate text-xs text-inkSoft">{current.name}</p>
              <p className="text-[11px] text-inkSoft">
                RGB {current.rgb.r},{current.rgb.g},{current.rgb.b}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 常用色快捷行 */}
      <div className="mx-5">
        <SectionLabel>常用色</SectionLabel>
        <div className="flex flex-wrap gap-1.5 py-1.5">
          {quickIndices.map((idx, i) => {
            const c = palette.colors[idx];
            return (
              <Swatch
                key={`quick-${i}-${c.code}`}
                rgb={c.rgb}
                code={c.code}
                name={c.name}
                size="sm"
                active={idx === colorIndex}
                count={counts.get(idx)}
                onClick={() => setColorIndex(idx)}
              />
            );
          })}
        </div>
      </div>

      {/* 最近使用 */}
      {recentColors.length > 0 && (
        <div className="mx-5">
          <SectionLabel>最近使用</SectionLabel>
          <div className="flex flex-wrap gap-1.5 py-1.5">
            {recentColors.map((idx) => {
              const c = palette.colors[idx];
              if (!c) return null;
              return (
                <Swatch
                  key={`recent-${idx}`}
                  rgb={c.rgb}
                  code={c.code}
                  name={c.name}
                  size="sm"
                  active={idx === colorIndex}
                  onClick={() => setColorIndex(idx)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 搜索 */}
      <div className="mx-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索色号 / 名称…"
          aria-label="搜索色板"
          className="w-full rounded-full border-2 border-line bg-surface px-4 py-2 text-sm text-ink outline-none transition-colors placeholder:text-inkSoft/70 focus:border-primary"
        />
      </div>

      {/* 色系分组 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {families.map((family) => {
          const indices = matchSet ? family.indices.filter((i) => matchSet.has(i)) : family.indices;
          if (indices.length === 0) return null;
          return (
            <section key={family.name} className="mb-4">
              <SectionLabel>
                {family.name}
                <span className="ml-1.5 font-normal text-inkSoft/70">{indices.length}</span>
              </SectionLabel>
              <div className="flex flex-wrap gap-1.5 py-1.5">
                {indices.map((idx) => {
                  const c = palette.colors[idx];
                  return (
                    <Swatch
                      key={c.code}
                      rgb={c.rgb}
                      code={c.code}
                      name={c.name}
                      active={idx === colorIndex}
                      count={counts.get(idx)}
                      onClick={() => setColorIndex(idx)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
        {matchSet && matchSet.size === 0 && (
          <p className="py-4 text-center text-sm text-inkSoft">没有匹配「{query}」的色号</p>
        )}
      </div>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-inkSoft">
      {children}
    </h4>
  );
}
