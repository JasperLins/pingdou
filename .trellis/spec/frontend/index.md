# Frontend Development Guidelines

> px-creat-web（React + TS + Vite）前端开发规范。约定以 M0 落地结论为准（2026-09-04）。

---

## Overview

px-creat-web 技术栈：Vite + React 18 + TypeScript(strict) + Tailwind CSS v3 + zustand + React Router（声明式 `<Routes>`）+ Vitest。营销页构建后自研预渲染，工具页 CSR。契约源头：`.trellis/tasks/09-04-px-creat-web-p0/design.md`（跨子任务技术契约）与根 `AGENTS.md` §3.2。

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | px-creat-web 目录布局、模块组织、命名规范 | 已填充（M0） |
| [Component Guidelines](./component-guidelines.md) | token 集中、主题四组合、组件结构 | 已填充（M0） |
| [Hook Guidelines](./hook-guidelines.md) | 自定义 hooks、数据获取模式 | 待补充 |
| [State Management](./state-management.md) | zustand persist、ThemeController 模式、FOUC 契约 | 已填充（M0） |
| [SEO & Prerendering](./seo-prerendering.md) | 营销页预渲染登记制、SEO meta 单一来源 | 已填充（M0） |
| [Quality Guidelines](./quality-guidelines.md) | 验证门槛、禁用模式、路由水合契约、Known Debt | 已填充（M0） |
| [Type Safety](./type-safety.md) | 类型模式与校验 | 待补充 |

---

## How to Fill These Guidelines

1. 记录项目的**实际约定**（非理想化设想），附代码库真实示例
2. 列出禁用模式及其原因
3. 记录实际踩过的坑（Common Mistakes / Gotcha）

目标：让 AI 助手与新成员理解**本项目**的真实工作方式。

---

**Language**: 文档使用**中文**（与项目工作语言一致；代码标识符与命令保持英文）。
