# 技术设计 · M0 工程基建（脚手架 + Tailwind token + SEO 预渲染）

对应 prd.md 的技术定稿。本文是本子任务的 design 产出，含：目录结构、token 设计说明、SEO 方案对比与选型、验证结论、待定项。

## 1. 目录结构（落地形态）

```text
px-creat-web/
  index.html                  # SPA 模板：默认 title、favicon；不放 description/OG（避免与注入重复）
  package.json                # type:module · engines.node >=20 · scripts: dev/build/test/typecheck/preview
  pnpm-workspace.yaml         # pnpm 11 设置（allowBuilds: esbuild）
  tsconfig.json               # strict + noUnusedLocals/Parameters，include src + vite.config.ts
  vite.config.ts              # @vitejs/plugin-react + '@' → /src 别名 + vitest 配置
  tailwind.config.js          # 设计 token 唯一映射层（色板指向 CSS 变量）
  postcss.config.js
  scripts/prerender.mjs       # 构建后自研预渲染（见 §3）
  public/                     # favicon.svg · og-default.png（1200×630 占位）
  src/
    main.tsx                  # 客户端入口：BrowserRouter（声明式路由，与 SSR 入口同构）+ hydrate/create 自适应
    entry-server.tsx          # 预渲染入口：MemoryRouter + renderToString，导出 render/PRERENDER_ROUTES
    AppRoutes.tsx             # 路由表唯一来源（客户端与预渲染共用）
    index.css                 # CSS 变量 token 定义（4 主题组合）+ Tailwind 指令
    router/seo.ts             # 路由级 SEO 配置唯一来源（title/description/OG/robots/PRERENDER_ROUTES）
    components/
      AppShell.tsx            # 全路由外壳：ThemeController + Seo + Outlet
      Seo.tsx                 # 客户端按路由 upsert <head> meta/OG
      ThemeController.tsx     # theme store → <html data-theme / .dark>
      layout/                 # Header（居中 pill 导航+主题切换）/ Footer / MarketingLayout
      ui/                     # Button / Card / Dialog / Drawer / Tabs / Tooltip + index barrel
      editor/                 # 占位（README 说明 m2 组件清单）
    pages/
      marketing/              # Home（版式对齐 web-style）/ About —— 可预渲染
      studio/                 # Studio 占位（CSR，noindex）
      dev/                    # DevUi 组件演示页（/dev/ui，noindex）
    store/theme.ts            # zustand + persist：accent(bocchi/miku) + dark
    lib/                      # 纯函数（禁止 import React）：utils.ts(cn/escapeHtml) + README 契约
    data/                     # 色板数据占位（README 说明唯一权威来源约定）
```

## 2. Token 设计说明（双主题 + 暗色）

**机制**：CSS 变量（`--c-*`，"R G B" 三元组）承载全部语义色，`tailwind.config.js` theme.extend 把 `bg/surface/ink/primary/heroFrom/...` 映射到 `rgb(var(--c-x) / <alpha-value>)`。四个组合按特异性递增覆盖：

| 选择器 | 组合 |
| --- | --- |
| `:root` | Bocchi 粉 · 亮 |
| `[data-theme='miku']` | Miku 青 · 亮 |
| `.dark` | Bocchi 粉 · 暗 |
| `.dark[data-theme='miku']` | Miku 青 · 暗 |

`<html data-theme="bocchi" class?>` 由 theme store（zustand persist，localStorage `pindou-theme`）经 ThemeController 写入；Tailwind `darkMode: 'class'`。预渲染产物保持默认（bocchi 亮）；`index.html` 内联启动脚本在首帧绘制前按同一持久化键恢复 `data-theme`/`.dark`，消除老用户回访时的主题闪烁（FOUC），挂载后 ThemeController 接管，两端取值口径一致。

**色值来源**（web-style 双图 PowerShell 取样）：

- Bocchi（bocchi the rock.jpg）：近白底 `#FDFAFB`、Hero 渐变 `#E27988 → #FCA5B5`、深点缀 `#C9586C`、深色文字 `#2C222B`；
- Miku（Miku UI Design.jpg）：近白底 `#F5FBFB`、Hero 渐变 `#4FBFC3 → #AFECED`、深点缀 `#2C6E7E`/`#2C8E92`；
- 暗色两套为对应亮色的深色衍生（保持粉/青色相，primary 提亮、on-primary 翻深）。

