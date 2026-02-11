import { getDb } from '../database/db.js';

export class DeviceModel {
  /**
   * Создать или обновить устройство
   * @param {Object} deviceData 
   * @returns {Object}
   */
  static upsert({ id, address, status, config, state }) {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const configStr = config ? JSON.stringify(config) : null;
    const stateStr = state ? JSON.stringify(state) : null;

    const stmt = db.prepare(`
      INSERT INTO devices (id, address, status, config, state, last_seen, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        address = excluded.address,
        status = excluded.status,
        config = excluded.config,
        state = excluded.state,
        last_seen = excluded.last_seen,
        updated_at = excluded.updated_at
    `);

    stmt.run(id, address, status || 'connected', configStr, stateStr, now, now, now);
    return this.findById(id);
  }

  /**
   * Найти устройство по ID
   * @param {string} id 
   * @returns {Object|null}
   */
  static findById(id) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) return null;
    
    return this._parseDevice(row);
  }

  /**
   * Получить все устройства
   * @param {Object} filters 
   * @returns {Array}
   */
  static findAll(filters = {}) {
    const db = getDb();
    let query = 'SELECT * FROM devices';
    const params = [];

    if (filters.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY last_seen DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => this._parseDevice(row));
  }

  /**
   * Обновить статус устройства
   * @param {string} id 
   * @param {string} status 
   * @returns {boolean} - true если статус изменился
   */
  static updateStatus(id, status) {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    
    // Проверить текущий статус
    const currentDevice = this.findById(id);
    if (currentDevice?.status === status) {
      // Статус не изменился, только обновляем last_seen
      const updateTime = db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?');
      updateTime.run(now, id);
      return false;
    }
    
    const stmt = db.prepare('UPDATE devices SET status = ?, last_seen = ? WHERE id = ?');
    stmt.run(status, now, id);
    return true;
  }

  /**
   * Обновить конфигурацию устройства
   * @param {string} id 
   * @param {Object} config 
   * @returns {boolean} - true если конфигурация изменилась
   */
  static updateConfig(id, config) {
    const db = getDb();
    
    // Проверить текущую конфигурацию
    const currentDevice = this.findById(id);
    const newConfigStr = JSON.stringify(config);
    const oldConfigStr = currentDevice?.config ? JSON.stringify(currentDevice.config) : null;
    
    if (oldConfigStr === newConfigStr) {
      return false; // Конфигурация не изменилась
    }
    
    const stmt = db.prepare('UPDATE devices SET config = ? WHERE id = ?');
    stmt.run(newConfigStr, id);
    return true;
  }

  /**
   * Обновить состояние устройства
   * @param {string} id 
   * @param {Object} state 
   * @returns {boolean} - true если состояние изменилось, false если осталось прежним
   */
  static updateState(id, state) {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    
    // Получить текущее состояние для сравнения
    const currentDevice = this.findById(id);
    const newStateStr = JSON.stringify(state);
    const oldStateStr = currentDevice?.state ? JSON.stringify(currentDevice.state) : null;
    
    // Если состояние не изменилось, только обновляем last_seen
    if (oldStateStr === newStateStr) {
      const updateTime = db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?');
      updateTime.run(now, id);
      return false; // Состояние не изменилось
    }
    
    // Состояние изменилось - обновляем и state, и last_seen
    const stmt = db.prepare('UPDATE devices SET state = ?, last_seen = ? WHERE id = ?');
    stmt.run(newStateStr, now, id);
    return true; // Состояние изменилось
  }

  /**
   * Удалить устройство
   * @param {string} id 
   */
  static delete(id) {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM devices WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Парсинг JSON полей
   * @private
   */
  static _parseDevice(row) {
    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
      state: row.state ? JSON.parse(row.state) : null,
    };
  }
}
