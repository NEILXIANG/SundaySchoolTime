const { Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');

let tray = null;

function createTray(mainWindow) {
  // 暂时使用空图标，待图标文件准备好后替换
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: '关于',
      click: () => {
        // 显示关于对话框
        log.info('Show about dialog');
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
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
    log.info('Tray destroyed');
  }
}

module.exports = {
  createTray,
  destroyTray
};
