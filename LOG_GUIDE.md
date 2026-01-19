# 日志系统使用指南

## 概述

本项目采用分层、结构化的日志系统，支持多进程日志聚合、会话跟踪和组件级别的日志隔离，便于开发调试和AI辅助问题诊断。

## 核心特性

### 1. 统一日志接口（logger.js）

- **会话ID跟踪**：每次应用启动生成唯一会话ID，便于关联同一运行周期的所有日志
- **进程类型标识**：区分主进程、渲染进程和其他辅助进程
- **组件作用域**：按功能模块划分日志（main, db, store, menu, tray, renderer, ipc等）
- **双格式输出**：
  - 人类可读格式：`main-YYYY-MM-DD.log`
  - 结构化JSONL格式：`structured-YYYY-MM-DD.jsonl`（便于程序分析）

### 2. 日志级别

| 级别 | 用途 | 示例场景 |
|-----|------|---------|
| `debug` | 详细调试信息 | 函数入口/出口、参数值、中间状态 |
| `info` | 重要业务事件 | 数据库操作成功、窗口创建、用户操作 |
| `warn` | 警告但不影响运行 | 配置降级、文件缺失、性能慢 |
| `error` | 错误需要关注 | 异常捕获、操作失败、数据校验失败 |

### 3. 日志格式

#### 人类可读格式
```
[2026-01-18 10:30:45.123] [info] [main] [pid:12345] [session:s-abcd1234] [proc:main] Application Starting | meta={"version":"1.0.0"}
```

#### 结构化JSONL格式
```json
{"ts":"2026-01-18T10:30:45.123Z","level":"info","scope":"main","message":"Application Starting","meta":{"version":"1.0.0"},"sessionId":"s-abcd1234","pid":12345,"processType":"main","appVersion":"1.0.0"}
```

## 使用方法

### 在主进程中使用

```javascript
const { getLogger } = require('./logger');
const log = getLogger('main'); // 或其他组件名

log.debug('Function called', { param1: 'value1', param2: 123 });
log.info('Operation completed', { result: 'success', recordsAffected: 10 });
log.warn('Slow query detected', { queryTime: 500, threshold: 200 });
log.error('Database operation failed', error); // error对象会自动展开
```

### 在渲染进程中使用

通过preload暴露的API：

```javascript
// renderer.js
window.api.log.info('User clicked button', { buttonId: 'submit' });
window.api.log.error('Form validation failed', { errors: validationErrors });
```

### 在数据库模块中使用

```javascript
const { getLogger } = require('./logger');
const log = getLogger('db');

function addStudent(data) {
  const startTime = Date.now();
  log.debug('addStudent called', { name: data.name, className: data.className });
  
  try {
    // ... 数据库操作
    const elapsed = Date.now() - startTime;
    log.info('Student added', { id: result.id, name: data.name, elapsed });
    return result;
  } catch (error) {
    log.error('addStudent failed', error);
    throw error;
  }
}
```

## 日志分析工具

### 自动分析脚本

```bash
# 分析最新日志
npm run logs

# 分析指定日志文件
node scripts/analyze-logs.js ~/Library/Logs/SundaySchoolTime/main-2026-01-18.log
```

### 分析报告包含

- 📊 **统计摘要**：总行数、各级别数量
- 🔴 **错误详情**：所有错误及堆栈信息
- 🟡 **警告列表**：前10条警告
- 🔄 **生命周期事件**：应用启动、窗口创建、退出等关键事件
- ⚡ **性能数据**：带时间戳的操作耗时
- 🧩 **组件分布**：各模块日志数量统计
- 🧭 **会话统计**：多会话运行情况
- 🔍 **问题模式**：频繁出现的错误模式识别

### 打开日志目录

```bash
# macOS
npm run logs:open
# 或手动打开：~/Library/Logs/SundaySchoolTime

# Windows
npm run logs:open
# 或手动打开：%USERPROFILE%\AppData\Roaming\SundaySchoolTime\logs

# Linux
npm run logs:open
# 或手动打开：~/.config/SundaySchoolTime/logs
```

## AI辅助问题诊断流程

### 步骤1：复现问题并记录会话ID

运行应用，查看启动日志中的Session ID：
```
[2026-01-18 10:30:45.123] [info] Session ID: s-abcd1234-xyz789
```

### 步骤2：运行日志分析

```bash
npm run logs
```

### 步骤3：提取关键信息提供给AI

将以下信息提供给AI助手：

1. **会话ID**（用于精确过滤）
2. **错误详情**（分析报告中的🔴部分）
3. **生命周期事件**（分析报告中的🔄部分）
4. **相关组件日志**（如问题出现在数据库，提供db相关日志）

