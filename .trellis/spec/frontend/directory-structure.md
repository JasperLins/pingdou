# Directory Structure

> px-creat-web 实际布局（M0 建成）。契约源头：`.trellis/tasks/09-04-px-creat-web-p0/design.md`「目录契约」节。

---

## Directory Layout

```text
px-creat-web/
  scripts/
    prerender.mjs            # 构建后预渲染脚本（营销页静态 HTML 产出）
  src/
    lib/                     # 纯函数库：禁止 import React / DOM API；显式类型签名 + TSDoc；UI 层唯一调用入口
    components/
      ui/                    # 通用起步组件（Button/Card/Dialog/Drawer/Tabs/Tooltip）
      layout/                # Header / Footer / MarketingLayout
      editor/                # 编辑器专属组件（CanvasStage、ToolRail…，M2+）
    pages/
      marketing/             # 营销页（可预渲染；新增页须登记 SEO_META + PRERENDER_ROUTES）
      studio/                # 编辑器 CSR 工具页
      dev/                   # 组件演示页（/dev/ui）
    store/                   # zustand stores（theme.ts；project/editor 后续）
    data/                    # 色板 CSV 构建期内置（全生态唯一权威来源）
    router/
      seo.ts                 # 路由 meta 单一来源
  public/
```

---

## Module Organization

- `lib/` 与 UI 严格解耦：转换管线、色彩科学（CIELAB / CIEDE2000）、图纸导出等算法一律放 `lib/`，禁止 React 依赖；配 Vitest 单测。
- `data/` 是色板数据唯一权威来源，各端不得自建副本（根 AGENTS.md 协作约定）。

---

## Naming Conventions

组件文件 PascalCase；工具 / store / 路由模块 camelCase；函数与变量 camelCase；常量 SCREAMING_SNAKE。

---

## Examples

- 主题四组合 token：`src/index.css`；语义 token 映射：`tailwind.config.js`
- 预渲染登记制：`src/router/seo.ts` + `scripts/prerender.mjs`
- persist store 范式：`src/store/theme.ts`
