import { WebSocketServer } from "ws";
import { EventEmitter } from "events";
import logger from "../utils/logger.js";

/**
 * Сервис для публикации статусов устройств через WebSocket
 * Позволяет клиентам подписываться на обновления в реальном времени
 */
export class StatusBroadcaster extends EventEmitter {
  constructor(port, deviceService) {
    super();
    this.port = port;
    this.clients = new Set();
    this.wss = null;
    this.deviceService = deviceService;
  }

  /**
   * Запустить WebSocket сервер для клиентов
   */
  start() {
    this.wss = new WebSocketServer({ port: this.port }, () => {
      logger.info(`Status broadcast server started on port ${this.port}`);
    });

    this.wss.on("connection", (ws, req) => {
      const clientIp = req?.socket?.remoteAddress || "unknown";
      logger.info("Status client connected", { clientIp });

      this.clients.add(ws);

      // Отправляем приветственное сообщение
      ws.send(
        JSON.stringify({
          type: "welcome",
          message: "Connected to device status broadcaster",
          timestamp: new Date().toISOString(),
        }),
      );

      // Отправляем текущее состояние всех устройств
      this._sendInitialState(ws);

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);
          this._handleClientMessage(ws, data);
        } catch (err) {
          logger.warn("Invalid message from status client", {
            error: err.message,
            clientIp,
          });
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        logger.info("Status client disconnected", { clientIp });
      });

