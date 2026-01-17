const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { createMenu } = require('./menu');
const { createTray, destroyTray } = require('./tray');
const { saveWindowState, restoreWindowState, getPreferences } = require('./store');

// 环境变量
const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

// 初始化日志系统
log.initialize();

// 配置日志
log.transports.file.level = isDev ? 'debug' : 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.level = isDev ? 'debug' : 'warn';
log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

// 日志轮转：旧日志文件管理
log.transports.file.resolvePath = () => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  return path.join(log.transports.file.getFile().dir, `main-${dateStr}.log`);
};

autoUpdater.logger = log;

// 启动日志：记录系统信息
log.info('='.repeat(80));
log.info('Application Starting');
log.info('='.repeat(80));
log.info('Environment:', isDev ? 'development' : 'production');
log.info('Platform:', process.platform);
log.info('Architecture:', process.arch);
log.info('Node version:', process.versions.node);
log.info('Electron version:', process.versions.electron);
log.info('Chrome version:', process.versions.chrome);
log.info('App version:', app.getVersion());
log.info('User data path:', app.getPath('userData'));
log.info('Logs path:', app.getPath('logs'));
log.info('='.repeat(80));

let mainWindow;
let tray = null;

// 全局错误处理
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  log.error('Stack trace:', error.stack);
  
  // 在开发环境中立即退出，生产环境可能需要更优雅的处理
  if (isDev) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise);
  log.error('Reason:', reason);
  
  if (reason instanceof Error) {
    log.error('Stack trace:', reason.stack);
  }
});

// 监听子进程崩溃事件
app.on('render-process-gone', (event, webContents, details) => {
  log.error(`Renderer process gone: ${details.reason}, exitCode: ${details.exitCode}`);
  log.error(`WebContents ID: ${webContents.id}, URL: ${webContents.getURL()}`);
});

app.on('child-process-gone', (event, details) => {
  log.error(`Child process gone: ${details.type}, reason: ${details.reason}, exitCode: ${details.exitCode}`);
  // 如果是 GPU 进程崩溃，通常 Electron 会自动重启，但服务进程可能需要手动处理
  if (details.type === 'Utility' || details.type === 'Zygote') {
    log.warn('Critical child process crashed');
  }
});

// 处理来自渲染进程的日志
ipcMain.on('log-message', (event, level, message, ...args) => {
  if (log[level]) {
    log[level](`[Renderer] ${message}`, ...args);
  } else {
    log.info(`[Renderer] ${message}`, ...args);
  }
});

function createWindow() {
  log.info('------- Creating Main Window -------');
  log.debug('Function: createWindow() started');

  // 从存储中恢复窗口尺寸，如果没有则使用默认值
  const prefs = getPreferences();
  log.debug('User preferences loaded:', JSON.stringify(prefs));
  
  const windowOptions = {
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#1f1f1f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev
    }
  };
  log.debug('Window options:', JSON.stringify(windowOptions, null, 2));
  
  mainWindow = new BrowserWindow(windowOptions);
  log.info('BrowserWindow instance created');

  // 监听来自渲染进程的所有 IPC 消息，用于调试
  mainWindow.webContents.on('ipc-message', (event, channel, ...args) => {
    // 过滤掉频繁的消息
    if (channel !== 'ping') {
        log.debug(`IPC Message received: [${channel}]`, args);
    }
  });

  // 监听渲染进程的控制台输出 (如果是旧版 API 或者通过特定方式)
  // 注意：electron-log 会自动处理 renderer 日志，如果我们正确配置了
  
  // 恢复窗口状态
  log.debug('Restoring window state...');
  restoreWindowState(mainWindow);
  log.debug('Window state restored');

  // 创建应用菜单
  log.debug('Creating application menu...');
  try {
    createMenu(mainWindow);
    log.info('Application menu created successfully');
  } catch (error) {
    log.error('Failed to create menu:', error);
  }

  // 创建系统托盘（如果用户设置启用）
  if (prefs.showTrayIcon) {
    log.debug('Creating system tray...');
    try {
      tray = createTray(mainWindow);
      log.info('System tray created successfully');
    } catch (error) {
      log.error('Failed to create tray:', error);
    }
  } else {
    log.debug('System tray disabled by user preference');
  }

  const startTime = Date.now();
  log.debug('Loading index.html...');
  mainWindow.loadFile('index.html')
    .then(() => {
      const loadTime = Date.now() - startTime;
      log.info(`index.html loaded successfully in ${loadTime}ms`);
    })
    .catch((error) => {
      log.error('Failed to load index.html:', error);
      log.error('Error stack:', error.stack);
      log.error('Quitting application due to load failure');
      app.quit();
    });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      const totalStartTime = Date.now() - startTime;
      log.info(`Window ready to show (total: ${totalStartTime}ms)`);
      mainWindow.show();
      log.info('Main window shown to user');
      
      // 开发模式自动打开 DevTools
      if (isDev) {
        mainWindow.webContents.openDevTools();
        log.info('DevTools opened (development mode)');
      }
      
      log.info('------- Window Creation Complete -------');
    } else {
      log.warn('mainWindow is null in ready-to-show event');
    }
  });

  // 窗口事件监听
  mainWindow.on('closed', () => {
    log.info('Event: window closed');
    saveWindowState(mainWindow);
    mainWindow = null;
    log.debug('mainWindow set to null');
  });

  mainWindow.on('blur', () => {
    log.debug('Event: window blur (lost focus)');
  });

  mainWindow.on('focus', () => {
    log.debug('Event: window focus (gained focus)');
  });

  mainWindow.on('maximize', () => {
    log.debug('Event: window maximized');
    saveWindowState(mainWindow);
  });

  mainWindow.on('unmaximize', () => {
    log.debug('Event: window unmaximized');
    saveWindowState(mainWindow);
  });

  mainWindow.on('minimize', () => {
    log.debug('Event: window minimized');
  });

  mainWindow.on('restore', () => {
    log.debug('Event: window restored');
  });

  // 在窗口移动或调整大小时保存状态
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      log.debug(`Event: window resize (${bounds.width}x${bounds.height})`);
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      log.debug(`Event: window move (x:${bounds.x}, y:${bounds.y})`);
      saveWindowState(mainWindow);
    }
  });

  // 渲染进程崩溃监控
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log.error('Renderer process gone:', details);
    log.error('Reason:', details.reason);
    log.error('Exit code:', details.exitCode);
  });

  // 页面加载监控
  mainWindow.webContents.on('did-start-loading', () => {
    log.debug('WebContents: started loading');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('WebContents: finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('WebContents: failed to load');
    log.error('Error code:', errorCode);
    log.error('Error description:', errorDescription);
  });

  // 控制台消息监控
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelMap = { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' };
    const logLevel = levelMap[level] || 'info';
    log[logLevel](`Renderer[${sourceId}:${line}]: ${message}`);
  });
}

