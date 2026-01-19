#!/usr/bin/env node
/**
 * 结构化日志查询工具
 * 用于快速查询和过滤结构化日志文件
 * 
 * 使用方法：
 *   node scripts/query-logs.js --session=s-abc123        # 查询特定会话
 *   node scripts/query-logs.js --scope=db                # 查询特定组件
 *   node scripts/query-logs.js --level=error             # 查询特定级别
 *   node scripts/query-logs.js --message="Student added" # 搜索消息内容
 *   node scripts/query-logs.js --from="2026-01-18T10:00" --to="2026-01-18T11:00" # 时间范围
 *   node scripts/query-logs.js --tail=50                 # 最近N条
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取日志目录
function getLogDir() {
  const platform = process.platform;
  let logPath;

  if (platform === 'darwin') {
    logPath = path.join(os.homedir(), 'Library/Logs/SundaySchoolTime');
  } else if (platform === 'win32') {
    logPath = path.join(process.env.USERPROFILE, 'AppData/Roaming/SundaySchoolTime/logs');
  } else {
    logPath = path.join(os.homedir(), '.config/SundaySchoolTime/logs');
  }

  return logPath;
}

// 获取最新的结构化日志文件
function getLatestStructuredLog() {
  const logDir = getLogDir();
  
  if (!fs.existsSync(logDir)) {
    console.error(`日志目录不存在: ${logDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(logDir)
    .filter(f => f.startsWith('structured-') && f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(logDir, f),
      mtime: fs.statSync(path.join(logDir, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.error('未找到结构化日志文件');
    process.exit(1);
  }

  return files[0].path;
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    session: null,
    scope: null,
    level: null,
    message: null,
    from: null,
    to: null,
    tail: null,
    file: null
  };

  args.forEach(arg => {
    const [key, value] = arg.split('=');
    const cleanKey = key.replace(/^--/, '');
    if (cleanKey in options) {
      if (cleanKey === 'tail') {
        options[cleanKey] = parseInt(value, 10);
      } else {
        options[cleanKey] = value;
      }
    }
  });

  return options;
}

// 过滤日志条目
function matchesFilter(entry, options) {
  if (options.session && entry.sessionId !== options.session) {
    return false;
  }
  
  if (options.scope && entry.scope !== options.scope) {
    return false;
  }
  
  if (options.level && entry.level !== options.level) {
    return false;
  }
  
  if (options.message && !entry.message.includes(options.message)) {
    return false;
  }
  
  if (options.from || options.to) {
    const entryTime = new Date(entry.ts);
    if (options.from) {
      const fromTime = new Date(options.from);
      if (entryTime < fromTime) return false;
    }
    if (options.to) {
      const toTime = new Date(options.to);
      if (entryTime > toTime) return false;
    }
  }
  
  return true;
}

// 格式化输出
function formatEntry(entry, index) {
  const levelColors = {
    error: '\x1b[31m', // 红色
    warn: '\x1b[33m',  // 黄色
    info: '\x1b[36m',  // 青色
    debug: '\x1b[90m'  // 灰色
  };
  const reset = '\x1b[0m';
  const color = levelColors[entry.level] || reset;
  
  const timestamp = entry.ts ? new Date(entry.ts).toLocaleString('zh-CN') : 'unknown';
  const scope = entry.scope ? `[${entry.scope}]` : '';
  const session = entry.sessionId ? `[${entry.sessionId.slice(0, 12)}]` : '';
  const pid = entry.pid ? `[pid:${entry.pid}]` : '';
  
  console.log(`${color}${index + 1}. [${timestamp}] [${entry.level}] ${scope} ${session} ${pid}${reset}`);
  console.log(`   ${entry.message}`);
  
  if (entry.meta && Object.keys(entry.meta).length > 0) {
    const metaStr = JSON.stringify(entry.meta, null, 2)
      .split('\n')
      .map(line => `   ${line}`)
      .join('\n');
    console.log(`   Meta: ${metaStr}`);
  }
  console.log('');
}

// 查询日志
function queryLogs(options) {
  const logFile = options.file || getLatestStructuredLog();
  
  console.log('='.repeat(80));
  console.log('结构化日志查询');
  console.log('='.repeat(80));
  console.log(`日志文件: ${logFile}`);
  console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
  
  if (options.session) console.log(`会话过滤: ${options.session}`);
  if (options.scope) console.log(`组件过滤: ${options.scope}`);
  if (options.level) console.log(`级别过滤: ${options.level}`);
  if (options.message) console.log(`消息搜索: ${options.message}`);
  if (options.from) console.log(`起始时间: ${options.from}`);
  if (options.to) console.log(`结束时间: ${options.to}`);
  if (options.tail) console.log(`最近条数: ${options.tail}`);
  
  console.log('='.repeat(80));
  console.log('');

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const entries = [];
  lines.forEach(line => {
    try {
      const entry = JSON.parse(line);
      if (matchesFilter(entry, options)) {
        entries.push(entry);
      }
    } catch (error) {
      // 跳过无效的JSON行
    }
  });
  
  // 如果指定了tail，只取最后N条
  const displayEntries = options.tail ? entries.slice(-options.tail) : entries;
  
  console.log(`找到 ${entries.length} 条匹配记录${options.tail ? `，显示最近 ${displayEntries.length} 条` : ''}\n`);
  
  displayEntries.forEach((entry, index) => {
    formatEntry(entry, index);
  });
  
  console.log('='.repeat(80));
  console.log(`总计: ${displayEntries.length} 条记录`);
  console.log('='.repeat(80));
}

// 显示帮助信息
function showHelp() {
  console.log(`
结构化日志查询工具

用法:
  node scripts/query-logs.js [选项]

选项:
  --session=<会话ID>     按会话ID过滤
  --scope=<组件名>       按组件名过滤 (main, db, store, etc.)
  --level=<级别>         按日志级别过滤 (debug, info, warn, error)
  --message=<关键词>     搜索消息内容
  --from=<时间>          起始时间 (ISO格式: 2026-01-18T10:00:00)
  --to=<时间>            结束时间 (ISO格式: 2026-01-18T11:00:00)
  --tail=<数量>          只显示最近N条
  --file=<文件路径>      指定日志文件 (默认使用最新的)

示例:
  # 查询所有错误
  node scripts/query-logs.js --level=error

  # 查询特定会话的数据库操作
  node scripts/query-logs.js --session=s-abc123 --scope=db

  # 查询最近50条info级别的日志
  node scripts/query-logs.js --level=info --tail=50

  # 搜索包含"Student"的消息
  node scripts/query-logs.js --message=Student

  # 查询时间范围内的日志
  node scripts/query-logs.js --from=2026-01-18T10:00 --to=2026-01-18T11:00
`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  const options = parseArgs();
  queryLogs(options);
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { queryLogs, getLatestStructuredLog };
