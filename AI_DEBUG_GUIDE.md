# AI辅助问题诊断快速指南

本文档专为AI编程场景设计，帮助快速定位和修复SundaySchoolTime应用的问题。

## 🚀 快速开始

### 1. 问题发生后立即执行

```bash
# 运行日志分析
npm run logs

# 或查询所有错误
npm run logs:errors
```

### 2. 收集关键信息

从日志分析报告中提取：

- ✅ **会话ID**（Session ID）
- ✅ **错误详情**（🔴 错误详情部分）
- ✅ **相关组件**（🧩 组件分布）
- ✅ **生命周期事件**（🔄 应用生命周期）
- ✅ **性能数据**（⚡ 性能数据）

### 3. AI提示词模板

```
我的Electron应用遇到问题：[简要描述问题]

会话ID: [从日志中复制]

错误日志：
```
[粘贴错误详情]
```

相关上下文：
- 组件：[相关组件名称]
- 发生时间：[时间戳]
- 操作步骤：[复现步骤]

请分析问题根本原因并提供修复方案。
```

## 📊 常见问题诊断场景

### 场景1：应用崩溃

**症状**：应用突然退出或白屏

**诊断步骤**：

```bash
# 1. 查看最新的错误
npm run logs:errors

# 2. 查找崩溃相关日志
node scripts/query-logs.js --message="process gone"
node scripts/query-logs.js --message="crashed"
```

**关键日志指标**：
- `Renderer process gone`（渲染进程崩溃）
- `Child process gone`（子进程崩溃）
- `Uncaught Exception`（未捕获异常）
- `Unhandled Rejection`（未处理的Promise拒绝）

**AI提问模板**：
```
应用崩溃，以下是崩溃前的日志：
[粘贴相关错误日志]

会话ID: [会话ID]
崩溃类型: [进程类型]
```

### 场景2：数据库操作失败

**症状**：数据保存/读取失败

**诊断步骤**：

```bash
# 查看数据库组件日志
node scripts/query-logs.js --scope=db

# 查看IPC调用日志
node scripts/query-logs.js --scope=ipc --message="db call"
```

**关键日志指标**：
- `addStudent failed`（添加学生失败）
- `updateStudent failed`（更新失败）
- `Database migration failed`（迁移失败）
- `db call failed`（IPC调用失败）

**AI提问模板**：
```
数据库操作失败，操作类型：[addStudent/updateStudent/...]

错误日志：
[粘贴db和ipc相关日志]

参数：[如有参数记录]
会话ID: [会话ID]
```

### 场景3：性能问题

**症状**：操作响应慢、界面卡顿

**诊断步骤**：

```bash
# 分析性能数据
npm run logs

# 查看慢操作（假设超过100ms算慢）
node scripts/query-logs.js --message="elapsed"
```

**关键日志指标**：
- `elapsed`（操作耗时）
- `loadTime`（加载时间）
- `Window ready to show`（窗口启动时间）

**AI提问模板**：
```
应用性能问题，症状：[卡顿/慢响应]

性能数据：
[粘贴包含elapsed的日志]

会话ID: [会话ID]
操作场景: [用户在做什么]
```

### 场景4：文件操作失败

**症状**：照片导入失败、文件删除失败

**诊断步骤**：

```bash
# 查看文件相关日志
node scripts/query-logs.js --message="photo"
node scripts/query-logs.js --message="file"
```

**关键日志指标**：
- `Failed to copy photo file`（复制失败）
- `Photo file too large`（文件过大）
- `Invalid file type`（类型错误）
- `Failed to delete photo file`（删除失败）

**AI提问模板**：
```
文件操作失败，操作类型：[导入/删除/...]

错误日志：
[粘贴文件相关日志]

文件信息：[大小、类型等，如有记录]
会话ID: [会话ID]
```

### 场景5：IPC通信问题

**症状**：渲染进程和主进程通信失败

**诊断步骤**：

```bash
# 查看IPC日志
node scripts/query-logs.js --scope=ipc
node scripts/query-logs.js --scope=renderer
```

**关键日志指标**：
- `db call failed`（数据库调用失败）
- `IPC Message received`（消息接收）
- `Method ... is not allowed`（方法不允许）

**AI提问模板**：
```
IPC通信问题，调用方法：[方法名]

IPC日志：
[粘贴ipc和renderer相关日志]

会话ID: [会话ID]
```

## 🔍 高级查询技巧

### 按时间范围查询

```bash
# 查询特定时间段
node scripts/query-logs.js --from="2026-01-18T10:00" --to="2026-01-18T11:00"
```

### 查询特定会话的所有日志

```bash
# 先从分析报告获取会话ID
npm run logs

# 然后查询该会话
node scripts/query-logs.js --session=s-abcd1234-xyz789
```

### 组合查询

```bash
# 查询特定组件的错误
node scripts/query-logs.js --scope=db --level=error

# 查询最近50条调试日志
node scripts/query-logs.js --level=debug --tail=50
```

### 搜索关键词

```bash
# 搜索包含特定关键词的日志
node scripts/query-logs.js --message="Student"
node scripts/query-logs.js --message="failed"
```

## 📋 完整诊断清单

遇到问题时，按以下清单收集信息：

- [ ] 运行`npm run logs`获取分析报告
- [ ] 记录会话ID
- [ ] 记录问题发生的时间点
- [ ] 复现问题的步骤
- [ ] 查询相关组件日志
- [ ] 检查性能数据
- [ ] 检查错误堆栈
- [ ] 确认应用是否正常启动/退出

## 🛠️ 日志命令速查

```bash
# 基础分析
npm run logs                    # 完整日志分析报告
npm run logs:open              # 打开日志目录
npm run logs:errors            # 只看错误
npm run logs:query             # 启动查询工具

# 高级查询
node scripts/query-logs.js --scope=db              # 数据库日志
node scripts/query-logs.js --scope=ipc             # IPC日志
node scripts/query-logs.js --level=error           # 错误日志
node scripts/query-logs.js --session=s-xxx         # 特定会话
node scripts/query-logs.js --message="关键词"       # 关键词搜索
node scripts/query-logs.js --tail=100              # 最近100条
node scripts/query-logs.js --help                  # 帮助信息
```

## 💡 最佳实践

### 1. 问题复现时记录会话ID

每次启动应用都会生成新的会话ID，确保记录问题发生时的会话ID。

### 2. 提供完整上下文

向AI提供问题时，包含：
- 具体的错误消息
- 完整的堆栈跟踪
- 操作步骤
- 预期行为 vs 实际行为

### 3. 使用结构化查询

优先使用`query-logs.js`而非手动grep，获得格式化的、易读的输出。

### 4. 关注性能指标

即使没有明显错误，关注`elapsed`时间，识别性能瓶颈。

### 5. 对比正常会话

对比正常会话和问题会话的日志差异，快速定位异常。

## 🔗 相关文档

- 完整日志使用指南：[LOG_GUIDE.md](LOG_GUIDE.md)
- 日志系统源码：[logger.js](logger.js)
- 分析脚本：[scripts/analyze-logs.js](scripts/analyze-logs.js)
- 查询脚本：[scripts/query-logs.js](scripts/query-logs.js)

## 🆘 紧急问题快速响应

如果遇到紧急问题，执行以下一行命令获取所有关键信息：

```bash
npm run logs && npm run logs:errors
```

将输出结果直接提供给AI，并附上：
1. 问题简述
2. 复现步骤
3. 会话ID（从输出中获取）

AI将基于结构化日志快速诊断并提供解决方案。
