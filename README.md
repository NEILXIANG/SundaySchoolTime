# MSS - 教师学生图文分发工具

## 阶段 1：Electron 应用壳

最小可运行的 Electron 桌面应用，支持 Windows 和 macOS。

### 项目结构

```
MSS/
├── package.json          # 项目配置
├── main.js              # 主进程（创建窗口）
├── preload.js           # 预加载脚本（安全 IPC）
├── index.html           # 渲染进程（用户界面）
├── test/                # 测试文件
│   ├── app.test.js     # 集成测试
│   └── unit.test.js    # 单元测试
└── README.md            # 项目说明
```

### 安装与运行

#### 安装依赖

```bash
npm install
```

#### 启动应用

```bash
npm start
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

- ✅ 跨平台支持（macOS, Windows）
- ✅ 主进程、渲染进程、preload 分离
- ✅ Context Isolation 启用（安全）
- ✅ Node Integration 禁用（安全）
- ✅ 安全的 IPC 通信架构
- ✅ 无外部框架依赖
- ✅ 生产级代码质量

### 技术栈

- **Electron**: ^28.0.0
- **测试框架**: Mocha
- **断言库**: Chai
- **E2E 测试**: Playwright

### 验证清单

- [x] npm install 成功
- [x] npm start 可打开窗口
- [x] 显示 "App Ready"
- [x] 显示平台信息
- [x] 连续打开关闭 3 次无异常
- [x] 所有测试通过（60+ 项）
- [x] 代码架构安全（Context Isolation）

### 下一阶段

阶段 2：本地数据库（SQLite）集成
