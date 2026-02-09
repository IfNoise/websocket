import JSONRPCws from "../json-rpc-ws.js";
import { DeviceService } from "./services/DeviceService.js";
import { StatusBroadcaster } from "./services/StatusBroadcaster.js";
import { getDb } from "./database/db.js";
import logger, { deviceLogger } from "./utils/logger.js";

/**
 * Расширенный JSON-RPC WebSocket сервер с интеграцией БД
 * Автоматически сохраняет состояние устройств в базу данных
 */
export class JSONRPCwsServerWithDB {
  constructor(port, options = {}) {
    this.port = port;
    this.options = options;

    // Инициализация БД
    getDb();
    logger.info("Database initialized");

    // Создание базового JSON-RPC сервера
    this.jsonrpc = JSONRPCws(port, this._onDeviceConnect.bind(this), {
      ...options,
      logger, // Передаем Winston logger
    });

    // Инициализация StatusBroadcaster на отдельном порту
    const statusPort = options.statusPort || port + 1;
    this.statusBroadcaster = new StatusBroadcaster(statusPort, DeviceService);
    this.statusBroadcaster.start();

    // Связать broadcaster с DeviceService
    DeviceService.setBroadcaster(this.statusBroadcaster);

    // Подписка на события
    this._setupEventHandlers();

    // Запуск сервера
    this.jsonrpc.start();
    logger.info(`WebSocket server started on port ${port}`);

    // Периодическое обновление статусов (каждые 30 секунд)
    this._startStatusMonitor();

    // Периодический опрос состояния устройств
    this._startStatePolling();
  }

  /**
   * Обработчик подключения устройства
   * @private
   */
  _onDeviceConnect(device) {
    deviceLogger.connect(device.deviceId || "unknown", device.address);

    // Сохранить устройство в БД
    if (device.deviceId) {
      try {
        DeviceService.registerDevice({
          id: device.deviceId,
          address: device.address,
          config: device.config,
          state: null,
        });
        logger.info("Device saved to database", { deviceId: device.deviceId });
      } catch (err) {
        deviceLogger.error(device.deviceId, err, { operation: "register" });
      }
    }
  }

  /**
   * Настройка обработчиков событий
   * @private
   */
  _setupEventHandlers() {
    // Событие подключения устройства
    this.jsonrpc.on("device", (device) => {
      this._onDeviceConnected(device);
    });

    // Событие отключения устройства
    this.jsonrpc.on("disconnect", (device) => {
      this._onDeviceDisconnected(device);
    });

    // Уведомления от устройств
    this.jsonrpc.on("notification", (device, frame) => {
      this._onDeviceNotification(device, frame);
    });
  }

  /**
   * Обработчик успешного подключения и инициализации устройства
   * @private
   */
  _onDeviceConnected(device) {
    if (!device.deviceId) return;

    try {
      // Обновить устройство в БД
      DeviceService.registerDevice({
        id: device.deviceId,
        address: device.address,
        config: device.config,
        state: null,
      });

      // Получить текущее состояние и сохранить
      const startTime = Date.now();
      device
        .call("Get.State", {})
        .then((result) => {
          DeviceService.updateDeviceState(device.deviceId, result);
          deviceLogger.rpcResponse(
            device.deviceId,
            "Get.State",
            true,
            Date.now() - startTime,
          );
        })
        .catch((err) => {
          deviceLogger.error(device.deviceId, err, { method: "Get.State" });
        });
    } catch (err) {
      deviceLogger.error(device.deviceId, err, {
        operation: "device_connected",
      });
    }
  }

  /**
   * Обработчик отключения устройства
   * @private
   */
  _onDeviceDisconnected(device) {
    if (!device.deviceId) return;

    deviceLogger.disconnect(device.deviceId, device.address);

    try {
      DeviceService.updateDeviceStatus(device.deviceId, "disconnected");
    } catch (err) {
      deviceLogger.error(device.deviceId, err, { operation: "disconnect" });
    }
  }

