# Quality Guidelines

> px-creat-web 质量门槛。每个前端任务收尾前逐条过；跨任务红线来自 `.trellis/tasks/09-04-px-creat-web-p0/design.md`「性能预算」。

---

## Verification Gates（必须全部通过）

1. `pnpm i && pnpm build`（含 tsc + vite build + 预渲染脚本）
2. `pnpm exec tsc --noEmit` 零错误
3. `pnpm test`（Vitest）；`lib/` 纯函数必须有单测
4. 营销页改动时：检查 `dist/` 预渲染 HTML 含真实 DOM 正文与逐路由 title / description / OG 标签
5. 视觉改动对照 `web-style/` 双图走查

---

## Forbidden Patterns

- `any` / `as any` / `@ts-ignore` / `@ts-expect-error` / `eslint-disable`（全仓 grep 应零命中）
- `src/lib/` 内 import React 或 DOM API
- 组件内硬编码颜色 / 圆角（见 [component-guidelines.md](./component-guidelines.md) Styling Patterns）
- 主线程同步执行 >50ms 的计算（必须 Worker 或分片；烫染渲染永不修改 cells 数据）

---

## Required Patterns

### 路由与水合契约（px-creat-web，2026-09-04 m0 定稿）

- 路由用 **声明式 `<Routes>`**（客户端 `BrowserRouter` / 预渲染 `MemoryRouter` 包同一 `AppRoutes`，两端同构渲染）。**禁止**把 `<Routes>` 组件传入数据路由 API（`createBrowserRouter`/`createRoutesFromElements`）——SSR 路径正常但客户端启动即崩，页面变纯静态、交互全死（m0 实测教训，见 `.trellis/tasks/09-04-m0-infra/design.md` §6）。
- 客户端入口 `hydrateRoot` 仅允许作用于预渲染路由（`PRERENDER_ROUTES` 命中且 `#root` 有内容）；SPA fallback 兜底路径一律 `createRoot`。
- `robots` 等路由级 meta 在客户端 upsert 时必须"无配置即移除"，防止 noindex 跨页残留。

### 环境注意（Windows / ZCode）

- Bash 持久 cwd 不落在子项目目录（如 `px-creat-web/`）：hook 以相对路径注册，cwd 在子目录时会失效；进入子目录用子 shell `(cd … && …)`。
- 后台起的 `vite preview` 实例退出后端口可能被旧实例占用，验收前先 `netstat` 确认监听进程是自己的实例。

---

## tsconfig 基线

`strict` + `noUnusedLocals` + `noUnusedParameters`；后续配置只收紧不放松。

---

## Testing Requirements

- `lib/` 纯函数逐模块配 Vitest 单测（色彩科学、转换管线、导出序列化必须覆盖）。
- 预渲染管线：escapeHtml 等注入路径必须有断言；改动 `SEO_META` / `PRERENDER_ROUTES` 后跑 build 并抽查 `dist/` 产物。

---

## Code Review Checklist

- [ ] Verification Gates 全过；Forbidden Patterns 全仓 grep 零命中
- [ ] 新营销页已登记 `SEO_META` + `PRERENDER_ROUTES`（见 [seo-prerendering.md](./seo-prerendering.md)）
- [ ] 主题相关改动四组合 token 同步、`ThemeController` 模式未被绕过
- [ ] 新颜色 token 四组合同步补齐（见 [component-guidelines.md](./component-guidelines.md)）

---

## Known Debt（P2，顺延 M1+；来源 M0 check 报告）

1. `Home.tsx` HERO_BEADS mock hex → P1 接入图库数据时迁 `src/data/`
2. `scripts/prerender.mjs` 的 escapeHtml 与 `src/lib/utils.ts` 重复实现 → 收敛为单一导出
3. 水合路径白名单在“仅 /index.html 兜底”的托管下会 mismatch → 预渲染时给 `#root` 写标记属性做二次校验
4. CSR 路由 SPA fallback 对非 JS 爬虫的 SEO → 托管层加 `X-Robots-Tag`
5. FOUC 脚本不校验 persist `version` → theme schema 变更时人工同步（见 [state-management.md](./state-management.md) Gotcha）
6. ESLint 未引入 → M1 开工前补 eslint + react-hooks 规则
