# SEO 与预渲染（px-creat-web）

> 营销页必须产出含真实 DOM 正文与逐路由 meta/OG 的静态 HTML；工具页纯 CSR。方案定稿于 M0（详见 `.trellis/tasks/09-04-m0-infra/design.md`）。

---

## Design Decision: 构建后自研静态渲染（2026-09-04 定稿）

**Context**: px-creat-web 是独立 SPA 但有硬性 SEO 要求，营销页需要预渲染静态 HTML。

**Options Considered**:
1. vite-plugin-prerender — 依赖 puppeteer@^1.7.0（2018 年、需下载 Chromium），CI/国内网络不可移植且已停更 → **弃**
2. 部署层 prerendering — 与托管平台绑定，本地 build 无静态产物，不满足验收 → **弃**
3. 迁移 Next.js / SSG 框架 — 重型迁移，留到 P1 图库前再评估 → **暂缓**
4. **构建后自研静态渲染 — 采纳（零新增依赖）**：`vite build` 后以 `build.ssr` 二次构建 `src/entry-server.tsx`，Node 端 `renderToString` 渲染营销路由，把正文与 meta/OG 注入 dist 模板（`scripts/prerender.mjs`）。

---

## Convention: 新增营销页的登记制

**What**: 路由 meta 单一来源是 `src/router/seo.ts`。新增营销页必须同时：
1. 在 `SEO_META` 登记该路由的 title / description / og 字段；
2. 在 `scripts/prerender.mjs` 的 `PRERENDER_ROUTES` 登记路由路径。

**Why**: 客户端 `src/components/Seo.tsx`（upsert meta，含 robots 标签移除）与预渲染脚本共用同一配置，两个消费方不分叉；漏登记 = 该页无 meta / 不被预渲染。

**Wrong vs Correct**:
```tsx
// Wrong: 页面组件里自己管 <title> / useEffect 改 meta
useEffect(() => { document.title = '关于我们' }, [])

// Correct: 组件只挂 <Seo />，数据来自 SEO_META 登记表
return <><Seo {...SEO_META['/about']} />…</>
```

---

## 契约要点

- `main.tsx` / `entry-server.tsx` 共用 `AppRoutes`，路由表不得分叉。
- 任何注入 HTML 模板的动态文本必须经 escapeHtml（有单测）；勿新增第二份实现（既有重复见 Known Debt）。
- 预渲染产物：`dist/index.html`、`dist/about/index.html`、`dist/about.html`（后者兼容 `$uri.html` 回退型静态托管；nginx 建议 `try_files $uri $uri.html $uri/ /index.html;`）。
- 新营销页同时需在 `AppRoutes` 挂路由并使用 `MarketingLayout`。

---

## 已知边界（P2，顺延 M1+）

- `og:url` / canonical 未输出，`og:image` 为根相对占位图；正式部署域名确定后在 `router/seo.ts` 绝对化，正式 OG 封面（烫染效果图版式）属 P1 分享页任务。
- CSR 路由（`/studio`）经 SPA fallback 返回首页 HTML，非 JS 爬虫会看到首页内容；托管层可加 `X-Robots-Tag` 头加固（Google 等 JS 爬虫无碍）。
- 客户端水合判定按路径白名单；若托管只配 `/index.html` 兜底，直开 `/about` 会 hydrate 不匹配（React 18 降级 client render，非致命）。
