const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const Database = require('better-sqlite3');

let db;

// 统一时间戳为毫秒。如果传入秒级时间戳（常见于外部接口），自动转换为毫秒。
function normalizeMillis(value, fieldName) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`${fieldName || 'timestamp'} must be a valid number`);
  }
  if (value < 0) {
    throw new Error(`${fieldName || 'timestamp'} cannot be negative`);
  }
  const v = value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  return v;
}

function getUserDataPath() {
  try {
    // Electron 主进程环境
    const { app } = require('electron');
    return app.getPath('userData');
  } catch (error) {
    // 非 Electron 环境（例如脚本或测试）
    return path.join(process.cwd(), 'data');
  }
}

function getDbPath() {
  const userDataPath = getUserDataPath();
  fs.mkdirSync(userDataPath, { recursive: true });
  return path.join(userDataPath, 'sunday-school-time.db');
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function initDb() {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);

  // 更好的一致性与性能
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // 建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS Student (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      className TEXT,
      tags TEXT,
      guardianName TEXT,
      phone TEXT,
      wechat TEXT,
      whatsapp TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Photo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filePath TEXT NOT NULL UNIQUE,
      fileName TEXT,
      capturedAt INTEGER,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS StudentPhoto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      photoId INTEGER NOT NULL,
      linkedAt INTEGER NOT NULL,
      UNIQUE(studentId, photoId),
      FOREIGN KEY(studentId) REFERENCES Student(id) ON DELETE CASCADE,
      FOREIGN KEY(photoId) REFERENCES Photo(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS MessageRecord (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      templateText TEXT NOT NULL,
      personalizedText TEXT,
      finalText TEXT NOT NULL,
      channel TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(studentId) REFERENCES Student(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_student_name ON Student(name);
    CREATE INDEX IF NOT EXISTS idx_photo_capturedAt ON Photo(capturedAt);
    CREATE INDEX IF NOT EXISTS idx_studentphoto_studentId ON StudentPhoto(studentId);
    CREATE INDEX IF NOT EXISTS idx_studentphoto_photoId ON StudentPhoto(photoId);
    CREATE INDEX IF NOT EXISTS idx_message_studentId ON MessageRecord(studentId);
    CREATE INDEX IF NOT EXISTS idx_message_createdAt ON MessageRecord(createdAt);
  `);

  // 数据库版本管理和迁移系统
  try {
    const currentVersion = db.pragma('user_version', { simple: true });
    const targetVersion = 1; // 当前目标版本
    
    if (currentVersion < targetVersion) {
      // 执行迁移
      runMigrations(db, currentVersion, targetVersion);
    }
  } catch (err) {
    log.error('Database migration failed:', err);
    // 不抛出错误，以免阻断应用启动
  }

  return db;
}

// 数据库迁移执行函数
function runMigrations(db, fromVersion, toVersion) {
  const migrations = {
    0: () => {
      // 版本0到版本1：添加联系人字段
      const tableInfo = db.pragma('table_info(Student)');
      const hasGuardian = tableInfo.some(col => col.name === 'guardianName');
      
      if (!hasGuardian) {
        db.prepare('ALTER TABLE Student ADD COLUMN guardianName TEXT').run();
        db.prepare('ALTER TABLE Student ADD COLUMN phone TEXT').run();
        db.prepare('ALTER TABLE Student ADD COLUMN wechat TEXT').run();
        db.prepare('ALTER TABLE Student ADD COLUMN whatsapp TEXT').run();
      }
      db.pragma('user_version = 1');
    }
    // 未来的迁移可以在这里添加
    // 1: () => { ... db.pragma('user_version = 2'); }
  };

  for (let v = fromVersion; v < toVersion; v++) {
    if (migrations[v]) {
      migrations[v]();
    }
  }
}

// Student CRUD
function addStudent({ name, className = '', tags = '', guardianName = '', phone = '', wechat = '', whatsapp = '' }) {
  if (!name || !name.trim()) {
    throw new Error('Student name is required');
  }
  const stmt = initDb().prepare(
    'INSERT INTO Student (name, className, tags, guardianName, phone, wechat, whatsapp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(name.trim(), className, tags, guardianName, phone, wechat, whatsapp, Date.now());
  return info.lastInsertRowid;
}

function listStudents({ limit = null, offset = 0 } = {}) {
  let query = 'SELECT * FROM Student ORDER BY createdAt DESC';
  const params = [];
  
  if (limit !== null && limit > 0) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }
  
  return initDb().prepare(query).all(...params);
}

function countStudents() {
  return initDb().prepare('SELECT COUNT(*) as count FROM Student').get().count;
}

function searchStudents(query, { limit = null, offset = 0 } = {}) {
  if (!query || !query.trim()) {
    return listStudents({ limit, offset });
  }
  
  const searchTerm = `%${query.trim()}%`;
  let sql = `SELECT * FROM Student WHERE 
    name LIKE ? OR 
    className LIKE ? OR 
    tags LIKE ? OR
    guardianName LIKE ? OR
    phone LIKE ? OR
    wechat LIKE ? OR
    whatsapp LIKE ?
    ORDER BY createdAt DESC`;
  const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
  
  if (limit !== null && limit > 0) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }
  
  return initDb().prepare(sql).all(...params);
}

function getStudentById(id) {
  return initDb().prepare('SELECT * FROM Student WHERE id = ?').get(id);
}

function updateStudent(id, { name, className, tags, guardianName, phone, wechat, whatsapp }) {
  const current = getStudentById(id);
  if (!current) {
    throw new Error('Student not found');
  }

  const nextName = name !== undefined ? name : current.name;
  if (!nextName || !nextName.trim()) {
    throw new Error('Student name is required');
  }

  const stmt = initDb().prepare(
    'UPDATE Student SET name = ?, className = ?, tags = ?, guardianName = ?, phone = ?, wechat = ?, whatsapp = ? WHERE id = ?'
  );

  return stmt.run(
    nextName.trim(),
    className !== undefined ? className : current.className,
    tags !== undefined ? tags : current.tags,
    guardianName !== undefined ? guardianName : current.guardianName,
    phone !== undefined ? phone : current.phone,
    wechat !== undefined ? wechat : current.wechat,
    whatsapp !== undefined ? whatsapp : current.whatsapp,
    id
  ).changes;
}

function deleteStudent(id) {
  return initDb().prepare('DELETE FROM Student WHERE id = ?').run(id).changes;
}

// Photo CRUD
function addPhoto({ filePath, fileName = '', capturedAt = null }) {
  const db = initDb();
  
  // 1. 本地化存储逻辑
  // 确保存储目录存在
  const photosDir = path.join(getUserDataPath(), 'photos');
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Source photo file not found');
  }

  // 校验文件类型（通过扩展名）
  const ext = path.extname(filePath).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`);
  }

  // 校验 MIME 类型（更严格的检查）
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  try {
    const { lookup } = require('mime-types');
    const mimeType = lookup(filePath);
    if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Invalid MIME type. Detected: ${mimeType || 'unknown'}`);
    }
  } catch (error) {
    log.warn('MIME type check failed, falling back to extension check:', error.message);
  }

  // 校验文件大小（最大10MB）
  const stats = fs.statSync(filePath);
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (stats.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }

  let finalPath = filePath;
  // 如果文件不在 photos 目录下，则复制进去
  if (!filePath.startsWith(photosDir)) {
    const ext = path.extname(filePath);
    // 生成唯一文件名，添加随机后缀防止同一毫秒内导入多个同名文件时碰撞
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const baseName = path.basename(filePath, ext);
    const newFileName = `${Date.now()}_${randomSuffix}_${baseName}${ext}`;
    const newPath = path.join(photosDir, newFileName);
    
    try {
      fs.copyFileSync(filePath, newPath);
      finalPath = newPath;
      // 如果没有传入 fileName，使用原始文件名
      if (!fileName) {
        fileName = path.basename(filePath);
      }
    } catch (err) {
      log.error('Failed to copy photo file:', err);
      // 为了数据完整性，这里抛出错误更安全
      throw new Error(`Failed to import photo: ${err.message}`);
    }
  }

  // 2. 数据库插入逻辑 (使用 finalPath)
  // 先检查是否已存在 (检查 finalPath，防止重复导入同一个已本地化的文件)
  const existing = db.prepare('SELECT id FROM Photo WHERE filePath = ?').get(finalPath);
  if (existing) {
    return existing.id;
  }
  
  const normalizedCapturedAt = normalizeMillis(capturedAt, 'capturedAt');

  const stmt = db.prepare(
    'INSERT INTO Photo (filePath, fileName, capturedAt, createdAt) VALUES (?, ?, ?, ?)'
  );
  const info = stmt.run(finalPath, fileName, normalizedCapturedAt, Date.now());
  return info.lastInsertRowid;
}

function listPhotos({ limit = null, offset = 0 } = {}) {
  let query = 'SELECT * FROM Photo ORDER BY createdAt DESC';
  const params = [];
  
  if (limit !== null && limit > 0) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }
  
  const photos = initDb().prepare(query).all(...params);
  return photos.map(photo => {
    if (photo.capturedAt !== null) {
      photo.capturedAt = normalizeMillis(photo.capturedAt, 'capturedAt');
    }
    return photo;
  });
}

function countPhotos() {
  return initDb().prepare('SELECT COUNT(*) as count FROM Photo').get().count;
}

function searchPhotos(query, { limit = null, offset = 0 } = {}) {
  if (!query || !query.trim()) {
    return listPhotos({ limit, offset });
  }
  
  const searchTerm = `%${query.trim()}%`;
  let sql = `SELECT * FROM Photo WHERE 
    fileName LIKE ? OR 
    filePath LIKE ?
    ORDER BY createdAt DESC`;
  const params = [searchTerm, searchTerm];
  
  if (limit !== null && limit > 0) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }
  
  const photos = initDb().prepare(sql).all(...params);
  return photos.map(photo => {
    if (photo.capturedAt !== null) {
      photo.capturedAt = normalizeMillis(photo.capturedAt, 'capturedAt');
    }
    return photo;
  });
}

function getPhotoById(id) {
  const photo = initDb().prepare('SELECT * FROM Photo WHERE id = ?').get(id);
  if (photo && photo.capturedAt !== null) {
    photo.capturedAt = normalizeMillis(photo.capturedAt, 'capturedAt');
  }
  return photo;
}

function deletePhoto(id) {
  const photo = getPhotoById(id);
  if (!photo) {
    throw new Error('Photo not found');
  }
  
  const changes = initDb().prepare('DELETE FROM Photo WHERE id = ?').run(id).changes;
  
  // 删除物理文件（如果存在）
  if (photo.filePath && fs.existsSync(photo.filePath)) {
    try {
      fs.unlinkSync(photo.filePath);
    } catch (err) {
      // 记录错误但不阻断删除操作
      log.warn('Failed to delete photo file:', photo.filePath, err);
    }
  }
  
  return changes;
}

function updatePhoto(id, { fileName, capturedAt }) {
  const current = getPhotoById(id);
  if (!current) {
    throw new Error('Photo not found');
  }
  
  const normalizedCapturedAt = normalizeMillis(capturedAt, 'capturedAt');
  const stmt = initDb().prepare(
    'UPDATE Photo SET fileName = ?, capturedAt = ? WHERE id = ?'
  );
  
  return stmt.run(
    fileName !== undefined ? fileName : current.fileName,
    normalizedCapturedAt !== null && normalizedCapturedAt !== undefined ? normalizedCapturedAt : current.capturedAt,
    id
  ).changes;
}

// StudentPhoto 关联
function linkStudentPhoto(studentId, photoId) {
  // 校验外键存在性
  if (!getStudentById(studentId)) {
    throw new Error('Student not found');
  }
  if (!getPhotoById(photoId)) {
    throw new Error('Photo not found');
  }
  
  const stmt = initDb().prepare(
    'INSERT OR IGNORE INTO StudentPhoto (studentId, photoId, linkedAt) VALUES (?, ?, ?)'
  );
  return stmt.run(studentId, photoId, Date.now()).changes;
}

function unlinkStudentPhoto(studentId, photoId) {
  if (studentId === null || studentId === undefined || photoId === null || photoId === undefined) {
    throw new Error('studentId and photoId are required');
  }
  
  const stmt = initDb().prepare(
    'DELETE FROM StudentPhoto WHERE studentId = ? AND photoId = ?'
  );
  return stmt.run(studentId, photoId).changes;
}

function listPhotosByStudent(studentId) {
  const stmt = initDb().prepare(`
    SELECT Photo.* FROM Photo
    JOIN StudentPhoto ON StudentPhoto.photoId = Photo.id
    WHERE StudentPhoto.studentId = ?
    ORDER BY StudentPhoto.linkedAt DESC
  `);
  const photos = stmt.all(studentId);
  return photos.map(photo => {
    if (photo.capturedAt !== null) {
      photo.capturedAt = normalizeMillis(photo.capturedAt, 'capturedAt');
    }
    return photo;
  });
}

function listStudentsByPhoto(photoId) {
  const stmt = initDb().prepare(`
    SELECT Student.* FROM Student
    JOIN StudentPhoto ON StudentPhoto.studentId = Student.id
    WHERE StudentPhoto.photoId = ?
    ORDER BY StudentPhoto.linkedAt DESC
  `);
  return stmt.all(photoId);
}

// MessageRecord
function addMessageRecord({ studentId, templateText, personalizedText = '', finalText, channel = '' }) {
  if (studentId === null || studentId === undefined) {
    throw new Error('studentId is required');
  }
  if (!templateText || !templateText.trim()) {
    throw new Error('templateText is required');
  }
  if (!finalText || !finalText.trim()) {
    throw new Error('finalText is required');
  }

  const stmt = initDb().prepare(
    'INSERT INTO MessageRecord (studentId, templateText, personalizedText, finalText, channel, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(
    studentId,
    templateText,
    personalizedText,
    finalText,
    channel,
    Date.now()
  );
  return info.lastInsertRowid;
}

function getMessageRecordById(id) {
  return initDb().prepare('SELECT * FROM MessageRecord WHERE id = ?').get(id);
}

function listMessageRecords({ studentId = null, from = null, to = null } = {}) {
  let query = 'SELECT * FROM MessageRecord WHERE 1=1';
  const params = [];

  if (studentId !== null && studentId !== undefined) {
    query += ' AND studentId = ?';
    params.push(studentId);
  }
  if (from !== null && from !== undefined) {
    query += ' AND createdAt >= ?';
    params.push(from);
  }
  if (to !== null && to !== undefined) {
    query += ' AND createdAt <= ?';
    params.push(to);
  }

  query += ' ORDER BY createdAt DESC';
  return initDb().prepare(query).all(...params);
}

function backupDatabase() {
  const db = initDb();
  const dbPath = getDbPath();
  const backupDir = path.join(getUserDataPath(), 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
  
  try {
    // 确保 WAL 日志被刷入主数据库文件后再复制
    db.pragma('wal_checkpoint(FULL)');
    fs.copyFileSync(dbPath, backupPath);
    log.info('Database backup created:', backupPath);
    
    // 清理旧备份，保留最近5个
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        mtime: fs.statSync(path.join(backupDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (backups.length > 5) {
      backups.slice(5).forEach(backup => {
        fs.unlinkSync(backup.path);
        log.info('Old backup removed:', backup.name);
      });
    }
    
    return backupPath;
  } catch (error) {
    log.error('Database backup failed:', error);
    throw error;
  }
}

module.exports = {
  initDb,
  closeDb,
  getDbPath,
  backupDatabase,
  addStudent,
  listStudents,
  countStudents,
  searchStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  addPhoto,
  listPhotos,
  countPhotos,
  searchPhotos,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  linkStudentPhoto,
  unlinkStudentPhoto,
  listPhotosByStudent,
  listStudentsByPhoto,
  addMessageRecord,
  getMessageRecordById,
  listMessageRecords
};
