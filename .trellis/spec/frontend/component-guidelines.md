# Component Guidelines

> px-creat-web 组件约定。视觉权威基准：`px-creat-web/web-style/` 双图（同一版式骨架，Bocchi 粉默认 / Miku 青可切）；`lineone-ui-demo/` 仅作组件结构参考，其 navy 色阶与后台观感禁止进入整站 token。

---

## Styling Patterns

**What**: Tailwind CSS v3。设计 token 全部集中在 `tailwind.config.js` 的 `theme.extend`，组件只允许语义 token class：

- 圆角：`rounded-card / rounded-cardLg / rounded-cardSm / rounded-thumbSm / rounded-full`（卡片 24–32px、缩略图 12–20px、按钮全 pill）
- 阴影：`shadow-soft / shadow-soft-lg / shadow-sticker`（低透明度 soft 阴影）
- 颜色：只允许语义 class（映射到 `src/index.css` 的 `--c-*` CSS 变量）

**Forbidden**: 组件内硬编码 hex 或任意值色 class（如 `bg-[#ffe3ef]`）。唯一例外：mock 内容数据（如 `Home.tsx` 的 `HERO_BEADS` 贴纸卡“作品自身颜色”，等价图片素材）——P1 图库接入真实数据时迁往 `src/data/`，勿使成模式。

**Wrong vs Correct**:
```tsx
// Wrong
<div className="rounded-3xl bg-[#ffe3ef] shadow-md">

// Correct
<div className="rounded-card bg-surface shadow-soft">
```

---

## 主题 token 架构

- `src/index.css` 中 `--c-*` 变量按**四组合**定义：`:root`（bocchi 亮）/ `[data-theme='miku']` / `.dark` / `.dark[data-theme='miku']`，特异性递增、源码顺序固定。
- `tailwind.config.js` 使用 `darkMode: 'class'`。
- 新增颜色 token 必须**四组合同步补齐**，不得只加亮色组合。

---

## Component Structure

- 函数组件 + hooks；组件文件 PascalCase（`Button.tsx`）。
- 组件目录：`components/ui/`（通用起步组件：Button/Card/Dialog/Drawer/Tabs/Tooltip）、`components/layout/`（Header/Footer/MarketingLayout）、`components/editor/`（编辑器专属，M2+）。
- 页面路由分区：`pages/marketing/`（可预渲染，套 `MarketingLayout`）、`pages/studio/`（CSR 工具页）、`pages/dev/`（组件演示页 `/dev/ui`，不进公开导航）。

---

## Common Mistakes

- 新营销页只加路由不登记 `SEO_META` / `PRERENDER_ROUTES` → 见 [seo-prerendering.md](./seo-prerendering.md)。
- 直接操作 `<html>` 的主题属性 → 必须经 `ThemeController`（见 [state-management.md](./state-management.md)）。
