# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] - 2026-03-05

### Changed
- 删除 modelAliases 配置，从工具生成配置中移除
- 拆分保存按钮：代理配置和 Claude Code 模型配置各有独立的保存按钮

---

## [1.0.2] - 2026-03-05

### Added
- 添加 CLAUDE.md 项目指南文档
- 添加 PRD.md 产品需求文档
- 添加 CHANGELOG.md 修改日志文档

---

## [1.0.1] - 2026-03-05

### Fixed
- 修复 JSON 视图展示完整配置内容

### Refactored
- 简化 UI 和配置保存逻辑

---

## [1.0.0] - 2026-02-28

### Added
- 合并模型别名为支持表单/JSON 双视图
- 优化设置页面布局
- 添加 Claude Code 配置手动编辑功能
- 添加常见问题 FAQ 文档
- 添加首次打开说明到 README
- 更新 README 添加下载链接和修改日志

### Fixed
- 修复各项 UI 和功能问题

### Refactored
- 代码重构和优化

---

## Initial Release - 2026-02-23

### Added
- 多路由规则管理（添加、编辑、删除、优先级排序、启用/禁用）
- 智能模型映射（通配符匹配、默认模型兜底）
- 请求日志（实时显示、匹配规则、延迟、状态码、详情查看）
- 速度测试功能
- Claude Code 集成（一键写入配置、模型别名、剪贴板复制）
- 系统托盘（状态显示、快速访问）
- 设置管理（代理端口、请求超时）

---

*This project does not use full GitHub-style release notes. For detailed commit history, run `git log`.*
