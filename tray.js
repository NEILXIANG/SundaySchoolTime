const { Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { getLogger } = require('./logger');

const log = getLogger('tray');

let tray = null;

function createTray(mainWindow) {
  try {
    // 尝试加载真实图标，如果失败则使用占位符
    let icon;
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      log.info('Loaded tray icon from:', iconPath);
    } else {
      // 使用内置的1x1 PNG 占位符
      const iconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X2s3sAAAAASUVORK5CYII=';
      icon = nativeImage.createFromDataURL(iconDataUrl);
      log.warn('Icon file not found, using placeholder');
    }
    
    tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        log.debug('Tray Action: Show Window');
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        log.debug('Tray Action: Hide Window');
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: '关于',
      click: () => {
        log.info('Tray: Show about dialog');
        const { app, dialog } = require('electron');
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '关于SundaySchoolTime',
          message: 'SundaySchoolTime',
          detail: `版本: ${app.getVersion()}\n教师学生图文分发工具\n\n© 2026 Neil Xiang`,
          buttons: ['确定']
        });
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        const { app } = require('electron');
        app.quit();
      }
    }
  ]);

  tray.setToolTip('SundaySchoolTime');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  log.info('Tray created');
  return tray;
  } catch (error) {
    log.error('Failed to create tray:', error);
    throw error;
  }
}

function destroyTray() {
  try {
    if (tray) {
      tray.destroy();
      tray = null;
      log.info('Tray destroyed');
    }
  } catch (error) {
    log.error('Failed to destroy tray:', error);
  }
}

module.exports = {
  createTray,
  destroyTray
};
