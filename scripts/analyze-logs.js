#!/usr/bin/env node
/**
 * 日志分析工具
 * 用于分析应用日志文件，快速定位问题
 * 
 * 使用方法：
 *   node scripts/analyze-logs.js [日志文件路径]
 *   
 * 如果不提供路径，将分析最新的日志文件
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

// 获取最新的日志文件
function getLatestLogFile() {
  const logDir = getLogDir();
  
  if (!fs.existsSync(logDir)) {
    console.error(`日志目录不存在: ${logDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(logDir)
    .filter(f => (f.startsWith('main-') && f.endsWith('.log')) || (f.startsWith('structured-') && f.endsWith('.jsonl')))
    .map(f => ({
      name: f,
      path: path.join(logDir, f),
      mtime: fs.statSync(path.join(logDir, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.error('未找到日志文件');
    process.exit(1);
  }

  return files[0].path;
}

// 解析日志行
function parseLogLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        timestamp: parsed.ts || parsed.timestamp || 'unknown',
        level: parsed.level || 'info',
        message: parsed.message || '',
        scope: parsed.scope,
        meta: parsed.meta,
        sessionId: parsed.sessionId,
        raw: line
      };
    } catch (error) {
      return null;
    }
  }

  // 格式: [2026-01-17 10:29:30.123] [info] Message
  const match = trimmed.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
  if (!match) return null;

  const message = match[3];
  const scopeMatch = message.match(/^\[([^\]]+)\] \[pid:/);
  const scope = scopeMatch ? scopeMatch[1] : undefined;

  return {
    timestamp: match[1],
    level: match[2],
    message,
    scope,
    raw: line
  };
}

// 分析日志文件
function analyzeLogs(filePath) {
  console.log('='.repeat(80));
  console.log('日志分析报告');
  console.log('='.repeat(80));
  console.log(`日志文件: ${filePath}`);
  console.log(`分析时间: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const stats = {
    total: lines.length,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
    errors: [],
    warnings: [],
    lifecycle: [],
    performance: [],
    scopes: {},
    sessions: {}
  };

  // 分析每一行
  lines.forEach((line, index) => {
    const parsed = parseLogLine(line);
    
    if (!parsed) {
      return;
    }

    // 统计级别
    if (parsed.level === 'error') {
      stats.error++;
      stats.errors.push({ line: index + 1, ...parsed });
    } else if (parsed.level === 'warn') {
      stats.warn++;
      stats.warnings.push({ line: index + 1, ...parsed });
    } else if (parsed.level === 'info') {
      stats.info++;
    } else if (parsed.level === 'debug') {
      stats.debug++;
    }

    // 统计 scope / session
    if (parsed.scope) {
      stats.scopes[parsed.scope] = (stats.scopes[parsed.scope] || 0) + 1;
    }
    if (parsed.sessionId) {
      stats.sessions[parsed.sessionId] = (stats.sessions[parsed.sessionId] || 0) + 1;
    }

    // 收集生命周期事件
    if (parsed.message.includes('Event:') || 
        parsed.message.includes('Application Starting') ||
        parsed.message.includes('Application Terminated')) {
      stats.lifecycle.push({ line: index + 1, ...parsed });
    }

    // 收集性能数据
    if (parsed.message.includes('ms)') || parsed.message.includes('milliseconds')) {
      stats.performance.push({ line: index + 1, ...parsed });
    }
  });

  // 打印统计
  console.log('📊 日志统计:');
  console.log(`   总行数: ${stats.total}`);
  console.log(`   🔴 错误: ${stats.error}`);
  console.log(`   🟡 警告: ${stats.warn}`);
  console.log(`   🔵 信息: ${stats.info}`);
  console.log(`   ⚪ 调试: ${stats.debug}`);
  console.log('');

  // 打印错误
  if (stats.errors.length > 0) {
    console.log('🔴 错误详情:');
    stats.errors.forEach(err => {
      const scopeLabel = err.scope ? ` [${err.scope}]` : '';
      console.log(`   行 ${err.line}: [${err.timestamp}]${scopeLabel} ${err.message}`);
      if (err.meta && err.meta.stack) {
        console.log(`      Stack: ${String(err.meta.stack).split('\n')[0]}`);
      }
    });
    console.log('');
  } else {
    console.log('✅ 没有错误');
    console.log('');
  }

  // 打印警告
  if (stats.warnings.length > 0) {
    console.log('🟡 警告详情:');
    stats.warnings.slice(0, 10).forEach(warn => {
      const scopeLabel = warn.scope ? ` [${warn.scope}]` : '';
      console.log(`   行 ${warn.line}: [${warn.timestamp}]${scopeLabel} ${warn.message}`);
    });
    if (stats.warnings.length > 10) {
      console.log(`   ... 还有 ${stats.warnings.length - 10} 个警告`);
    }
    console.log('');
  }

  // 打印生命周期事件
  if (stats.lifecycle.length > 0) {
    console.log('🔄 应用生命周期:');
    stats.lifecycle.forEach(event => {
      console.log(`   行 ${event.line}: [${event.timestamp}] ${event.message}`);
    });
    console.log('');
  }

  // 打印性能数据
  if (stats.performance.length > 0) {
    console.log('⚡ 性能数据:');
    stats.performance.forEach(perf => {
      console.log(`   行 ${perf.line}: ${perf.message}`);
    });
    console.log('');
  }

  // 打印组件分布
  const scopeEntries = Object.entries(stats.scopes).sort((a, b) => b[1] - a[1]);
  if (scopeEntries.length > 0) {
    console.log('🧩 组件分布:');
    scopeEntries.slice(0, 10).forEach(([scope, count]) => {
      console.log(`   ${scope}: ${count}`);
    });
    if (scopeEntries.length > 10) {
      console.log(`   ... 还有 ${scopeEntries.length - 10} 个组件`);
    }
    console.log('');
  }

  // 会话统计
  const sessionEntries = Object.entries(stats.sessions).sort((a, b) => b[1] - a[1]);
  if (sessionEntries.length > 0) {
    console.log('🧭 会话统计:');
    sessionEntries.slice(0, 5).forEach(([sessionId, count]) => {
      console.log(`   ${sessionId}: ${count}`);
    });
    if (sessionEntries.length > 5) {
      console.log(`   ... 还有 ${sessionEntries.length - 5} 个会话`);
    }
    console.log('');
  }

  // 分析模式
  console.log('🔍 问题模式分析:');
  
  // 检查频繁错误
  const errorMessages = stats.errors.map(e => e.message);
  const errorCounts = {};
  errorMessages.forEach(msg => {
    const key = msg.substring(0, 50); // 取前50个字符作为key
    errorCounts[key] = (errorCounts[key] || 0) + 1;
  });
  
  const frequentErrors = Object.entries(errorCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  
  if (frequentErrors.length > 0) {
    console.log('   ⚠️  频繁出现的错误:');
    frequentErrors.forEach(([msg, count]) => {
      console.log(`      - "${msg}..." (${count} 次)`);
    });
  } else {
    console.log('   ✅ 没有频繁出现的错误');
  }
  console.log('');

  // 检查应用是否正常启动和关闭
  const hasStart = stats.lifecycle.some(e => e.message.includes('Application Starting'));
  const hasEnd = stats.lifecycle.some(e => e.message.includes('Application Terminated'));
  
  console.log('📋 运行状态:');
  console.log(`   应用启动: ${hasStart ? '✅ 是' : '❌ 否'}`);
  console.log(`   正常退出: ${hasEnd ? '✅ 是' : '⚠️  否（可能崩溃或强制终止）'}`);
  console.log('');

  console.log('='.repeat(80));
  console.log('分析完成');
  console.log('='.repeat(80));
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  let logFile;

  if (args.length > 0) {
    logFile = args[0];
    if (!fs.existsSync(logFile)) {
      console.error(`文件不存在: ${logFile}`);
      process.exit(1);
    }
  } else {
    logFile = getLatestLogFile();
  }

  analyzeLogs(logFile);
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { analyzeLogs, getLatestLogFile };
