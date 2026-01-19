const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Logger Module Tests', () => {
  let logger;
  let logDir;
  
  before(() => {
    // 在测试环境中设置
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // 重置模块缓存以获取新实例
    delete require.cache[require.resolve('../logger.js')];
    logger = require('../logger.js');
  });

  describe('Logger Initialization', () => {
    it('should export required functions', () => {
      expect(logger.initLogger).to.be.a('function');
      expect(logger.getLogger).to.be.a('function');
      expect(logger.getRawLogger).to.be.a('function');
      expect(logger.getSessionId).to.be.a('function');
      expect(logger.getLogDir).to.be.a('function');
    });

    it('should generate unique session ID', () => {
      const sessionId1 = logger.getSessionId();
      expect(sessionId1).to.be.a('string');
      expect(sessionId1).to.match(/^s-/);
      
      // Session ID应该在同一实例中保持不变
      const sessionId2 = logger.getSessionId();
      expect(sessionId1).to.equal(sessionId2);
    });

    it('should return valid log directory path', () => {
      const dir = logger.getLogDir();
      expect(dir).to.be.a('string');
      expect(dir.length).to.be.greaterThan(0);
      
      // 验证路径包含应用名称
      expect(dir.toLowerCase()).to.include('sundayschooltime');
    });

    it('should initialize logger without errors', () => {
      expect(() => {
        logger.initLogger({
          processType: 'test',
          appVersion: '1.0.0-test',
          logFilePrefix: 'test'
        });
      }).to.not.throw();
    });

    it('should handle multiple initialization calls safely', () => {
      logger.initLogger({ processType: 'test1' });
      logger.initLogger({ processType: 'test2' }); // 应该被忽略
      // 不应抛出错误
    });
  });

  describe('Logger Instance Creation', () => {
    it('should create logger with default scope', () => {
      const log = logger.getLogger();
      expect(log).to.be.an('object');
      expect(log.debug).to.be.a('function');
      expect(log.info).to.be.a('function');
      expect(log.warn).to.be.a('function');
      expect(log.error).to.be.a('function');
    });

    it('should create logger with custom scope', () => {
      const log = logger.getLogger('customScope');
      expect(log).to.be.an('object');
      expect(log.debug).to.be.a('function');
      expect(log.info).to.be.a('function');
      expect(log.warn).to.be.a('function');
      expect(log.error).to.be.a('function');
    });

    it('should return frozen logger object', () => {
      const log = logger.getLogger('testScope');
      expect(Object.isFrozen(log)).to.be.true;
    });

    it('should handle null/undefined scope gracefully', () => {
      const log1 = logger.getLogger(null);
      const log2 = logger.getLogger(undefined);
      const log3 = logger.getLogger('');
      
      expect(log1).to.be.an('object');
      expect(log2).to.be.an('object');
      expect(log3).to.be.an('object');
    });
  });

  describe('Logging Functions', () => {
    let log;

    beforeEach(() => {
      log = logger.getLogger('testModule');
    });

    it('should log debug messages', () => {
      expect(() => log.debug('Test debug message')).to.not.throw();
      expect(() => log.debug('Test with meta', { key: 'value' })).to.not.throw();
    });

    it('should log info messages', () => {
      expect(() => log.info('Test info message')).to.not.throw();
      expect(() => log.info('Test with meta', { data: 123 })).to.not.throw();
    });

    it('should log warn messages', () => {
      expect(() => log.warn('Test warn message')).to.not.throw();
      expect(() => log.warn('Test with meta', { warning: true })).to.not.throw();
    });

    it('should log error messages', () => {
      expect(() => log.error('Test error message')).to.not.throw();
      expect(() => log.error('Test with error object', new Error('Test error'))).to.not.throw();
    });

    it('should handle complex objects in metadata', () => {
      const complexObj = {
        nested: { deeply: { value: 'test' } },
        array: [1, 2, 3],
        number: 42,
        boolean: true,
        nullValue: null
      };
      expect(() => log.info('Complex object', complexObj)).to.not.throw();
    });

    it('should handle circular references in metadata', () => {
      const circular = { a: 1 };
      circular.self = circular;
      expect(() => log.info('Circular reference', circular)).to.not.throw();
    });

    it('should handle Error objects correctly', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      expect(() => log.error('Error occurred', error)).to.not.throw();
    });

    it('should handle very large objects', () => {
      const largeObj = { data: 'x'.repeat(10000) };
      expect(() => log.debug('Large object', largeObj)).to.not.throw();
    });

    it('should handle undefined and null values', () => {
      expect(() => log.info('Null value', null)).to.not.throw();
      expect(() => log.info('Undefined value', undefined)).to.not.throw();
    });

    it('should handle multiple metadata arguments', () => {
      expect(() => log.info('Multiple args', { a: 1 }, { b: 2 }, { c: 3 })).to.not.throw();
    });

    it('should handle BigInt values', () => {
      const bigIntObj = { value: BigInt(9007199254740991) };
      expect(() => log.info('BigInt value', bigIntObj)).to.not.throw();
    });

    it('should handle Date objects', () => {
      const dateObj = { timestamp: new Date() };
      expect(() => log.info('Date object', dateObj)).to.not.throw();
    });

    it('should handle RegExp objects', () => {
      const regexObj = { pattern: /test/gi };
      expect(() => log.info('RegExp object', regexObj)).to.not.throw();
    });

    it('should handle Symbol values', () => {
      const symbolObj = { id: Symbol('test') };
      expect(() => log.info('Symbol value', symbolObj)).to.not.throw();
    });
  });

  describe('Raw Logger Access', () => {
    it('should return raw electron-log instance', () => {
      const rawLog = logger.getRawLogger();
      expect(rawLog).to.be.an('object');
      expect(rawLog.transports).to.exist;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string messages', () => {
      const log = logger.getLogger('test');
      expect(() => log.info('')).to.not.throw();
    });

    it('should handle very long messages', () => {
      const log = logger.getLogger('test');
      const longMessage = 'x'.repeat(10000);
      expect(() => log.info(longMessage)).to.not.throw();
    });

    it('should handle special characters in messages', () => {
      const log = logger.getLogger('test');
      const specialChars = '测试 テスト тест 🎉 \n\t\r\\/"\'';
      expect(() => log.info(specialChars)).to.not.throw();
    });

    it('should handle non-string messages', () => {
      const log = logger.getLogger('test');
      expect(() => log.info(123)).to.not.throw();
      expect(() => log.info(true)).to.not.throw();
      expect(() => log.info({ message: 'object' })).to.not.throw();
    });

    it('should handle concurrent logging', async () => {
      const log = logger.getLogger('concurrent');
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise((resolve) => {
            log.info(`Concurrent message ${i}`, { index: i });
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
    });

    it('should handle scope names with special characters', () => {
      const log1 = logger.getLogger('test-scope');
      const log2 = logger.getLogger('test_scope');
      const log3 = logger.getLogger('test.scope');
      const log4 = logger.getLogger('test:scope');
      
      expect(log1).to.be.an('object');
      expect(log2).to.be.an('object');
      expect(log3).to.be.an('object');
      expect(log4).to.be.an('object');
    });
  });

  describe('Performance', () => {
    it('should log messages efficiently', () => {
      const log = logger.getLogger('performance');
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        log.debug(`Message ${i}`, { index: i });
      }
      
      const elapsed = Date.now() - start;
      // 1000条日志应该在合理时间内完成（<2秒）
      expect(elapsed).to.be.lessThan(2000);
    });

    it('should handle rapid consecutive calls', () => {
      const log = logger.getLogger('rapid');
      expect(() => {
        for (let i = 0; i < 100; i++) {
          log.info(`Rapid ${i}`);
        }
      }).to.not.throw();
    });
  });

  describe('Session ID Uniqueness', () => {
    it('should generate different session IDs for different module loads', () => {
      const sessionId1 = logger.getSessionId();
      
      // 重新加载模块
      delete require.cache[require.resolve('../logger.js')];
      const logger2 = require('../logger.js');
      const sessionId2 = logger2.getSessionId();
      
      // 新的模块实例应该有不同的session ID
      expect(sessionId1).to.not.equal(sessionId2);
    });
  });

  describe('Error Handling', () => {
    it('should not crash on logging failures', () => {
      const log = logger.getLogger('errorTest');
      
      // 尝试记录一个会导致JSON.stringify失败的对象
      const problematic = {};
      Object.defineProperty(problematic, 'prop', {
        get() { throw new Error('Getter error'); }
      });
      
      expect(() => log.info('Problematic object', problematic)).to.not.throw();
    });

    it('should handle filesystem errors gracefully', () => {
      // 这个测试可能需要mock fs，但至少验证不会崩溃
      const log = logger.getLogger('fsTest');
      expect(() => log.info('Test message')).to.not.throw();
    });
  });

  describe('Integration with Different Environments', () => {
    it('should work in test environment', () => {
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../logger.js')];
      const testLogger = require('../logger.js');
      const log = testLogger.getLogger('test');
      
      expect(() => log.info('Test environment')).to.not.throw();
    });

    it('should work in development environment', () => {
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../logger.js')];
      const devLogger = require('../logger.js');
      const log = devLogger.getLogger('dev');
      
      expect(() => log.info('Development environment')).to.not.throw();
    });

    it('should work in production environment', () => {
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../logger.js')];
      const prodLogger = require('../logger.js');
      const log = prodLogger.getLogger('prod');
      
      expect(() => log.info('Production environment')).to.not.throw();
    });
  });
});
