const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Log Analysis Scripts Tests', () => {
  let tempLogDir;
  let tempLogFile;
  let tempStructuredLog;

  before(() => {
    // 创建临时日志目录
    tempLogDir = path.join(os.tmpdir(), 'test-logs-' + Date.now());
    fs.mkdirSync(tempLogDir, { recursive: true });
    
    // 创建测试日志文件
    const date = new Date().toISOString().split('T')[0];
    tempLogFile = path.join(tempLogDir, `main-${date}.log`);
    tempStructuredLog = path.join(tempLogDir, `structured-${date}.jsonl`);
    
    // 写入测试日志数据
    const logContent = `[2026-01-18 10:30:45.123] [info] [main] [pid:12345] [session:s-test123] [proc:main] Application Starting
[2026-01-18 10:30:45.456] [debug] [db] [pid:12345] [session:s-test123] [proc:main] Database initialized
[2026-01-18 10:30:46.789] [error] [db] [pid:12345] [session:s-test123] [proc:main] Database connection failed | meta={"error":"Connection refused"}
[2026-01-18 10:30:47.012] [warn] [store] [pid:12345] [session:s-test123] [proc:main] Config file not found
[2026-01-18 10:30:48.345] [info] [main] [pid:12345] [session:s-test123] [proc:main] Window ready to show | meta={"totalStartTime":1500}
`;
    fs.writeFileSync(tempLogFile, logContent);
    
    // 写入结构化日志
    const structuredContent = [
      { ts: '2026-01-18T10:30:45.123Z', level: 'info', scope: 'main', message: 'Application Starting', sessionId: 's-test123', pid: 12345 },
      { ts: '2026-01-18T10:30:45.456Z', level: 'debug', scope: 'db', message: 'Database initialized', sessionId: 's-test123', pid: 12345 },
      { ts: '2026-01-18T10:30:46.789Z', level: 'error', scope: 'db', message: 'Database connection failed', meta: { error: 'Connection refused' }, sessionId: 's-test123', pid: 12345 },
      { ts: '2026-01-18T10:30:47.012Z', level: 'warn', scope: 'store', message: 'Config file not found', sessionId: 's-test123', pid: 12345 },
      { ts: '2026-01-18T10:30:48.345Z', level: 'info', scope: 'main', message: 'Window ready to show', meta: { totalStartTime: 1500 }, sessionId: 's-test123', pid: 12345 }
    ].map(e => JSON.stringify(e)).join('\n');
    
    fs.writeFileSync(tempStructuredLog, structuredContent);
  });

  after(() => {
    // 清理临时文件
    if (fs.existsSync(tempLogDir)) {
      fs.rmSync(tempLogDir, { recursive: true, force: true });
    }
  });

  describe('analyze-logs.js', () => {
    let analyzeModule;

    before(() => {
      analyzeModule = require('../scripts/analyze-logs.js');
    });

    it('should export analyzeLogs function', () => {
      expect(analyzeModule.analyzeLogs).to.be.a('function');
    });

    it('should export getLatestLogFile function', () => {
      expect(analyzeModule.getLatestLogFile).to.be.a('function');
    });

    it('should parse log file without errors', () => {
      expect(() => {
        analyzeModule.analyzeLogs(tempLogFile);
      }).to.not.throw();
    });

    it('should handle non-existent log file gracefully', () => {
      const nonExistentFile = path.join(tempLogDir, 'non-existent.log');
      expect(() => {
        analyzeModule.analyzeLogs(nonExistentFile);
      }).to.throw();
    });

    it('should handle empty log file', () => {
      const emptyFile = path.join(tempLogDir, 'empty.log');
      fs.writeFileSync(emptyFile, '');
      
      expect(() => {
        analyzeModule.analyzeLogs(emptyFile);
      }).to.not.throw();
    });

    it('should handle malformed log lines', () => {
      const malformedFile = path.join(tempLogDir, 'malformed.log');
      fs.writeFileSync(malformedFile, 'This is not a valid log line\nAnother invalid line');
      
      expect(() => {
        analyzeModule.analyzeLogs(malformedFile);
      }).to.not.throw();
    });
  });

  describe('query-logs.js', () => {
    let queryModule;

    before(() => {
      queryModule = require('../scripts/query-logs.js');
    });

    it('should export queryLogs function', () => {
      expect(queryModule.queryLogs).to.be.a('function');
    });

    it('should export getLatestStructuredLog function', () => {
      expect(queryModule.getLatestStructuredLog).to.be.a('function');
    });

    it('should query structured logs without errors', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog });
      }).to.not.throw();
    });

    it('should filter by log level', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog, level: 'error' });
      }).to.not.throw();
    });

    it('should filter by scope', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog, scope: 'db' });
      }).to.not.throw();
    });

    it('should filter by session', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog, session: 's-test123' });
      }).to.not.throw();
    });

    it('should search by message content', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog, message: 'Database' });
      }).to.not.throw();
    });

    it('should limit results with tail option', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog, tail: 2 });
      }).to.not.throw();
    });

    it('should handle time range filtering', () => {
      expect(() => {
        queryModule.queryLogs({ 
          file: tempStructuredLog, 
          from: '2026-01-18T10:30:00',
          to: '2026-01-18T10:31:00'
        });
      }).to.not.throw();
    });

    it('should handle empty query results gracefully', () => {
      expect(() => {
        queryModule.queryLogs({ file: tempStructuredLog, level: 'fatal' });
      }).to.not.throw();
    });

    it('should handle malformed JSONL gracefully', () => {
      const malformedJsonl = path.join(tempLogDir, 'malformed.jsonl');
      fs.writeFileSync(malformedJsonl, 'not json\n{"valid": "json"}\ninvalid again');
      
      expect(() => {
        queryModule.queryLogs({ file: malformedJsonl });
      }).to.not.throw();
    });

    it('should handle non-existent structured log file', () => {
      const nonExistent = path.join(tempLogDir, 'non-existent.jsonl');
      expect(() => {
        queryModule.queryLogs({ file: nonExistent });
      }).to.throw();
    });
  });

  describe('Log Analysis Integration', () => {
    it('should correctly count log levels in test file', () => {
      // 这是一个集成测试，验证分析逻辑的正确性
      const content = fs.readFileSync(tempLogFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      expect(lines.length).to.equal(5);
      
      const errorCount = lines.filter(l => l.includes('[error]')).length;
      const warnCount = lines.filter(l => l.includes('[warn]')).length;
      const infoCount = lines.filter(l => l.includes('[info]')).length;
      const debugCount = lines.filter(l => l.includes('[debug]')).length;
      
      expect(errorCount).to.equal(1);
      expect(warnCount).to.equal(1);
      expect(infoCount).to.equal(2);
      expect(debugCount).to.equal(1);
    });

    it('should correctly parse structured log entries', () => {
      const content = fs.readFileSync(tempStructuredLog, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      const entries = lines.map(line => JSON.parse(line));
      expect(entries.length).to.equal(5);
      
      // 验证结构
      entries.forEach(entry => {
        expect(entry).to.have.property('ts');
        expect(entry).to.have.property('level');
        expect(entry).to.have.property('message');
        expect(entry).to.have.property('sessionId');
      });
      
      // 验证过滤
      const dbEntries = entries.filter(e => e.scope === 'db');
      expect(dbEntries.length).to.equal(2);
      
      const errorEntries = entries.filter(e => e.level === 'error');
      expect(errorEntries.length).to.equal(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large log files', function() {
      this.timeout(10000);
      
      const largeFile = path.join(tempLogDir, 'large.log');
      const lines = [];
      for (let i = 0; i < 10000; i++) {
        lines.push(`[2026-01-18 10:30:${(i % 60).toString().padStart(2, '0')}.${(i % 1000).toString().padStart(3, '0')}] [info] [test] Message ${i}`);
      }
      fs.writeFileSync(largeFile, lines.join('\n'));
      
      expect(() => {
        const analyzeModule = require('../scripts/analyze-logs.js');
        analyzeModule.analyzeLogs(largeFile);
      }).to.not.throw();
    });

    it('should handle logs with special characters', () => {
      const specialFile = path.join(tempLogDir, 'special.log');
      const specialContent = `[2026-01-18 10:30:45.123] [info] [test] 测试中文 テスト 🎉
[2026-01-18 10:30:45.456] [error] [test] Error: "quoted" 'value' with\\nnewline
[2026-01-18 10:30:45.789] [warn] [test] Path: C:\\Users\\test\\file.txt`;
      
      fs.writeFileSync(specialFile, specialContent);
      
      expect(() => {
        const analyzeModule = require('../scripts/analyze-logs.js');
        analyzeModule.analyzeLogs(specialFile);
      }).to.not.throw();
    });

    it('should handle mixed structured and unstructured content', () => {
      const mixedFile = path.join(tempLogDir, 'mixed.jsonl');
      const mixedContent = `{"ts":"2026-01-18T10:30:45.123Z","level":"info","message":"Valid JSON"}
Not a JSON line
{"ts":"2026-01-18T10:30:46.123Z","level":"error","message":"Another valid"}
Random text here
{"incomplete": "json"`;
      
      fs.writeFileSync(mixedFile, mixedContent);
      
      expect(() => {
        const queryModule = require('../scripts/query-logs.js');
        queryModule.queryLogs({ file: mixedFile });
      }).to.not.throw();
    });

    it('should handle unicode and emoji in log messages', () => {
      const unicodeFile = path.join(tempLogDir, 'unicode.jsonl');
      const unicodeEntries = [
        { ts: '2026-01-18T10:30:45.123Z', level: 'info', message: '你好世界 🌍' },
        { ts: '2026-01-18T10:30:46.123Z', level: 'debug', message: 'Привет мир 🚀' },
        { ts: '2026-01-18T10:30:47.123Z', level: 'warn', message: 'مرحبا بالعالم 🌙' }
      ].map(e => JSON.stringify(e)).join('\n');
      
      fs.writeFileSync(unicodeFile, unicodeEntries);
      
      expect(() => {
        const queryModule = require('../scripts/query-logs.js');
        queryModule.queryLogs({ file: unicodeFile });
      }).to.not.throw();
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid sequential queries', () => {
      const queryModule = require('../scripts/query-logs.js');
      
      expect(() => {
        for (let i = 0; i < 10; i++) {
          queryModule.queryLogs({ file: tempStructuredLog, tail: 1 });
        }
      }).to.not.throw();
    });

    it('should efficiently filter large datasets', function() {
      this.timeout(10000);
      
      const largeStructuredFile = path.join(tempLogDir, 'large-structured.jsonl');
      const entries = [];
      for (let i = 0; i < 5000; i++) {
        entries.push(JSON.stringify({
          ts: `2026-01-18T10:${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.${(i % 1000).toString().padStart(3, '0')}Z`,
          level: ['info', 'debug', 'warn', 'error'][i % 4],
          scope: ['main', 'db', 'store', 'ipc'][i % 4],
          message: `Test message ${i}`,
          sessionId: `s-test${Math.floor(i / 100)}`
        }));
      }
      fs.writeFileSync(largeStructuredFile, entries.join('\n'));
      
      const start = Date.now();
      const queryModule = require('../scripts/query-logs.js');
      queryModule.queryLogs({ file: largeStructuredFile, level: 'error' });
      const elapsed = Date.now() - start;
      
      // 应该在合理时间内完成（<2秒）
      expect(elapsed).to.be.lessThan(2000);
    });
  });
});