  /**
   * Обработчик уведомлений от устройств
   * @private
   */
  _onDeviceNotification(device, frame) {
    if (!device.deviceId) return;

    logger.debug("Notification from device", {
      deviceId: device.deviceId,
      method: frame.method,
      params: frame.params,
    });

    try {
      // Обработка различных типов уведомлений
      switch (frame.method) {
        case "State.Changed":
        case "state.changed":
          // Устройство сообщает об изменении состояния (например, выходы)
          if (frame.params) {
            DeviceService.updateDeviceState(device.deviceId, frame.params);
            deviceLogger.info(
              device.deviceId,
              "State changed via notification",
              {
                state: frame.params,
              },
            );
          }
          break;

        case "Config.Changed":
        case "config.changed":
          // Устройство сообщает об изменении конфигурации
          if (frame.params) {
            DeviceService.updateDeviceConfig(device.deviceId, frame.params);
            deviceLogger.info(
              device.deviceId,
              "Config changed via notification",
              {
                config: frame.params,
              },
            );
          }
          break;

        case "Event":
        case "event":
          // Общие события от устройства (для будущего использования)
          deviceLogger.info(device.deviceId, "Device event", {
            event: frame.params,
          });
          break;

        default:
          deviceLogger.debug(device.deviceId, "Unhandled notification", {
            method: frame.method,
            params: frame.params,
          });
      }
    } catch (err) {
      deviceLogger.error(device.deviceId, err, {
        operation: "notification_handler",
        method: frame.method,
      });
    }
  }

  /**
   * Мониторинг статусов устройств
   * @private
   */
  _startStatusMonitor() {
    this.statusInterval = setInterval(() => {
      const devices = this.jsonrpc.getDevices();
      let updated = 0;

      devices.forEach((device) => {
        if (!device.deviceId) return;

        try {
          const status =
            device.ws?.readyState === 1 ? "connected" : "disconnected";
          DeviceService.updateDeviceStatus(device.deviceId, status);
          updated++;
        } catch (err) {
          logger.error("Failed to update device status", {
            deviceId: device.deviceId,
            error: err.message,
          });
        }
      });

      if (updated > 0) {
        logger.debug(`Updated status for ${updated} device(s)`);
      }
    }, 30000); // Каждые 30 секунд
  }

  /**
   * Периодический опрос состояния устройств
   * @private
   */
  _startStatePolling() {
    // Интервал опроса из переменных окружения (по умолчанию 5 секунд)
    const pollInterval = parseInt(process.env.STATE_POLL_INTERVAL) || 5000;

    this.statePollingInterval = setInterval(() => {
      const devices = this.jsonrpc.getDevices();

      devices.forEach((device) => {
        if (!device.deviceId) return;
        if (device.ws?.readyState !== 1) return; // Только подключенные устройства

        // Опросить состояние устройства
        device
          .call("Get.State", {})
          .then((result) => {
            // Обновить состояние в БД и транслировать через WebSocket
            DeviceService.updateDeviceState(device.deviceId, result);
          })
          .catch((err) => {
            // Ошибки опроса не критичны, только логируем на debug уровне
            deviceLogger.debug(device.deviceId, "State polling error", {
              error: err.message,
            });
          });
      });
    }, pollInterval);

    logger.info(`State polling started (interval: ${pollInterval}ms)`);
  }

  /**
   * Получить все устройства
   */
  getDevices() {
    return this.jsonrpc.getDevices();
  }

  /**
   * Найти устройство по ID
   */
  findDeviceById(deviceId) {
    return this.jsonrpc.findDeviceById(deviceId);
  }

  /**
   * Получить устройство из БД
   */
  getDeviceFromDB(deviceId) {
    return DeviceService.getDevice(deviceId);
  }

  /**
   * Получить все устройства из БД
   */
  getAllDevicesFromDB(filters = {}) {
    return DeviceService.getAllDevices(filters);
  }

  /**
   * Broadcast метод ко всем устройствам
   */
  broadcast(method, params, timeoutMs) {
    return this.jsonrpc.broadcast(method, params, timeoutMs);
  }

  /**
   * Закрыть сервер
   */
  close() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    if (this.statePollingInterval) {
      clearInterval(this.statePollingInterval);
    }

    // Закрыть StatusBroadcaster
    if (this.statusBroadcaster) {
      this.statusBroadcaster.close();
    }

    this.jsonrpc.close();
  }
}

/**
 * Фабричная функция для обратной совместимости
 */
export default function createJSONRPCwsServerWithDB(port, options = {}) {
  return new JSONRPCwsServerWithDB(port, options);
}
