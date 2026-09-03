/**
 * 构建后自研预渲染（SEO 方案定稿，详见任务 design.md）：
 *
 * 1. 用 vite 以 SSR 模式二次构建 src/entry-server.tsx → dist-prerender/entry-server.js；
 * 2. 对每个营销路由调用 render(url)（react-dom/server renderToString）得到静态 HTML；
 * 3. 把 dist/index.html 模板的 <title> 替换、#root 注入渲染结果、</head> 前注入 meta/OG；
 * 4. 产物：dist/index.html（/）与 dist/about/index.html（/about），随后清理 dist-prerender。
 *
 * 相比 vite-plugin-prerender（puppeteer 系）零浏览器依赖、零新增运行时依赖；
 * meta/OG 与客户端 Seo 组件共用 src/router/seo.ts 单一来源。
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

const root = process.cwd()
const ssrOutDir = 'dist-prerender'
const shellPath = resolve(root, 'dist/index.html')

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function main() {
  // 1. SSR 构建（react/react-dom/react-router-dom/zustand 均为依赖，自动外置给 Node import）
  await build({
    root,
    logLevel: 'warn',
    build: {
      ssr: 'src/entry-server.tsx',
      outDir: ssrOutDir,
      minify: false,
      rollupOptions: {
        output: { entryFileNames: 'entry-server.js' },
      },
    },
  })

  const serverEntry = await import(pathToFileURL(resolve(root, ssrOutDir, 'entry-server.js')).href)
  const shell = await readFile(shellPath, 'utf8')

  if (!shell.includes('<div id="root"></div>')) {
    throw new Error('dist/index.html 中未找到 <div id="root"></div>，预渲染注入点缺失')
  }

  // 2. 逐路由渲染并写入产物
  for (const route of serverEntry.PRERENDER_ROUTES) {
    const { html, title, headTags } = serverEntry.render(route)
    const out = shell
      .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
      .replace('<div id="root"></div>', () => `<div id="root">${html}</div>`)
      .replace('</head>', () => `  ${headTags}\n  </head>`)

    const relFile = route === '/' ? 'index.html' : `${route.replace(/^\/+|\/+$/g, '')}/index.html`
    const target = resolve(root, 'dist', relFile)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, out, 'utf8')
    console.log(`[prerender] ${route} -> dist/${relFile} (body ${html.length} bytes, title "${title}")`)

    // 非根路由同时输出 about.html：兼容只做 $uri.html 回退的静态托管
    // （nginx 建议 try_files $uri $uri.html $uri/ /index.html;）
    if (route !== '/') {
      const flat = resolve(root, 'dist', `${route.replace(/^\/+|\/+$/g, '')}.html`)
      await writeFile(flat, out, 'utf8')
      console.log(`[prerender] ${route} -> dist/${route.replace(/^\/+|\/+$/g, '')}.html`)
    }
  }

  // 3. 清理 SSR 中间产物
  await rm(resolve(root, ssrOutDir), { recursive: true, force: true })
  console.log('[prerender] done')
}

main().catch((err) => {
  console.error('[prerender] failed:', err)
  process.exit(1)
})
