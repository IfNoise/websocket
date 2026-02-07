import { getDb } from '../database/db.js';

export class ComponentMetadataModel {
  /**
   * Создать или обновить метаданные компонента
   * @param {Object} data 
   * @returns {Object}
   */
  static upsert({ deviceId, componentType, componentKey, metadata }) {
    const db = getDb();
    const metadataStr = JSON.stringify(metadata);
    
    const stmt = db.prepare(`
      INSERT INTO component_metadata (device_id, component_type, component_key, metadata)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(device_id, component_type, component_key) DO UPDATE SET
        metadata = excluded.metadata,
        updated_at = strftime('%s', 'now')
    `);

    const info = stmt.run(deviceId, componentType, componentKey, metadataStr);
    
    // Получить созданную или обновленную запись
    const selectStmt = db.prepare(`
      SELECT * FROM component_metadata 
      WHERE device_id = ? AND component_type = ? AND component_key = ?
    `);
    
    const row = selectStmt.get(deviceId, componentType, componentKey);
    return this._parseMetadata(row);
  }

  /**
   * Найти метаданные по ID
   * @param {number} id 
   * @returns {Object|null}
   */
  static findById(id) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM component_metadata WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) return null;
    
    return this._parseMetadata(row);
  }

  /**
   * Найти метаданные компонента
   * @param {string} deviceId 
   * @param {string} componentType 
   * @param {string} componentKey 
   * @returns {Object|null}
   */
  static findByComponent(deviceId, componentType, componentKey) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM component_metadata 
      WHERE device_id = ? AND component_type = ? AND component_key = ?
    `);
    const row = stmt.get(deviceId, componentType, componentKey);
    
    if (!row) return null;
    
    return this._parseMetadata(row);
  }

  /**
   * Получить все метаданные устройства
   * @param {string} deviceId 
   * @param {string} componentType - опционально фильтр по типу
   * @returns {Array}
   */
  static findByDevice(deviceId, componentType = null) {
    const db = getDb();
    let query = 'SELECT * FROM component_metadata WHERE device_id = ?';
    const params = [deviceId];

    if (componentType) {
      query += ' AND component_type = ?';
      params.push(componentType);
    }

    query += ' ORDER BY component_type, component_key';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => this._parseMetadata(row));
  }

  /**
   * Получить метаданные по типу компонента (для всех устройств)
   * @param {string} componentType 
   * @returns {Array}
   */
  static findByType(componentType) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM component_metadata WHERE component_type = ?');
    const rows = stmt.all(componentType);
    
    return rows.map(row => this._parseMetadata(row));
  }

  /**
   * Удалить метаданные
   * @param {number} id 
   */
  static delete(id) {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM component_metadata WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Удалить все метаданные устройства
   * @param {string} deviceId 
   */
  static deleteByDevice(deviceId) {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM component_metadata WHERE device_id = ?');
    stmt.run(deviceId);
  }

  /**
   * Парсинг JSON полей
   * @private
   */
  static _parseMetadata(row) {
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }
}
