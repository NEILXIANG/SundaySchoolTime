const { contextBridge, ipcRenderer } = require('electron');

// 捕获未处理的错误并发送到主进程
window.addEventListener('error', (event) => {
  const errorInfo = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error && event.error.stack ? event.error.stack.substring(0, 1000) : null // 限制stack大小
  };
  ipcRenderer.send('log-message', 'error', `Uncaught Error: ${event.message}`, errorInfo);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = typeof event.reason === 'object' ? JSON.stringify(event.reason).substring(0, 500) : String(event.reason);
  ipcRenderer.send('log-message', 'error', `Unhandled Rejection: ${reason}`);
});

// 安全地暴露 API 到渲染进程
const logApi = Object.freeze({
  info: (msg, ...args) => ipcRenderer.send('log-message', 'info', msg, ...args),
  warn: (msg, ...args) => ipcRenderer.send('log-message', 'warn', msg, ...args),
  error: (msg, ...args) => ipcRenderer.send('log-message', 'error', msg, ...args),
  debug: (msg, ...args) => ipcRenderer.send('log-message', 'debug', msg, ...args),
});

const dbApi = Object.freeze({
  invoke: (method, ...args) => ipcRenderer.invoke('db:call', method, ...args)
});

// 存储注册的回调以便清理
const filesSelectedListeners = new Map();
let listenerIdCounter = 0;

const fileApi = Object.freeze({
  onFilesSelected: (callback) => {
    const listenerId = ++listenerIdCounter;
    const wrappedCallback = (event, filePaths) => callback(filePaths);
    filesSelectedListeners.set(listenerId, wrappedCallback);
    ipcRenderer.on('files-selected', wrappedCallback);
    return listenerId;
  },
  removeFilesSelectedListener: (listenerId) => {
    const callback = filesSelectedListeners.get(listenerId);
    if (callback) {
      ipcRenderer.removeListener('files-selected', callback);
      filesSelectedListeners.delete(listenerId);
      return true;
    }
    return false;
  }
});

const api = Object.freeze({
  // 未来可在此添加 IPC 通信方法
  platform: process.platform,
  log: logApi,
  db: dbApi,
  file: fileApi
});

contextBridge.exposeInMainWorld('api', api);
