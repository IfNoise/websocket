import express from 'express';
import { MetadataController } from './controllers/MetadataController.js';
import { DeviceController } from './controllers/DeviceController.js';
import { param, body, query, validationResult } from 'express-validator';

const router = express.Router();

/**
 * Middleware для валидации запросов
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// ==================== Device DB Routes ====================

// Получить все устройства из БД
router.get(
  '/db/devices',
  [query('status').optional().isString()],
  validate,
  DeviceController.getAllDevices
);

// Получить устройство из БД
router.get(
  '/db/devices/:deviceId',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.getDevice
);

// Обновить конфигурацию устройства в БД
router.put(
  '/db/devices/:deviceId/config',
  [
    param('deviceId').isString().trim(),
    body('config').isObject()
  ],
  validate,
  DeviceController.updateConfig
);

// Обновить состояние устройства в БД
router.put(
  '/db/devices/:deviceId/state',
  [
    param('deviceId').isString().trim(),
    body('state').isObject()
  ],
  validate,
  DeviceController.updateState
);

// Получить компоненты устройства
router.get(
  '/db/devices/:deviceId/components',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.getComponents
);

// Удалить устройство из БД
router.delete(
  '/db/devices/:deviceId',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.deleteDevice
);

// ==================== Metadata Routes ====================

// Получить все метаданные устройства
router.get(
  '/devices/:deviceId/metadata',
  [
    param('deviceId').isString().trim(),
    query('componentType').optional().isString()
  ],
  validate,
  MetadataController.getDeviceMetadata
);

// Получить метаданные конкретного компонента
router.get(
  '/devices/:deviceId/metadata/:componentType/:componentKey',
  [
    param('deviceId').isString().trim(),
    param('componentType').isString().trim(),
    param('componentKey').isString().trim()
  ],
  validate,
  MetadataController.getComponentMetadata
);

// Сохранить метаданные компонента
router.post(
  '/devices/:deviceId/metadata',
  [
    param('deviceId').isString().trim(),
    body('componentType').isString().trim(),
    body('componentKey').isString().trim(),
    body('metadata').isObject()
  ],
  validate,
  MetadataController.saveMetadata
);

// Пакетное сохранение метаданных
router.post(
  '/devices/:deviceId/metadata/bulk',
  [
    param('deviceId').isString().trim(),
    body('metadataList').isArray()
  ],
  validate,
  MetadataController.saveBulkMetadata
);

// Удалить метаданные
router.delete(
  '/metadata/:id',
  [param('id').isInt()],
  validate,
  MetadataController.deleteMetadata
);

// ==================== Irrigator-specific Routes ====================

// Получить все метаданные ирригаторов устройства
router.get(
  '/devices/:deviceId/irrigators/metadata',
  [param('deviceId').isString().trim()],
  validate,
  MetadataController.getIrrigatorsMetadata
);

// Получить метаданные ирригатора
router.get(
  '/devices/:deviceId/irrigators/:irrigatorKey/metadata',
  [
    param('deviceId').isString().trim(),
    param('irrigatorKey').isString().trim()
  ],
  validate,
  MetadataController.getIrrigatorMetadata
);

// Сохранить метаданные ирригатора
router.post(
  '/devices/:deviceId/irrigators/:irrigatorKey/metadata',
  [
    param('deviceId').isString().trim(),
    param('irrigatorKey').isString().trim(),
    body('metadata').isObject()
  ],
  validate,
  MetadataController.saveIrrigatorMetadata
);

export default router;
