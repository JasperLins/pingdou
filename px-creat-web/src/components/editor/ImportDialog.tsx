import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CUSTOM_SIZE_MAX, CUSTOM_SIZE_MIN } from './boardSpec';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/project';
import { useConvertStore } from '@/store/convert';
import { IMPORT_ACCEPT, ImportImageError, loadSourceImage, pixelsToDataUrl } from './convert/imageIo';
import { CropStep } from './convert/CropStep';
import { ConfigStep } from './convert/ConfigStep';
import { ResultCanvas } from './convert/ResultCanvas';

/**
 * 图片转图纸对话框（design.md §1 状态机宿主）：
 * idle（上传）→ crop（裁剪+类型三选）→ config（生成类型+参数+对照）→
 * converting（Worker 执行）→ done（结果 → 进编辑器精修）。
 * 任意态可回退上一步；取消关闭即清理会话（源图为 dataURL，无对象 URL 需回收）。
 */
export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const STEP_LABELS: ReadonlyArray<{ key: 'crop' | 'config' | 'done'; label: string }> = [
  { key: 'crop', label: '裁剪' },
  { key: 'config', label: '参数' },
  { key: 'done', label: '完成' },
];

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const step = useConvertStore((s) => s.step);
  const result = useConvertStore((s) => s.result);
  const params = useConvertStore((s) => s.params);
  const sourceType = useConvertStore((s) => s.sourceType);
  const setSource = useConvertStore((s) => s.setSource);
  const enterConfig = useConvertStore((s) => s.enterConfig);
  const backToCrop = useConvertStore((s) => s.backToCrop);
  const startConvert = useConvertStore((s) => s.startConvert);
  const backToConfig = useConvertStore((s) => s.backToConfig);
  const adoptResult = useConvertStore((s) => s.adoptResult);
  const openStore = useConvertStore((s) => s.open);
  const closeStore = useConvertStore((s) => s.close);
  const brandKey = useProjectStore((s) => s.brandKey);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开即重置会话（连续两次导入互不影响）；关闭即清理（dataURL 无需回收）
  useEffect(() => {
    if (open) openStore();
    else closeStore();
  }, [open, openStore, closeStore]);

  const handleFile = useCallback(
    (file: File | undefined): void => {
      if (!file) return;
      setUploadError(null);
      loadSourceImage(file)
        .then((source) => setSource(source))
        .catch((err: unknown) => {
          setUploadError(err instanceof ImportImageError ? err.message : '图片读取失败，请重试');
        });
    },
    [setSource],
  );

  const close = (): void => {
    closeStore();
    setUploadError(null);
    onClose();
  };

  // 直映模式下目标尺寸由源图网格决定，不做档位校验
  const sizeValid =
    sourceType !== 'photo' ||
    (params.targetSize >= CUSTOM_SIZE_MIN && params.targetSize <= CUSTOM_SIZE_MAX);

  const toEditor = (): void => {
    const work = useConvertStore.getState().work;
    const current = useConvertStore.getState().result;
    if (!work || !current) return;
    // 参考层用 work 像素（裁剪+缩放后的原图，与网格精确对齐）
    adoptResult(pixelsToDataUrl(work));
  };

  const stepIndex = step === 'crop' ? 0 : step === 'config' || step === 'converting' ? 1 : 2;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="从图片转图纸"
      className="max-h-[92vh] max-w-4xl overflow-y-auto"
      footer={renderFooter()}
    >
      {step !== 'idle' && (
        <ol className="mb-4 flex items-center gap-2 text-xs font-bold">
          {STEP_LABELS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border-2',
                  i < stepIndex
                    ? 'border-primary bg-primary text-onPrimary'
                    : i === stepIndex
                      ? 'border-primary bg-primaryFaint text-primaryStrong'
                      : 'border-line bg-surface text-inkSoft',
                )}
              >
                {i + 1}
              </span>
              <span className={i <= stepIndex ? 'text-ink' : 'text-inkSoft'}>{s.label}</span>
              {i < STEP_LABELS.length - 1 && <span aria-hidden className="text-inkSoft">→</span>}
            </li>
          ))}
        </ol>
      )}

      {step === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-10 text-center transition-colors',
            dragOver ? 'border-primary bg-primaryFaint' : 'border-line bg-surface2',
          )}
        >
          <span aria-hidden className="text-4xl">🖼️</span>
          <p className="text-sm font-bold text-ink">拖一张图进来，或点击选择文件</p>
          <p className="text-xs text-inkSoft">PNG / JPG / WebP · ≤10MB · 透明背景支持 · 全程本地处理</p>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            选择图片
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {uploadError && <p className="text-xs font-semibold text-primaryStrong">{uploadError}</p>}
        </div>
      )}

      {step === 'crop' && <CropStep />}

      {(step === 'config' || step === 'converting') && (
        <div className={cn(step === 'converting' && 'pointer-events-none opacity-60')}>
          <ConfigStep />
          {step === 'converting' && (
            <div className="mt-3 flex items-center justify-center gap-2.5 rounded-full bg-primaryFaint px-4 py-2 text-xs font-bold text-primaryStrong">
              <span className="inline-block h-3 w-3 animate-ping rounded-full bg-primaryStrong" />
              正在转换（大图最多需要几秒）…
            </div>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <ResultCanvas w={result.w} h={result.h} cells={result.cells} brandKey={brandKey} maxSide={360} />
            <p className="text-xs text-inkSoft">
              <b className="text-ink">{result.w}×{result.h}</b> 格 · 用色 <b className="text-ink">{result.usedCodes}</b> 种 ·
              共 <b className="text-ink">{result.w * result.h}</b> 格 · 原图已挂参考层（进编辑器后透写对齐）
            </p>
          </div>
          <p className="rounded-2xl bg-surface2 p-3 text-center text-[11px] leading-relaxed text-inkSoft">
            进编辑器后可继续精修：补豆、换色、烫染预览、导出三件套。转换结果会替换当前画布（可一键撤销）。
          </p>
        </div>
      )}
    </Dialog>
  );

  function renderFooter(): ReactNode {
    if (step === 'idle') {
      return (
        <Button variant="ghost" onClick={close}>
          取消
        </Button>
      );
    }
    if (step === 'crop') {
      return (
        <>
          <Button variant="ghost" onClick={close}>
            取消
          </Button>
          <Button onClick={enterConfig}>下一步：设置参数</Button>
        </>
      );
    }
    if (step === 'config') {
      return (
        <>
          <Button variant="ghost" onClick={close}>
            取消
          </Button>
          <Button variant="outline" onClick={backToCrop}>
            上一步
          </Button>
          <Button disabled={!sizeValid} onClick={() => void startConvert()}>
            开始转换
          </Button>
        </>
      );
    }
    if (step === 'converting') {
      return (
        <Button variant="ghost" onClick={close}>
          取消
        </Button>
      );
    }
    return (
      <>
        <Button variant="outline" onClick={backToConfig}>
          返回调整
        </Button>
        <Button onClick={toEditor}>进编辑器精修</Button>
      </>
    );
  }
}
