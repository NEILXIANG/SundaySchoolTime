const { contextBridge } = require('electron');

// 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld(
  'api',
  Object.freeze({
    // 未来可在此添加 IPC 通信方法
    platform: process.platform
  })
);
