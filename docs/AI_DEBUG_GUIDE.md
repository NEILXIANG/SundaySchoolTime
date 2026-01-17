# AI 调试快速参考

## 🚀 快速开始

当应用出现问题时，按以下步骤操作：

### 1. 分析日志
```bash
npm run logs
```

### 2. 查看关键信息
- ✅ 是否有错误？
- ✅ 应用是否正常启动？
- ✅ 应用是否正常退出？

### 3. 定位问题
- 查看错误堆栈
- 确认发生时间
- 查找相关上下文

## 📋 常见问题排查

### 应用无法启动

**症状**: 应用启动后立即崩溃

**排查步骤**:
1. 运行 `npm run logs`
2. 查看是否有 "Application Starting" 日志
3. 检查是否有 "Uncaught Exception" 或 "ReferenceError"
4. 查看堆栈追踪定位代码位置

**日志示例**:
```
[error] Uncaught Exception: ReferenceError: isDev is not defined
[error] Stack trace: at Object.<anonymous> (main.js:10:29)
```

**解决方案**: 变量未定义，需要在使用前声明

### 窗口创建失败

**症状**: 应用启动但窗口不显示

**排查步骤**:
1. 检查 "------- Creating Main Window -------" 日志
2. 查看 "BrowserWindow instance created" 是否出现
3. 确认 "Window ready to show" 事件是否触发
4. 检查是否有加载失败错误

**日志示例**:
```
[info] ------- Creating Main Window -------
[info] BrowserWindow instance created
[error] Failed to load index.html: Error: ENOENT
```

**解决方案**: index.html 文件不存在或路径错误

### 功能模块报错

**症状**: 某个功能不工作（菜单、托盘等）

**排查步骤**:
1. 搜索相关模块日志 (menu, tray, store)
2. 查看是否有 "created successfully" 日志
3. 检查错误信息和堆栈

**日志示例**:
```
[debug] Creating system tray...
[error] Failed to create tray: Error: icon path not found
```

**解决方案**: 托盘图标文件缺失

### 性能问题

**症状**: 应用启动缓慢或响应慢

**排查步骤**:
1. 查看性能数据部分
2. 检查加载时间是否过长
3. 查找是否有重复的慢操作

**日志示例**:
```
[info] index.html loaded successfully in 5234ms  ⚠️ 过慢
[info] Window ready to show (total: 6789ms)     ⚠️ 过慢
```

**解决方案**: 优化资源加载，检查网络请求

## 🔍 日志搜索技巧

### 按级别搜索
```bash
# 只看错误
grep "\[error\]" ~/Library/Logs/SundaySchoolTime/main-*.log

# 只看警告和错误
grep -E "\[error\]|\[warn\]" ~/Library/Logs/SundaySchoolTime/main-*.log
```

### 按关键词搜索
```bash
# 搜索窗口相关日志
grep -i "window" ~/Library/Logs/SundaySchoolTime/main-*.log

# 搜索特定函数
grep "createWindow" ~/Library/Logs/SundaySchoolTime/main-*.log
```

### 按时间范围搜索
```bash
# 搜索特定时间
grep "10:29:3" ~/Library/Logs/SundaySchoolTime/main-*.log

# 搜索今天的日志
cat ~/Library/Logs/SundaySchoolTime/main-$(date +%Y-%m-%d).log
```

### 统计分析
```bash
# 统计错误数量
grep -c "\[error\]" ~/Library/Logs/SundaySchoolTime/main-*.log

# 列出所有错误类型
grep "\[error\]" ~/Library/Logs/SundaySchoolTime/main-*.log | cut -d']' -f3 | sort | uniq
```

## 📊 日志模式识别

### 正常启动模式
```
[info] ============================================================
[info] Application Starting
[info] Environment: development
[info] Platform: darwin
[info] App version: 1.0.0
[info] ------- Creating Main Window -------
[info] BrowserWindow instance created
[info] Application menu created successfully
[info] index.html loaded successfully in XXXms
[info] Window ready to show (total: XXXms)
[info] Main window shown to user
[info] ------- Window Creation Complete -------
```

### 异常启动模式
```
[info] Application Starting
[error] Uncaught Exception: ...        ⚠️ 启动时错误
[info] Application Terminated
```

### 崩溃模式
```
[info] Application Starting
[info] BrowserWindow instance created
[error] Renderer process gone: ...    ⚠️ 渲染进程崩溃
(没有 "Application Terminated")      ⚠️ 非正常退出
```

## 🛠️ 调试工作流

### 完整调试流程

1. **复现问题**
   - 记录操作步骤
   - 注意发生时间

2. **收集日志**
   ```bash
   npm run logs
   ```

3. **分析错误**
   - 查看错误详情
   - 阅读堆栈追踪
   - 确认错误类型

4. **查找上下文**
   ```bash
   # 假设错误在 10:29:32
   grep "10:29:3" ~/Library/Logs/SundaySchoolTime/main-*.log
   ```

5. **定位代码**
   - 根据堆栈找到文件和行号
   - 查看相关代码

6. **修复验证**
   - 修改代码
   - 重启应用
   - 再次运行 `npm run logs`
   - 确认错误消失

## 💡 最佳实践

### 添加日志的时机

✅ **应该添加日志**:
- 函数入口和出口
- 错误发生时
- 重要状态变更
- 性能关键点
- 用户操作

❌ **不需要日志**:
- 简单的 getter/setter
- 频繁调用的小函数
- 临时调试代码

### 日志质量检查

✅ **好的日志**:
```javascript
log.info('User login successful', { userId, timestamp });
log.error('Database connection failed:', error);
log.error('Stack trace:', error.stack);
log.debug('Processing item:', { id, status, data });
```

❌ **差的日志**:
```javascript
log.info('success');           // 不明确
log.error(error);              // 缺少上下文
log.debug('data: ' + data);    // 应该用 JSON.stringify
```

## 📞 获取帮助

如果日志无法定位问题：

1. **分享日志文件**
   ```bash
   npm run logs:open
   ```
   将日志文件复制给 AI 或团队

2. **提供完整上下文**
   - 操作系统和版本
   - 应用版本
   - 复现步骤
   - 完整日志文件

3. **使用 GitHub Issues**
   - 创建 Issue
   - 附上日志分析结果
   - 描述预期行为 vs 实际行为

## 🎯 快速命令

```bash
# 查看最新日志
npm run logs

# 打开日志目录
npm run logs:open

# 实时监控日志（开发模式）
tail -f ~/Library/Logs/SundaySchoolTime/main-$(date +%Y-%m-%d).log

# 清理旧日志（保留最近7天）
find ~/Library/Logs/SundaySchoolTime -name "main-*.log" -mtime +7 -delete
```

## 📚 相关文档

- [完整日志文档](LOGGING.md)
- [贡献指南](../CONTRIBUTING.md)
- [项目 README](../README.md)