**形状/阴影/字体**：卡片圆角 `cardSm 24px / card 28px / cardLg 32px`、缩略图 `thumb 16px / thumbSm 12px`、按钮全 pill（rounded-full）；soft 阴影走 `--c-shadow` 主题化低透明度（`soft / soft-lg / sticker` + `dropShadow.sticker`）；字体 Poppins→Nunito→Quicksand→系统中文字体栈（不外链）。渐变 token `bg-hero-gradient`（135°，from/mid/to 三档变量）。

**版式落地**（首页）：居中 pill 玻璃导航 + 大圆角渐变 Hero（贴纸感图纸预览卡出血、像素心形涂鸦、像素豆圆点网格）→ 搜索 pill + 标签 chips → 三栏内容（贴纸卡网格 ×2 / 侧栏最新列表 + 渐变 CTA 卡）。

## 3. SEO 预渲染方案对比与选型

### 候选

| 方案 | 原理 | 体积/依赖 | 维护性 | 结论 |
| --- | --- | --- | --- | --- |
| A. vite-plugin-prerender（及其 puppeteer 系替代，如 react-snap） | 构建后起无头浏览器逐路由渲染快照 | 引入 puppeteer + Chromium（~100-300MB），CI/Windows 均要装浏览器 | vite-plugin-prerender 停更多年（v0.3.0-alpha，面向 Vite 2-4 时代）；react-snap 同样停更且与 React 18 createRoot 兼容性差 | 弃 |
| B. 部署层预渲染（Netlify/Cloudflare prerender 等） | 平台爬虫中间件动态渲染 | 依赖特定托管平台，仓库内不可验证 | 与部署绑定，本地 build 产物不含静态 HTML，无法满足验收 | 弃 |
| C. SSG 框架迁移（vite-ssg/Next.js） | 整站换渲染框架 | 需重构入口与路由生命周期；vite-ssg 生态偏 Vue | P1 图库前再评估 Next.js（父任务既定），M0 不做框架迁移 | 弃（本轮） |
| **D. 构建后自研静态渲染脚本（react-dom/server）** | `vite build` 后追加 SSR 二次构建 `entry-server.tsx`，Node 端 `renderToString` 每个营销路由，把 HTML 与 meta/OG 注入 dist 的 index.html 模板 | **零新增依赖**（react-dom/server 本就是依赖）；脚本 ~100 行 | 入口/路由表/SEO 配置与客户端共用同源文件，逻辑可控可测 | **采纳** |

### 选型 D 的理由与实现

- 任务硬约束"避免引入体积/维护性差的重依赖"直接排除 A；B 无法本地验证；C 与父任务"P1 前再评估 Next.js"的节奏冲突。
- 营销页是静态内容（无数据获取），`renderToString` 与客户端 `createBrowserRouter` 对同一 `AppRoutes` 渲染 DOM 一致，客户端入口 `hydrateRoot`（`#root` 有内容时）/`createRoot` 自适应，预渲染页可水合、直开页正常 CSR。
- 实现：`pnpm build` = `tsc --noEmit && vite build && node scripts/prerender.mjs`。脚本以 `build.ssr` 二次构建 → `dist-prerender/entry-server.js` → 对 `PRERENDER_ROUTES`（`/`、`/about`）注入 `<title>`、`#root` 内容、`</head>` 前的 meta/OG → 写 `dist/index.html`、`dist/about/index.html`，并同时输出 `dist/about.html`（兼容仅做 `$uri.html` 回退的静态托管；nginx 建议 `try_files $uri $uri.html $uri/ /index.html;`）→ 清理中间产物。
- 单一来源：路由 meta（title/description/OG/robots）全部在 `src/router/seo.ts`；客户端 `Seo.tsx` 与预渲染脚本共用，工具页（/studio、/dev/ui）标记 `noindex`。
- 已验证：dist 产物含完整静态 HTML（首页 body 22.7KB）与全部 meta/OG 标签（见 prd 验收）。

