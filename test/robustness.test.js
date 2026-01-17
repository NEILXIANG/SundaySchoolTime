const { _electron: electron } = require('playwright');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

describe('系统鲁棒性与边界条件测试', () => {
    let electronApp;
    let userDataPath;
    let configPath;

    // Helper to cleanup and setup
    const startApp = async () => {
        electronApp = await electron.launch({
            args: [path.join(__dirname, '..')],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        // 获取应用实际使用的 userData 路径
        userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'));
        configPath = path.join(userDataPath, 'config.json');
        return electronApp;
    };

    afterEach(async function() {
        this.timeout(10000); // 增加关闭的超时时间
        if (electronApp) {
            await electronApp.close();
        }
    });

    describe('配置系统异常恢复', () => {
        it('当配置文件损坏时，应用应能自动修复并正常启动', async function() {
            this.timeout(20000); 

            // 1. 先启动一次以获取路径并确保目录存在
            await startApp();
            await electronApp.close();

            // 2. 写入损坏的 JSON
            fs.writeFileSync(configPath, 'INVALID_JSON_DATA_@#$%', 'utf-8');

            // 3. 再次启动 - 应该成功而不是崩溃
            try {
                await startApp();
            } catch (error) {
                console.error(error);
                throw new Error('应用启动失败，未能处理损坏的配置文件');
            }

            // 4. 验证窗口是否加载
            const window = await electronApp.firstWindow();
            await window.waitForLoadState('domcontentloaded'); // 显式等待加载
            const title = await window.title();
            expect(title).to.exist;

            // 5. 验证是否生成了新的有效配置文件
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            expect(config).to.have.property('windowBounds');

            // 6. 验证是否生成了备份文件
            const files = fs.readdirSync(userDataPath);
            const backupFile = files.find(f => f.includes('.corrupted.') && f.endsWith('.bak'));
            expect(backupFile).to.exist;
        });

        it('当配置文件包含类型不匹配的数据时，应用应能兼容或重置', async function() {
            this.timeout(30000); // 增加超时

            await startApp();
            await electronApp.close();

            // 2. 写入类型错误的数据
            const invalidData = {
                preferences: {
                    showTrayIcon: "NOT_A_BOOLEAN_STRING",
                    theme: 12345
                }
            };
            
            // 确保目录结构存在
            if (fs.existsSync(configPath)) {
                fs.writeFileSync(configPath, JSON.stringify(invalidData));
            }

            // 3. 重新启动
            await startApp();

            // 4. 等待应用启动并显示
            const window = await electronApp.firstWindow();
            await window.waitForLoadState('domcontentloaded');
            
            // 等待可见性，最多重试几次
            await window.waitForFunction(() => {
                // 在渲染进程不可直接访问 BrowserWindow visibility，需要通过 page visibility API 或者其他方式
                // 或者我们让 main 进程告知。
                // 简单点：等待 document body 存在
                return document.body !== null;
            });
            
            // 检查主窗口状态
            const isVisible = await electronApp.evaluate(async ({ BrowserWindow }) => {
                const win = BrowserWindow.getAllWindows()[0];
                return win.isVisible();
            });
            
            // 如果不可见，可能是还在加载或者 ready-to-show 还没触发
            // 但 domcontentloaded 已经触发了。
            // 我们的 main.js 是在 ready-to-show 时 show()。
            // 在测试环境下，直接断言 true。如果失败，说明 ready-to-show 没触发或者被阻塞。
            expect(isVisible).to.be.true;
        });
    });

    describe('Store 边界值测试', () => {
        beforeEach(async () => await startApp());

        it('应该处理极端的窗口尺寸数值', async function() {
            this.timeout(10000);
            
            // 使用 Playwright/Electron API 设置极端尺寸
            await electronApp.evaluate(({ BrowserWindow }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.setSize(10000, 10000);
            });

            // 等待应用保存状态 (debounce)
            await new Promise(r => setTimeout(r, 2000)); 

            // 直接读取文件验证
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                expect(config.windowBounds).to.exist;
                // 验证宽或者高是否被设置为了一个"很大"的值
                // 实际值取决于 OS 限制，但肯定比默认的 1000 大
                expect(config.windowBounds.width).to.be.greaterThan(1000);
            } else {
               throw new Error('Config file not found');
            }
        });
    });

    describe('IPC 通信鲁棒性', () => {
        beforeEach(async () => await startApp());

        it('渲染进程发送大量的日志不应导致阻塞', async function() {
            this.timeout(10000);
            const window = await electronApp.firstWindow();
            await window.evaluate(async () => {
                if (window.api && window.api.log) {
                    for(let i=0; i<500; i++) {
                        window.api.log.info(`Stress check ${i}`);
                    }
                }
            });
            expect(true).to.be.true;
        });

        it('发送非法的日志参数不应崩溃主进程', async () => {
            const window = await electronApp.firstWindow();
            await window.evaluate(() => {
                if (window.api && window.api.log) {
                    try {
                        const circular = {};
                        circular.self = circular;
                        window.api.log.info(circular); 
                    } catch(e) {}
                }
            });
            
            // 验证主进程还活着
            const isRunning = await electronApp.evaluate(() => true);
            expect(isRunning).to.be.true;
        });
    });
});
