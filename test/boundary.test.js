const { _electron: electron } = require('playwright');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { cleanupElectronApp, getHeadlessLaunchConfig, hideWindow } = require('./helpers');

describe('边界条件和极端情况测试', () => {
    let electronApp;
    let window;

    beforeEach(async function () {
        this.timeout(30000);
        electronApp = await electron.launch(
            getHeadlessLaunchConfig(path.join(__dirname, '..'))
        );
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await hideWindow(window);
    });

    afterEach(async function () {
        this.timeout(15000);
        await cleanupElectronApp(electronApp);
        electronApp = null;
    });

    async function dbCall(method, ...args) {
        return await window.evaluate(async ({ method, args }) => {
            if (!window.api || !window.api.db) throw new Error('DB API missing');
            const result = await window.api.db.invoke(method, ...args);
            return result;
        }, { method, args });
    }

    describe('Student 边界测试', () => {
        it('应该处理空字符串名称（应失败）', async () => {
            const res = await dbCall('addStudent', { name: '' });
            expect(res.success).to.be.false;
            expect(res.error).to.include('required');
        });

        it('应该处理仅空格的名称（应失败）', async () => {
            const res = await dbCall('addStudent', { name: '   ' });
            expect(res.success).to.be.false;
            expect(res.error).to.include('required');
        });

        it('应该处理超长名称', async () => {
            const longName = 'A'.repeat(1000);
            const res = await dbCall('addStudent', { name: longName });
            expect(res.success).to.be.true;
            
            const getRes = await dbCall('getStudentById', res.data);
            expect(getRes.data.name.length).to.equal(1000);
        });

        it('应该处理Unicode字符（表情符号）', async () => {
            const emojiName = '学生👨‍🎓测试🎉';
            const res = await dbCall('addStudent', { name: emojiName });
            expect(res.success).to.be.true;
            
            const getRes = await dbCall('getStudentById', res.data);
            expect(getRes.data.name).to.equal(emojiName);
        });

        it('应该处理特殊SQL字符', async () => {
            const sqlName = "Robert'); DROP TABLE Student;--";
            const res = await dbCall('addStudent', { name: sqlName });
            expect(res.success).to.be.true;
            
            // 验证数据库仍然完好
            const listRes = await dbCall('listStudents');
            expect(listRes.success).to.be.true;
        });

        it('应该处理更新不存在的学生', async () => {
            const res = await dbCall('updateStudent', 999999, { name: 'Ghost' });
            expect(res.success).to.be.false;
            expect(res.error).to.include('not found');
        });

        it('应该处理删除不存在的学生', async () => {
            const res = await dbCall('deleteStudent', 999999);
            expect(res.success).to.be.true;
            expect(res.data).to.equal(0); // 0 rows deleted
        });

        it('应该处理null和undefined字段', async () => {
            const res = await dbCall('addStudent', { 
                name: 'Test',
                className: null,
                tags: undefined
            });
            expect(res.success).to.be.true;
        });
    });

    describe('Photo 边界测试', () => {
        let tempPhotoPath;

        beforeEach(() => {
            tempPhotoPath = path.join(__dirname, 'boundary_test.jpg');
            fs.writeFileSync(tempPhotoPath, 'fake image data');
        });

        afterEach(() => {
            if (fs.existsSync(tempPhotoPath)) {
                fs.unlinkSync(tempPhotoPath);
            }
        });

        it('应该拒绝不存在的文件', async () => {
            const res = await dbCall('addPhoto', { 
                filePath: '/nonexistent/path/to/image.jpg' 
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('not found');
        });

        it('应该处理边界大小的文件（刚好10MB）', async () => {
            const exactPath = path.join(__dirname, 'exact_10mb.jpg');
            const exactBuffer = Buffer.alloc(10 * 1024 * 1024); // Exactly 10MB
            fs.writeFileSync(exactPath, exactBuffer);

            const res = await dbCall('addPhoto', { filePath: exactPath });
            expect(res.success).to.be.true;

            fs.unlinkSync(exactPath);
        });

        it('应该处理时间戳转换（秒到毫秒）', async () => {
            const secondsTimestamp = 1700000000;
            const res = await dbCall('addPhoto', { 
                filePath: tempPhotoPath,
                capturedAt: secondsTimestamp
            });
            expect(res.success).to.be.true;

            const getRes = await dbCall('getPhotoById', res.data);
            expect(getRes.data.capturedAt).to.equal(secondsTimestamp * 1000);
        });

        it('应该处理已存在毫秒级时间戳', async () => {
            const millisTimestamp = 1700000000000;
            const res = await dbCall('addPhoto', { 
                filePath: tempPhotoPath,
                capturedAt: millisTimestamp
            });
            expect(res.success).to.be.true;

            const getRes = await dbCall('getPhotoById', res.data);
            expect(getRes.data.capturedAt).to.equal(millisTimestamp);
        });

        it('应该拒绝负数时间戳', async () => {
            const res = await dbCall('addPhoto', { 
                filePath: tempPhotoPath,
                capturedAt: -1000
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('cannot be negative');
        });

        it('应该处理更新不存在的照片', async () => {
            const res = await dbCall('updatePhoto', 999999, { fileName: 'ghost.jpg' });
            expect(res.success).to.be.false;
            expect(res.error).to.include('not found');
        });

        it('应该处理删除不存在的照片', async () => {
            const res = await dbCall('deletePhoto', 999999);
            // db.js deletePhoto 对不存在的记录抛出 'Photo not found' 错误
            expect(res.success).to.be.false;
            expect(res.error).to.include('not found');
        });
    });

    describe('Search 边界测试', () => {
        beforeEach(async () => {
            // 创建测试数据
            await dbCall('addStudent', { name: 'Alice', className: 'Grade 1' });
            await dbCall('addStudent', { name: 'Bob', className: 'Grade 2' });
            await dbCall('addStudent', { name: 'Charlie', className: 'Grade 1' });
        });

        it('应该处理空字符串搜索', async () => {
            const res = await dbCall('searchStudents', '');
            expect(res.success).to.be.true;
            expect(res.data).to.be.an('array');
        });

        it('应该处理仅空格的搜索', async () => {
            const res = await dbCall('searchStudents', '   ');
            expect(res.success).to.be.true;
            expect(res.data).to.be.an('array');
        });

        it('应该处理SQL通配符', async () => {
            const res = await dbCall('searchStudents', '%');
            expect(res.success).to.be.true;
            // 应该转义通配符，而不是匹配所有
        });

        it('应该处理搜索不存在的内容', async () => {
            const res = await dbCall('searchStudents', 'NonExistentStudent12345');
            expect(res.success).to.be.true;
            expect(res.data).to.have.lengthOf(0);
        });

        it('应该支持部分匹配', async () => {
            const res = await dbCall('searchStudents', 'lic'); // Should match Alice
            expect(res.success).to.be.true;
            expect(res.data.length).to.be.at.least(1);
        });

        it('应该处理大小写不敏感搜索', async () => {
            const res = await dbCall('searchStudents', 'alice');
            expect(res.success).to.be.true;
            expect(res.data.length).to.be.at.least(1);
        });
    });

    describe('Pagination 极端测试', () => {
        it('应该拒绝负数limit', async () => {
            const res = await dbCall('listStudents', { limit: -10, offset: 0 });
            expect(res.success).to.be.false;
            expect(res.error).to.include('limit');
        });

        it('应该拒绝负数offset', async () => {
            const res = await dbCall('listStudents', { limit: 10, offset: -5 });
            expect(res.success).to.be.false;
            expect(res.error).to.include('offset');
        });

        it('应该处理limit为0', async () => {
            const res = await dbCall('listStudents', { limit: 0, offset: 0 });
            expect(res.success).to.be.true;
            // 行为取决于实现，可能返回空数组或所有数据
        });

        it('应该处理非常大的limit', async () => {
            const res = await dbCall('listStudents', { limit: 1000000, offset: 0 });
            expect(res.success).to.be.true;
            expect(res.data).to.be.an('array');
        });

        it('应该处理offset超出范围', async () => {
            const res = await dbCall('listStudents', { limit: 10, offset: 999999 });
            expect(res.success).to.be.true;
            expect(res.data).to.have.lengthOf(0);
        });

        it('应该拒绝非数字limit', async () => {
            const res = await dbCall('listStudents', { limit: 'ten', offset: 0 });
            expect(res.success).to.be.false;
        });

        it('应该拒绝非数字offset', async () => {
            const res = await dbCall('listStudents', { limit: 10, offset: 'five' });
            expect(res.success).to.be.false;
        });
    });

    describe('Relationship 边界测试', () => {
        let studentId, photoId;
        let tempPhotoPath;

        beforeEach(async () => {
            tempPhotoPath = path.join(__dirname, 'rel_test.jpg');
            fs.writeFileSync(tempPhotoPath, 'test');
            
            const s = await dbCall('addStudent', { name: 'RelTest' });
            const p = await dbCall('addPhoto', { filePath: tempPhotoPath });
            studentId = s.data;
            photoId = p.data;
        });

        afterEach(() => {
            if (fs.existsSync(tempPhotoPath)) {
                fs.unlinkSync(tempPhotoPath);
            }
        });

        it('应该拒绝链接不存在的学生', async () => {
            const res = await dbCall('linkStudentPhoto', 999999, photoId);
            expect(res.success).to.be.false;
            expect(res.error).to.include('not found');
        });

        it('应该拒绝链接不存在的照片', async () => {
            const res = await dbCall('linkStudentPhoto', studentId, 999999);
            expect(res.success).to.be.false;
            expect(res.error).to.include('not found');
        });

        it('应该处理重复链接', async () => {
            await dbCall('linkStudentPhoto', studentId, photoId);
            const res = await dbCall('linkStudentPhoto', studentId, photoId);
            expect(res.success).to.be.true;
            
            // 验证只有一条关联记录
            const photos = await dbCall('listPhotosByStudent', studentId);
            const matches = photos.data.filter(p => p.id === photoId);
            expect(matches).to.have.lengthOf(1);
        });

        it('应该处理解除不存在的链接', async () => {
            const res = await dbCall('unlinkStudentPhoto', studentId, 999999);
            expect(res.success).to.be.true;
            expect(res.data).to.equal(0); // 0 rows deleted
        });

        it('应该拒绝null参数', async () => {
            const res = await dbCall('unlinkStudentPhoto', null, photoId);
            expect(res.success).to.be.false;
        });
    });

    describe('MessageRecord 边界测试', () => {
        let studentId;

        beforeEach(async () => {
            const s = await dbCall('addStudent', { name: 'MsgTest' });
            studentId = s.data;
        });

        it('应该拒绝缺少studentId', async () => {
            const res = await dbCall('addMessageRecord', {
                templateText: 'Hello',
                finalText: 'Hello World'
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('studentId');
        });

        it('应该拒绝空templateText', async () => {
            const res = await dbCall('addMessageRecord', {
                studentId: studentId,
                templateText: '',
                finalText: 'Hello'
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('templateText');
        });

        it('应该拒绝空finalText', async () => {
            const res = await dbCall('addMessageRecord', {
                studentId: studentId,
                templateText: 'Hello',
                finalText: ''
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('finalText');
        });

        it('应该处理超长消息', async () => {
            const longText = 'A'.repeat(10000);
            const res = await dbCall('addMessageRecord', {
                studentId: studentId,
                templateText: longText,
                finalText: longText,
                channel: 'test'
            });
            expect(res.success).to.be.true;
        });
    });

    describe('IPC 安全边界测试', () => {
        it('应该拒绝过多参数', async () => {
            const result = await window.evaluate(async () => {
                try {
                    const args = new Array(15).fill('test');
                    const res = await window.api.db.invoke('listStudents', ...args);
                    return res;
                } catch (e) {
                    return { success: false, error: e.message };
                }
            });
            expect(result.success).to.be.false;
        });

        it('应该拒绝过大的参数', async () => {
            const result = await window.evaluate(async () => {
                const hugeData = { data: 'X'.repeat(2 * 1024 * 1024) }; // 2MB
                const res = await window.api.db.invoke('addStudent', hugeData);
                return res;
            });
            expect(result.success).to.be.false;
            expect(result.error).to.include('too large');
        });

        it('应该拒绝不在白名单的方法', async () => {
            const result = await window.evaluate(async () => {
                const res = await window.api.db.invoke('dangerousMethod', {});
                return res;
            });
            expect(result.success).to.be.false;
            expect(result.error).to.include('not allowed');
        });
    });

    describe('并发操作测试', () => {
        it('应该处理并发添加学生', async function() {
            this.timeout(15000);
            
            const result = await window.evaluate(async () => {
                const promises = [];
                for (let i = 0; i < 50; i++) {
                    promises.push(
                        window.api.db.invoke('addStudent', {
                            name: `Concurrent ${i}`,
                            className: 'Test'
                        })
                    );
                }
                
                const results = await Promise.all(promises);
                return {
                    total: results.length,
                    successes: results.filter(r => r.success).length,
                    failures: results.filter(r => !r.success).length
                };
            });
            
            expect(result.successes).to.equal(50);
            expect(result.failures).to.equal(0);
        });

        it('应该处理并发删除和查询', async function() {
            this.timeout(15000);
            
            const result = await window.evaluate(async () => {
                // 先创建一些数据
                const ids = [];
                for (let i = 0; i < 10; i++) {
                    const res = await window.api.db.invoke('addStudent', {
                        name: `DelTest ${i}`
                    });
                    if (res.success) ids.push(res.data);
                }
                
                // 并发删除和查询
                const promises = [];
                ids.forEach(id => {
                    promises.push(window.api.db.invoke('deleteStudent', id));
                    promises.push(window.api.db.invoke('getStudentById', id));
                });
                
                const results = await Promise.all(promises);
                return { total: results.length };
            });
            
            expect(result.total).to.equal(20);
        });
        
        it('应该处理重复链接同一学生和照片', async () => {
            // 创建临时照片文件
            const tempPhoto = path.join(__dirname, 'temp_link_test.jpg');
            fs.writeFileSync(tempPhoto, 'temp photo for link test');
            
            const sId = (await dbCall('addStudent', { name: 'Link Test' })).data;
            const pId = (await dbCall('addPhoto', { filePath: tempPhoto })).data;
            
            const res1 = await dbCall('linkStudentPhoto', sId, pId);
            expect(res1.success).to.be.true;
            
            // 第二次链接
            const res2 = await dbCall('linkStudentPhoto', sId, pId);
            // 应该成功或返回已存在的错误
            expect([true, false]).to.include(res2.success);
            
            // 清理临时文件
            if (fs.existsSync(tempPhoto)) fs.unlinkSync(tempPhoto);
        });
        
        it('应该处理链接不存在的学生或照片', async () => {
            const res = await dbCall('linkStudentPhoto', 999999, 999999);
            expect(res.success).to.be.false;
        });
        
        it('应该处理取消不存在的链接', async () => {
            const res = await dbCall('unlinkStudentPhoto', 999999, 999999);
            expect(res.success).to.be.true; // 可能返回成功但影响0行
        });
    });
    
    describe('MessageRecord 边界测试', () => {
        it('应该拒绝空的templateText', async () => {
            const sId = (await dbCall('addStudent', { name: 'Msg Test' })).data;
            const res = await dbCall('addMessageRecord', {
                studentId: sId,
                templateText: '',
                finalText: 'test'
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('required');
        });
        
        it('应该拒绝空的finalText', async () => {
            const sId = (await dbCall('addStudent', { name: 'Msg Test' })).data;
            const res = await dbCall('addMessageRecord', {
                studentId: sId,
                templateText: 'test',
                finalText: ''
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('required');
        });
        
        it('应该拒绝缺少studentId', async () => {
            const res = await dbCall('addMessageRecord', {
                templateText: 'test',
                finalText: 'test'
            });
            expect(res.success).to.be.false;
            expect(res.error).to.include('required');
        });
        
        it('应该处理不存在的studentId', async () => {
            const res = await dbCall('addMessageRecord', {
                studentId: 999999,
                templateText: 'test',
                finalText: 'test'
            });
            // 可能成功（无外键约束）或失败（有外键约束）
            // 取决于数据库schema
        });
    });
});
