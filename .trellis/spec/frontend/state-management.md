# State Management

> px-creat-web（React + TS）状态管理约定。zustand 选型定稿于 M0（2026-09-04），已回写根 AGENTS.md §3.2。

---

## Overview

- 全局状态：**zustand**（定稿，不引入 redux）。参考实现：`src/store/theme.ts`。
- 主题（accent + dark）是目前唯一 persist 场景；画布/工程状态 store（`project.ts` / `editor.ts`，M2+）按需新建，遵循同一模式。
- 服务端状态（P1 图库 API）：暂未引入专门库，落地时回写本文件。

---

## Convention: store 不触 DOM

**What**: zustand store 只管数据；DOM 副作用（写 `<html data-theme>`、切 `.dark` class）统一由 `src/components/ThemeController.tsx` 订阅 store 后执行。

**Why**: store 保持可测、可在 SSR / Worker 语境使用；副作用集中一处，预渲染与客户端行为一致。

```tsx
// Wrong: 在 store 的 setter 里直接操作 document
setAccent: (a) => { set({ accent: a }); document.documentElement.dataset.theme = a }

// Correct: store 纯数据，组件订阅后同步 DOM
const accent = useThemeStore((s) => s.accent)
useEffect(() => { document.documentElement.dataset.theme = accent }, [accent])
```

---

## Gotcha: FOUC 防闪烁脚本与 persist schema 强耦合

> `index.html` 内联启动脚本在首帧前读取 persist 键 `pindou-theme`（结构 `saved.state.accent` / `saved.state.dark`）恢复 `data-theme` 与 `.dark` class。
>
> 修改 theme store 的 state 结构或 persist 键名时，**必须同步修改该脚本**。脚本目前不校验 persist `version`（P2），schema 变更期间人工保证两端一致；读取失败回退默认 bocchi 亮色（与预渲染默认一致）。

---

## Common Mistakes

- 在组件里散落 `localStorage` 读写主题 → 一律走 store（persist 已配置，键 `pindou-theme`）。
- 在预渲染路径（`entry-server.tsx` 可达代码）访问 `window` / `localStorage` / `document` → 仅限客户端守卫内使用。
