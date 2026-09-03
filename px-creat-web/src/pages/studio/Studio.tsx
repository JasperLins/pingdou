import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_INFOS } from '@/lib/palettes';
import type { Project } from '@/lib/types';
import {
  parseProjectFile,
  serializeProjectFile,
  createIndexedDbRefImageStore,
} from '@/lib/storage';
import type { BeadSpec } from '@/store/project';
import { loadPersisted, useProjectStore } from '@/store/project';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CanvasStage } from '@/components/editor/CanvasStage';
import { ToolRail } from '@/components/editor/ToolRail';
import { PalettePanel } from '@/components/editor/PalettePanel';
import { StatsPanel } from '@/components/editor/StatsPanel';
import { NewDialog } from '@/components/editor/NewDialog';
import { BrandSwitchDialog } from '@/components/editor/BrandSwitchDialog';
import { useEditorShortcuts } from '@/components/editor/useEditorShortcuts';
import { useProjectAutoSave } from '@/components/editor/useProjectAutoSave';
import { boardCoverage, physicalCm } from '@/components/editor/boardSpec';

/**
 * 编辑器主页（CSR，noindex）：左 ToolRail / 中 CanvasStage / 右 Palette+Stats。
 * 负责：首次进入恢复存档（或引导新建）、自动保存、工程 JSON 导入导出。
 */
export function Studio() {
  const loaded = useProjectStore((s) => s.loaded);
  const title = useProjectStore((s) => s.title);
  const brandKey = useProjectStore((s) => s.brandKey);
  const w = useProjectStore((s) => s.w);
  const h = useProjectStore((s) => s.h);
  const spec = useProjectStore((s) => s.spec);
  const hasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);

  const [newOpen, setNewOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; onOk: () => void } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEditorShortcuts();
  useProjectAutoSave();

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // 首次进入：恢复存档或引导新建
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const refStore = typeof indexedDB !== 'undefined' ? createIndexedDbRefImageStore() : undefined;
    void loadPersisted(window.localStorage, refStore).then((result) => {
      if (result.project) {
        useProjectStore.getState().loadFrom(result.project, result.spec, result.refImage);
      } else {
        setNewOpen(true);
      }
    });
  }, []);

  const guarded = (action: () => void): void => {
    if (useProjectStore.getState().hasUnsavedChanges) {
      setConfirm({ message: '当前作品有未保存的修改，继续将先自动保存一次。', onOk: action });
    } else {
      action();
    }
  };

  const refStore = useCallback(() => {
    return typeof indexedDB !== 'undefined' ? createIndexedDbRefImageStore() : undefined;
  }, []);

  const onExport = (): void => {
    const state = useProjectStore.getState();
    if (!state.loaded) return;
    const ref = state.refImage ? { dataUrl: state.refImage.dataUrl, name: state.refImage.name } : undefined;
    // spec 为工程 JSON 扩展字段（导入端宽松读取，见 store/project.ts）
    const json = serializeProjectFile({ ...state.toProject(), spec: state.spec } as Project, ref);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title || 'pindou-project'}.pindou.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('工程 JSON 已导出');
  };

  const onImportFile = (file: File | undefined): void => {
    if (!file) return;
    void file.text().then((text) => {
      const result = parseProjectFile(text);
      if (!result.ok) {
        showToast(`导入失败：${result.error}`);
        return;
      }
      let specFromRaw: BeadSpec | null = null;
      try {
        const raw = JSON.parse(text) as { spec?: string };
        if (raw.spec === '5mm' || raw.spec === '2.6mm') specFromRaw = raw.spec;
      } catch {
        specFromRaw = null;
      }
      const ref = result.refImage ? { name: result.refImage.name ?? '参考图', dataUrl: result.refImage.dataUrl } : null;
      useProjectStore.getState().loadFrom(result.project, specFromRaw, ref);
      void useProjectStore.getState().persistNow(window.localStorage, refStore());
      showToast(`已导入「${result.project.title}」`);
    });
  };

  const coverage = boardCoverage(w, h, spec);

  return (
    <div className="flex h-screen flex-col gap-3 bg-bg p-3">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 rounded-card bg-surface px-4 py-2.5 shadow-soft">
        <input
          type="text"
          value={title}
          onChange={(e) => useProjectStore.getState().setTitle(e.target.value)}
          placeholder="未命名作品"
          aria-label="作品名称"
          className="min-w-0 max-w-64 flex-shrink rounded-full bg-surface2 px-4 py-1.5 text-sm font-bold text-ink outline-none transition-colors placeholder:text-inkSoft/60 focus:bg-primaryFaint"
        />
        <span className="hidden shrink-0 rounded-full bg-primaryFaint px-3 py-1 text-xs font-bold text-primaryStrong md:inline">
          {BRAND_INFOS[brandKey].label} · {spec}
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            hasUnsavedChanges ? 'bg-ink/10 text-inkSoft' : 'bg-primaryFaint text-primaryStrong'
          }`}
          title={lastSavedAt ? `上次保存 ${new Date(lastSavedAt).toLocaleTimeString()}` : '尚未保存'}
        >
          {hasUnsavedChanges ? '未保存' : `已保存${lastSavedAt ? ' · ' + new Date(lastSavedAt).toLocaleTimeString() : ''}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="soft" onClick={() => guarded(() => setNewOpen(true))}>
            新建
          </Button>
          <Button size="sm" variant="soft" onClick={() => importInputRef.current?.click()}>
            导入 JSON
          </Button>
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
          <Button size="sm" variant="soft" onClick={onExport}>
            导出 JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBrandOpen(true)} disabled={!loaded}>
            切换品牌
          </Button>
        </div>
      </header>

      {/* 主体三栏 */}
      <div className="flex min-h-0 flex-1 gap-3">
        <ToolRail />
        <CanvasStage />
        <aside className="flex w-80 min-w-64 flex-col gap-3 overflow-y-auto">
          <PalettePanel />
          <StatsPanel />
        </aside>
      </div>

      {/* 状态栏 */}
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-card bg-surface px-4 py-2 text-xs text-inkSoft shadow-soft">
        <span>
          网格 <b className="text-ink">{w}×{h}</b>
        </span>
        <span>
          物理尺寸 <b className="text-ink">{physicalCm(w, spec)}×{physicalCm(h, spec)} cm</b>（{spec}）
        </span>
        <span>
          板数 <b className="text-ink">{coverage.total}</b>（{coverage.cols}×{coverage.rows}）
        </span>
        <span className="ml-auto hidden lg:inline">
          快捷键：B 画笔 · E 橡皮 · G 油漆桶 · I 吸管 · [ ] 笔刷 · 空格平移 · Ctrl+Z 撤销 · Alt+点击取色
        </span>
      </footer>

      <NewDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <BrandSwitchDialog open={brandOpen} onClose={() => setBrandOpen(false)} />

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="继续操作？"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                void useProjectStore.getState().persistNow(window.localStorage, refStore());
                confirm?.onOk();
                setConfirm(null);
              }}
            >
              保存并继续
            </Button>
          </>
        }
      >
        <p>{confirm?.message}</p>
      </Dialog>

      {toast && (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg shadow-soft-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
