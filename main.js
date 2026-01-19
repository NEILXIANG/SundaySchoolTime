const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initLogger, getLogger, getRawLogger, getSessionId } = require('./logger');
const { autoUpdater } = require('electron-updater');
const { createMenu } = require('./menu');
const { createTray, destroyTray } = require('./tray');
const { saveWindowState, restoreWindowState, getPreferences } = require('./store');
const db = require('./db');

// 环境变量
const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

// 初始化日志系统
initLogger({ processType: 'main', appVersion: app.getVersion(), logFilePrefix: 'main' });
const log = getLogger('main');
const rawLog = getRawLogger();
autoUpdater.logger = rawLog;

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
log.info('Session ID:', getSessionId());
log.info('='.repeat(80));

let mainWindow;
let tray = null;

// 全局错误处理
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception', error);
  log.error('Stack trace', error && error.stack ? error.stack : 'N/A');
  
  // 在开发环境中立即退出，生产环境可能需要更优雅的处理
  if (isDev) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at', { promise });
  log.error('Reason', reason);
  
  if (reason instanceof Error) {
    log.error('Stack trace:', reason.stack);
  }
});

// 监听子进程崩溃事件
app.on('render-process-gone', (event, webContents, details) => {
  log.error('Renderer process gone', details);
  log.error('WebContents details', { id: webContents.id, url: webContents.getURL() });
});

app.on('child-process-gone', (event, details) => {
  log.error('Child process gone', details);
  // 如果是 GPU 进程崩溃，通常 Electron 会自动重启，但服务进程可能需要手动处理
  if (details.type === 'Utility' || details.type === 'Zygote') {
    log.warn('Critical child process crashed');
  }
});

// 处理来自渲染进程的日志
ipcMain.on('log-message', (event, level, message, ...args) => {
  const rendererLog = getLogger('renderer');
  const levelName = typeof level === 'string' ? level : 'info';
  const payload = {
    senderId: event.sender?.id,
    url: event.sender?.getURL?.()
  };
  if (rendererLog[levelName]) {
    rendererLog[levelName](message, payload, ...args);
  } else {
    rendererLog.info(message, payload, ...args);
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
      log.info('index.html loaded successfully', { loadTime });
    })
    .catch((error) => {
      log.error('Failed to load index.html', error);
      log.error('Quitting application due to load failure');
      app.quit();
    });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      const totalStartTime = Date.now() - startTime;
      log.info('Window ready to show', { totalStartTime });
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
    // 注意：窗口关闭时已无法调用 getBounds()，状态在 close 之前保存
    mainWindow = null;
    log.debug('mainWindow set to null');
  });

  // 在窗口关闭前保存状态
  mainWindow.on('close', () => {
    log.debug('Event: window close (before closed)');
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
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

  // 初始化数据库
  try {
    db.initDb();
    log.info('Database initialized successfully');
  } catch (error) {
    log.error('Failed to initialize database:', error);
  }

  // 注册 IPC 处理程序 (Database)
  const allowedDbMethods = new Set([
    'addStudent', 'listStudents', 'countStudents', 'searchStudents', 'getStudentById', 'updateStudent', 'deleteStudent',
    'addPhoto', 'listPhotos', 'countPhotos', 'searchPhotos', 'getPhotoById', 'updatePhoto', 'deletePhoto',
    'linkStudentPhoto', 'unlinkStudentPhoto', 'listPhotosByStudent', 'listStudentsByPhoto',
    'addMessageRecord', 'getMessageRecordById', 'listMessageRecords', 'backupDatabase'
  ]);

  ipcMain.handle('db:call', async (event, method, ...args) => {
    try {
      // 限制参数数量，防止滥用
      if (args.length > 10) {
        throw new Error('Too many arguments');
      }
      
      // 限制单个参数大小（对象/数组）
      const argSize = JSON.stringify(args).length;
      if (argSize > 1024 * 1024) { // 1MB
        throw new Error('Argument size too large');
      }
      
      if (!allowedDbMethods.has(method)) {
        throw new Error(`Method ${method} is not allowed`);
      }

      // 参数类型验证
      if (method === 'addStudent' && args.length > 0) {
        const student = args[0];
        if (typeof student !== 'object' || !student.name || typeof student.name !== 'string') {
          throw new Error('Invalid student data: name is required and must be string');
        }
      }
      
      if ((method === 'listStudents' || method === 'searchStudents' || method === 'listPhotos') && args.length > 0) {
        const options = args[0];
        if (typeof options === 'object') {
          if (options.limit !== undefined && (typeof options.limit !== 'number' || options.limit < 0)) {
            throw new Error('Invalid limit: must be non-negative number');
          }
          if (options.offset !== undefined && (typeof options.offset !== 'number' || options.offset < 0)) {
            throw new Error('Invalid offset: must be non-negative number');
          }
        }
      }

      if (typeof db[method] === 'function') {
        const ipcLog = getLogger('ipc');
        const startTime = Date.now();
        ipcLog.debug('db call started', { method, argCount: args.length });
        
        // 大部分 db 操作是同步的，但通过 invoke 调用 wrap 成 promise
        const result = db[method](...args);
        const elapsed = Date.now() - startTime;
        
        ipcLog.info('db call completed', { method, elapsed, resultType: typeof result });
        return { success: true, data: result };
      } else {
        throw new Error(`Method ${method} not found in db module`);
      }
    } catch (error) {
      const ipcLog = getLogger('ipc');
      ipcLog.error('db call failed', { method, error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  });

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

// 自动更新配置 - 事件监听器在模块顶层注册，避免重复
let autoUpdaterInitialized = false;

function setupAutoUpdaterEvents() {
  if (autoUpdaterInitialized) return;
  autoUpdaterInitialized = true;

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

function checkForUpdates() {
  log.info('------- Auto-Update Check -------');
  
  // 确保事件监听器只注册一次
  setupAutoUpdaterEvents();
  
  log.debug('Calling autoUpdater.checkForUpdatesAndNotify()...');
  
  autoUpdater.checkForUpdatesAndNotify()
    .then(() => {
      log.debug('Update check initiated successfully');
    })
    .catch((error) => {
      log.error('Update check failed:', error);
      log.error('Error stack:', error.stack);
    });
}

app.on('window-all-closed', () => {
  log.info('Event: all windows closed');
  log.debug('Platform:', process.platform);
  
  if (mainWindow) {
    log.debug('Flushing and saving window state before cleanup...');
    const { flushWindowState } = require('./store');
    flushWindowState();
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
  db.closeDb();
  log.debug('Database connection closed');
  log.debug('Application will quit, final cleanup');
});

app.on('quit', (event, exitCode) => {
  log.info('Event: quit');
  log.info('Application quit with exit code:', exitCode);
  log.info('='.repeat(80));
  log.info('Application Terminated');
  log.info('='.repeat(80));
});
