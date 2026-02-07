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
}
