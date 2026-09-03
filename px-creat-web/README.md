# px-creat-web · 拼豆 Web 创作端

拼豆生态 P0 创作端：画图 / 图片转图纸 → 精修编辑 → 烫染预览 → 导出三件套。React 18 + TypeScript(strict) + Vite + Tailwind CSS v3，pnpm 管理，Node 20+。

## 常用命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 本地开发（http://localhost:5173）
pnpm test           # vitest 单测（lib 纯函数 / seo 配置 / store）
pnpm typecheck      # tsc --noEmit
pnpm build          # 类型检查 → 生产构建 → 营销页预渲染（scripts/prerender.mjs）
pnpm preview        # 预览 dist 产物
```

## 关键入口

- 路由表：`src/AppRoutes.tsx`（客户端与预渲染共用）；路由 meta/OG：`src/router/seo.ts`
- 预渲染：`scripts/prerender.mjs` + `src/entry-server.tsx`（新营销页在 `PRERENDER_ROUTES` 登记即进管线）
- 设计 token：`src/index.css`（CSS 变量，Bocchi 粉 / Miku 青 × 亮暗四组合）+ `tailwind.config.js`（语义映射）
- 主题切换：`src/store/theme.ts`（zustand persist）+ `src/components/ThemeController.tsx`
- 组件演示：`/dev/ui`（noindex）

规范与视觉基准见本目录 `AGENTS.md` 与根目录 `AGENTS.md`。
