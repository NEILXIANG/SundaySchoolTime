const { expect } = require('chai');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

describe('阶段1：Electron 应用壳测试套件', function() {
  this.timeout(30000);
  
  let electronApp;
  let window;

  // 测试1：应用可以成功启动
  describe('1. 应用启动测试', () => {
    it('应该能够成功启动 Electron 应用', async () => {
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..')]
      });
      
      expect(electronApp).to.not.be.null;
      
      // 获取第一个窗口
      window = await electronApp.firstWindow();
      expect(window).to.not.be.null;
    });

    it('应该创建一个窗口', async () => {
      const windows = await electronApp.windows();
      expect(windows.length).to.equal(1);
    });

    it('窗口应该有正确的尺寸', async () => {
      const size = await window.evaluate(() => {
        return {
          width: window.outerWidth,
          height: window.outerHeight
        };
      });
      
      expect(size.width).to.be.at.least(900);
      expect(size.height).to.be.at.least(600);
    });

    after(async () => {
      if (electronApp) {
        await electronApp.close();
      }
    });
  });

  // 测试2：主进程架构测试
  describe('2. 主进程架构测试', () => {
    before(async () => {
      const mainContent = fs.readFileSync(
        path.join(__dirname, '../main.js'), 
        'utf-8'
      );
      this.mainContent = mainContent;
    });

    it('应该导入 BrowserWindow 模块', () => {
      expect(this.mainContent).to.include('BrowserWindow');
    });

    it('应该配置 contextIsolation: true', () => {
      expect(this.mainContent).to.include('contextIsolation: true');
    });

    it('应该配置 nodeIntegration: false', () => {
      expect(this.mainContent).to.include('nodeIntegration: false');
    });

    it('应该配置 preload 脚本', () => {
      expect(this.mainContent).to.include('preload:');
      expect(this.mainContent).to.include('preload.js');
    });

    it('应该处理 window-all-closed 事件', () => {
      expect(this.mainContent).to.include('window-all-closed');
    });

    it('应该处理 activate 事件（macOS）', () => {
      expect(this.mainContent).to.include('activate');
    });
  });

  // 测试3：Preload 脚本测试
  describe('3. Preload 脚本安全测试', () => {
    before(() => {
      const preloadContent = fs.readFileSync(
        path.join(__dirname, '../preload.js'),
        'utf-8'
      );
      this.preloadContent = preloadContent;
    });

    it('应该使用 contextBridge 暴露 API', () => {
      expect(this.preloadContent).to.include('contextBridge');
    });

    it('应该暴露 api 对象到主世界', () => {
      expect(this.preloadContent).to.include('exposeInMainWorld');
      expect(this.preloadContent).to.include("'api'");
    });

    it('不应该直接暴露 Node.js 模块', () => {
      expect(this.preloadContent).to.not.include('require("fs")');
      expect(this.preloadContent).to.not.include('require("child_process")');
    });
  });

  // 测试4：渲染进程页面测试
  describe('4. 渲染进程页面测试', () => {
    beforeEach(async () => {
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..')],
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });
      window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');
    });

    it('页面标题应该正确', async () => {
      const title = await window.title();
      expect(title).to.equal('教师学生图文分发工具');
    });

    it('应该显示 "App Ready" 文本', async () => {
      const h1Text = await window.locator('h1').textContent();
      expect(h1Text).to.equal('App Ready');
    });

    it('应该显示副标题', async () => {
      const pText = await window.locator('p').first().textContent();
      expect(pText).to.equal('教师学生图文分发工具');
    });

    it('应该显示平台信息', async () => {
      const getPlatformText = async () => {
        await window.waitForFunction(() => {
          const el = document.querySelector('#platformName');
          return el && el.textContent && el.textContent !== '加载中...';
        }, { timeout: 5000 });
        return window.locator('#platformName').textContent();
      };

      let platformText;
      try {
        platformText = await getPlatformText();
      } catch (error) {
        if (electronApp) {
          try {
            await electronApp.close();
          } catch (e) {
            // 忽略关闭错误
          }
        }
        electronApp = await electron.launch({
          args: [path.join(__dirname, '..')],
          env: {
            ...process.env,
            NODE_ENV: 'test'
          }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        platformText = await getPlatformText();
      }
      expect(platformText).to.be.oneOf(['darwin', 'win32', 'linux']);
    });

    it('window.api 应该在渲染进程中可用', async () => {
      const apiExists = await window.evaluate(() => {
        return typeof window.api !== 'undefined';
      });
      expect(apiExists).to.be.true;
    });

    it('window.api.platform 应该返回正确的平台', async () => {
      const platform = await window.evaluate(() => {
        return window.api.platform;
      });
      expect(platform).to.be.oneOf(['darwin', 'win32', 'linux']);
    });

    it('window.api 应该是不可变对象', async () => {
      const isFrozen = await window.evaluate(() => {
        return Object.isFrozen(window.api);
      });
      expect(isFrozen).to.be.true;
    });

    it('页面应该设置 CSP', async () => {
      const csp = await window.evaluate(() => {
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return meta ? meta.getAttribute('content') : null;
      });
      expect(csp).to.be.a('string');
      expect(csp).to.include("default-src 'self'");
    });

    afterEach(async function() {
      this.timeout(10000);
      if (electronApp) {
        try {
          await electronApp.close();
        } catch (e) {
          // 忽略关闭错误
        }
        electronApp = null;
      }
    });
  });

  // 测试5：项目结构测试
  describe('5. 项目结构完整性测试', () => {
    const requiredFiles = [
      'package.json',
      'main.js',
      'preload.js',
      'index.html'
    ];

    requiredFiles.forEach(file => {
      it(`应该存在文件: ${file}`, () => {
        const filePath = path.join(__dirname, '..', file);
        expect(fs.existsSync(filePath)).to.be.true;
      });
    });

    it('package.json 应该配置正确的 main 入口', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
      expect(pkg.main).to.equal('main.js');
    });

    it('package.json 应该包含 start 脚本', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
      expect(pkg.scripts.start).to.include('electron');
    });

    it('package.json 应该包含 electron 依赖', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
      expect(pkg.devDependencies).to.have.property('electron');
    });
  });

  // 测试6：鲁棒性测试 - 连续启动关闭
  describe('6. 鲁棒性测试：连续打开关闭 3 次', () => {
    for (let i = 1; i <= 3; i++) {
      it(`第 ${i} 次：应该能够启动并正常关闭`, async () => {
        // 启动应用
        const app = await electron.launch({
          args: [path.join(__dirname, '..')]
        });
        
        expect(app).to.not.be.null;
        
        // 获取窗口
        const win = await app.firstWindow();
        expect(win).to.not.be.null;
        
        // 验证页面加载
        const title = await win.title();
        expect(title).to.equal('教师学生图文分发工具');
        
        // 等待一下确保应用稳定
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 关闭应用
        await app.close();
        
        // 等待一下再进行下一次测试
        await new Promise(resolve => setTimeout(resolve, 500));
      });
    }
  });

  // 测试7：窗口状态管理测试
  describe('7. 窗口状态管理测试', () => {
    beforeEach(async () => {
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..')]
      });
      window = await electronApp.firstWindow();
    });

    afterEach(async function() {
      this.timeout(10000);
      if (electronApp) {
        try {
          await electronApp.close();
        } catch (e) {
          // 忽略关闭错误
        }
        electronApp = null;
      }
    });

    it('窗口应该可见', async () => {
      const isVisible = await window.evaluate(() => {
        return document.visibilityState === 'visible';
      });
      expect(isVisible).to.be.true;
    });

    it('窗口应该可以获取可见状态', async () => {
      const visibilityState = await window.evaluate(() => {
        return document.visibilityState;
      });
      // 验证窗口状态可以被读取
      expect(['visible', 'hidden']).to.include(visibilityState);
    });
  });

  // 测试8：安全性测试
  describe('8. 安全性测试', () => {
    before(async () => {
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..')]
      });
      window = await electronApp.firstWindow();
    });

    it('渲染进程不应该能访问 require', async () => {
      const canRequire = await window.evaluate(() => {
        try {
          // @ts-ignore
          return typeof require !== 'undefined' && typeof require('fs') !== 'undefined';
        } catch (e) {
          return false;
        }
      });
      expect(canRequire).to.be.false;
    });

    it('渲染进程不应该能访问 process.versions.node', async () => {
      const hasNodeAccess = await window.evaluate(() => {
        try {
          return typeof process !== 'undefined' && 
                 typeof process.versions !== 'undefined' &&
                 typeof process.versions.node !== 'undefined';
        } catch (e) {
          return false;
        }
      });
      expect(hasNodeAccess).to.be.false;
    });

    after(async () => {
      if (electronApp) {
        await electronApp.close();
      }
    });
  });

  // 测试9：跨平台兼容性测试
  describe('9. 跨平台兼容性测试', () => {
    before(async () => {
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..')]
      });
      window = await electronApp.firstWindow();
    });

    it('应该正确识别当前平台', async () => {
      const platform = await window.evaluate(() => {
        return window.api.platform;
      });
      expect(platform).to.be.a('string');
      expect(['darwin', 'win32', 'linux']).to.include(platform);
    });

    it('应用在当前平台上应该正常运行', async () => {
      const isReady = await window.evaluate(() => {
        return document.readyState === 'complete';
      });
      expect(isReady).to.be.true;
    });

    after(async () => {
      if (electronApp) {
        await electronApp.close();
      }
    });
  });

  // 测试10：性能测试
  describe('10. 性能测试', () => {
    it('应用应该在 5 秒内启动', async () => {
      const startTime = Date.now();
      
      const app = await electron.launch({
        args: [path.join(__dirname, '..')]
      });
      
      const win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');
      
      const loadTime = Date.now() - startTime;
      
      await app.close();
      
      expect(loadTime).to.be.lessThan(5000);
    });

    it('页面 DOM 应该完全加载', async () => {
      const app = await electron.launch({
        args: [path.join(__dirname, '..')]
      });
      
      const win = await app.firstWindow();
      await win.waitForLoadState('load');
      
      const elementCount = await win.evaluate(() => {
        return document.querySelectorAll('*').length;
      });
      
      await app.close();
      
      expect(elementCount).to.be.greaterThan(5);
    });
  });
});
