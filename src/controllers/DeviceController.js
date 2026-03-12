import { DeviceService } from "../services/DeviceService.js";
import { apiLogger } from "../utils/logger.js";

function resolveDevice(wsServer, deviceId) {
  return wsServer.jsonrpc.findDeviceById
    ? wsServer.jsonrpc.findDeviceById(deviceId)
    : wsServer.jsonrpc.getDevices().find((d) => d.deviceId === deviceId);
}

function isReadOnlyMethod(method = "") {
  const normalized = method.toLowerCase();
  return (
    normalized.startsWith("get.") ||
    normalized.startsWith("config.get") ||
    normalized === "ping"
  );
}

function isStateChangingMethod(method = "") {
  const normalized = method.toLowerCase();
  return (
    normalized.startsWith("set.") ||
    normalized.startsWith("toggle.") ||
    normalized.startsWith("strategy.") ||
    normalized.startsWith("config.set") ||
    normalized.startsWith("config.save")
  );
}

function isIdempotentMethod(method = "") {
  const normalized = method.toLowerCase();
  if (normalized.startsWith("toggle.")) return false;
  return true;
}

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

      const device = resolveDevice(wsServer, deviceId);

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

      const device = resolveDevice(wsServer, deviceId);

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

      const device = resolveDevice(wsServer, deviceId);

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

      const readOnly = isReadOnlyMethod(method);
      const stateChanging = isStateChangingMethod(method);

      // Read-only вызовы не ставим в очередь: либо отвечаем быстро, либо честно возвращаем offline.
      if (readOnly) {
        const device = resolveDevice(wsServer, deviceId);
        if (!device || !wsServer.isDeviceConnected(deviceId)) {
          return res.status(503).json({
            success: false,
            error: "Device is offline",
          });
        }

        const result = await device.call(method, params || {});
        return res.json({ success: true, data: result });
      }

      const connected = wsServer.isDeviceConnected(deviceId);
      const result = await wsServer.callDevice(deviceId, method, params || {}, {
        stateChanging,
        idempotent: isIdempotentMethod(method),
        waitForExecution: connected,
      });

      if (result?.queued) {
        return res.status(202).json({
          success: true,
          queued: true,
          data: result,
          message: "Command queued and will be delivered when device reconnects",
        });
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

      const connected = wsServer.isDeviceConnected(deviceId);

      // Обновляем конфигурацию на устройстве через надежную очередь команд
      const setResult = await wsServer.callDevice(
        deviceId,
        "Config.Set",
        { config },
        {
          timeoutMs: 2000,
          stateChanging: true,
          waitForExecution: connected,
          idempotent: true,
        },
      );

      if (setResult?.queued) {
        return res.status(202).json({
          success: true,
          queued: true,
          data: setResult,
          message: "Config.Set queued and will be applied after reconnect",
        });
      }

      if (setResult && setResult.error) {
        return res.status(400).json({ success: false, error: setResult.error });
      }

      const currentDevice = resolveDevice(wsServer, deviceId);
      if (currentDevice) {
        currentDevice.config = setResult.result || currentDevice.config;
      }

      if (setResult?.result) {
        DeviceService.updateDeviceConfig(deviceId, setResult.result);
      }

      // Сохраняем конфигурацию
      const saveResult = await wsServer.callDevice(
        deviceId,
        "Config.Save",
        { reboot: reboot || false },
        {
          stateChanging: true,
          waitForExecution: connected,
          idempotent: true,
        },
      );

      if (saveResult?.queued) {
        return res.status(202).json({
          success: true,
          queued: true,
          data: saveResult,
          message: "Config.Save queued and will be applied after reconnect",
        });
      }

      if (saveResult && saveResult.error) {
        return res
          .status(400)
          .json({ success: false, error: saveResult.error });
      }

      // Обновляем устройство в фоне
      currentDevice?.update?.();

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

      const device = resolveDevice(wsServer, deviceId);

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
