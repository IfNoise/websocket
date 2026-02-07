import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
  constructor(dbPath = path.join(__dirname, '../../data/devices.db')) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  initTables() {
    // Таблица устройств
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        address TEXT,
        status TEXT DEFAULT 'disconnected',
        config TEXT, -- JSON строка с конфигурацией устройства
        state TEXT, -- JSON строка с текущим состоянием
        last_seen INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Таблица метаданных компонентов (irrigators, timers, outputs и т.д.)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS component_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        component_type TEXT NOT NULL, -- 'irrigator', 'timer', 'output' и т.д.
        component_key TEXT NOT NULL, -- ключ компонента (например 'irr1', 'light1')
        metadata TEXT NOT NULL, -- JSON строка с метаданными
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        UNIQUE(device_id, component_type, component_key)
      )
    `);

    // Индексы для быстрого поиска
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
      CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
      CREATE INDEX IF NOT EXISTS idx_component_device ON component_metadata(device_id);
      CREATE INDEX IF NOT EXISTS idx_component_type ON component_metadata(component_type);
    `);

    // Триггер для обновления updated_at
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_devices_timestamp 
      AFTER UPDATE ON devices
      BEGIN
        UPDATE devices SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_metadata_timestamp 
      AFTER UPDATE ON component_metadata
      BEGIN
        UPDATE component_metadata SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;
    `);
  }

  getDatabase() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance.getDatabase();
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default DatabaseManager;
