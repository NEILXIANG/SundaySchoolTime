const { app, BrowserWindow } = require('electron');
const path = require('path');
const log = require('electron-log');

// 配置日志
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

let mainWindow;

// 全局错误处理
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

function createWindow() {
  log.info('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#1f1f1f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev
    }
  });

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
    mainWindow = null;
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (!isMac) {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('App is quitting');
});
