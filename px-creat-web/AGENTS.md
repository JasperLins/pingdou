# px-creat-web · Web 创作端

> 拼豆生态的 P0 创作端：创作者画图、图片转图纸、烫染效果预览、BOM 生成与导出。独立 SPA，经 REST API 接入 `server/`（芋道后端）。总纲见根目录 `../AGENTS.md`。

## 当前状态

M0 工程骨架已搭建（2026-09-04）：Vite 6 + React 18 + TypeScript(strict) + Tailwind CSS v3 + zustand + Vitest，pnpm 管理，Node 20+。已有：双主题 token（Bocchi 粉/Miku 青 × 亮暗）、通用 UI 组件起步（`components/ui/`，`/dev/ui` 演示页）、路由分区与路由级 SEO、营销页预渲染管线。`web-style/` 为视觉参考（只读）。编辑器/转换算法属 m2/m3，尚未开始。

## 技术栈与硬性要求

- React 18 + TypeScript + Vite（strict，`tsc --noEmit` 零错误），不引入后端渲染依赖（P0 纯前端）。
- **SEO 已定稿（2026-09-04）**：Vite 构建后自研预渲染——`pnpm build` 末步执行 `scripts/prerender.mjs`，以 `src/entry-server.tsx`（react-dom/server）渲染营销路由并把 title/meta/OG 注入产物 HTML；路由 meta 单一来源 `src/router/seo.ts`（`PRERENDER_ROUTES` 登记）。工具页纯 CSR。P1 图库前再评估 Next.js。
- 样式用 Tailwind CSS。**整站视觉基准是 `web-style/` 两张参考图**（`bocchi the rock.jpg` 粉色主题、`Miku UI Design.jpg` 青色主题：大圆角卡片、pill 按钮、粉彩渐变 Hero、角色插画出血、贴纸元素）；`../lineone-ui-demo/` 仅作组件形态与交互参考（见其 AGENTS.md），不沿用其 navy 后台配色。需要视觉模型（GLM-5.3-flash）产出页面 UI 时，调用会话 `sess_e96db654-c0c6-4231-8e6e-de152fb67575` 执行。
- 色板数据（MARD/COCO/Perler/Hama/Artkal，CSV）放 `src/data/`，是全生态唯一权威来源。

## 目录结构（M0 落地）

```text
src/
  lib/          纯函数算法库（禁止 import React）：utils.ts 已有；types/color/palettes/converter/
                patternSheet/storage（m1–m5 落地，见 lib/README.md）
  router/       seo.ts：路由级 title/description/OG/robots + PRERENDER_ROUTES（SEO 单一来源）
  store/        zustand stores：theme.ts（accent: bocchi|miku + dark，localStorage 持久化）
  components/
    ui/         通用 UI：Button/Card/Dialog/Drawer/Tabs/Tooltip（lineone 结构复刻，本站 token）
    editor/     编辑器组件（m2 落地：CanvasStage/ToolRail/PalettePanel/StatsPanel…，见其 README）
    layout/     Header（居中 pill 导航 + 主题切换）/ Footer / MarketingLayout
    Seo.tsx     客户端路由 SEO upsert；ThemeController.tsx 主题同步 <html>
  pages/
    marketing/  Home（web-style 版式）/ About —— 可预渲染
    studio/     Studio 占位（CSR，noindex）
    dev/        DevUi 组件演示（/dev/ui，noindex）
  data/         五品牌色板 CSV（m1 入库，唯一权威来源，见其 README）
  AppRoutes.tsx 路由表唯一来源；main.tsx 客户端入口；entry-server.tsx 预渲染入口
public/         favicon.svg · og-default.png
scripts/        prerender.mjs（构建后预渲染）
```

## 代码规范

- 组件：函数组件 + Hooks；文件 PascalCase `.tsx`，工具模块 camelCase `.ts`。
- 核心算法（转换、色彩匹配、烫染渲染）必须在 `src/lib/` 与 UI 解耦、可独立测试；重计算放 Web Worker 或分片任务，禁止冻结 UI。
- 烫染效果是渲染层属性，不修改图纸像素数据（切换零副作用）。
- SEO：路由层统一管理 `<title>`/meta/OG；作品分享页 OG 图用烫染效果封面。
- TypeScript 严格模式，禁止 `any` 滥用；每个模块完成须过 `tsc --noEmit` 与生产构建。

## 需求口径

需求文档（根目录《…V4.0总纲.md》）是**初步基线**，开发中基于讨论演进，不逐字照搬；凡与讨论结论冲突，以最新讨论为准，并回写文档或本文件。