      ws.on("error", (err) => {
        logger.error("Status client WebSocket error", {
          error: err.message,
          clientIp,
        });
        this.clients.delete(ws);
      });
    });

    this.wss.on("error", (err) => {
      logger.error("Status broadcast server error", { error: err.message });
    });
  }

  /**
   * Обработка сообщений от клиентов
   * @private
   */
  _handleClientMessage(ws, data) {
    const { type, deviceId } = data;

    switch (type) {
      case "ping":
        ws.send(
          JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }),
        );
        break;

      case "subscribe":
        // Клиент может подписаться на конкретное устройство
        if (deviceId) {
          ws.subscribedDevices = ws.subscribedDevices || new Set();
          ws.subscribedDevices.add(deviceId);
          ws.send(
            JSON.stringify({
              type: "subscribed",
              deviceId,
              timestamp: new Date().toISOString(),
            }),
          );
          logger.debug("Client subscribed to device", { deviceId });

          // Отправляем текущее состояние конкретного устройства
          this._sendDeviceState(ws, deviceId);
        }
        break;

      case "unsubscribe":
        if (deviceId && ws.subscribedDevices) {
          ws.subscribedDevices.delete(deviceId);
          ws.send(
            JSON.stringify({
              type: "unsubscribed",
              deviceId,
              timestamp: new Date().toISOString(),
            }),
          );
          logger.debug("Client unsubscribed from device", { deviceId });
        }
        break;

      default:
        logger.debug("Unknown message type from client", { type });
    }
  }

  /**
   * Отправить обновление статуса устройства всем подключенным клиентам
   * @param {string} deviceId - ID устройства
   * @param {Object} data - Данные для отправки
   */
  broadcastDeviceUpdate(deviceId, data) {
    if (!this.wss || this.clients.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: "device_update",
      deviceId,
      data,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;
    this.clients.forEach((ws) => {
      try {
        if (ws.readyState === ws.OPEN) {
          // Отправляем если клиент подписан на устройство или на все устройства
          if (!ws.subscribedDevices || ws.subscribedDevices.has(deviceId)) {
            ws.send(message);
            sentCount++;
          }
        }
      } catch (err) {
        logger.error("Failed to send status update to client", {
          error: err.message,
          deviceId,
        });
      }
    });

    if (sentCount > 0) {
      logger.debug("Device update broadcasted", {
        deviceId,
        clientCount: sentCount,
      });
    }
  }

  /**
   * Отправить обновление состояния устройства
   * @param {string} deviceId
   * @param {Object} state
   */
  broadcastDeviceState(deviceId, state) {
    // Debug логирование
    if (process.env.LOG_LEVEL === 'debug') {
      const subscribedCount = this.subscriptions.get(deviceId)?.size || 0;
      console.log(`[StatusBroadcaster.broadcastDeviceState] ${deviceId}: subscribers=${subscribedCount}, state=${JSON.stringify(state).substring(0, 100)}...`);
    }

    this.broadcastDeviceUpdate(deviceId, {
      eventType: "state_changed",
      state,
    });
  }

  /**
   * Отправить обновление статуса устройства
   * @param {string} deviceId
   * @param {string} status - 'connected' | 'disconnected' | 'error'
   */
  broadcastDeviceStatus(deviceId, status) {
    this.broadcastDeviceUpdate(deviceId, {
      eventType: "status_changed",
      status,
    });
  }

  /**
   * Отправить обновление конфигурации устройства
   * @param {string} deviceId
   * @param {Object} config
   */
  broadcastDeviceConfig(deviceId, config) {
    this.broadcastDeviceUpdate(deviceId, {
      eventType: "config_changed",
      config,
    });
  }

  /**
   * Отправить начальное состояние всех устройств клиенту при подключении
   * @private
   * @param {WebSocket} ws - WebSocket клиента
   */
  async _sendInitialState(ws) {
    try {
      const devices = await this.deviceService.getAllDevices();

      if (devices && devices.length > 0) {
        logger.debug("Sending initial state", { deviceCount: devices.length });

        devices.forEach((device) => {
          if (device.state) {
            try {
              const message = JSON.stringify({
                type: "device_update",
                deviceId: device.id,
                data: {
                  eventType: "state_changed",
                  state: device.state,
                },
                timestamp: new Date().toISOString(),
              });

              if (ws.readyState === ws.OPEN) {
                ws.send(message);
              }
            } catch (err) {
              logger.error("Failed to send initial state for device", {
                deviceId: device.id,
                error: err.message,
              });
            }
          }
        });
      }
    } catch (err) {
      logger.error("Failed to send initial state", { error: err.message });
    }
  }

  /**
   * Отправить состояние конкретного устройства клиенту
   * @private
   * @param {WebSocket} ws - WebSocket клиента
   * @param {string} deviceId - ID устройства
   */
  async _sendDeviceState(ws, deviceId) {
    try {
      const device = await this.deviceService.getDevice(deviceId);

      if (device && device.state) {
        const message = JSON.stringify({
          type: "device_update",
          deviceId: device.id,
          data: {
            eventType: "state_changed",
            state: device.state,
          },
          timestamp: new Date().toISOString(),
        });

        if (ws.readyState === ws.OPEN) {
          ws.send(message);
          logger.debug("Device state sent to client", { deviceId });
        }
      }
    } catch (err) {
      logger.error("Failed to send device state", {
        deviceId,
        error: err.message,
      });
    }
  }

  /**
   * Отправить уведомление об ошибке устройства
   * @param {string} deviceId
   * @param {string|Error} error
   */
  broadcastDeviceError(deviceId, error) {
    this.broadcastDeviceUpdate(deviceId, {
      eventType: "error",
      error: error instanceof Error ? error.message : error,
    });
  }

  /**
   * Получить количество подключенных клиентов
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Остановить сервер
   */
  close() {
    if (this.wss) {
      this.clients.forEach((ws) => {
        try {
          ws.close();
        } catch (err) {
          // ignore
        }
      });
      this.clients.clear();

      this.wss.close(() => {
        logger.info("Status broadcast server closed");
      });
    }
  }
}

// Singleton instance
let broadcasterInstance = null;

/**
 * Получить singleton экземпляр StatusBroadcaster
 * @param {number} port - Порт для WebSocket сервера
 */
export function getStatusBroadcaster(port) {
  if (!broadcasterInstance) {
    broadcasterInstance = new StatusBroadcaster(port);
  }
  return broadcasterInstance;
}

export default StatusBroadcaster;
