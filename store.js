const Store = require('electron-store');
const { getLogger } = require('./logger');
const { screen } = require('electron');

const log = getLogger('store');

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

function sanitizePreferences(prefs = {}) {
  const defaults = schema.preferences.default;
  const result = { ...defaults, ...prefs };

  result.showTrayIcon = typeof result.showTrayIcon === 'boolean' ? result.showTrayIcon : defaults.showTrayIcon;
  result.autoUpdate = typeof result.autoUpdate === 'boolean' ? result.autoUpdate : defaults.autoUpdate;
  result.theme = typeof result.theme === 'string' ? result.theme : defaults.theme;
  result.language = typeof result.language === 'string' ? result.language : defaults.language;

  return result;
}

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
    // 创建一个内存fallback store，确保应用可以继续运行
    log.warn('Using in-memory fallback store');
    
    // 使用默认值初始化内存存储
    const defaultData = {};
    Object.keys(schema).forEach(key => {
      if (schema[key].default !== undefined) {
        defaultData[key] = schema[key].default;
      }
    });
    
    const memoryStore = {
      data: defaultData,
      get(key) { 
        return this.data[key] !== undefined ? this.data[key] : (schema[key]?.default || null);
      },
      set(key, value) { this.data[key] = value; },
      clear() { 
        this.data = {};
        // 重置为默认值
        Object.keys(schema).forEach(k => {
          if (schema[k].default !== undefined) {
            this.data[k] = schema[k].default;
          }
        });
      },
      get size() { return Object.keys(this.data).length; },
      get store() { return this.data; },
      path: 'memory'
    };
    store = memoryStore;
  }
}

// 防抖动计时器
let saveWindowStateTimer = null;

// 保存窗口状态
function saveWindowState(window) {
  log.debug('Function: saveWindowState() called');
  
  if (!window) {
    log.warn('saveWindowState: window is null or undefined, skipping');
    return;
  }

  // 清除之前的定时器，实现防抖动
  if (saveWindowStateTimer) {
    clearTimeout(saveWindowStateTimer);
  }

  saveWindowStateTimer = setTimeout(() => {
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
  }, 500); // 500ms防抖动
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
      const display = screen.getPrimaryDisplay();
      const { workArea } = display || {};

      let safeBounds = bounds;
      if (workArea) {
        // Clamp to visible work area to避免离屏
        const clampedX = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - Math.max(bounds.width, 100));
        const clampedY = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - Math.max(bounds.height, 100));
        safeBounds = { ...bounds, x: clampedX, y: clampedY };
      }

      log.debug(`Setting window bounds: ${safeBounds.width}x${safeBounds.height} at (${safeBounds.x}, ${safeBounds.y})`);
      window.setBounds(safeBounds);
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
    const preferences = sanitizePreferences(store.get('preferences'));
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
    const preferences = sanitizePreferences(store.get('preferences'));
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
  resetSettings,
  flushWindowState: () => {
    // 立即保存，无防抖动，用于应用退出时
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }
  }
};
