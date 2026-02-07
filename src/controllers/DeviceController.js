import { DeviceService } from '../services/DeviceService.js';
import { apiLogger } from '../utils/logger.js';

export class DeviceController {
  /**
   * Получить все устройства из БД
   * GET /api/db/devices
   */
  static getAllDevices(req, res) {
    try {
      const { status } = req.query;
      const filters = status ? { status } : {};

      const devices = DeviceService.getAllDevices(filters);
      return res.json({ success: true, data: devices });
    } catch (error) {
      apiLogger.error(error, { operation: 'getAllDevices' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Получить устройство из БД по ID
   * GET /api/db/devices/:deviceId
   */
  static getDevice(req, res) {
    try {
      const { deviceId } = req.params;

      const device = DeviceService.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ 
          success: false, 
          error: 'Device not found' 
        });
      }

      return res.json({ success: true, data: device });
    } catch (error) {
      apiLogger.error(error, { operation: 'getDevice' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Обновить конфигурацию устройства в БД
   * PUT /api/db/devices/:deviceId/config
   * Body: { config }
   */
  static updateConfig(req, res) {
    try {
      const { deviceId } = req.params;
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({ 
          success: false, 
          error: 'config is required' 
        });
      }

      const device = DeviceService.updateDeviceConfig(deviceId, config);
      return res.json({ success: true, data: device });
    } catch (error) {
      apiLogger.error(error, { operation: 'updateConfig' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Обновить состояние устройства в БД
   * PUT /api/db/devices/:deviceId/state
   * Body: { state }
   */
  static updateState(req, res) {
    try {
      const { deviceId } = req.params;
      const { state } = req.body;

      if (!state) {
        return res.status(400).json({ 
          success: false, 
          error: 'state is required' 
        });
      }

      const device = DeviceService.updateDeviceState(deviceId, state);
      return res.json({ success: true, data: device });
    } catch (error) {
      apiLogger.error(error, { operation: 'updateState' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Получить компоненты устройства (irrigators, timers, outputs)
   * GET /api/db/devices/:deviceId/components
   */
  static getComponents(req, res) {
    try {
      const { deviceId } = req.params;

      const device = DeviceService.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ 
          success: false, 
          error: 'Device not found' 
        });
      }

      const components = DeviceService.extractComponents(device.config);
      return res.json({ success: true, data: components });
    } catch (error) {
      apiLogger.error(error, { operation: 'getComponents' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Удалить устройство из БД
   * DELETE /api/db/devices/:deviceId
   */
  static deleteDevice(req, res) {
    try {
      const { deviceId } = req.params;

      DeviceService.deleteDevice(deviceId);
      return res.json({ success: true, message: 'Device deleted' });
    } catch (error) {
      apiLogger.error(error, { operation: 'deleteDevice' });
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}
