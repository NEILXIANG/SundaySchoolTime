const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

describe('单元测试：文件内容验证', () => {
  
  describe('main.js 单元测试', () => {
    let mainContent;

    before(() => {
      mainContent = fs.readFileSync(
        path.join(__dirname, '../main.js'),
        'utf-8'
      );
    });

    it('应该正确导入 electron 模块', () => {
      expect(mainContent).to.match(/require\(['"]electron['"]\)/);
    });

    it('应该正确导入 path 模块', () => {
      expect(mainContent).to.match(/require\(['"]path['"]\)/);
    });

    it('createWindow 函数应该存在', () => {
      expect(mainContent).to.include('function createWindow()');
    });

    it('应该设置窗口宽度为 1000', () => {
      expect(mainContent).to.match(/width:\s*1000/);
    });

    it('应该设置窗口高度为 700', () => {
      expect(mainContent).to.match(/height:\s*700/);
    });

    it('preload 路径应该正确拼接', () => {
      expect(mainContent).to.match(/path\.join\(__dirname,\s*['"]preload\.js['"]\)/);
    });

    it('应该加载 index.html', () => {
      expect(mainContent).to.match(/loadFile\(['"]index\.html['"]\)/);
    });

    it('应该监听窗口关闭事件', () => {
      expect(mainContent).to.include("on('closed'");
    });

    it('关闭时应该将 mainWindow 设为 null', () => {
      expect(mainContent).to.include('mainWindow = null');
    });

    it('应该使用 app.whenReady()', () => {
      expect(mainContent).to.match(/app\.whenReady\(\)/);
    });

    it('应该配置 sandbox: true', () => {
      expect(mainContent).to.include('sandbox: true');
    });

    it('Windows/Linux 平台应该退出应用', () => {
      expect(mainContent).to.include('isMac');
      expect(mainContent).to.include('app.quit()');
    });
  });

  describe('preload.js 单元测试', () => {
    let preloadContent;

    before(() => {
      preloadContent = fs.readFileSync(
        path.join(__dirname, '../preload.js'),
        'utf-8'
      );
    });

    it('应该导入 contextBridge', () => {
      expect(preloadContent).to.match(/require\(['"]electron['"]\)/);
      expect(preloadContent).to.include('contextBridge');
    });

    it('应该使用 exposeInMainWorld', () => {
      expect(preloadContent).to.match(/contextBridge\.exposeInMainWorld/);
    });

    it('应该暴露 api 命名空间', () => {
      expect(preloadContent).to.match(/['"]api['"]/);
    });

    it('应该暴露 platform 属性', () => {
      expect(preloadContent).to.include('platform:');
      expect(preloadContent).to.include('process.platform');
    });

    it('不应该暴露敏感的 Node.js API', () => {
      expect(preloadContent).to.not.include('require("fs")');
      expect(preloadContent).to.not.include('require("child_process")');
      expect(preloadContent).to.not.include('require("net")');
    });
  });

  describe('index.html 单元测试', () => {
    let htmlContent;

    before(() => {
      htmlContent = fs.readFileSync(
        path.join(__dirname, '../index.html'),
        'utf-8'
      );
    });

    it('应该是有效的 HTML5 文档', () => {
      expect(htmlContent).to.include('<!DOCTYPE html>');
      expect(htmlContent).to.match(/<html.*>/);
      expect(htmlContent).to.include('</html>');
    });

    it('应该设置正确的字符编码', () => {
      expect(htmlContent).to.match(/charset=['"]UTF-8['"]/i);
    });

    it('应该设置 viewport', () => {
      expect(htmlContent).to.match(/name=['"]viewport['"]/);
    });

    it('应该包含标题', () => {
      expect(htmlContent).to.match(/<title>.*教师学生图文分发工具.*<\/title>/);
    });

    it('应该包含 "App Ready" 标题', () => {
      expect(htmlContent).to.match(/<h1>.*App Ready.*<\/h1>/);
    });

    it('应该包含平台显示元素', () => {
      expect(htmlContent).to.include('id="platform"');
      expect(htmlContent).to.include('id="platformName"');
    });

    it('应该包含 JavaScript 代码', () => {
      expect(htmlContent).to.match(/<script>[\s\S]*<\/script>/);
    });

    it('JavaScript 应该访问 window.api', () => {
      expect(htmlContent).to.include('window.api');
    });

    it('应该包含 CSS 样式', () => {
      expect(htmlContent).to.match(/<style>[\s\S]*<\/style>/);
    });

    it('应该包含 CSP meta', () => {
      expect(htmlContent).to.match(/http-equiv=['"]Content-Security-Policy['"]/i);
    });

    it('不应该引用外部框架（React/Vue等）', () => {
      expect(htmlContent).to.not.match(/react/i);
      expect(htmlContent).to.not.match(/vue/i);
      expect(htmlContent).to.not.match(/angular/i);
    });
  });

  describe('package.json 单元测试', () => {
    let pkg;

    before(() => {
      pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
    });

    it('应该有正确的 name', () => {
      expect(pkg.name).to.be.a('string');
      expect(pkg.name.length).to.be.greaterThan(0);
    });

    it('应该有 version', () => {
      expect(pkg.version).to.match(/^\d+\.\d+\.\d+$/);
    });

    it('main 应该指向 main.js', () => {
      expect(pkg.main).to.equal('main.js');
    });

    it('应该有 start 脚本', () => {
      expect(pkg.scripts).to.have.property('start');
      expect(pkg.scripts.start).to.include('electron');
    });

    it('应该包含 electron 作为开发依赖', () => {
      expect(pkg.devDependencies).to.have.property('electron');
    });

    it('electron 版本应该是有效的', () => {
      const electronVersion = pkg.devDependencies.electron;
      expect(electronVersion).to.match(/^\^?\d+\.\d+\.\d+$/);
    });
  });

  describe('代码质量检查', () => {
    it('main.js 不应该有语法错误', () => {
      expect(() => {
        const content = fs.readFileSync(
          path.join(__dirname, '../main.js'),
          'utf-8'
        );
        // 基本语法检查
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        expect(openBraces).to.equal(closeBraces);
      }).to.not.throw();
    });

    it('preload.js 不应该有语法错误', () => {
      expect(() => {
        const content = fs.readFileSync(
          path.join(__dirname, '../preload.js'),
          'utf-8'
        );
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        expect(openBraces).to.equal(closeBraces);
      }).to.not.throw();
    });

    it('index.html 应该有成对的标签', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../index.html'),
        'utf-8'
      );
      
      const htmlOpen = (content.match(/<html/g) || []).length;
      const htmlClose = (content.match(/<\/html>/g) || []).length;
      expect(htmlOpen).to.equal(htmlClose);
      
      const bodyOpen = (content.match(/<body/g) || []).length;
      const bodyClose = (content.match(/<\/body>/g) || []).length;
      expect(bodyOpen).to.equal(bodyClose);
      
      const headOpen = (content.match(/<head/g) || []).length;
      const headClose = (content.match(/<\/head>/g) || []).length;
      expect(headOpen).to.equal(headClose);
    });
  });
});
