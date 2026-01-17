const { Menu } = require('electron');
const { app } = require('electron');
const log = require('electron-log');

function createMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    // macOS 应用菜单
    ...(isMac
      ? [
        {
          label: app.name,
          submenu: [
            { role: 'about', label: '关于 SundaySchoolTime' },
            { type: 'separator' },
            { role: 'services', label: '服务' },
            { type: 'separator' },
            { role: 'hide', label: '隐藏' },
            { role: 'hideOthers', label: '隐藏其他' },
            { role: 'unhide', label: '显示全部' },
            { type: 'separator' },
            { role: 'quit', label: '退出' }
          ]
        }
      ]
      : []),

    // 文件菜单
    {
      label: '文件',
      submenu: [
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            log.info('Open file menu clicked');
            // 实现打开文件功能
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            log.info('Save file menu clicked');
            // 实现保存文件功能
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },

    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        ...(isMac
          ? [
            { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
            { role: 'delete', label: '删除' },
            { role: 'selectAll', label: '全选' },
            { type: 'separator' },
            {
              label: '语音',
              submenu: [
                { role: 'startSpeaking', label: '开始朗读' },
                { role: 'stopSpeaking', label: '停止朗读' }
              ]
            }
          ]
          : [
            { role: 'delete', label: '删除' },
            { type: 'separator' },
            { role: 'selectAll', label: '全选' }
          ])
      ]
    },

    // 查看菜单
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },

    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac
          ? [
            { type: 'separator' },
            { role: 'front', label: '全部置于顶层' },
            { type: 'separator' },
            { role: 'window', label: '窗口' }
          ]
          : [
            { role: 'close', label: '关闭' }
          ])
      ]
    },

    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '文档',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/NEILXIANG/SundaySchoolTime#readme');
          }
        },
        {
          label: '报告问题',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/NEILXIANG/SundaySchoolTime/issues');
          }
        },
        { type: 'separator' },
        {
          label: '检查更新',
          click: () => {
            const { autoUpdater } = require('electron-updater');
            autoUpdater.checkForUpdatesAndNotify();
            log.info('Check for updates');
          }
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 SundaySchoolTime',
              message: 'SundaySchoolTime',
              detail: `版本: ${app.getVersion()}\n教师学生图文分发工具\n\n© 2026 Neil Xiang`,
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  log.info('Application menu created');
}

module.exports = {
  createMenu
};