// 开发模式启用热重载
if (isDev) {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true
    });
    log.info('Hot reload enabled');
  } catch (err) {
    log.warn('Failed to enable hot reload:', err);
  }
}

app.whenReady().then(() => {
  log.info('Event: app ready');
  log.info('App version:', app.getVersion());
  log.info('Ready time:', new Date().toISOString());
  
  log.debug('Calling createWindow()...');
  createWindow();

  // 生产环境检查更新
  if (!isDev) {
    log.info('Production mode: checking for updates...');
    checkForUpdates();
  } else {
    log.debug('Development mode: skipping update check');
  }

  app.on('activate', () => {
    log.info('Event: app activate');
    const windowCount = BrowserWindow.getAllWindows().length;
    log.debug(`Current window count: ${windowCount}`);
    if (windowCount === 0) {
      log.info('No windows open, creating new window...');
      createWindow();
    }
  });
});

// 自动更新配置
function checkForUpdates() {
  log.info('------- Auto-Update Check -------');
  log.debug('Calling autoUpdater.checkForUpdatesAndNotify()...');
  
  autoUpdater.checkForUpdatesAndNotify()
    .then(() => {
      log.debug('Update check initiated successfully');
    })
    .catch((error) => {
      log.error('Update check failed:', error);
      log.error('Error stack:', error.stack);
    });

  autoUpdater.on('checking-for-update', () => {
    log.info('AutoUpdater: checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('AutoUpdater: update available');
    log.info('Update info:', JSON.stringify(info, null, 2));
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('AutoUpdater: update not available');
    log.debug('Current version is latest:', info.version);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    log.info('AutoUpdater: download progress');
    log.debug(`Speed: ${progressObj.bytesPerSecond}, Downloaded: ${progressObj.percent}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('AutoUpdater: update downloaded');
    log.info('Downloaded version:', info.version);
    log.info('Release date:', info.releaseDate);
    log.debug('Update will be installed on next restart');
    // 可以在这里通知用户并询问是否重启应用
  });

  autoUpdater.on('error', (error) => {
    log.error('AutoUpdater: error occurred');
    log.error('Error message:', error.message);
    log.error('Error stack:', error.stack);
  });
  
  log.debug('AutoUpdater event listeners registered');
}

app.on('window-all-closed', () => {
  log.info('Event: all windows closed');
  log.debug('Platform:', process.platform);
  
  if (mainWindow) {
    log.debug('Saving window state before cleanup...');
    saveWindowState(mainWindow);
  }
  
  log.debug('Destroying tray...');
  destroyTray();
  
  if (!isMac) {
    log.info('Non-macOS platform, quitting application...');
    app.quit();
  } else {
    log.debug('macOS platform, keeping app alive');
  }
});

app.on('before-quit', (event) => {
  log.info('Event: before-quit');
  log.info('App is quitting, performing cleanup...');
  log.debug('Quit event can be prevented:', event.defaultPrevented);
});

app.on('will-quit', (event) => {
  log.info('Event: will-quit');
  log.debug('Application will quit, final cleanup');
});

app.on('quit', (event, exitCode) => {
  log.info('Event: quit');
  log.info('Application quit with exit code:', exitCode);
  log.info('='.repeat(80));
  log.info('Application Terminated');
  log.info('='.repeat(80));
});
