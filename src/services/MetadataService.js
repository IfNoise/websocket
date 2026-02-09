import { ComponentMetadataModel } from "../models/ComponentMetadata.js";

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
    return ComponentMetadataModel.findByComponent(
      deviceId,
      componentType,
      componentKey,
    );
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
    return this.saveMetadata(deviceId, "irrigator", irrigatorKey, {
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
    return this.getMetadata(deviceId, "irrigator", irrigatorKey);
  }

  /**
   * Получить все метаданные ирригаторов устройства
   * @param {string} deviceId
   */
  static getAllIrrigatorsMetadata(deviceId) {
    return this.getDeviceMetadata(deviceId, "irrigator");
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
        item.metadata,
      );
      results.push(result);
    }
    return results;
  }

  /**
   * Установить таблицу поливов для ирригатора
   * Сохраняет в метаданные и ВСЕГДА отправляет на устройство через RPC
   * @param {string} deviceId
   * @param {string} irrigatorKey
   * @param {Array} irrigationTable - [{start: number, stop: number}, ...]
   * @param {Object} strategyParams - параметры стратегии полива
   * @param {Object} wsServer - WebSocket сервер для RPC вызовов
   */
  static async setIrrigationTable(
    deviceId,
    irrigatorKey,
    irrigationTable,
    strategyParams = {},
    wsServer,
  ) {
    // Получить текущие метаданные
    const currentMetadata = this.getIrrigatorMetadata(deviceId, irrigatorKey);
    const metadata = currentMetadata?.metadata || {};

    // Обновить irrigation table и параметры стратегии
    metadata.irrigationTable = irrigationTable;
    metadata.strategyParams = strategyParams;
    metadata.lastIrrigationTableUpdate = Date.now();

    // Сохранить в метаданные
    const saved = this.saveIrrigatorMetadata(deviceId, irrigatorKey, metadata);

    // ВСЕГДА отправить на устройство для синхронизации
    if (!wsServer) {
      throw new Error("WebSocket server not available");
    }

    {
      const device = wsServer.findDeviceById(deviceId);

      if (!device) {
        throw new Error(`Device ${deviceId} not connected`);
      }

      // Получить имя ирригатора из конфигурации
      const deviceFromDB = await import("./DeviceService.js").then((m) =>
        m.DeviceService.getDevice(deviceId),
      );
      const irrigatorConfig = deviceFromDB?.config?.[irrigatorKey];
      const irrigatorName = irrigatorConfig?.name || irrigatorKey;

      // Отправить RPC команду Set.IrrigationTable
      const rpcParams = {
        irrigator: irrigatorName,
        reg_map: JSON.stringify(irrigationTable),
      };

      try {
        const result = await device.call(
          "Set.IrrigationTable",
          rpcParams,
          5000,
        );
        saved.rpcResult = result;
        saved.syncedToDevice = true;
      } catch (err) {
        saved.rpcError = err.message;
        saved.syncedToDevice = false;
        throw new Error(
          `Failed to sync irrigation table to device: ${err.message}`,
        );
      }
    }

    return saved;
  }

  /**
   * Получить таблицу поливов из метаданных сервера
   * @param {string} deviceId
   * @param {string} irrigatorKey
   */
  static getIrrigationTable(deviceId, irrigatorKey) {
    const metadata = this.getIrrigatorMetadata(deviceId, irrigatorKey);

    if (!metadata?.metadata?.irrigationTable) {
      return null;
    }

    // Извлекаем дополнительные метаданные, исключая дублируемые поля
    const {
      irrigationTable,
      strategyParams,
      lastIrrigationTableUpdate,
      updatedAt,
      ...additionalMetadata
    } = metadata.metadata;

    return {
      irrigatorKey,
      irrigationTable,
      strategyParams: strategyParams || {},
      lastUpdate: lastIrrigationTableUpdate,
      ...(Object.keys(additionalMetadata).length > 0 && {
        metadata: additionalMetadata,
      }),
    };
  }

  /**
   * Получить таблицу поливов с устройства через RPC
   * @param {string} deviceId
   * @param {string} irrigatorKey
   * @param {Object} wsServer
   */
  static async getIrrigationTableFromDevice(deviceId, irrigatorKey, wsServer) {
    if (!wsServer) {
      throw new Error("WebSocket server not available");
    }

    const device = wsServer.findDeviceById(deviceId);

    if (!device) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Получить имя ирригатора из конфигурации
    const deviceFromDB = await import("./DeviceService.js").then((m) =>
      m.DeviceService.getDevice(deviceId),
    );
    const irrigatorConfig = deviceFromDB?.config?.[irrigatorKey];
    const irrigatorName = irrigatorConfig?.name || irrigatorKey;

    // Отправить RPC команду Get.IrrigationTable
    const rpcParams = {
      irrigator: irrigatorName,
    };

    try {
      const result = await device.call("Get.IrrigationTable", rpcParams, 5000);

      // Парсим reg_map если это строка
      let irrigationTable = result.reg_map;
      if (typeof irrigationTable === "string") {
        irrigationTable = JSON.parse(irrigationTable);
      }

      return {
        irrigatorKey,
        irrigatorName,
        irrigationTable,
        deviceResponse: result,
      };
    } catch (err) {
      throw new Error(
        `Failed to get irrigation table from device: ${err.message}`,
      );
    }
  }

  /**
   * Синхронизировать таблицу поливов с устройством
   * Берет таблицу из метаданных и отправляет на устройство
   * @param {string} deviceId
   * @param {string} irrigatorKey
   * @param {Object} wsServer
   */
  static async syncIrrigationTable(deviceId, irrigatorKey, wsServer) {
    const tableData = this.getIrrigationTable(deviceId, irrigatorKey);

    if (!tableData) {
      throw new Error("No irrigation table found in metadata");
    }

    return this.setIrrigationTable(
      deviceId,
      irrigatorKey,
      tableData.irrigationTable,
      tableData.strategyParams || {},
      wsServer,
    );
  }
}
