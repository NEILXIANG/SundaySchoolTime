const { app, BrowserWindow } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { createMenu } = require('./menu');
const { createTray, destroyTray } = require('./tray');
const { saveWindowState, restoreWindowState, getPreferences } = require('./store');

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

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

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

function createWindow() {
  log.info('Creating main window...');

  // 从存储中恢复窗口尺寸，如果没有则使用默认值
  const prefs = getPreferences();
  
  mainWindow = new BrowserWindow({
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
  });

  // 恢复窗口状态
  restoreWindowState(mainWindow);

  // 创建应用菜单
  createMenu(mainWindow);

  // 创建系统托盘（如果用户设置启用）
  if (prefs.showTrayIcon) {
    tray = createTray(mainWindow);
  }

  mainWindow.loadFile('index.html').catch((error) => {
    log.error('Failed to load index.html:', error);
    app.quit();
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      log.info('Main window shown');
      
      // 开发模式自动打开 DevTools
      if (isDev) {
        mainWindow.webContents.openDevTools();
        log.info('DevTools opened');
      }
    }
  });

  mainWindow.on('closed', () => {
    log.info('Main window closed');
    saveWindowState(mainWindow);
    mainWindow = null;
  });

  // 在窗口移动或调整大小时保存状态
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      saveWindowState(mainWindow);
    }
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
  log.info('App ready, version:', app.getVersion());
  createWindow();

  // 生产环境检查更新
  if (!isDev) {
    checkForUpdates();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 自动更新配置
function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    log.error('Update check failed:', error);
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    // 可以在这里通知用户并询问是否重启应用
  });

  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
  });
}

app.on('window-all-closed', () => {
  log.info('All windows closed');
  saveWindowState(mainWindow);
  destroyTray();
  if (!isMac) {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('App is quitting');
});
