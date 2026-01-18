# 本地数据库说明（SQLite）

## 概览
- 引擎：better-sqlite3（同步 API）
- 文件位置：userData 目录下 `sunday-school-time.db`
- 目标：离线、本地索引、可回溯

## 表结构 SQL
```sql
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
```

## 字段说明
### Student
- `id`: 学生主键
- `name`: 学生姓名
- `className`: 班级/分组
- `tags`: 标签（字符串，后续可扩展 JSON）
- `guardianName`: 家长姓名
- `phone`: 手机号（用于短信发送）
- `wechat`: 微信号/微信昵称
- `whatsapp`: WhatsApp 号码
- `createdAt`: 创建时间（时间戳）

### Photo
- `id`: 照片主键
- `filePath`: 照片绝对路径（唯一）
- `fileName`: 文件名
- `capturedAt`: 拍摄时间（可选）
- `createdAt`: 入库时间

### StudentPhoto
- `studentId`: 关联学生
- `photoId`: 关联照片
- `linkedAt`: 关联时间
- `(studentId, photoId)` 唯一约束

### MessageRecord
- `studentId`: 学生 ID
- `templateText`: 通用模板内容
- `personalizedText`: 个性化评语
- `finalText`: 合成后的最终消息文本
- `channel`: 发送渠道标识（微信/WhatsApp/短信等）
- `createdAt`: 生成时间

## 索引说明
```sql
CREATE INDEX IF NOT EXISTS idx_student_name ON Student(name);
CREATE INDEX IF NOT EXISTS idx_photo_capturedAt ON Photo(capturedAt);
CREATE INDEX IF NOT EXISTS idx_studentphoto_studentId ON StudentPhoto(studentId);
CREATE INDEX IF NOT EXISTS idx_studentphoto_photoId ON StudentPhoto(photoId);
CREATE INDEX IF NOT EXISTS idx_message_studentId ON MessageRecord(studentId);
CREATE INDEX IF NOT EXISTS idx_message_createdAt ON MessageRecord(createdAt);
```

## 说明
- 数据库仅本地生成，不联网。
- **外键约束已启用**：`PRAGMA foreign_keys = ON`，删除 Student/Photo 时自动级联删除关联记录。
- 关联表设置了唯一约束，防止重复关联。
- 所有时间字段为毫秒级时间戳（`Date.now()`），便于按日期回溯与筛选。
- 添加学生时 `name` 必填且不能为空字符串，否则抛出错误。

## API 函数列表
```javascript
// 初始化与关闭
initDb()           // 初始化数据库连接
closeDb()          // 关闭数据库连接（应用退出时调用）
getDbPath()        // 获取数据库文件路径

// Student CRUD
addStudent({ name, className, tags, guardianName, phone, wechat, whatsapp })
listStudents()
getStudentById(id)
updateStudent(id, { name, className, tags, guardianName, phone, wechat, whatsapp })
deleteStudent(id)

// Photo CRUD
addPhoto({ filePath, fileName, capturedAt })  // 已存在时返回已有 ID
listPhotos()
getPhotoById(id)
updatePhoto(id, { fileName, capturedAt })
deletePhoto(id)

// StudentPhoto 关联
linkStudentPhoto(studentId, photoId)
unlinkStudentPhoto(studentId, photoId)
listPhotosByStudent(studentId)
listStudentsByPhoto(photoId)

// MessageRecord
addMessageRecord({ studentId, templateText, personalizedText, finalText, channel })
getMessageRecordById(id)
listMessageRecords({ studentId, from, to })
```
