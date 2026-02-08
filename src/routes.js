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

// ==================== Device Routes ====================
// API для управления конфигурациями и получения статусов

// Получить конфигурацию устройства
router.get(
  '/devices/:deviceId/config',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.getConfig
);

// Обновить конфигурацию устройства
router.patch(
  '/devices/:deviceId/config',
  [
    param('deviceId').isString().trim(),
    body('config').isObject()
  ],
  validate,
  DeviceController.updateConfig
);

// Получить состояние устройства (read-only)
router.get(
  '/devices/:deviceId/state',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.getState
);

// Получить outputs устройства (read-only)
router.get(
  '/devices/:deviceId/outputs',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.getOutputs
);

// Универсальный вызов RPC метода на устройстве
router.post(
  '/devices/:deviceId/call',
  [
    param('deviceId').isString().trim(),
    body('method').isString().trim().matches(/^[a-zA-Z0-9_.:-]{1,100}$/),
    body('params').optional().isObject()
  ],
  validate,
  DeviceController.call
);

// Получить компоненты устройства (irrigators, outputs, sensors и т.д.)
router.get(
  '/devices/:deviceId/components',
  [param('deviceId').isString().trim()],
  validate,
  DeviceController.getComponents
);

// ==================== Universal Component Routes ====================
// Работа с любыми компонентами: irrigators, outputs, sensors, timers, pcfOutputs

// Получить метаданные компонента
router.get(
  '/devices/:deviceId/:componentType/:componentKey',
  [
    param('deviceId').isString().trim(),
    param('componentType').isString().trim(),
    param('componentKey').isString().trim(),
    query('source').optional().isIn(['metadata', 'device'])
  ],
  validate,
  MetadataController.getComponentData
);

// Обновить конфигурацию компонента
router.patch(
  '/devices/:deviceId/:componentType/:componentKey',
  [
    param('deviceId').isString().trim(),
    param('componentType').isString().trim(),
    param('componentKey').isString().trim(),
    body().isObject()
  ],
  validate,
  MetadataController.setComponentData
);

// ==================== Irrigation Table Routes ====================
// API для работы с таблицами поливов

// Получить таблицу поливов ирригатора
router.get(
  '/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table',
  [
    param('deviceId').isString().trim(),
    param('irrigatorKey').isString().trim(),
    query('source').optional().isIn(['metadata', 'device'])
  ],
  validate,
  MetadataController.getIrrigationTable
);

// Установить таблицу поливов для ирригатора
router.post(
  '/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table',
  [
    param('deviceId').isString().trim(),
    param('irrigatorKey').isString().trim(),
    body('irrigationTable').isArray()
  ],
  validate,
  MetadataController.setIrrigationTable
);

export default router;
