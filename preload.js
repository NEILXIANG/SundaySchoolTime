const { contextBridge, ipcRenderer } = require('electron');

// 捕获未处理的错误并发送到主进程
window.addEventListener('error', (event) => {
  ipcRenderer.send('log-message', 'error', `Uncaught Error: ${event.message}`, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error ? event.error.stack : null
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ipcRenderer.send('log-message', 'error', `Unhandled Rejection: ${event.reason}`);
});

// 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld(
  'api',
  Object.freeze({
    // 未来可在此添加 IPC 通信方法
    platform: process.platform,
    log: {
      info: (msg, ...args) => ipcRenderer.send('log-message', 'info', msg, ...args),
      warn: (msg, ...args) => ipcRenderer.send('log-message', 'warn', msg, ...args),
      error: (msg, ...args) => ipcRenderer.send('log-message', 'error', msg, ...args),
      debug: (msg, ...args) => ipcRenderer.send('log-message', 'debug', msg, ...args),
    }
  })
);
