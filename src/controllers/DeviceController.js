import { DeviceService } from "../services/DeviceService.js";
import { apiLogger } from "../utils/logger.js";

export class DeviceController {
  /**
   * Получить список всех подключенных устройств
   * GET /api/devices
   */
  static getAllDevices(req, res) {
    try {
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      const devices = wsServer.jsonrpc.getDevices() || [];

      return res.json({
        success: true,
        data: devices.map((device) => ({
          id: device.deviceId,
          address: device.address,
          status: device.status,
          config: device.config,
        })),
      });
    } catch (error) {
      apiLogger.error(error, { operation: "getAllDevices" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получить конфигурацию устройства через RPC
   * GET /api/devices/:deviceId/config
   */
  static async getConfig(req, res) {
    try {
      const { deviceId } = req.params;
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      const device = wsServer.jsonrpc.findDeviceById
        ? wsServer.jsonrpc.findDeviceById(deviceId)
        : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: "Device not found",
        });
      }

      const result = await device.call("Config.Get", {});
      return res.json({ success: true, data: result.result || result });
    } catch (error) {
      apiLogger.error(error, { operation: "getConfig" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получить состояние устройства через RPC (read-only)
   * GET /api/devices/:deviceId/state
   */
  static async getState(req, res) {
    try {
      const { deviceId } = req.params;
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      const device = wsServer.jsonrpc.findDeviceById
        ? wsServer.jsonrpc.findDeviceById(deviceId)
        : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: "Device not found",
        });
      }

      const frame = await device.call("Get.State", {});

      // Обновить состояние в БД и транслировать через WebSocket
      // frame = { id, result, error } - извлекаем только result
      DeviceService.updateDeviceState(deviceId, frame.result);

      return res.json({ success: true, data: frame.result });
    } catch (error) {
      apiLogger.error(error, { operation: "getState" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получить outputs устройства через RPC (read-only)
   * GET /api/devices/:deviceId/outputs
   */
  static async getOutputs(req, res) {
    try {
      const { deviceId } = req.params;
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      const device = wsServer.jsonrpc.findDeviceById
        ? wsServer.jsonrpc.findDeviceById(deviceId)
        : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: "Device not found",
        });
      }

      const result = await device.call("Get.Outputs", {});
      return res.json({ success: true, data: result });
    } catch (error) {
      apiLogger.error(error, { operation: "getOutputs" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Универсальный вызов RPC метода на устройстве
   * POST /api/devices/:deviceId/call
   * Body: { method, params }
   */
  static async call(req, res) {
    try {
      const { deviceId } = req.params;
      const { method, params } = req.body;
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      const device = wsServer.jsonrpc.findDeviceById
        ? wsServer.jsonrpc.findDeviceById(deviceId)
        : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: "Device not found",
        });
      }

      const result = await device.call(method, params || {});

      // После команд, которые могут изменить состояние, обновить его
      const stateChangingMethods = [
        "Get.State",
        "Set.Output",
        "Set.Outputs",
        "Toggle.Output",
        "Strategy.Start",
        "Strategy.Stop",
        "Strategy.Pause",
        "Strategy.Resume",
      ];

      if (
        stateChangingMethods.some((m) =>
          method.toLowerCase().includes(m.toLowerCase().split(".")[1]),
        )
      ) {
        try {
          // Получить актуальное состояние после изменения
          const frame = await device.call("Get.State", {});
          // frame = { id, result, error } - извлекаем только result
          DeviceService.updateDeviceState(deviceId, frame.result);
        } catch (err) {
          // Ошибка получения состояния не критична
          apiLogger.debug("Failed to update state after command", {
            deviceId,
            method,
            error: err.message,
          });
        }
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      apiLogger.error(error, { operation: "call" });
      return res.status(500).json({
        success: false,
        error: error.message,
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
          error: "Device not found",
        });
      }

      return res.json({ success: true, data: device });
    } catch (error) {
      apiLogger.error(error, { operation: "getDevice" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Обновить конфигурацию устройства через RPC (PATCH)
   * PATCH /api/devices/:deviceId/config
   * Body: { config, reboot }
   */
  static async updateConfig(req, res) {
    try {
      const { deviceId } = req.params;
      const { config, reboot } = req.body;
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      if (!config) {
        return res.status(400).json({
          success: false,
          error: "config is required",
        });
      }

      const device = wsServer.jsonrpc.findDeviceById
        ? wsServer.jsonrpc.findDeviceById(deviceId)
        : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: "Device not found",
        });
      }

      // Обновляем конфигурацию на устройстве
      const setResult = await device.call("Config.Set", { config }, 2000);
      if (setResult && setResult.error) {
        return res.status(400).json({ success: false, error: setResult.error });
      }

      device.config = setResult.result || device.config;

      // Сохраняем конфигурацию
      const saveResult = await device.call("Config.Save", {
        reboot: reboot || false,
      });
      if (saveResult && saveResult.error) {
        return res
          .status(400)
          .json({ success: false, error: saveResult.error });
      }

      // Обновляем устройство в фоне
      device.update?.();

      return res.json({ success: true, message: "Config updated" });
    } catch (error) {
      apiLogger.error(error, { operation: "updateConfig" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получить компоненты устройства (irrigators, timers, outputs)
   * GET /api/devices/:deviceId/components
   */
  static async getComponents(req, res) {
    try {
      const { deviceId } = req.params;
      const wsServer = req.app.locals.wsServer;

      if (!wsServer) {
        return res.status(500).json({
          success: false,
          error: "WebSocket server not available",
        });
      }

      const device = wsServer.jsonrpc.findDeviceById
        ? wsServer.jsonrpc.findDeviceById(deviceId)
        : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: "Device not found",
        });
      }

      const components = DeviceService.extractComponents(device.config);
      return res.json({ success: true, data: components });
    } catch (error) {
      apiLogger.error(error, { operation: "getComponents" });
      return res.status(500).json({
        success: false,
        error: error.message,
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
      return res.json({ success: true, message: "Device deleted" });
    } catch (error) {
      apiLogger.error(error, { operation: "deleteDevice" });
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
