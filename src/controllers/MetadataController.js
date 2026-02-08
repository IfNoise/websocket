import { MetadataService } from '../services/MetadataService.js';
import { DeviceService } from '../services/DeviceService.js';
import { metadataLogger, apiLogger } from '../utils/logger.js';

export class MetadataController {
  /**
   * Получить все метаданные устройства
   * GET /api/devices/:deviceId/metadata
   */
  static getDeviceMetadata(req, res) {
    try {
      const { deviceId } = req.params;
      const { componentType } = req.query;

      const metadata = MetadataService.getDeviceMetadata(deviceId, componentType);
      return res.json({ success: true, data: metadata });
    } catch (error) {
      apiLogger.error(error, { operation: 'getDeviceMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Получить метаданные конкретного компонента
   * GET /api/devices/:deviceId/metadata/:componentType/:componentKey
   */
  static getComponentMetadata(req, res) {
    try {
      const { deviceId, componentType, componentKey } = req.params;

      const metadata = MetadataService.getMetadata(deviceId, componentType, componentKey);
      
      if (!metadata) {
        return res.status(404).json({ 
          success: false, 
          error: 'Metadata not found' 
        });
      }

      return res.json({ success: true, data: metadata });
    } catch (error) {
      apiLogger.error(error, { operation: 'getComponentMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Сохранить или обновить метаданные компонента
   * POST /api/devices/:deviceId/metadata
   * Body: { componentType, componentKey, metadata }
   */
  static saveMetadata(req, res) {
    try {
      const { deviceId } = req.params;
      const { componentType, componentKey, metadata } = req.body;

      if (!componentType || !componentKey || !metadata) {
        return res.status(400).json({ 
          success: false, 
          error: 'componentType, componentKey and metadata are required' 
        });
      }

      const result = MetadataService.saveMetadata(
        deviceId,
        componentType,
        componentKey,
        metadata
      );

      metadataLogger.save(deviceId, componentType, componentKey);

      return res.json({ success: true, data: result });
    } catch (error) {
      apiLogger.error(error, { operation: 'saveMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Пакетное сохранение метаданных
   * POST /api/devices/:deviceId/metadata/bulk
   * Body: { metadataList: [{ componentType, componentKey, metadata }, ...] }
   */
  static saveBulkMetadata(req, res) {
    try {
      const { deviceId } = req.params;
      const { metadataList } = req.body;

      if (!Array.isArray(metadataList)) {
        return res.status(400).json({ 
          success: false, 
          error: 'metadataList must be an array' 
        });
      }

      const results = MetadataService.saveBulkMetadata(deviceId, metadataList);

      return res.json({ success: true, data: results });
    } catch (error) {
      apiLogger.error(error, { operation: 'saveBulkMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Удалить метаданные
   * DELETE /api/metadata/:id
   */
  static deleteMetadata(req, res) {
    try {
      const { id } = req.params;
      
      metadataLogger.delete(id);

      return res.json({ success: true, message: 'Metadata deleted' });
    } catch (error) {
      apiLogger.error(error, { operation: 'deleteMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Получить все метаданные ирригаторов устройства
   * GET /api/devices/:deviceId/irrigators/metadata
   */
  static getIrrigatorsMetadata(req, res) {
    try {
      const { deviceId } = req.params;

      const metadata = MetadataService.getAllIrrigatorsMetadata(deviceId);
      return res.json({ success: true, data: metadata });
    } catch (error) {
      apiLogger.error(error, { operation: 'getIrrigatorsMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Сохранить метаданные ирригатора (специализированный метод)
   * POST /api/devices/:deviceId/irrigators/:irrigatorKey/metadata
   * Body: { metadata }
   */
  static saveIrrigatorMetadata(req, res) {
    try {
      const { deviceId, irrigatorKey } = req.params;
      const { metadata } = req.body;

      if (!metadata) {
        return res.status(400).json({ 
          success: false, 
          error: 'metadata is required' 
        });
      }

      const result = MetadataService.saveIrrigatorMetadata(
        deviceId,
        irrigatorKey,
        metadata
      );

      return res.json({ success: true, data: result });
    } catch (error) {
      apiLogger.error(error, { operation: 'saveIrrigatorMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Получить метаданные ирригатора
   * GET /api/devices/:deviceId/irrigators/:irrigatorKey/metadata
   */
  static getIrrigatorMetadata(req, res) {
    try {
      const { deviceId, irrigatorKey } = req.params;

      const metadata = MetadataService.getIrrigatorMetadata(deviceId, irrigatorKey);
      
      if (!metadata) {
        return res.status(404).json({ 
          success: false, 
          error: 'Irrigator metadata not found' 
        });
      }

      return res.json({ success: true, data: metadata });
    } catch (error) {
      apiLogger.error(error, { operation: 'getIrrigatorMetadata' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Установить таблицу поливов для ирригатора
   * POST /api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table
   * Body: { 
   *   irrigationTable: [{start: number, stop: number}, ...],
   *   strategyParams: { параметры стратегии полива }
   * }
   * Автоматически синхронизирует с устройством через RPC
   */
  static async setIrrigationTable(req, res) {
    try {
      const { deviceId, irrigatorKey } = req.params;
      const { irrigationTable, strategyParams = {} } = req.body;

      if (!Array.isArray(irrigationTable)) {
        return res.status(400).json({ 
          success: false, 
          error: 'irrigationTable must be an array' 
        });
      }

      // Сохранить таблицу поливов и параметры стратегии в метаданные
      // Автоматически синхронизирует с устройством
      const result = await MetadataService.setIrrigationTable(
        deviceId,
        irrigatorKey,
        irrigationTable,
        strategyParams,
        req.app.locals.wsServer
      );

      return res.json({ 
        success: true, 
        data: result,
        message: 'Irrigation table saved and synchronized with device'
      });
    } catch (error) {
      apiLogger.error(error, { operation: 'setIrrigationTable' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Получить таблицу поливов ирригатора
   * GET /api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table
   * Query: ?source=metadata|device (default: metadata)
   */
  static async getIrrigationTable(req, res) {
    try {
      const { deviceId, irrigatorKey } = req.params;
      const { source = 'metadata' } = req.query;

      let irrigationTable;

      if (source === 'device') {
        // Получить с устройства через RPC
        irrigationTable = await MetadataService.getIrrigationTableFromDevice(
          deviceId,
          irrigatorKey,
          req.app.locals.wsServer
        );
      } else {
        // Получить из метаданных сервера
        irrigationTable = MetadataService.getIrrigationTable(deviceId, irrigatorKey);
      }

      if (!irrigationTable) {
        return res.status(404).json({ 
          success: false, 
          error: 'Irrigation table not found' 
        });
      }

      return res.json({ 
        success: true, 
        data: irrigationTable,
        source
      });
    } catch (error) {
      apiLogger.error(error, { operation: 'getIrrigationTable' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Синхронизировать таблицу поливов с устройством
   * PUT /api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table/sync
   */
  static async syncIrrigationTable(req, res) {
    try {
      const { deviceId, irrigatorKey } = req.params;

      const result = await MetadataService.syncIrrigationTable(
        deviceId,
        irrigatorKey,
        req.app.locals.wsServer
      );

      return res.json({ 
        success: true, 
        data: result,
        message: 'Irrigation table synchronized with device'
      });
    } catch (error) {
      apiLogger.error(error, { operation: 'syncIrrigationTable' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // ==================== Universal Component API ====================

  /**
   * Универсальный метод для получения данных любого компонента
   * GET /api/devices/:deviceId/:componentType/:componentKey
   */
  static async getComponentData(req, res) {
    try {
      const { deviceId, componentType, componentKey } = req.params;
      const { source = 'metadata' } = req.query;

      // Специальная обработка для irrigators с irrigation-table
      if (componentType === 'irrigators' || componentType === 'irrigator') {
        const metadata = MetadataService.getIrrigatorMetadata(deviceId, componentKey);
        
        if (!metadata) {
          return res.status(404).json({ 
            success: false, 
            error: `Irrigator ${componentKey} metadata not found` 
          });
        }

        // Если запрошено с устройства
        if (source === 'device') {
          try {
            const deviceData = await MetadataService.getIrrigationTableFromDevice(
              deviceId,
              componentKey,
              req.app.locals.wsServer
            );
            return res.json({ 
              success: true, 
              ...deviceData,
              source: 'device'
            });
          } catch (error) {
            // Если устройство не доступно, вернуть из метаданных
            return res.json({ 
              success: true, 
              ...metadata.metadata,
              source: 'metadata',
              note: 'Device unavailable, returned from cache'
            });
          }
        }

        return res.json({ 
          success: true, 
          ...metadata.metadata,
          source: 'metadata'
        });
      }

      // Для остальных компонентов - просто метаданные
      const metadata = MetadataService.getMetadata(deviceId, componentType, componentKey);
      
      if (!metadata) {
        return res.status(404).json({ 
          success: false, 
          error: `Component ${componentType}/${componentKey} not found` 
        });
      }

      return res.json({ 
        success: true, 
        ...metadata.metadata,
        source: 'metadata'
      });
    } catch (error) {
      apiLogger.error(error, { operation: 'getComponentData' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Универсальный метод для установки данных любого компонента
   * POST /api/devices/:deviceId/:componentType/:componentKey
   */
  static async setComponentData(req, res) {
    try {
      const { deviceId, componentType, componentKey } = req.params;
      const data = req.body;

      // Специальная обработка для irrigators с irrigation-table
      if ((componentType === 'irrigators' || componentType === 'irrigator') && data.irrigationTable) {
        return MetadataController.setIrrigationTable(req, res);
      }

      // Для остальных компонентов - сохранить метаданные
      const result = MetadataService.saveMetadata(
        deviceId,
        componentType,
        componentKey,
        data
      );

      metadataLogger.save(deviceId, componentType, componentKey);

      return res.json({ 
        success: true, 
        message: `${componentType} ${componentKey} data saved`,
        data: result 
      });
    } catch (error) {
      apiLogger.error(error, { operation: 'setComponentData' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}