### 步骤4：AI分析示例提示词

```
我遇到了以下问题：[问题描述]

以下是日志分析结果：
[粘贴npm run logs的输出]

会话ID: s-abcd1234-xyz789

请帮我分析可能的原因并提供修复建议。
```

## 最佳实践

### 1. 日志粒度

- **操作入口**：记录函数调用及关键参数
- **操作结果**：记录成功/失败、影响行数、耗时
- **错误捕获**：记录完整错误对象（自动提取stack）
- **性能关键点**：记录耗时操作的时间（如数据库、文件IO）

### 2. 元数据组织

优先使用对象传递元数据而非字符串拼接：

```javascript
// ✅ 推荐
log.info('User login', { userId: 123, username: 'john', ip: '192.168.1.1' });

// ❌ 不推荐
log.info(`User login: userId=${123}, username=john, ip=192.168.1.1`);
```

### 3. 敏感信息保护

避免记录密码、token等敏感信息：

```javascript
// ✅ 正确
log.info('User authenticated', { userId: user.id, method: 'password' });

// ❌ 错误
log.info('User authenticated', { userId: user.id, password: user.password });
```

### 4. 错误处理

```javascript
try {
  // 操作
} catch (error) {
  log.error('Operation failed', error); // error对象会自动展开为{name, message, stack}
  throw error; // 或return error response
}
```

### 5. 性能监控

对关键操作添加耗时统计：

```javascript
const startTime = Date.now();
// ... 操作
const elapsed = Date.now() - startTime;
log.info('Operation completed', { operation: 'dbQuery', elapsed, recordCount: results.length });
```

## 日志文件管理

### 自动轮转

- 日志按天分割：`main-2026-01-18.log`、`main-2026-01-19.log`
- 单文件大小限制：10MB（超出后自动轮转）
- 旧日志自动保留，需要时手动清理

### 备份日志保留策略

- 数据库备份：自动保留最近5个备份
- 应用日志：建议定期手动清理超过30天的日志

### 手动清理

```bash
# macOS/Linux
find ~/Library/Logs/SundaySchoolTime -name "*.log" -mtime +30 -delete

# Windows (PowerShell)
Get-ChildItem "$env:USERPROFILE\AppData\Roaming\SundaySchoolTime\logs" -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

## 开发环境vs生产环境

| 特性 | 开发环境 | 生产环境 |
|-----|---------|---------|
| 文件日志级别 | `debug` | `info` |
| 控制台日志级别 | `debug` | `warn` |
| DevTools | 自动打开 | 关闭 |
| 热重载 | 启用 | 禁用 |

环境切换：

```bash
# 开发模式
npm run dev

# 生产模式（打包后）
npm start
```

## 常见问题排查

### Q: 日志文件在哪里？

A: 参考"打开日志目录"章节，或运行`npm run logs:open`

### Q: 日志太多怎么过滤？

A: 
- 使用`grep`：`grep "ERROR" main-2026-01-18.log`
- 使用`jq`解析JSONL：`cat structured-2026-01-18.jsonl | jq 'select(.level=="error")'`
- 使用分析脚本：`npm run logs`

### Q: 如何只查看某个组件的日志？

A: 
- 人类可读格式：`grep "\[db\]" main-2026-01-18.log`
- 结构化格式：`cat structured-2026-01-18.jsonl | jq 'select(.scope=="db")'`

### Q: 如何查看特定会话的日志？

A: 
- `grep "session:s-abcd1234" main-2026-01-18.log`
- `cat structured-2026-01-18.jsonl | jq 'select(.sessionId=="s-abcd1234")'`

### Q: 日志显示[Circular]或[Unserializable]？

A: logger会自动处理循环引用和无法序列化的对象，显示占位符防止崩溃。检查传入的对象是否包含循环引用。

## 扩展组件

### 添加新的日志作用域

```javascript
// 在新模块中
const { getLogger } = require('./logger');
const log = getLogger('myNewModule'); // 新作用域名称

log.info('My module initialized');
```

### 自定义日志输出

如需自定义输出格式或增加远程日志上传，可修改`logger.js`中的`writeStructured`函数。

## 相关文件

- **核心模块**：[logger.js](logger.js)
- **分析脚本**：[scripts/analyze-logs.js](scripts/analyze-logs.js)
- **主进程日志**：[main.js](main.js)
- **数据库日志**：[db.js](db.js)
- **配置存储日志**：[store.js](store.js)
- **渲染进程桥接**：[preload.js](preload.js)
