# CLAUDE.md - Claude Proxy 项目指南

## 项目概述

这是一个 **Electron 桌面应用**（macOS Apple Silicon），用于管理和切换不同的 Claude API 中转服务。支持多路由规则、智能模型映射、请求日志和速度测试等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 5 + TailwindCSS 3 |
| 后端 | Fastify 4 (Node.js) |
| 桌面 | Electron 28 + electron-builder |

## 关键目录结构

```
├── electron/           # Electron 主进程
│   ├── main.ts        # 主入口 - 窗口管理、IPC 通信
│   ├── preload.ts     # 预加载脚本 - 安全桥接层
│   └── tray.ts        # 系统托盘
│
├── src/
│   ├── proxy/         # 代理服务核心
│   │   ├── router.ts  # 路由匹配逻辑
│   │   ├── server.ts  # HTTP 代理服务器 (Fastify)
│   │   └── upstream.ts # 上游请求转发
│   │
│   ├── store/         # 数据存储
│   │   ├── routes.ts  # 路由规则存储
│   │   └── settings.ts # 设置存储
│   │
│   ├── types/         # TypeScript 类型定义
│   │   └── index.ts
│   │
│   └── ui/            # 前端界面
│       ├── components/ # UI 组件
│       ├── pages/     # 页面组件
│       └── App.tsx    # 主应用组件
```

## 开发命令

```bash
npm run dev      # 开发模式（热重载）
npm run build    # 构建
npm run dist     # 打包安装包 (.dmg)
```

## 重要配置

- **路由规则存储**: `~/Library/Application Support/claude-proxy/routes.json`
- **设置存储**: `~/Library/Application Support/claude-proxy/settings.json`
- **默认代理端口**: 3456

## 核心功能

1. **多路由规则管理** - 支持多个上游 API 端点，优先级排序，启用/禁用
2. **智能模型映射** - 使用通配符匹配模型名（如 `claude-sonnet-*`），默认模型兜底
3. **请求日志** - 实时显示请求记录、匹配规则、延迟、状态码、Token 用量
4. **速度测试** - 一键测试路由连通性
5. **Claude Code 集成** - 一键写入 Claude Code 配置
6. **系统托盘** - 托盘图标显示代理状态

## 版本管理

当前版本: **1.0.2**

### 版本更新约束

每次项目有代码变更需要发布新版本时，必须执行以下操作：

1. **更新版本号**: 修改 `package.json` 中的 `version` 字段，遵循语义化版本规范
   - 修复 bug: 1.0.x -> 1.0.(x+1)
   - 新增功能: 1.x.0 -> 1.(x+1).0
   - 重大变更: x.0.0 -> (x+1).0.0

2. **更新修改日志**: 在 `docs/CHANGELOG.md` 顶部添加新版本条目，包含：
   - 版本号和发布日期
   - 变更类型分类（Added / Fixed / Changed / Removed）
   - 具体变更内容描述

## 注意事项

- 本项目仅支持 macOS Apple Silicon (arm64)
- 代理服务器在本地运行，通过路由规则转发请求到不同的上游
- 使用 `minimatch` 库进行模型名的通配符匹配
