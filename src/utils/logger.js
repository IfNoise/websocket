import winston from "winston";
import LokiTransport from "winston-loki";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Кастомный формат логов
const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  // Добавить stack trace для ошибок
  if (stack) {
    log += `\n${stack}`;
  }

  // Добавить дополнительные метаданные
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }

  return log;
});

// Конфигурация транспортов
const transports = [];

// Console transport (всегда включен)
transports.push(
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      errors({ stack: true }),
      customFormat,
    ),
  }),
);

// File transport для локального хранения
if (process.env.LOG_TO_FILE === "true") {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(
        timestamp(),
        errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  );

  transports.push(
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(
        timestamp(),
        errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  );
}

// Loki transport для централизованного логирования
if (process.env.LOKI_URL) {
  const lokiOptions = {
    host: process.env.LOKI_URL || "http://localhost:3100",
    labels: {
      app: "iot-websocket-server",
      env: process.env.NODE_ENV || "development",
      server: process.env.SERVER_NAME || "main",
    },
    json: true,
    format: combine(
      timestamp(),
      errors({ stack: true }),
      winston.format.json(),
    ),
    replaceTimestamp: true,
    onConnectionError: (err) => {
      console.error("Loki connection error:", err);
    },
  };

  // Добавить basic auth если настроен
  if (process.env.LOKI_USERNAME && process.env.LOKI_PASSWORD) {
    lokiOptions.basicAuth = `${process.env.LOKI_USERNAME}:${process.env.LOKI_PASSWORD}`;
  }

  transports.push(new LokiTransport(lokiOptions));
}

// Создание logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    winston.format.json(),
  ),
  transports,
  exitOnError: false,
});

// Увеличить лимит EventEmitter для предотвращения MaxListeners warning
logger.setMaxListeners(20);
transports.forEach((transport) => {
  if (transport.setMaxListeners) {
    transport.setMaxListeners(20);
  }
});

// Обработка неотловленных исключений
const exceptionsTransport = new winston.transports.File({
  filename: "logs/exceptions.log",
});
exceptionsTransport.setMaxListeners?.(20);
logger.exceptions.handle(exceptionsTransport);

const rejectionsTransport = new winston.transports.File({
  filename: "logs/rejections.log",
});
rejectionsTransport.setMaxListeners?.(20);
logger.rejections.handle(rejectionsTransport);

// Вспомогательные методы для структурированного логирования
export const deviceLogger = {
  connect: (deviceId, address) => {
    logger.info("Device connected", {
      event: "device.connect",
      deviceId,
      address,
    });
  },

  disconnect: (deviceId, address) => {
    logger.info("Device disconnected", {
      event: "device.disconnect",
      deviceId,
      address,
    });
  },

  info: (deviceId, message, context = {}) => {
    logger.info(message, {
      event: "device.info",
      deviceId,
      ...context,
    });
  },

  debug: (deviceId, message, context = {}) => {
    logger.debug(message, {
      event: "device.debug",
      deviceId,
      ...context,
    });
  },

  error: (deviceId, error, context = {}) => {
    logger.error("Device error", {
      event: "device.error",
      deviceId,
      error: error.message || error,
      stack: error.stack,
      ...context,
    });
  },

  rpcCall: (deviceId, method, params) => {
    logger.debug("Device RPC call", {
      event: "device.rpc.call",
      deviceId,
      method,
      params,
    });
  },

  rpcResponse: (deviceId, method, success, duration) => {
    logger.debug("Device RPC response", {
      event: "device.rpc.response",
      deviceId,
      method,
      success,
      duration,
    });
  },
};

export const apiLogger = {
  request: (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? "warn" : "debug";

      logger[logLevel]("API request", {
        event: "api.request",
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
    });

    if (next) next();
  },

  error: (error, context = {}) => {
    logger.error("API error", {
      event: "api.error",
      error: error.message || error,
      stack: error.stack,
      ...context,
    });
  },
};

export const dbLogger = {
  query: (query, duration) => {
    logger.debug("Database query", {
      event: "db.query",
      query: query.substring(0, 200), // Ограничить длину
      duration,
    });
  },

  error: (error, query) => {
    logger.error("Database error", {
      event: "db.error",
      error: error.message || error,
      query: query?.substring(0, 200),
      stack: error.stack,
    });
  },
};

export const metadataLogger = {
  save: (deviceId, componentType, componentKey) => {
    logger.info("Metadata saved", {
      event: "metadata.save",
      deviceId,
      componentType,
      componentKey,
    });
  },

  delete: (id, deviceId) => {
    logger.info("Metadata deleted", {
      event: "metadata.delete",
      id,
      deviceId,
    });
  },
};

export default logger;
