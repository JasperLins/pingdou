import { useProjectStore } from '@/store/project';
import { FINISH_GROUPS, resetFinish, setFinish, useFinishStore } from '@/store/finish';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { FinishPresetKey } from '@/lib/finish';
import { useFinishThumbnails } from './useFinishThumbnails';

/**
 * 烫染效果面板（design §4，滤镜式）：分组预设缩略图横滑列表（当前作品低分辨率
 * 快照渲染，逐个替换）+ 强度滑杆（150ms 防抖重渲染在 useFinishPreview）+
 * 按住对比（空格同效，全局快捷键）+ Esc 返回编辑视图。
 * 预设/强度经 setFinish 写工程状态（§4.8 finish 字段），永不触碰 cells。
 */
export function FinishPanel() {
  const finish = useProjectStore((s) => s.finish);
  const comparing = useFinishStore((s) => s.comparing);
  const previewBusy = useFinishStore((s) => s.previewBusy);
  const thumbnails = useFinishStore((s) => s.thumbnails);

  useFinishThumbnails();

  const selectedPreset = (FINISH_GROUPS.flatMap((g) => g.presets).find((p) => p.key === finish.preset)?.key ??
    'normal') as FinishPresetKey;

  return (
    <Card className="flex flex-col gap-4" padded={false}>
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <CardTitle>烫染预览</CardTitle>
        <div className="flex items-center gap-2">
          {previewBusy && (
            <span className="animate-pulse rounded-full bg-primaryFaint px-2.5 py-0.5 text-[11px] font-bold text-primaryStrong">
              渲染中…
            </span>
          )}
          <button
            type="button"
            aria-label="关闭烫染预览"
            title="关闭（Esc）"
            onClick={() => useFinishStore.getState().exitPreview()}
            className="rounded-full p-1.5 text-inkSoft transition-colors hover:bg-primaryFaint hover:text-primaryStrong"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 分组预设缩略图：横滑列表，逐个替换不阻塞 */}
      {FINISH_GROUPS.map((group) => (
        <div key={group.label} className="mx-5">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-inkSoft">{group.label}</h4>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5">
            {group.presets.map((preset) => {
              const thumb = thumbnails[preset.key];
              const active = selectedPreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFinish({ ...finish, preset: preset.key })}
                  className="group flex w-[86px] shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1.5 transition-all hover:bg-primaryFaint/60 active:scale-95"
                >
                  <span
                    className={cn(
                      'relative block h-[68px] w-[68px] overflow-hidden rounded-xl bg-surface2 shadow-sticker',
                      active && 'ring-2 ring-primary ring-offset-2 ring-offset-surface',
                    )}
                  >
                    {thumb?.dataUrl ? (
                      <img
                        src={thumb.dataUrl}
                        alt={`${preset.label}效果缩略图`}
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <span className="flex h-full w-full animate-pulse items-center justify-center text-[10px] text-inkSoft">
                        {preset.label}
                      </span>
                    )}
                  </span>
                  <span className={cn('text-xs font-bold', active ? 'text-primaryStrong' : 'text-ink')}>
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 强度滑杆：拖动即时回显，重渲染由 useFinishPreview 防抖 150ms */}
      <div className="mx-5">
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-inkSoft">强度</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink">{finish.intensity}%</span>
            <button
              type="button"
              onClick={() => resetFinish()}
              title="恢复正常烫 + 100% 强度"
              className="rounded-full bg-primaryFaint px-2 py-0.5 text-[11px] font-bold text-primaryStrong transition-all hover:bg-primarySoft/60 active:scale-90"
            >
              重置
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={finish.intensity}
          aria-label="烫染强度"
          onChange={(e) => setFinish({ ...finish, intensity: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
      </div>

      {/* 按住对比（空格同效） */}
      <div className="mx-5 mb-5 flex items-center gap-2.5">
        <Button
          variant={comparing ? 'primary' : 'soft'}
          size="sm"
          aria-pressed={comparing}
          className="select-none"
          onPointerDown={() => useFinishStore.getState().setComparing(true)}
          onPointerUp={() => useFinishStore.getState().setComparing(false)}
          onPointerLeave={() => useFinishStore.getState().setComparing(false)}
          onPointerCancel={() => useFinishStore.getState().setComparing(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          按住对比
        </Button>
        <p className="text-[11px] leading-relaxed text-inkSoft">空格同效 · 松开恢复 · Esc 返回编辑</p>
      </div>
    </Card>
  );
}
