const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../db');

/**
 * Direct coverage for helper exports: getDbPath, initDb, closeDb.
 * Uses a per-test temp cwd to avoid interfering with other integration tests.
 * Skips gracefully if native better-sqlite3 binding is incompatible with current Node.
 */
describe('DB Helper Coverage', function() {
  const originalCwd = process.cwd();
  let tempDir;

  before(function() {
    // Probe compatibility in an isolated temp dir to avoid polluting CWD
    const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sst-db-probe-'));
    const prevCwd = process.cwd();
    try {
      process.chdir(probeDir);
      db.closeDb();
      db.initDb();
      db.closeDb();
    } catch (err) {
      if (String(err).includes('NODE_MODULE_VERSION')) {
        this.skip();
      } else {
        throw err;
      }
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(probeDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Fresh temp directory per test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sst-db-'));
    process.chdir(tempDir);
    db.closeDb();
  });

  afterEach(() => {
    db.closeDb();
    process.chdir(originalCwd);
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('getDbPath should create data directory and return full db path', () => {
    const dbPath = db.getDbPath();
    const dataDir = path.dirname(dbPath);

    expect(fs.realpathSync(dataDir)).to.equal(fs.realpathSync(path.join(tempDir, 'data')));
    expect(path.basename(dbPath)).to.equal('sunday-school-time.db');
    expect(fs.existsSync(dataDir)).to.be.true;
  });

  it('initDb should be idempotent and enforce pragmas', () => {
    const first = db.initDb();
    const second = db.initDb();

    expect(second).to.equal(first);

    // Pragmas set for consistency and safety
    const journalMode = first.pragma('journal_mode', { simple: true });
    const foreignKeys = first.pragma('foreign_keys', { simple: true });

    expect(String(journalMode).toLowerCase()).to.equal('wal');
    expect(foreignKeys).to.equal(1);
  });

  it('closeDb should be safe to call repeatedly and allow re-init', () => {
    db.initDb();
    expect(() => db.closeDb()).to.not.throw();
    expect(() => db.closeDb()).to.not.throw();

    const reopened = db.initDb();
    expect(reopened).to.be.ok;
  });
});
