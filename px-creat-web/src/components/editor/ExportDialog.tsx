import { useEffect, useMemo, useRef, useState } from 'react';
import { BRAND_INFOS, loadPalette } from '@/lib/palettes';
import { serializeBomCsv } from '@/lib/bomCsv';
import {
  DEFAULT_SHEET_OPTIONS,
  computeBom,
  type PatternSheetOptions,
  type SheetLayoutKind,
} from '@/lib/patternSheet';
import { serializeProjectFile } from '@/lib/storage';
import type { Project } from '@/lib/types';
import { useProjectStore } from '@/store/project';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import { downloadBlob, drawPatternSheetToCanvas, sanitizeFilename, sheetPngBlob } from './exportFiles';

/**
 * 导出三件套对话框（§4.7，M5 design.md §2）：
 * - 图纸 PNG：版式双选（完整图纸 / 纯图版）+ 格子色号标注开关 + 署名输入 + 预览缩略图；
 * - BOM CSV：前 N 行预览表 + 下载（UTF-8 BOM，Excel 中文兼容）；
 * - 工程 JSON：导出（含 finish 与内嵌参考图）+ 导入（复用 Studio 导入路径）。
 * 导出参数为对话框本地态（不进 store）；全部走 Blob 下载，中文文件名。
 */

/** 预览缩略图的渲染宽度上限（小图快速重绘；下载走全尺寸）。 */
const PREVIEW_MAX_WIDTH = 640;
/** BOM 预览表行数。 */
const BOM_PREVIEW_ROWS = 8;

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 工程 JSON 导入回调（Studio 顶栏导入同一路径，保证往返一致）。 */
  onImportProject: (file: File) => void;
}

