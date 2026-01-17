const Store = require('electron-store');
const log = require('electron-log');

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

const store = new Store({ schema });

// 保存窗口状态
function saveWindowState(window) {
  if (!window) {
    return;
  }

  const bounds = window.getBounds();
  const isMaximized = window.isMaximized();

  store.set('windowBounds', bounds);
  store.set('windowMaximized', isMaximized);
  log.info('Window state saved:', { bounds, isMaximized });
}

// 恢复窗口状态
function restoreWindowState(window) {
  if (!window) {
    return;
  }

  const bounds = store.get('windowBounds');
  const isMaximized = store.get('windowMaximized');

  if (bounds) {
    window.setBounds(bounds);
  }

  if (isMaximized) {
    window.maximize();
  }

  log.info('Window state restored:', { bounds, isMaximized });
}

// 获取用户偏好
function getPreferences() {
  return store.get('preferences');
}

// 设置用户偏好
function setPreference(key, value) {
  const preferences = store.get('preferences');
  preferences[key] = value;
  store.set('preferences', preferences);
  log.info(`Preference set: ${key} = ${value}`);
}

// 重置所有设置
function resetSettings() {
  store.clear();
  log.info('All settings reset');
}

module.exports = {
  store,
  saveWindowState,
  restoreWindowState,
  getPreferences,
  setPreference,
  resetSettings
};
