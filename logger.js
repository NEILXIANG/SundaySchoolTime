const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('electron-log');

const isDev = process.env.NODE_ENV === 'development';
let initialized = false;
let sessionId = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let processType = 'main';
let appVersion = 'unknown';
let logFilePrefix = 'main';

function getLogDir() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return app.getPath('logs');
    }
  } catch (error) {
    // ignored - fallback below
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Logs/SundaySchoolTime');
  }
  if (process.platform === 'win32') {
    const home = process.env.USERPROFILE || os.homedir();
    return path.join(home, 'AppData/Roaming/SundaySchoolTime/logs');
  }
  return path.join(os.homedir(), '.config/SundaySchoolTime/logs');
}

function ensureLogDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    // ignored
  }
}

function initLogger(options = {}) {
  if (initialized) return;
  initialized = true;

  processType = options.processType || processType;
  appVersion = options.appVersion || appVersion;
  logFilePrefix = options.logFilePrefix || logFilePrefix;

  // 在测试环境中，electron-log可能无法初始化，跳过
  if (process.env.NODE_ENV !== 'test') {
    try {
      log.initialize();
    } catch (error) {
      // 忽略初始化错误
    }
  }

  try {
    log.transports.file.level = isDev ? 'debug' : 'info';
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

    log.transports.console.level = isDev ? 'debug' : 'warn';
    log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

    log.transports.file.resolvePath = () => {
      const dir = getLogDir();
      ensureLogDir(dir);
      const dateStr = new Date().toISOString().split('T')[0];
      return path.join(dir, `${logFilePrefix}-${dateStr}.log`);
    };
  } catch (error) {
    // 在测试环境下可能无法配置transport，忽略
  }
}

function safeStringify(value, maxLength = 8000) {
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      if (typeof val === 'bigint') {
        return val.toString();
      }
      return val;
    });
    if (json && json.length > maxLength) {
      return `${json.slice(0, maxLength)}...`;
    }
    return json;
  } catch (error) {
    return '"[Unserializable]"';
  }
}

function normalizeMetaValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (typeof value === 'object' && value !== null) {
    return value;
  }
  return value;
}

function normalizeMeta(args) {
  if (!args || args.length === 0) return null;
  if (args.length === 1) return normalizeMetaValue(args[0]);
  return args.map(normalizeMetaValue);
}

function formatMessage(scope, message, meta) {
  const prefix = `[${scope}] [pid:${process.pid}] [session:${sessionId}] [proc:${processType}]`;
  if (meta === null || meta === undefined) {
    return `${prefix} ${message}`;
  }
  return `${prefix} ${message} | meta=${safeStringify(meta)}`;
}

function writeStructured(level, scope, message, meta) {
  try {
    const dir = getLogDir();
    ensureLogDir(dir);
    const dateStr = new Date().toISOString().split('T')[0];
    const file = path.join(dir, `structured-${dateStr}.jsonl`);
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      meta,
      sessionId,
      pid: process.pid,
      processType,
      appVersion
    };
    fs.appendFile(file, `${JSON.stringify(entry)}${os.EOL}`, () => {});
  } catch (error) {
    // 静默失败，不影响应用运行
  }
}

function logWithLevel(level, scope, message, ...args) {
  if (!initialized) initLogger();
  const text = typeof message === 'string' ? message : safeStringify(message);
  const meta = normalizeMeta(args);
  log[level](formatMessage(scope, text, meta));
  writeStructured(level, scope, text, meta);
}

function getLogger(scope = 'app') {
  if (!initialized) initLogger();
  const normalizedScope = scope || 'app';
  return Object.freeze({
    debug: (message, ...args) => logWithLevel('debug', normalizedScope, message, ...args),
    info: (message, ...args) => logWithLevel('info', normalizedScope, message, ...args),
    warn: (message, ...args) => logWithLevel('warn', normalizedScope, message, ...args),
    error: (message, ...args) => logWithLevel('error', normalizedScope, message, ...args)
  });
}

function getRawLogger() {
  if (!initialized) initLogger();
  return log;
}

function getSessionId() {
  return sessionId;
}

module.exports = {
  initLogger,
  getLogger,
  getRawLogger,
  getSessionId,
  getLogDir
};
