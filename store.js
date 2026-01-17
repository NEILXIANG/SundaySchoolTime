const Store = require('electron-store');
const log = require('electron-log');

log.debug('Initializing electron-store...');

// 配置 Schema
const schema = {
  windowBounds: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number', default: 1000 },
      height: { type: 'number', default: 700 }
    },
    default: { width: 1000, height: 700 }
  },
  windowMaximized: {
    type: 'boolean',
    default: false
  },
  preferences: {
    type: 'object',
    properties: {
      theme: { type: 'string', default: 'dark' },
      language: { type: 'string', default: 'zh-CN' },
      autoUpdate: { type: 'boolean', default: true },
      showTrayIcon: { type: 'boolean', default: true }
    },
    default: {
      theme: 'dark',
      language: 'zh-CN',
      autoUpdate: true,
      showTrayIcon: true
    }
  }
};

log.debug('Store schema defined:', JSON.stringify(schema, null, 2));

let store;

try {
  store = new Store({ schema });
  log.info('Store initialized, path:', store.path);
  log.debug('Store size:', store.size, 'items');
} catch (error) {
  log.error('Failed to initialize electron-store:', error);
  log.info('Attempting to recover by resetting configuration...');
  
  try {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');
    
    // 默认路径通常是 userData 下的 config.json
    // 注意：如果在测试环境或自定义了 cwd，这里可能需要调整
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.corrupted.${Date.now()}.bak`;
      fs.renameSync(configPath, backupPath);
      log.warn(`Corrupted config moved to: ${backupPath}`);
    }
    
    // 再次尝试初始化，将使用默认值创建新文件
    store = new Store({ schema });
    log.info('Store recovered successfully');
  } catch (retryError) {
    log.error('Critical: Failed to recover store:', retryError);
    // 最后的手段：创建一个内存中的 store polyfill 或者再次抛出
    // 为了防止应用完全无法启动，我们可以抛出更明确的错误
    throw new Error(`Critical Store Initialization Failure: ${retryError.message}`);
  }
}

// 保存窗口状态
function saveWindowState(window) {
  log.debug('Function: saveWindowState() called');
  
  if (!window) {
    log.warn('saveWindowState: window is null or undefined, skipping');
    return;
  }

  try {
    const bounds = window.getBounds();
    const isMaximized = window.isMaximized();
    const isMinimized = window.isMinimized();
    const isFullScreen = window.isFullScreen();

    log.debug('Current window state:', {
      bounds,
      isMaximized,
      isMinimized,
      isFullScreen
    });

    store.set('windowBounds', bounds);
    store.set('windowMaximized', isMaximized);
    
    log.info('Window state saved successfully:', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: isMaximized
    });
  } catch (error) {
    log.error('Failed to save window state:', error);
    log.error('Error stack:', error.stack);
  }
}

// 恢复窗口状态
function restoreWindowState(window) {
  log.debug('Function: restoreWindowState() called');
  
  if (!window) {
    log.warn('restoreWindowState: window is null or undefined, skipping');
    return;
  }

  try {
    const bounds = store.get('windowBounds');
    const isMaximized = store.get('windowMaximized');

    log.debug('Stored window state:', { bounds, isMaximized });

    if (bounds) {
      log.debug(`Setting window bounds: ${bounds.width}x${bounds.height} at (${bounds.x}, ${bounds.y})`);
      window.setBounds(bounds);
      log.info('Window bounds restored');
    } else {
      log.debug('No stored bounds found, using defaults');
    }

    if (isMaximized) {
      log.debug('Maximizing window...');
      window.maximize();
      log.info('Window maximized');
    }

    log.info('Window state restored successfully');
  } catch (error) {
    log.error('Failed to restore window state:', error);
    log.error('Error stack:', error.stack);
    log.warn('Using default window state');
  }
}

// 获取用户偏好
function getPreferences() {
  log.debug('Function: getPreferences() called');
  
  try {
    const preferences = store.get('preferences');
    log.debug('Preferences retrieved:', JSON.stringify(preferences));
    return preferences;
  } catch (error) {
    log.error('Failed to get preferences:', error);
    log.warn('Returning default preferences');
    return schema.preferences.default;
  }
}

// 设置用户偏好
function setPreference(key, value) {
  log.debug(`Function: setPreference("${key}", "${value}") called`);
  
  try {
    const preferences = store.get('preferences');
    const oldValue = preferences[key];
    
    preferences[key] = value;
    store.set('preferences', preferences);
    
    log.info(`Preference updated: ${key} changed from "${oldValue}" to "${value}"`);
    log.debug('All preferences:', JSON.stringify(preferences));
  } catch (error) {
    log.error(`Failed to set preference ${key}:`, error);
    log.error('Error stack:', error.stack);
  }
}

// 重置所有设置
function resetSettings() {
  log.warn('Function: resetSettings() called - ALL SETTINGS WILL BE CLEARED');
  
  try {
    const beforeSize = store.size;
    const beforeData = { ...store.store };
    
    log.debug('Settings before reset:', JSON.stringify(beforeData, null, 2));
    
    store.clear();
    
    log.info(`All settings reset successfully. Cleared ${beforeSize} items`);
    log.debug('New settings (defaults):', JSON.stringify(store.store, null, 2));
  } catch (error) {
    log.error('Failed to reset settings:', error);
    log.error('Error stack:', error.stack);
  }
}

module.exports = {
  store,
  saveWindowState,
  restoreWindowState,
  getPreferences,
  setPreference,
  resetSettings
};
