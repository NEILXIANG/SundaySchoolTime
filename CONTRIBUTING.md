# 贡献指南

感谢您对 SundaySchoolTime 项目的关注！我们欢迎任何形式的贡献。

## 行为准则

- 尊重所有贡献者
- 保持建设性的讨论
- 遵守项目的代码规范

## 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/NEILXIANG/SundaySchoolTime/issues) 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 清晰的标题和描述
   - 重现步骤
   - 预期行为和实际行为
   - 系统环境（操作系统、Electron 版本等）
   - 错误日志或截图

### 提交功能请求

1. 在 Issues 中描述您的想法
2. 说明这个功能的使用场景
3. 如果可能，提供设计方案或示例

### 提交代码

#### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/NEILXIANG/SundaySchoolTime.git
cd SundaySchoolTime

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 运行测试
npm test
```

#### 代码规范

- 使用 **ESLint** 和 **Prettier** 保持代码风格一致
- 运行 `npm run lint` 检查代码
- 运行 `npm run format` 格式化代码
- 提交前确保所有测试通过

#### 提交流程

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature-name`
3. 编写代码和测试
4. 提交更改：`git commit -m "feat: add your feature"`
5. 推送到分支：`git push origin feature/your-feature-name`
6. 创建 Pull Request

#### Commit 信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（Type）：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（既不是新功能也不是 Bug 修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动
- `ci`: CI/CD 配置变动

**示例：**
```
feat(menu): add application menu bar

- Add File menu with Open/Close actions
- Add Edit menu with standard shortcuts
- Add Help menu with About dialog

Closes #123
```

#### Pull Request 要求

- 清晰描述改动内容和原因
- 关联相关 Issue
- 确保所有测试通过
- 更新相关文档
- 保持提交历史清晰

### 测试要求

- 新功能必须包含测试用例
- 测试覆盖率不应降低
- 确保所有测试通过：`npm test`
- 运行代码覆盖率检查：`npm run test:coverage`

### 文档要求

- 更新 README.md（如适用）
- 更新 CHANGELOG.md
- 添加 JSDoc 注释（重要函数）
- 更新 API 文档（如适用）

## 开发指南

### 项目结构

```
SundaySchoolTime/
├── main.js           # 主进程
├── preload.js        # Preload 脚本
├── index.html        # 渲染进程
├── src/              # 源代码（未来）
├── test/             # 测试文件
├── assets/           # 资源文件
└── docs/             # 文档
```

### 调试技巧

- 使用 VS Code 调试配置（`.vscode/launch.json`）
- 开发模式下 DevTools 自动打开
- 查看日志文件（见 README.md）

### 常见问题

**Q: 如何运行单个测试文件？**
```bash
npx mocha test/app.test.js --timeout 30000
```

**Q: 如何清理构建产物？**
```bash
rm -rf dist node_modules package-lock.json
npm install
```

**Q: 如何查看日志？**
- macOS: `~/Library/Logs/SundaySchoolTime/main.log`
- Windows: `%USERPROFILE%\AppData\Roaming\SundaySchoolTime\logs\main.log`

## 发布流程

（仅限维护者）

1. 更新版本号：`npm version [major|minor|patch]`
2. 更新 CHANGELOG.md
3. 提交更改：`git commit -am "chore: release vX.Y.Z"`
4. 创建标签：`git tag vX.Y.Z`
5. 推送：`git push && git push --tags`
6. GitHub Actions 自动构建和发布

## 联系方式

- **GitHub Issues**: [https://github.com/NEILXIANG/SundaySchoolTime/issues](https://github.com/NEILXIANG/SundaySchoolTime/issues)
- **Email**: neil@example.com

再次感谢您的贡献！🎉
