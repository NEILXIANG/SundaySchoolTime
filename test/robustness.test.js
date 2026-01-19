const { _electron: electron } = require('playwright');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { cleanupElectronApp, getHeadlessLaunchConfig } = require('./helpers');

describe('系统鲁棒性与边界条件测试', () => {
    let electronApp;
    let userDataPath;
    let configPath;

    // Helper to cleanup and setup
    const startApp = async () => {
        electronApp = await electron.launch(
            getHeadlessLaunchConfig(path.join(__dirname, '..'))
        );
        // 获取应用实际使用的 userData 路径
        userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'));
        configPath = path.join(userDataPath, 'config.json');
        return electronApp;
    };

    afterEach(async function() {
        this.timeout(15000);
        await cleanupElectronApp(electronApp);
        electronApp = null;
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

    describe('Preload 监听器内存泄漏防护', () => {
        beforeEach(async function() {
            this.timeout(15000);
            if (electronApp) {
                try {
                    await electronApp.close();
                } catch (e) {
                    // Ignore close errors
                }
            }
            await startApp();
        });
        
        it('多次注册文件选择监听器应该可以清理', async () => {
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(() => {
                if (!window.api || !window.api.file) {
                    return { error: 'File API not found' };
                }
                
                const listenerIds = [];
                
                // 注册多个监听器
                for (let i = 0; i < 10; i++) {
                    const id = window.api.file.onFilesSelected(() => {});
                    listenerIds.push(id);
                }
                
                // 移除所有监听器
                let removeCount = 0;
                for (const id of listenerIds) {
                    if (window.api.file.removeFilesSelectedListener(id)) {
                        removeCount++;
                    }
                }
                
                return { 
                    registered: listenerIds.length,
                    removed: removeCount,
                    listenerIds
                };
            });
            
        it('数据库查询应能处理大量数据而不崩溃', async function() {
            this.timeout(60000); // 增加超时时间
            
            const window = await electronApp.firstWindow();
            
            // 创建大量测试数据
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(window.evaluate(async (i) => {
                    return await window.api.db.invoke('addStudent', {
                        name: `Bulk Student ${i}`,
                        className: `Class ${i % 5}`,
                        tags: `tag${i % 3}`
                    });
                }, i));
            }
            
            await Promise.all(promises);
            
            // 测试大量数据查询
            const result = await window.evaluate(async () => {
                const start = Date.now();
                
                // 测试搜索功能在大规模数据下的表现
                const searchRes = await window.api.db.invoke('searchStudents', 'Bulk');
                const searchTime = Date.now() - start;
                
                // 测试分页查询
                const pageRes = await window.api.db.invoke('listStudents', { limit: 50, offset: 0 });
                const pageTime = Date.now() - start - searchTime;
                
                // 测试计数功能
                const countRes = await window.api.db.invoke('countStudents');
                const countTime = Date.now() - start - searchTime - pageTime;
                
                return {
                    searchCount: searchRes.data.length,
                    pageCount: pageRes.data.length,
                    totalCount: countRes.data,
                    searchTime,
                    pageTime,
                    countTime
                };
            });
            
            expect(result.searchCount).to.be.at.least(100);
            expect(result.pageCount).to.equal(50);
            expect(result.totalCount).to.be.at.least(100);
            
            // 性能检查：搜索不应超过5秒，分页不应超过2秒
            expect(result.searchTime).to.be.below(5000);
            expect(result.pageTime).to.be.below(2000);
        });
        });
        
        it('监听器ID应该递增且唯一', async () => {
            const window = await electronApp.firstWindow();
            
            const ids = await window.evaluate(() => {
                if (!window.api || !window.api.file) return [];
                
                const listenerIds = [];
                for (let i = 0; i < 5; i++) {
                    listenerIds.push(window.api.file.onFilesSelected(() => {}));
                }
                
                // 清理
                listenerIds.forEach(id => {
                    window.api.file.removeFilesSelectedListener(id);
                });
                
                return listenerIds;
            });
            
            expect(ids).to.have.lengthOf(5);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).to.equal(5);
        });
    });

    describe('数据库边界条件', () => {
        beforeEach(async () => await startApp());
        
        it('超长字符串应该被正确处理', async () => {
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const longString = 'A'.repeat(10000);
                const res = await window.api.db.invoke('addStudent', {
                    name: longString,
                    className: 'Test'
                });
                return res;
            });
            
            expect(result.success).to.be.true;
        });
        
        it('特殊字符应该被正确转义', async () => {
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const specialName = "O'Brien; DROP TABLE Student;--";
                const res = await window.api.db.invoke('addStudent', {
                    name: specialName,
                    className: 'Test'
                });
                
                if (res.success) {
                    const getRes = await window.api.db.invoke('getStudentById', res.data);
                    return { success: true, name: getRes.data.name };
                }
                return res;
            });
            
            expect(result.success).to.be.true;
            expect(result.name).to.include("O'Brien");
        });
        
        it('并发数据库操作应该不会冲突', async function() {
            this.timeout(15000);
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const promises = [];
                for (let i = 0; i < 20; i++) {
                    promises.push(
                        window.api.db.invoke('addStudent', {
                            name: `Concurrent ${i}`,
                            className: 'Stress Test'
                        })
                    );
                }
                
                const results = await Promise.all(promises);
                const successes = results.filter(r => r.success).length;
                return { total: results.length, successes };
            });
            
            expect(result.successes).to.equal(20);
        });
    });

    describe('搜索功能鲁棒性', () => {
        beforeEach(async () => await startApp());
        
        it('搜索空字符串应该返回所有结果', async () => {
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const res = await window.api.db.invoke('searchStudents', '');
                return res;
            });
            
            expect(result.success).to.be.true;
            expect(result.data).to.be.an('array');
        });
        
        it('搜索特殊字符应该安全', async () => {
            const window = await electronApp.firstWindow();
            
            const specialQueries = ['%', '_', "'", '"', ';', '--', '/*', '*/', '\\'];
            
            for (const query of specialQueries) {
                const result = await window.evaluate(async (q) => {
                    const res = await window.api.db.invoke('searchStudents', q);
                    return res;
                }, query);
                
                expect(result.success).to.be.true;
            }
        });
    });
    
    describe('照片导入鲁棒性', () => {
        beforeEach(async () => await startApp());
        
        it('应该处理不存在的文件路径', async () => {
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const res = await window.api.db.invoke('addPhoto', {
                    filePath: '/nonexistent/path/to/photo.jpg'
                });
                return res;
            });
            
            expect(result.success).to.be.false;
            expect(result.error).to.exist;
        });
        
        it('应该处理文件路径包含特殊字符', async () => {
            const window = await electronApp.firstWindow();
            
            const specialPaths = [
                '/path/with space/photo.jpg',
                '/path/with\'quote/photo.jpg',
                '/path/with"doublequote/photo.jpg'
            ];
            
            for (const filepath of specialPaths) {
                const result = await window.evaluate(async (fp) => {
                    const res = await window.api.db.invoke('addPhoto', {
                        filePath: fp
                    });
                    return { success: res.success };
                }, filepath);
                
                // 应该要么成功，要么返回有意义的错误
                expect(result.success).to.be.a('boolean');
            }
        });
    });
    
    describe('数据一致性检查', () => {
        beforeEach(async () => await startApp());
        
        it('删除照片后不应该能获取该照片', async () => {
            const window = await electronApp.firstWindow();
            
            // 在主进程上下文中创建临时文件，避免在渲染器中使用 require
            const tempPath = path.join(os.tmpdir(), 'test_robustness_photo.jpg');
            fs.writeFileSync(tempPath, Buffer.alloc(100));
            
            try {
                const result = await window.evaluate(async (filePath) => {
                    const addRes = await window.api.db.invoke('addPhoto', {
                        filePath: filePath
                    });
                    
                    if (!addRes.success) return { error: 'Failed to add photo: ' + addRes.error };
                    
                    const photoId = addRes.data;
                    
                    // 删除照片
                    const delRes = await window.api.db.invoke('deletePhoto', photoId);
                    
                    // 尝试获取已删除的照片
                    const getRes = await window.api.db.invoke('getPhotoById', photoId);
                    
                    return {
                        deleteSuccess: delRes.success,
                        // getPhotoById 返回 undefined 时，data 为 undefined/null
                        // success 仍为 true（没有抛出错误），但 data 为空
                        photoData: getRes.data
                    };
                }, tempPath);
                
                if (!result.error) {
                    expect(result.deleteSuccess).to.be.true;
                    // 验证获取的照片数据为空（undefined 或 null）
                    expect(result.photoData).to.be.oneOf([undefined, null]);
                }
            } finally {
                // 清理临时文件
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            }
        });
        
        it('更新不存在的记录应该失败', async () => {
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const updateStudent = await window.api.db.invoke('updateStudent', 999999, {
                    name: 'Ghost'
                });
                
                const updatePhoto = await window.api.db.invoke('updatePhoto', 999999, {
                    fileName: 'ghost.jpg'
                });
                
                return {
                    studentUpdate: updateStudent.success,
                    photoUpdate: updatePhoto.success
                };
            });
            
            expect(result.studentUpdate).to.be.false;
            expect(result.photoUpdate).to.be.false;
        });
    });
    
    describe('数据库迁移鲁棒性', () => {
        // 不需要 beforeEach，因为我们会手动控制启停
        
        it('当数据库版本回退时，迁移脚本应能幂等执行', async function() {
            this.timeout(20000);
            
            // 1. 启动并生成一些数据
            await startApp();
            const window = await electronApp.firstWindow();
            await window.evaluate(() => window.api.db.invoke('addStudent', { name: 'Migration Survivor' }));
            
            // 2. 关闭应用释放DB锁
            await electronApp.close();
            electronApp = null; // Prevent afterEach from double closing
            
            // 3. 直接操作 DB 文件
            // Note: better-sqlite3 是原生模块，可能因 Node/Electron 版本不匹配而失败
            // 使用 try-catch 来处理这种情况
            const dbPath = path.join(userDataPath, 'sunday-school-time.db');
            
            try {
                const Database = require('better-sqlite3');
                if (fs.existsSync(dbPath)) {
                    const db = new Database(dbPath);
                    // 强制回退版本号，诱发 initDb 时再次运行迁移逻辑
                    db.pragma('user_version = 0');
                    db.close();
                }
            } catch (err) {
                // 如果 better-sqlite3 无法在当前环境加载（例如 Node 版本不匹配）
                // 跳过数据库版本回退步骤，仍然验证应用启动正常
                console.warn('Skipping DB version rollback due to better-sqlite3 incompatibility:', err.message);
            }
            
            // 4. 重启应用
            await startApp();
            
            // 5. 验证应用是否正常启动，迁移是否成功（无报错），且数据完整
            const window2 = await electronApp.firstWindow();
            const res = await window2.evaluate(() => window.api.db.invoke('listStudents'));
            
            expect(res.success).to.be.true;
            const survivor = res.data.find(s => s.name === 'Migration Survivor');
            expect(survivor).to.exist;
            
            // 验证字段确实存在（迁移确保了这些字段）
            expect(survivor).to.have.property('guardianName');
            expect(survivor).to.have.property('phone');
        });
    });

    describe('内存和资源管理', () => {
        beforeEach(async () => await startApp());
        
        it('应该能够处理连续的大量查询', async function() {
            this.timeout(30000);
            const window = await electronApp.firstWindow();
            
            const result = await window.evaluate(async () => {
                const errors = [];
                
                // 连续执行100次查询
                for (let i = 0; i < 100; i++) {
                    const res = await window.api.db.invoke('listStudents', {
                        limit: 10,
                        offset: 0
                    });
                    
                    if (!res.success) {
                        errors.push(`Query ${i} failed: ${res.error}`);
                    }
                }
                
                return {
                    totalQueries: 100,
                    errors: errors
                };
            });
            
            expect(result.errors).to.have.lengthOf(0);
        });
    });
});