## 4. 验证结论

- `pnpm install`：通过（react 18.3.1 / react-router-dom 6.30.6 / zustand 5.0.15 / vite 6.4.3 / tailwindcss 3.4.19 / vitest 3.2.7；pnpm-workspace.yaml `allowBuilds: esbuild`）。
- `pnpm exec tsc --noEmit`：零错误（strict + noUnusedLocals/Parameters）。
- `pnpm build`：通过；`dist/index.html`（首页正文 22.7KB）与 `dist/about/index.html`、`dist/about.html` 均含预渲染静态 HTML + 逐路由 title/description/OG；`vite preview` 下 `/`、`/about`、`/about/`、`/studio`、`/dev/ui`、`/og-default.png` 全部 200，`/about/` 与 `/about.html` 返回 about 版 meta。
- `pnpm test`（vitest）：15 用例全过（cn/escapeHtml、SEO 配置守卫、theme store；Node 环境下 zustand persist 无 localStorage 的 warning 属预期噪声）。
- 主题运行时核查：默认 bocchi 亮（`<html data-theme="bocchi">`），Header/演示页可切 miku 与 dark，token 随 `--c-*` 四组合全站生效。

## 5. 待定（后续任务拍板）

- **og:image / og:url / canonical 需要部署域名**：当前 og:image 用根相对路径 `/og-default.png`，og:url 与 canonical 未输出（无绝对域名可用）；部署域名确定后在 `router/seo.ts` 补绝对化。正式版 OG 封面（烫染效果图版式）在 P1 图库/分享页任务产出，现为 PowerShell 生成的粉彩渐变占位图。
- **ESLint**：本任务未引入（验收只要求 tsc + build）；建议 M1 前补 eslint + react-hooks 规则并在 build 脚本串联。
- **P1 图库前重估 Next.js**：父任务既定方向，若迁移则本文 §3 方案 D 退役。
- **多语言/额外营销路由**：新页面只需在 `SEO_META` + `PRERENDER_ROUTES` 登记即可进入预渲染管线。

## 6. 视觉验收与后置修复（2026-09-04，浏览器实测）

trellis-check 通过（无 P0）后的浏览器实测发现 **P0 级水合崩溃**，已修复并复验：

- **根因**：`main.tsx` 把 `<Routes>` 声明式组件 `AppRoutes` 误传入数据路由 API `createRoutesFromElements(<AppRoutes />)`（该 API 只接受 `<Route>` 元素），客户端模块启动即抛错——页面呈现预渲染静态 HTML（SSR 路径正常），但 React 从未挂载，**全部交互失效**（主题/暗色/导航均无响应）。curl 级验收无法发现，浏览器交互实测捕获。
- **修复**：客户端入口改为 `<BrowserRouter><AppRoutes /></BrowserRouter>` 声明式路由，与 SSR 入口（MemoryRouter + AppRoutes）**同构渲染**，水合天然一致；项目无 loader/action，数据路由模式无收益（父任务 design.md 路由行已同步定稿变更）。
- **随修的 check P1 两项**：① hydrate 门控——仅 `PRERENDER_ROUTES` 命中的路径才 `hydrateRoot`（SPA fallback 用首页 HTML 兜底 CSR 路由，盲目 hydrate 会恢复失败）；② `Seo.tsx` robots 标签改为"无配置即移除"（noindex 页导航回营销页后不残留）。
- **复验记录**：tsc 零错误 / 15 测试全过 / build+预渲染正常；浏览器实测——`#root` 出现 `__reactContainer`（水合成功）、Miku 切换 `data-theme="miku"` 且 `pindou-theme` localStorage 持久化、暗色 `.dark` 生效、`/dev/ui` CSR 直开走 createRoot 且客户端 noindex 生效、六组件演示齐全。
- 遗留观察：本工作区存在并行 IDE/外部编辑活动（About/DevUi/prerender.mjs/根 AGENTS.md 在实现完成后被外部更新，内容与任务方向一致）；`px-creat-web/.zcode/hooks/inject-shell-session-context.py` 为临时委托桩（宿主 hook 相对路径在子目录 cwd 下失效的缓解），根治后可删。
