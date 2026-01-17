# SundaySchoolTime - 教师学生图文分发工具

## 阶段 1：Electron 应用壳

最小可运行的 Electron 桌面应用，支持 Windows 和 macOS。

### 项目结构

```
SundaySchoolTime/
├── package.json          # 项目配置
├── main.js              # 主进程（创建窗口）
├── preload.js           # 预加载脚本（安全 IPC）
├── index.html           # 渲染进程（用户界面）
├── test/                # 测试文件
│   ├── app.test.js     # 集成测试
│   └── unit.test.js    # 单元测试
├── .gitignore           # Git 忽略配置
├── LICENSE              # MIT 许可证
└── README.md            # 项目说明
```

### 安装与运行

#### 安装依赖

```bash
npm install
```

#### 启动应用（生产模式）

```bash
npm start
```

#### 启动应用（开发模式）

开发模式会自动打开 DevTools 并启用热重载：

```bash
npm run dev
```

#### 构建应用

构建所有平台：
```bash
npm run build
```

仅构建 macOS：
```bash
npm run build:mac
```

仅构建 Windows：
```bash
npm run build:win
```

#### 运行测试

```bash
npm test
```

### 测试覆盖

#### 集成测试（app.test.js）

1. **应用启动测试**
   - ✅ 应用成功启动
   - ✅ 创建窗口
   - ✅ 窗口尺寸正确

2. **主进程架构测试**
   - ✅ BrowserWindow 导入
   - ✅ contextIsolation 启用
   - ✅ nodeIntegration 禁用
   - ✅ preload 脚本配置
   - ✅ 事件处理（window-all-closed, activate）

3. **Preload 脚本安全测试**
   - ✅ contextBridge 使用
   - ✅ API 安全暴露
   - ✅ 不暴露敏感模块

4. **渲染进程页面测试**
   - ✅ 页面标题正确
   - ✅ "App Ready" 显示
   - ✅ 平台信息显示
   - ✅ window.api 可用

5. **项目结构完整性测试**
   - ✅ 必需文件存在
   - ✅ package.json 配置正确

6. **鲁棒性测试**
   - ✅ 连续启动关闭 3 次无异常

7. **窗口状态管理测试**
   - ✅ 窗口可见性
   - ✅ 窗口最小化

8. **安全性测试**
   - ✅ 渲染进程无 require 访问
   - ✅ 渲染进程无 Node.js 访问

9. **跨平台兼容性测试**
   - ✅ 平台识别
   - ✅ 当前平台正常运行

10. **性能测试**
    - ✅ 5秒内启动
    - ✅ DOM 完全加载

#### 单元测试（unit.test.js）

1. **main.js 单元测试**（11项）
   - 模块导入、窗口配置、事件处理等

2. **preload.js 单元测试**（6项）
   - contextBridge 使用、API 暴露、安全性

3. **index.html 单元测试**（11项）
   - HTML 结构、元素存在、框架依赖检查

4. **package.json 单元测试**（7项）
   - 配置完整性、依赖版本

5. **代码质量检查**（3项）
   - 语法错误检查、标签配对

**总计：60+ 项测试用例**

### 功能特性

#### 核心功能
- ✅ 跨平台支持（macOS, Windows, Linux）
- ✅ 主进程、渲染进程、preload 分离
- ✅ Context Isolation 启用（安全）
- ✅ Node Integration 禁用（安全）
- ✅ Sandbox 模式启用（安全）
- ✅ 安全的 IPC 通信架构
- ✅ Content Security Policy (CSP)
- ✅ 无外部框架依赖

#### 开发工具
- ✅ 日志系统（electron-log）with 轮转和分级
- ✅ 开发模式热重载（electron-reloader）
- ✅ DevTools 自动打开（开发模式）
- ✅ 全局错误处理和追踪
- ✅ ESLint 代码检查
- ✅ Prettier 代码格式化
- ✅ EditorConfig 编辑器配置
- ✅ VS Code 调试配置

#### 用户体验
- ✅ 应用菜单栏（文件、编辑、查看、窗口、帮助）
- ✅ 系统托盘图标和菜单
- ✅ 窗口状态持久化（位置、大小）
- ✅ 用户偏好设置存储（electron-store）
- ✅ 自动更新机制（electron-updater）

