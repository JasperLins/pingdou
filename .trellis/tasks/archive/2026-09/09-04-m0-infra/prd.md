# M0 工程基建：脚手架+Tailwind token+SEO 预渲染

## Goal

从零搭建 px-creat-web 的 Vite + React + TS 工程骨架：构建链、设计 token、通用 UI 组件起步、路由分区（营销页/工具页）、SEO 预渲染方案定稿并落地。后续所有子任务在此骨架上开发。

## Requirements

- Vite + React 18 + TypeScript（strict）+ Vitest 脚手架；Node 20+；包管理器 pnpm（与仓库其他前端一致）。
- 路由分区：`pages/marketing/`（首页、工具介绍——必须可预渲染）与 `pages/studio/`（编辑器 CSR）；meta/OG 由路由层统一管理（`<title>`、description、OG 标签路由级配置）。
- Tailwind CSS 主题 token 从 `web-style/` 双图提炼（粉彩主题色渐变、24–32px 圆角、pill 按钮、soft 阴影、圆润无衬线字体）；**双主题切换**（默认 Bocchi 粉，可切 Miku 青，theme store 支持，2026-09-04 定稿），集中在 `tailwind.config.js`；lineone 仅作组件结构参考，不沿用其 navy 色阶。
- `components/ui/` 起步组件：Button、Card、Dialog、Drawer、Tabs、Tooltip（按 lineone 对应 elements/components 页复刻视觉，React 重写）。
- 状态选型落地：zustand（父任务 design.md 契约），建 `store/` 目录与 theme store 示例。
- SEO 预渲染：在 vite-plugin-prerender 与部署层方案之间定稿（写出对比结论到本任务 design.md），实现营销页静态 HTML 产出。

## Acceptance Criteria

- [ ] `pnpm i && pnpm build` 通过，`tsc --noEmit` 零错误
- [ ] 首页路由可访问，构建产物中营销页有预渲染静态 HTML（含 meta/OG）
- [ ] 暗色模式切换可用（class 切换，token 生效）
- [ ] 双主题切换可用（Bocchi 粉默认，Miku 青可切，token 全站生效）
- [ ] ui 起步组件有演示页，视觉符合 web-style 基准（父任务 design.md「视觉风格基准」节）
- [ ] SEO 方案定稿结论写入本任务 design.md 并回写根 AGENTS.md §px-creat-web

## Notes

- 依赖：无（首个子任务，可与 M1 并行）。
- 父任务契约：目录结构遵守父任务 design.md（lib/components/pages/store/data）。
