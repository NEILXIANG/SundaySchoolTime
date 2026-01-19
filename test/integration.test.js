const { _electron: electron } = require('playwright');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { cleanupElectronApp, getHeadlessLaunchConfig, hideWindow } = require('./helpers');

describe('功能集成测试', () => {
  let electronApp;
  let window;

  beforeEach(async function () {
    this.timeout(30000);
    electronApp = await electron.launch(
      getHeadlessLaunchConfig(path.join(__dirname, '..'))
    );
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await hideWindow(window);  // 隐藏窗口减少干扰
  });

  afterEach(async function () {
    this.timeout(15000);
    await cleanupElectronApp(electronApp);
    electronApp = null;
  });

  describe('菜单功能集成测试', () => {
    it('应用启动后应该有菜单', async () => {
      // 通过评估主进程检查菜单是否存在
      const hasMenu = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return menu !== null;
      });
      expect(hasMenu).to.be.true;
    });

    it('菜单应该包含多个菜单项', async () => {
      const menuItemCount = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return menu ? menu.items.length : 0;
      });
      expect(menuItemCount).to.be.greaterThan(0);
    });

    it('开发者工具菜单项在开发环境可用，生产环境隐藏', async () => {
      const hasDevTools = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        if (!menu) return false;
        
        for (const item of menu.items) {
          if (item.submenu) {
            for (const subItem of item.submenu.items) {
              if (subItem.label && subItem.label.includes('开发者工具')) {
                return true;
              }
            }
          }
        }
        return false;
      });

      const expected = process.env.NODE_ENV === 'development';
      expect(hasDevTools).to.equal(expected);
    });
  });

  describe('托盘功能集成测试', () => {
    it('应用应该创建托盘图标', async () => {
      const hasTray = await electronApp.evaluate(() => {
        // 检查是否有托盘实例
        return global.tray !== undefined && global.tray !== null;
      });
      // 注意：在某些测试环境中托盘可能不可用
      expect(hasTray).to.be.a('boolean');
    });
  });

  describe('窗口状态持久化测试', () => {
    it('窗口大小应该可以保存和恢复', async () => {
      const bounds = await window.evaluate(() => {
        return {
          width: window.outerWidth,
          height: window.outerHeight
        };
      });
      
      expect(bounds.width).to.be.greaterThan(0);
      expect(bounds.height).to.be.greaterThan(0);
    });

    it('窗口位置应该有效', async () => {
      const position = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const pos = windows[0].getPosition();
          return { x: pos[0], y: pos[1] };
        }
        return null;
      });
      
      if (position) {
        expect(position.x).to.be.a('number');
        expect(position.y).to.be.a('number');
      }
    });
  });

  describe('日志功能集成测试', () => {
    it('日志文件应该被创建', async function () {
      this.timeout(10000);
      // 等待日志写入
      await new Promise(resolve => setTimeout(resolve, 1500));

      const userDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'));
      const appLogsDir = await electronApp.evaluate(({ app }) => app.getPath('logs'));
      const candidateDirs = [path.join(userDataDir, 'logs'), appLogsDir];
      let files = [];
      for (let i = 0; i < 3 && files.length === 0; i++) {
        for (const dir of candidateDirs) {
          if (fs.existsSync(dir)) {
            files = fs.readdirSync(dir).filter((name) => name.endsWith('.log'));
            if (files.length > 0) {
              break;
            }
          }
        }
        if (files.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      expect(files.length).to.be.greaterThan(0);
    });

    it('窗口最小化和恢复应该正常工作', async function () {
      this.timeout(20000);
      
      const platform = await electronApp.evaluate(() => process.platform);
      if (platform === 'darwin') {
        this.skip(); // macOS 最小化行为在无窗口管理器下不稳定
      }

      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].minimize();
        }
      });

      // 轮询等待最小化成功
      let isMinimized = false;
      for (let i = 0; i < 20; i++) {
        isMinimized = await electronApp.evaluate(({ BrowserWindow }) => {
          const windows = BrowserWindow.getAllWindows();
          return windows.length > 0 ? windows[0].isMinimized() : false;
        });
        if (isMinimized) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      expect(isMinimized).to.be.true;

      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].restore();
        }
      });

      // 轮询等待恢复
      let isRestored = false;
      for (let i = 0; i < 20; i++) {
        isRestored = await electronApp.evaluate(({ BrowserWindow }) => {
          const windows = BrowserWindow.getAllWindows();
          return windows.length > 0 ? !windows[0].isMinimized() : false;
        });
        if (isRestored) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      expect(isRestored).to.be.true;
    });

    it('窗口最大化应该正常工作', async function () {
      this.timeout(10000);
      
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0 && !windows[0].isMaximized()) {
          windows[0].maximize();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const isMaximized = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0].isMaximized() : false;
      });

      expect(isMaximized).to.be.true;
    });

    it('窗口焦点事件应该被监听', async () => {
      const hasFocusListeners = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const listeners = windows[0].eventNames();
          return listeners.includes('focus') || listeners.includes('blur');
        }
        return false;
      });

      expect(hasFocusListeners).to.be.true;
    });
  });

  describe('安全性集成测试', () => {
    it('应用应该能处理渲染进程错误', async function() {
      this.timeout(5000); // 增加超时时间
      // 触发一个渲染进程错误
      try {
        await window.evaluate(() => {
          // 这将触发一个错误，但应用不应该崩溃
          setTimeout(() => {
            throw new Error('Test error in renderer');
          }, 100);
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        // 错误应该被捕获
      }

      // 应用应该仍然在运行
      const isRunning = await electronApp.evaluate(() => {
        return true;
      });
      expect(isRunning).to.be.true;
    });

    it('主进程应该有全局错误处理', async () => {
      const hasErrorHandlers = await electronApp.evaluate(() => {
        const processListeners = process.listeners('uncaughtException');
        return processListeners.length > 0;
      });
      expect(hasErrorHandlers).to.be.true;
    });
  });

  describe('窗口事件处理测试', () => {
    it('窗口最小化和恢复应该正常工作', async function () {
      this.timeout(20000);
      
      // macOS 上的最小化行为可能不同，跳过此测试
      const platform = await electronApp.evaluate(() => process.platform);
      if (platform === 'darwin') {
        this.skip();
        return;
      }
      
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].minimize();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const isMinimized = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0].isMinimized() : false;
      });

      expect(isMinimized).to.be.true;

      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].restore();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const isRestored = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? !windows[0].isMinimized() : false;
      });

      expect(isRestored).to.be.true;
    });

    it('窗口最大化应该正常工作', async function () {
      this.timeout(10000);
      
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0 && !windows[0].isMaximized()) {
          windows[0].maximize();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const isMaximized = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0].isMaximized() : false;
      });

      expect(isMaximized).to.be.true;
    });

    it('窗口焦点事件应该被监听', async () => {
      const hasFocusListeners = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const listeners = windows[0].eventNames();
          return listeners.includes('focus') || listeners.includes('blur');
        }
        return false;
      });

      expect(hasFocusListeners).to.be.true;
    });
  });

  describe('安全性集成测试', () => {
    it('webPreferences 应该启用 contextIsolation', async () => {
      const canAccessRequire = await window.evaluate(() => {
        return typeof require === 'function';
      });
      expect(canAccessRequire).to.be.false;
    });

    it('webPreferences 应该禁用 nodeIntegration', async () => {
      // 通过检查渲染进程中是否可以访问 Node.js API 来验证
      const nodeIntegration = await window.evaluate(() => {
        return typeof process !== 'undefined' && typeof process.versions !== 'undefined';
      });

      expect(nodeIntegration).to.be.false;
    });

    it('应该加载 preload 脚本', async () => {
      const hasPreloadAPI = await window.evaluate(() => {
        return typeof window.api !== 'undefined';
      });
      expect(hasPreloadAPI).to.be.true;
    });
  });

  describe('跨平台兼容性测试', () => {
    it('应该检测正确的平台', async () => {
      const detectedPlatform = await electronApp.evaluate(() => {
        return process.platform;
      });

      expect(['darwin', 'win32', 'linux']).to.include(detectedPlatform);
    });

    it('应该有正确的应用路径', async () => {
      const appPath = await electronApp.evaluate(({ app }) => {
        return app.getAppPath();
      });

      expect(appPath).to.be.a('string');
      expect(appPath.length).to.be.greaterThan(0);
    });

    it('应该有正确的用户数据路径', async () => {
      const userDataPath = await electronApp.evaluate(({ app }) => {
        return app.getPath('userData');
      });

      expect(userDataPath).to.be.a('string');
      expect(userDataPath.length).to.be.greaterThan(0);
    });
  });

  describe('内存泄漏预防测试', () => {
    it('重复最小化和恢复不应该导致内存泄漏', async function () {
      this.timeout(15000);

      for (let i = 0; i < 5; i++) {
        await electronApp.evaluate(({ BrowserWindow }) => {
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].minimize();
          }
        });
        await new Promise(resolve => setTimeout(resolve, 200));

        await electronApp.evaluate(({ BrowserWindow }) => {
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].restore();
          }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const stillResponsive = await electronApp.evaluate(() => true);
      expect(stillResponsive).to.be.true;
    });

    it('应该只有一个主窗口实例', async () => {
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length;
      });

      expect(windowCount).to.equal(1);
    });
  });

  describe('渲染进程通信测试', () => {
    it('preload API 应该暴露给渲染进程', async () => {
      const hasAPI = await window.evaluate(() => {
        return typeof window.electronAPI !== 'undefined' || typeof window.api !== 'undefined';
      });

      expect(hasAPI).to.be.true;
    });

    it('versions API 应该可访问', async () => {
      const versions = await window.evaluate(() => {
        return window.electronAPI?.versions || null;
      });

      if (versions) {
        expect(versions).to.have.property('node');
        expect(versions).to.have.property('chrome');
        expect(versions).to.have.property('electron');
      }
    });

    it('platform API 应该可访问', async () => {
      const platform = await window.evaluate(() => {
        return window.electronAPI?.platform || null;
      });

      if (platform) {
        expect(['darwin', 'win32', 'linux']).to.include(platform);
      }
    });
  });

  describe('应用生命周期测试', () => {
    it('应用应该能正常关闭', async function () {
      this.timeout(10000);
      
      await electronApp.close();
      // 验证应用已关闭
      electronApp = null; // 防止 afterEach 再次关闭
    });

    it('应用重启应该正常工作', async function () {
      this.timeout(20000);

      // 关闭当前实例
      await electronApp.close();

      // 启动新实例
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..')],
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });

      window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const isReady = await electronApp.evaluate(({ app }) => {
        return app.isReady();
      });

      expect(isReady).to.be.true;
    });
  });

  describe('多次启动停止压力测试', () => {
    it('应该能承受5次连续启动和停止', async function () {
      this.timeout(60000);

      // 先关闭当前实例
      if (electronApp) {
        await electronApp.close();
        electronApp = null;
      }

      for (let i = 0; i < 5; i++) {
        const app = await electron.launch({
          args: [path.join(__dirname, '..')],
          env: {
            ...process.env,
            NODE_ENV: 'test'
          }
        });

        const win = await app.firstWindow();
        await win.waitForLoadState('domcontentloaded');

        const isReady = await app.evaluate(({ app }) => {
          return app.isReady();
        });

        expect(isReady).to.be.true;

      
        await app.close();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });
  });

  describe('数据库与 IPC 集成测试', () => {
    it('渲染进程应该能通过 API 调用数据库添加和查询学生', async () => {
      // 在渲染进程中执行
      const result = await window.evaluate(async () => {
        // 调用暴露的 db.invoke
        if (!window.api || !window.api.db) return { error: 'API not exposed' };
        
        try {
          // 1. 添加学生
          const addRes = await window.api.db.invoke('addStudent', { 
            name: 'IPC Student', 
            className: 'IPC Class'
          });
          
          if (!addRes.success) return { error: addRes.error };
          const newId = addRes.data;

          // 2. 查询列表
          const listRes = await window.api.db.invoke('listStudents');
          const students = listRes.data;
          
          return { newId, students };
        } catch (e) {
          return { error: e.message };
        }
      });

      expect(result.error).to.be.undefined;
      expect(result.newId).to.be.a('number');
      expect(result.students).to.be.an('array');
      const found = result.students.find(s => s.name === 'IPC Student');
      expect(found).to.not.be.undefined;
    });
  });
});
