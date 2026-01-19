# 测试命令使用指南

## 🚀 快速开始

### 日常开发（推荐）⭐
```bash
npm run test:fast
```
- **耗时**: ~30秒
- **内容**: 单元测试 + 数据库测试
- **无UI干扰**: 不启动Electron窗口
- **用途**: 日常开发验证代码逻辑

### 完整测试
```bash
npm test
```
- **耗时**: ~2-3分钟
- **内容**: 单元测试 + 集成测试
- **用途**: 提交前验证

### 全量测试
```bash
npm run test:all
```
- **耗时**: ~6分钟
- **内容**: 所有246个测试用例
- **用途**: 发布前、CI/CD

## 📦 测试分类

### 1. 单元测试（无UI）
```bash
npm run test:unit
```
**包含**:
- `db_helpers.test.js` - 数据库辅助函数（54个测试）
- `logger.test.js` - 日志模块（60个测试）
- `log-scripts.test.js` - 日志工具（40个测试）

**特点**:
- ✅ 极快（20秒内）
- ✅ 无窗口弹出
- ✅ 适合TDD开发

### 2. 集成测试（有UI）
```bash
npm run test:integration
```
**包含**:
- `integration.test.js` - 功能集成（20个测试）
- `boundary.test.js` - 边界条件（48个测试）
- `app.test.js` - 应用基础（47个测试）

**特点**:
- ⏱️ 较慢（4分钟）
- 🖥️ 启动Electron（已隐藏窗口）
- 🔍 测试真实UI交互

### 3. 数据库测试
```bash
npm run test:db
```
**包含**:
- `db_full_coverage.test.js` - 完整覆盖（20个测试）

**特点**:
- ⚡ 快速（30秒）
- 🖥️ 启动一次Electron
- 📊 测试所有CRUD操作

### 4. 鲁棒性测试
```bash
npm run test:robustness
```
**包含**:
- `robustness.test.js` - 极端情况（17个测试）

**特点**:
- ⏱️ 中等（2分钟）
- 🔥 测试系统边界
- 💪 配置损坏、并发等

### 5. 仅UI测试
```bash
npm run test:ui
```
等同于 `test:integration`，方便记忆。

## ⚡ 优化后的效果

### 窗口管理
- ✅ **自动关闭**: 强制kill机制确保100%关闭
- ✅ **隐藏窗口**: 测试时窗口不可见，不干扰工作
- ✅ **超时保护**: 15秒超时后强制终止

### 清理逻辑
```javascript
// 每个测试结束后
afterEach(async function () {
  await cleanupElectronApp(electronApp);  // 强制清理
});

// 强制清理流程
1. 尝试优雅关闭 (10秒超时)
2. 失败则发送 SIGKILL
3. 清空引用防止泄漏
```

### 窗口隐藏
```javascript
// 启动时自动隐藏
electronApp = await electron.launch({
  env: { HEADLESS: 'true' }  // 触发隐藏模式
});

await hideWindow(window);  // 移到屏幕外
```

## 📊 性能对比

| 命令 | 测试数 | 窗口启动 | 耗时 | 用途 |
|------|--------|---------|------|------|
| `test:fast` | 154 | 1次 | 30秒 | 日常开发⭐ |
| `test` | 174 | 76次 | 3分钟 | 提交前 |
| `test:integration` | 115 | 75次 | 4分钟 | UI调试 |
| `test:all` | 246 | 94次 | 6分钟 | 发布前 |

## 🎯 使用建议

### 场景1: 修改数据库逻辑
```bash
npm run test:unit  # 先跑单元测试
npm run test:db    # 再跑数据库测试
```

### 场景2: 修改UI界面
```bash
npm run test:ui    # 跑集成测试
```

### 场景3: 修改配置/鲁棒性
```bash
npm run test:robustness  # 跑极端情况
```

### 场景4: 提交代码前
```bash
npm test           # 跑核心测试（单元+集成）
```

### 场景5: 发布前
```bash
npm run test:all   # 跑全量测试
```

## 🔧 Mocha配置

配置文件: `.mocharc.json`

```json
{
  "bail": false,          // 不在第一个失败时停止
  "timeout": 30000,       // 默认30秒超时
  "reporter": "spec",     // 详细输出
  "exit": true,           // 测试完强制退出
  "recursive": true       // 递归查找测试
}
```

## 🐛 故障排查

### 窗口没有关闭
```bash
# 查看残留进程
ps aux | grep Electron

# 手动清理
killall Electron
```

### 测试挂起
- 检查是否有异步操作未await
- 检查超时设置是否足够
- 查看日志: `npm run logs:errors`

### 测试失败
```bash
# 单独运行失败的测试
mocha test/integration.test.js --grep "具体测试名称"

# 查看详细输出
DEBUG=* npm test
```

## 📝 添加新测试

### 单元测试（推荐优先）
```javascript
// test/my_module.test.js
describe('我的模块', () => {
  it('应该返回正确结果', () => {
    expect(myFunction()).to.equal(expected);
  });
});
```

### 集成测试（需要UI）
```javascript
// test/my_feature.test.js
const { cleanupElectronApp, getHeadlessLaunchConfig } = require('./helpers');

describe('我的功能', () => {
  let electronApp;

  beforeEach(async function () {
    electronApp = await electron.launch(
      getHeadlessLaunchConfig(path.join(__dirname, '..'))
    );
  });

  afterEach(async function () {
    await cleanupElectronApp(electronApp);
  });

  it('应该工作', async () => {
    // 测试代码
  });
});
```

## 🎉 总结

优化后:
- ✅ 窗口100%自动关闭
- ✅ 测试时无UI干扰
- ✅ 支持灵活的测试分类
- ✅ 日常开发快速验证（30秒）
- ✅ 完整测试全面覆盖（6分钟）

推荐工作流:
1. 开发时: `npm run test:fast`
2. 提交前: `npm test`
3. 发布前: `npm run test:all`