#### 构建与发布
- ✅ 应用打包构建（electron-builder）
- ✅ macOS / Windows / Linux 支持
- ✅ 代码签名配置（macOS entitlements）
- ✅ CI/CD 自动化（GitHub Actions）
- ✅ 代码覆盖率报告（nyc）
- ✅ 自动发布到 GitHub Releases

### 技术栈

- **框架**: Electron ^28.0.0
- **测试**: Mocha + Chai + Playwright
- **代码质量**: ESLint + Prettier + EditorConfig
- **日志**: electron-log ^5.0.1
- **存储**: electron-store ^8.1.0
- **更新**: electron-updater ^6.1.7
- **构建**: electron-builder ^24.9.1
- **开发**: electron-reloader + cross-env
- **覆盖率**: nyc (Istanbul)

### 项目结构

```
SundaySchoolTime/
├── .github/
│   └── workflows/       # CI/CD 配置
│       ├── ci.yml       # 测试和构建
│       └── release.yml  # 自动发布
├── .vscode/             # VS Code 配置
│   ├── launch.json      # 调试配置
│   ├── tasks.json       # 任务配置
│   ├── settings.json    # 编辑器设置
│   └── extensions.json  # 推荐扩展
├── assets/              # 资源文件
│   └── README.md        # 图标说明
├── build/               # 构建配置
│   └── entitlements.mac.plist  # macOS 签名权限
├── test/                # 测试文件
│   ├── app.test.js      # E2E 测试
│   └── unit.test.js     # 单元测试
├── main.js              # 主进程入口
├── preload.js           # Preload 脚本
├── index.html           # 渲染进程 UI
├── menu.js              # 应用菜单
├── tray.js              # 系统托盘
├── store.js             # 设置存储
├── package.json         # 项目配置
├── .eslintrc.js         # ESLint 配置
├── .prettierrc          # Prettier 配置
├── .editorconfig        # EditorConfig
├── .nycrc               # 覆盖率配置
├── .gitignore           # Git 忽略
├── LICENSE              # MIT 许可证
├── README.md            # 项目文档
├── CHANGELOG.md         # 变更日志
└── CONTRIBUTING.md      # 贡献指南
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（热重载 + DevTools）
npm run dev

# 生产模式启动
npm start

# 运行测试
npm test

# 代码覆盖率
npm run test:coverage

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format
npm run format:check

# 构建应用
npm run build          # 所有平台
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
```

### 日志文件位置

- **macOS**: `~/Library/Logs/SundaySchoolTime/main-YYYY-MM-DD.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\SundaySchoolTime\logs\main-YYYY-MM-DD.log`
- **Linux**: `~/.config/SundaySchoolTime/logs/main-YYYY-MM-DD.log`

日志按天轮转，最大单文件 10MB。

### 用户设置位置

- **macOS**: `~/Library/Application Support/sunday-school-time/config.json`
- **Windows**: `%USERPROFILE%\AppData\Roaming\sunday-school-time\config.json`
- **Linux**: `~/.config/sunday-school-time/config.json`

### 已知问题

1. **依赖安全漏洞**：当前存在 8 个安全漏洞（2 low, 1 moderate, 5 high）
   - 主要来自 `electron`, `electron-builder`, `diff`, `tar`
   - 修复需要 `npm audit fix --force` 但会导致破坏性更改
   - 建议：在生产环境部署前评估风险并更新依赖

2. **应用图标**：目前使用占位符，需要设计师提供实际图标
   - 见 `assets/README.md` 了解图标规范和生成工具

3. **测试失败**：由于新增菜单、托盘、存储功能，部分 E2E 测试需要更新
   - 单元测试全部通过（53 个）
   - E2E 测试需要适配新功能（12 个失败）

### 验证清单

- [x] npm install 成功
- [x] npm start 可打开窗口
- [x] 显示 "App Ready"
- [x] 显示平台信息
- [x] 应用菜单可用
- [x] 系统托盘图标显示
- [x] 窗口状态持久化
- [x] 日志文件生成
- [x] 代码检查通过（npm run lint）
- [x] 代码格式化配置
- [x] CI/CD 流程配置
- [ ] 所有测试通过（需要更新 E2E 测试）
- [ ] 应用图标完成
- [ ] 安全漏洞修复

### 贡献

查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何贡献代码。

### 变更日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本历史和更新内容。

### 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情。
