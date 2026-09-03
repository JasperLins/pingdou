import { useEffect } from 'react';
import type { EditorTool } from '@/lib/types';
import { useEditorStore } from '@/store/editor';
import { useProjectStore } from '@/store/project';

/**
 * 编辑器快捷键全表（Studio 挂载）：
 * B 画笔 / E 橡皮 / G 油漆桶 / I 吸管 / [ ] 笔刷 1–4 / 空格平移 /
 * Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做 / Esc 取消高亮。
 * 输入控件聚焦时忽略。
 */

const TOOL_KEYS: Record<string, EditorTool> = {
  b: 'brush',
  e: 'eraser',
  g: 'bucket',
  i: 'picker',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const editor = useEditorStore.getState();
      const project = useProjectStore.getState();

      if (e.ctrlKey || e.metaKey) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) project.redo();
          else project.undo();
        } else if (key === 'y') {
          e.preventDefault();
          project.redo();
        }
        return;
      }

      switch (key) {
        case 'b':
        case 'e':
        case 'g':
        case 'i':
          editor.setTool(TOOL_KEYS[key]);
          break;
        case '[':
          editor.stepBrush(-1);
          break;
        case ']':
          editor.stepBrush(1);
          break;
        case ' ':
          e.preventDefault();
          editor.setSpaceHeld(true);
          break;
        case 'escape':
          editor.setHighlight(null);
          break;
        default:
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === ' ') useEditorStore.getState().setSpaceHeld(false);
    };

    const onBlur = (): void => {
      useEditorStore.getState().setSpaceHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
