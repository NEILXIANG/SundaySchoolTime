# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 完整的项目文档和开发规范
- 代码质量工具（ESLint, Prettier, EditorConfig）
- CI/CD 自动化测试流程
- 代码覆盖率报告
- 应用菜单栏和系统托盘
- 用户设置持久化
- 窗口状态管理
- 自动更新机制
- 应用图标和签名配置

### Changed
- 完善日志系统配置
- 优化 CSP 安全策略
- 增强错误处理机制

### Security
- 修复依赖包安全漏洞
- 完善内容安全策略（CSP）

## [1.0.0] - 2026-01-17

### Added
- Electron 应用基础框架
- 主进程、渲染进程、Preload 脚本分离架构
- Context Isolation 和 Sandbox 安全机制
- electron-log 日志系统
- electron-reloader 开发热重载
- electron-builder 构建配置（macOS/Windows）
- 全局错误处理器
- DevTools 自动打开（开发模式）
- 75 个自动化测试用例（集成测试 + 单元测试）
- MIT 开源许可证
- 项目 README 文档
- Git 版本控制和 GitHub 仓库

### Security
- 启用 contextIsolation
- 禁用 nodeIntegration
- 启用 sandbox 模式
- 实现 Content Security Policy (CSP)
- 使用 Object.freeze 保护 API

[Unreleased]: https://github.com/NEILXIANG/SundaySchoolTime/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NEILXIANG/SundaySchoolTime/releases/tag/v1.0.0
