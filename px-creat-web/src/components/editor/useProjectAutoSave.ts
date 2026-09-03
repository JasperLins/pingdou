import { useEffect } from 'react';
import { createAutoSaveController, useProjectStore } from '@/store/project';
import { createIndexedDbRefImageStore, type RefImageStore } from '@/lib/storage';

/**
 * 自动保存（30s 周期 + requestIdleCallback 错峰）：Studio 挂载后启动。
 * beforeunload 与页面隐藏（visibilitychange → hidden）时立即落盘兜底。
 */

function browserRefStore(): RefImageStore | undefined {
  if (typeof indexedDB === 'undefined') return undefined;
  return createIndexedDbRefImageStore();
}

export function useProjectAutoSave(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refStore = browserRefStore();
    const controller = createAutoSaveController({
      shouldSave: () => {
        const state = useProjectStore.getState();
        return state.loaded && state.hasUnsavedChanges;
      },
      save: async () => {
        await useProjectStore.getState().persistNow(window.localStorage, refStore);
      },
    });
    controller.start();

    const flush = (): void => controller.flush();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      controller.stop();
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);
}
