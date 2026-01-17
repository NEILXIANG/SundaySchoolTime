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

const store = new Store({ schema });
log.info('Store initialized, path:', store.path);
log.debug('Store size:', store.size, 'items');

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