export function ExportDialog({ open, onClose, onImportProject }: ExportDialogProps) {
  const loaded = useProjectStore((s) => s.loaded);
  const brandKey = useProjectStore((s) => s.brandKey);
  const title = useProjectStore((s) => s.title);
  const cellsVersion = useProjectStore((s) => s.cellsVersion);

  const [layout, setLayout] = useState<SheetLayoutKind>('sheet');
  const [cellLabels, setCellLabels] = useState(false);
  const [author, setAuthor] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const palette = useMemo(() => loadPalette(brandKey), [brandKey]);

  // BOM 走 store 快照重算（cellsVersion 变化即过期）
  const bom = useMemo(() => {
    const state = useProjectStore.getState();
    return computeBom(Array.from(state.cells), state.w, state.h, palette);
  }, [cellsVersion, palette]);

  const fileTitle = title.trim() || '未命名作品';
  const sheetOptions = useMemo<PatternSheetOptions>(
    () => ({
      ...DEFAULT_SHEET_OPTIONS,
      layout,
      cellLabels,
      author: author.trim(),
      title: fileTitle,
    }),
    [layout, cellLabels, author, fileTitle],
  );

  // 预览缩略图：指令式直绘到 canvas（限宽小图，不进 React state）
  useEffect(() => {
    if (!open) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const state = useProjectStore.getState();
    drawPatternSheetToCanvas(
      canvas,
      { cells: state.cells, w: state.w, h: state.h, palette },
      { ...sheetOptions, sheetMaxWidth: PREVIEW_MAX_WIDTH },
    );
  }, [open, palette, sheetOptions, cellsVersion]);

  const notify = (message: string): void => {
    setNotice(message);
    window.setTimeout(() => setNotice((cur) => (cur === message ? null : cur)), 2600);
  };

  const onExportPng = (): void => {
    const state = useProjectStore.getState();
    if (!state.loaded) return;
    void sheetPngBlob(state.cells, state.w, state.h, state.brandKey, sheetOptions).then((blob) => {
      if (!blob) {
        notify('图纸 PNG 生成失败（当前环境不支持画布导出）');
        return;
      }
      downloadBlob(blob, `${sanitizeFilename(fileTitle)}.png`);
      notify('图纸 PNG 已开始下载');
    });
  };

  const onExportCsv = (): void => {
    if (bom.length === 0) {
      notify('画布还没有用色，先画几颗豆吧');
      return;
    }
    const csv = serializeBomCsv(bom);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${sanitizeFilename(fileTitle)}-BOM.csv`);
    notify('BOM 清单已开始下载');
  };

  const onExportJson = (): void => {
    const state = useProjectStore.getState();
    if (!state.loaded) return;
    const ref = state.refImage ? { dataUrl: state.refImage.dataUrl, name: state.refImage.name } : undefined;
    // spec 为工程 JSON 扩展字段（导入端宽松读取，见 store/project.ts）
    const json = serializeProjectFile({ ...state.toProject(), spec: state.spec } as Project, ref);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${sanitizeFilename(fileTitle)}.json`);
    notify('工程 JSON 已开始下载');
  };

  const onImportFile = (file: File | undefined): void => {
    if (!file) return;
    onImportProject(file);
    onClose();
  };

  const total = bom.reduce((sum, row) => sum + row.count, 0);
  const ratioText = (count: number): string => (total > 0 ? ((count / total) * 100).toFixed(2) : '0.00');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="导出"
      className="max-h-[92vh] max-w-2xl overflow-y-auto"
      footer={
        <Button variant="ghost" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <Tabs defaultValue="png">
        <TabsList>
          <TabsTrigger value="png">图纸 PNG</TabsTrigger>
          <TabsTrigger value="csv">BOM 清单 CSV</TabsTrigger>
          <TabsTrigger value="json">工程 JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="png">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-bold text-ink">版式</p>
                <div className="flex gap-2">
                  <LayoutOption
                    active={layout === 'sheet'}
                    label="完整图纸"
                    hint="标题 · 刻度 · 图例"
                    onClick={() => setLayout('sheet')}
                  />
                  <LayoutOption
                    active={layout === 'pattern_only'}
                    label="纯图版"
                    hint="仅图案网格"
                    onClick={() => setLayout('pattern_only')}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold text-ink">标注与署名</p>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-inkSoft">
                  <input
                    type="checkbox"
                    checked={cellLabels}
                    onChange={(e) => setCellLabels(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  格子内印色号（放得下时显示）
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="作者署名（可留空）"
                  aria-label="作者署名"
                  className="mt-2 w-full rounded-full border-2 border-line bg-surface px-3.5 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-inkSoft/70 focus:border-primary"
                />
              </div>
            </div>

            <div className="rounded-card bg-surface2 p-3">
              <p className="mb-2 text-xs font-bold text-ink">预览</p>
              <div className="flex max-h-72 items-center justify-center overflow-auto rounded-2xl bg-surface p-2">
                <canvas ref={previewRef} className="h-auto max-w-full" aria-label="图纸预览" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-inkSoft">
                完整版含标题、每 5 格坐标刻度与底部图例（色块 · 色号 · 颗数）；
                {BRAND_INFOS[brandKey].label} · 用色 {bom.length} 种 · 共 {total.toLocaleString()} 颗。
              </p>
              <Button size="sm" onClick={onExportPng} disabled={!loaded}>
                下载 PNG
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="csv">
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-card border-2 border-line">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface2 text-inkSoft">
                    <th className="px-3 py-2 font-bold">色号</th>
                    <th className="px-3 py-2 font-bold">色名</th>
                    <th className="px-3 py-2 text-right font-bold">颗数</th>
                    <th className="px-3 py-2 text-right font-bold">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.slice(0, BOM_PREVIEW_ROWS).map((row) => (
                    <tr key={row.code} className="border-t border-line">
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                          <span
                            aria-hidden
                            className="inline-block h-3 w-3 rounded-sm shadow-sticker"
                            style={{ backgroundColor: `rgb(${row.rgb.r},${row.rgb.g},${row.rgb.b})` }}
                          />
                          {row.code}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-inkSoft">{row.name}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-ink">{row.count.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-inkSoft">{ratioText(row.count)}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line bg-surface2 font-bold text-ink">
                    <td className="px-3 py-2" colSpan={2}>
                      {bom.length > BOM_PREVIEW_ROWS ? `总计（预览前 ${BOM_PREVIEW_ROWS} 行，共 ${bom.length} 色）` : '总计'}
                    </td>
                    <td className="px-3 py-2 text-right">{total.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-inkSoft">
                UTF-8 编码（Excel 中文兼容），列为品牌 / 色号 / 色名 / 颗数 / 占比，末行汇总总颗数。
              </p>
              <Button size="sm" onClick={onExportCsv} disabled={bom.length === 0}>
                下载 CSV
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="json">
          <div className="space-y-4">
            <div className="rounded-card bg-surface2 p-4 text-xs leading-relaxed text-inkSoft">
              <p>
                <b className="text-ink">工程文件</b>
                ：完整图纸数据 + 烫染设置，可随时导入继续编辑；参考图内嵌其中，跨设备可迁移。
              </p>
              <p className="mt-1.5">导入兼容旧版文件：缺省烫染设置按「正常烫 · 强度 100」恢复。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[11px] text-inkSoft">文件：{sanitizeFilename(fileTitle)}.json</p>
              <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
                导入工程
              </Button>
              <Button size="sm" onClick={onExportJson} disabled={!loaded}>
                导出工程 JSON
              </Button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                onImportFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-full bg-primaryFaint px-4 py-2 text-center text-xs font-bold text-primaryStrong"
        >
          {notice}
        </p>
      )}
    </Dialog>
  );
}

function LayoutOption({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-card border-2 px-3 py-2 text-left transition-colors',
        active ? 'border-primary bg-primaryFaint' : 'border-line bg-surface hover:border-primary/60',
      )}
    >
      <span className={cn('block text-xs font-bold', active ? 'text-primaryStrong' : 'text-ink')}>{label}</span>
      <span className="mt-0.5 block text-[11px] text-inkSoft">{hint}</span>
    </button>
  );
}
