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

    // Per-device очередь команд для надежной доставки в условиях нестабильной сети
    this.commandQueues = new Map();
    this.defaultCommandTimeoutMs = options.commandTimeoutMs || 5000;
    this.defaultMaxRetries = options.commandMaxRetries || 3;
    this.defaultRetryBaseDelayMs = options.commandRetryBaseDelayMs || 400;
    this.commandQueueTtlMs = options.commandQueueTtlMs || 10 * 60 * 1000;
    this.commandQueueMaxLength = options.commandQueueMaxLength || 500;
    this.defaultWaitForExecutionTimeoutMs =
      options.waitForExecutionTimeoutMs || 10000;

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

  _buildCommandId(deviceId) {
    return `${deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _isDeviceConnected(device) {
    return Boolean(device && device.ws?.readyState === 1);
  }

  _isRetryableError(err) {
    const message = (err?.message || "").toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("disconnected") ||
      message.includes("socket not open") ||
      message.includes("econnreset") ||
      message.includes("broken pipe")
    );
  }

  _isDeviceOfflineError(err) {
    const message = (err?.message || "").toLowerCase();
    return (
      message.includes("device not connected") ||
      message.includes("socket not open") ||
      message.includes("disconnected")
    );
  }

  _getQueue(deviceId) {
    if (!this.commandQueues.has(deviceId)) {
      this.commandQueues.set(deviceId, {
        processing: false,
        pending: [],
        lastError: null,
        processedCount: 0,
      });
    }

    return this.commandQueues.get(deviceId);
  }

  _enqueueCommand(deviceId, command, { priority = "normal" } = {}) {
    const queue = this._getQueue(deviceId);

    if (queue.pending.length >= this.commandQueueMaxLength) {
      throw new Error(
        `Command queue is full for device ${deviceId} (max: ${this.commandQueueMaxLength})`,
      );
    }

    const queuedCommand = {
      ...command,
      enqueuedAt: Date.now(),
      expiresAt: Date.now() + (command.ttlMs || this.commandQueueTtlMs),
      attempts: 0,
      maxRetries: Number.isInteger(command.maxRetries)
        ? command.maxRetries
        : this.defaultMaxRetries,
      retryBaseDelayMs: command.retryBaseDelayMs || this.defaultRetryBaseDelayMs,
    };

    if (priority === "high") {
      queue.pending.unshift(queuedCommand);
    } else {
      queue.pending.push(queuedCommand);
    }

    return {
      queueLength: queue.pending.length,
      commandId: queuedCommand.commandId,
    };
  }

  async _syncDeviceState(deviceId) {
    const device = this.findDeviceById(deviceId);
    if (!this._isDeviceConnected(device)) {
      throw new Error(`Device not connected: ${deviceId}`);
    }

    const frame = await device.call("Get.State", {}, this.defaultCommandTimeoutMs);
    DeviceService.updateDeviceState(deviceId, frame.result);
    return frame.result;
  }

  async _executeQueuedCommand(deviceId, command) {
    const maxAttempts = Math.max(1, command.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      command.attempts = attempt;

      const device = this.findDeviceById(deviceId);
      if (!this._isDeviceConnected(device)) {
        throw new Error(`Device not connected: ${deviceId}`);
      }

      const startTime = Date.now();
      try {
        const frame = await device.call(
          command.method,
          command.params || {},
          command.timeoutMs || this.defaultCommandTimeoutMs,
        );

        if (frame?.error) {
          throw new Error(
            typeof frame.error === "string"
              ? frame.error
              : frame.error?.message || "RPC returned error",
          );
        }

        let syncedState = null;
        if (command.stateChanging || command.verifyState) {
          syncedState = await this._syncDeviceState(deviceId);
        }

        if (command.verifyState) {
          const isValid = await Promise.resolve(
            command.verifyState({
              state: syncedState,
              result: frame?.result,
              frame,
            }),
          );

          if (!isValid) {
            throw new Error("State verification failed after command execution");
          }
        }

        deviceLogger.rpcResponse(
          deviceId,
          command.method,
          true,
          Date.now() - startTime,
        );

        return frame;
      } catch (err) {
        const retryable =
          command.idempotent !== false &&
          this._isRetryableError(err) &&
          attempt < maxAttempts;

        if (!retryable) {
          throw err;
        }

        const backoffMs = Math.min(
          15000,
          command.retryBaseDelayMs * Math.pow(2, attempt - 1),
        );

        logger.warn("Retrying device command", {
          deviceId,
          method: command.method,
          attempt,
          maxAttempts,
          backoffMs,
          error: err.message,
        });

        await this._wait(backoffMs);
      }
    }

    throw new Error(`Command failed after retries: ${command.method}`);
  }

  async _processDeviceQueue(deviceId) {
    const queue = this._getQueue(deviceId);
    if (queue.processing) return;

    queue.processing = true;
    try {
      while (queue.pending.length > 0) {
        const command = queue.pending[0];

        if (Date.now() > command.expiresAt) {
          queue.pending.shift();
          queue.lastError = "Command expired in queue";
          command.reject?.(new Error("Command expired in queue"));
          continue;
        }

        try {
          const frame = await this._executeQueuedCommand(deviceId, command);
          queue.pending.shift();
          queue.processedCount += 1;
          queue.lastError = null;
          command.resolve?.(frame);
        } catch (err) {
          const isOffline = this._isDeviceOfflineError(err);
          queue.lastError = err.message;

          if (isOffline) {
            // Устройство оффлайн: оставляем команду в голове очереди до реконнекта.
            break;
          }

          queue.pending.shift();
          command.reject?.(err);
          deviceLogger.error(deviceId, err, {
            operation: "command_queue_execution",
            method: command.method,
            commandId: command.commandId,
          });
        }
      }
    } finally {
      queue.processing = false;
    }
  }

  /**
   * Надежный вызов команды на устройстве с очередью, ретраями и восстановлением после реконнекта.
   * @param {string} deviceId
   * @param {string} method
   * @param {Object} params
   * @param {Object} options
   */
  async callDevice(deviceId, method, params = {}, options = {}) {
    if (!deviceId) {
      throw new Error("deviceId is required");
    }
    if (!method) {
      throw new Error("method is required");
    }

    const commandId = options.commandId || this._buildCommandId(deviceId);

    const command = {
      commandId,
      method,
      params,
      timeoutMs: options.timeoutMs,
      stateChanging: options.stateChanging || false,
      idempotent: options.idempotent !== false,
      verifyState: options.verifyState,
      maxRetries: options.maxRetries,
      retryBaseDelayMs: options.retryBaseDelayMs,
      ttlMs: options.ttlMs,
    };

    const executePromise = new Promise((resolve, reject) => {
      command.resolve = resolve;
      command.reject = reject;
    });

    const enqueueResult = this._enqueueCommand(deviceId, command, {
      priority: options.priority,
    });

    // Попытаться обработать очередь сразу, если устройство уже online.
    this._processDeviceQueue(deviceId).catch((err) => {
      logger.error("Failed to process command queue", {
        deviceId,
        error: err.message,
      });
    });

    if (options.waitForExecution === false) {
      executePromise.catch((err) => {
        logger.error("Queued command failed", {
          deviceId,
          method,
          commandId,
          error: err.message,
        });
      });

      return {
        queued: true,
        commandId,
        queueLength: enqueueResult.queueLength,
      };
    }

    const waitTimeoutMs =
      options.waitForExecutionTimeoutMs ?? this.defaultWaitForExecutionTimeoutMs;

    if (!waitTimeoutMs || waitTimeoutMs <= 0) {
      return executePromise;
    }

    const timeoutResult = await Promise.race([
      executePromise,
      this._wait(waitTimeoutMs).then(() => ({
        queued: true,
        deferred: true,
        commandId,
        queueLength: this._getQueue(deviceId).pending.length,
      })),
    ]);

    if (timeoutResult?.queued) {
      executePromise.catch((err) => {
        logger.error("Deferred command failed", {
          deviceId,
          method,
          commandId,
          error: err.message,
        });
      });
    }

    return timeoutResult;
  }

  isDeviceConnected(deviceId) {
    const device = this.findDeviceById(deviceId);
    return this._isDeviceConnected(device);
  }

  getCommandQueueStats(deviceId = null) {
    if (deviceId) {
      const queue = this._getQueue(deviceId);
      return {
        deviceId,
        processing: queue.processing,
        pending: queue.pending.length,
        lastError: queue.lastError,
        processedCount: queue.processedCount,
      };
    }

    return Array.from(this.commandQueues.entries()).map(([id, queue]) => ({
      deviceId: id,
      processing: queue.processing,
      pending: queue.pending.length,
      lastError: queue.lastError,
      processedCount: queue.processedCount,
    }));
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
        .then((frame) => {
          // frame = { id, result, error } - извлекаем только result
          DeviceService.updateDeviceState(device.deviceId, frame.result);
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

      // Если накопились команды во время оффлайна, запускаем очередь после реконнекта.
      this._processDeviceQueue(device.deviceId).catch((err) => {
        deviceLogger.error(device.deviceId, err, {
          operation: "queue_resume_on_reconnect",
        });
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
          .then((frame) => {
            // frame = { id, result, error } - извлекаем только result
            DeviceService.updateDeviceState(device.deviceId, frame.result);
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

    // Завершить ожидающие команды
    this.commandQueues.forEach((queue, deviceId) => {
      queue.pending.forEach((command) => {
        command.reject?.(new Error(`Server closed while command pending: ${deviceId}`));
      });
      queue.pending = [];
      queue.processing = false;
    });
    this.commandQueues.clear();

    this.jsonrpc.close();
  }
}

/**
 * Фабричная функция для обратной совместимости
 */
export default function createJSONRPCwsServerWithDB(port, options = {}) {
  return new JSONRPCwsServerWithDB(port, options);
}
