import { ComponentMetadataModel } from '../models/ComponentMetadata.js';

export class MetadataService {
  /**
   * Сохранить или обновить метаданные компонента
   * @param {string} deviceId 
   * @param {string} componentType - 'irrigator', 'timer', 'output' и т.д.
   * @param {string} componentKey - 'irr1', 'light1' и т.д.
   * @param {Object} metadata - произвольные метаданные
   */
  static saveMetadata(deviceId, componentType, componentKey, metadata) {
    return ComponentMetadataModel.upsert({
      deviceId,
      componentType,
      componentKey,
      metadata,
    });
  }

  /**
   * Получить метаданные компонента
   * @param {string} deviceId 
   * @param {string} componentType 
   * @param {string} componentKey 
   */
  static getMetadata(deviceId, componentType, componentKey) {
    return ComponentMetadataModel.findByComponent(deviceId, componentType, componentKey);
  }

  /**
   * Получить все метаданные устройства
   * @param {string} deviceId 
   * @param {string} componentType - опционально
   */
  static getDeviceMetadata(deviceId, componentType = null) {
    return ComponentMetadataModel.findByDevice(deviceId, componentType);
  }

  /**
   * Удалить метаданные
   * @param {number} id 
   */
  static deleteMetadata(id) {
    ComponentMetadataModel.delete(id);
  }

  /**
   * Удалить все метаданные устройства
   * @param {string} deviceId 
   */
  static deleteDeviceMetadata(deviceId) {
    ComponentMetadataModel.deleteByDevice(deviceId);
  }

  /**
   * Сохранить метаданные для ирригатора
   * Специализированный метод для работы с таблицами поливов
   * @param {string} deviceId 
   * @param {string} irrigatorKey - 'irr1', 'irr2' и т.д.
   * @param {Object} metadata
   * @example
   * saveIrrigatorMetadata('esp32_A8A154', 'irr1', {
   *   schedule: { ... },
   *   wateringTable: [ ... ],
   *   lastModified: Date.now(),
   *   notes: 'Generated schedule for tomatoes'
   * })
   */
  static saveIrrigatorMetadata(deviceId, irrigatorKey, metadata) {
    return this.saveMetadata(deviceId, 'irrigator', irrigatorKey, {
      ...metadata,
      updatedAt: Date.now(),
    });
  }

  /**
   * Получить метаданные ирригатора
   * @param {string} deviceId 
   * @param {string} irrigatorKey 
   */
  static getIrrigatorMetadata(deviceId, irrigatorKey) {
    return this.getMetadata(deviceId, 'irrigator', irrigatorKey);
  }

  /**
   * Получить все метаданные ирригаторов устройства
   * @param {string} deviceId 
   */
  static getAllIrrigatorsMetadata(deviceId) {
    return this.getDeviceMetadata(deviceId, 'irrigator');
  }

  /**
   * Пакетное сохранение метаданных
   * @param {string} deviceId 
   * @param {Array} metadataList - [{ componentType, componentKey, metadata }, ...]
   */
  static saveBulkMetadata(deviceId, metadataList) {
    const results = [];
    for (const item of metadataList) {
      const result = this.saveMetadata(
        deviceId,
        item.componentType,
        item.componentKey,
        item.metadata
      );
      results.push(result);
    }
    return results;
  }
}
