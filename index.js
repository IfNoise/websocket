import "dotenv/config";
import JSONRPCws from "./json-rpc-ws.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { param, body, validationResult } from "express-validator";
import hpp from "hpp";
import { JSONRPCwsServerWithDB } from "./src/JSONRPCwsServerWithDB.js";
import apiRoutes from "./src/routes.js";
import logger, { apiLogger } from "./src/utils/logger.js";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger.json" with { type: "json" };

const app = express();
const api = express.Router();

// Basic security middleware
app.set("trust proxy", 1);
app.use(helmet());
app.use(hpp());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// API request logging middleware

app.use(apiLogger.request);

// Swagger API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// logger.info(
//   "Swagger API docs available at http://localhost:" + API_PORT + "/api-docs",
// );

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // limit each IP to 120 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
// End of security middleware

// Configuration ENV
const WS_PORT = process.env.WS_PORT || 8080;
const API_PORT = process.env.API_PORT || 3600;

// Использование нового сервера с интеграцией БД
const jsonrpcServer = new JSONRPCwsServerWithDB(WS_PORT);
const jsonrpc = jsonrpcServer.jsonrpc;

function sendError(res, status, message) {
  apiLogger.error(new Error(message), { status });
  return res.status(status).json({ error: message });
}

api.get("/devices", (req, res) => {
  const devices = jsonrpc.getDevices() || [];
  return res.json(
    devices.map((device) => ({
      id: device.deviceId,
      address: device.address,
      status: device.status,
      config: device.config,
    })),
  );
});

api.get(
  "/devices/:deviceId/getState",
  [param("deviceId").trim().isAlphanumeric().escape()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, "Invalid deviceId");
    const { deviceId } = req.params;
    const device = jsonrpc.findDeviceById
      ? jsonrpc.findDeviceById(deviceId)
      : jsonrpc.getDevices().find((d) => d.deviceId === deviceId);
    if (!device) return sendError(res, 404, "No devices found");
    try {
      const result = await device.call("Get.State", {});
      return res.json(result);
    } catch (err) {
      return sendError(res, 500, err.toString());
    }
  },
);

api.get(
  "/devices/:deviceId/getConfig",
  [param("deviceId").trim().isAlphanumeric().escape()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, "Invalid deviceId");
    const { deviceId } = req.params;
    const device = jsonrpc.findDeviceById
      ? jsonrpc.findDeviceById(deviceId)
      : jsonrpc.getDevices().find((d) => d.deviceId === deviceId);
    if (!device) return sendError(res, 404, "No devices found");
    try {
      const result = await device.call("Config.Get", {});
      return res.json(result.result || result);
    } catch (err) {
      return sendError(res, 500, err.toString());
    }
  },
);

api.get(
  "/devices/:deviceId/getOutputs",
  [param("deviceId").trim().isAlphanumeric().escape()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, "Invalid deviceId");
    const { deviceId } = req.params;
    const device = jsonrpc.findDeviceById
      ? jsonrpc.findDeviceById(deviceId)
      : jsonrpc.getDevices().find((d) => d.deviceId === deviceId);
    if (!device) return sendError(res, 404, "No devices found");
    try {
      const result = await device.call("Get.Outputs", {});
      return res.json(result);
    } catch (err) {
      return sendError(res, 500, err.toString());
    }
  },
);

api.post(
  "/devices/:deviceId/call",
  [
    param("deviceId").trim().isAlphanumeric().escape(),
    body("method")
      .isString()
      .trim()
      .matches(/^[a-zA-Z0-9_.:-]{1,100}$/),
    body("params").optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return sendError(res, 400, "Invalid request payload");
    const { deviceId } = req.params;
    const { method, params } = req.body;
    const device = jsonrpc.findDeviceById
      ? jsonrpc.findDeviceById(deviceId)
      : jsonrpc.getDevices().find((d) => d.deviceId === deviceId);
    if (!device) return sendError(res, 404, "Device not found");
    try {
      const result = await device.call(method, params || {});
      return res.json(result);
    } catch (err) {
      return sendError(res, 500, err.toString());
    }
  },
);

api.post(
  "/devices/:deviceId/setconfig",
  [
    param("deviceId").trim().isAlphanumeric().escape(),
    body("params").isObject(),
    body("reboot").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return sendError(res, 400, "Invalid request payload");
    const { deviceId } = req.params;
    const { reboot, params } = req.body;
    const device = jsonrpc.findDeviceById
      ? jsonrpc.findDeviceById(deviceId)
      : jsonrpc.getDevices().find((d) => d.deviceId === deviceId);
    if (!device) return sendError(res, 404, "Device not found");
    try {
      const setResult = await device.call(
        "Config.Set",
        { config: params },
        2000,
      );
      if (setResult && setResult.error) return res.json(setResult);
      device.config = setResult.result || device.config;
      const saveResult = await device.call("Config.Save", { reboot });
      if (saveResult && saveResult.error) return res.json(saveResult);
      // trigger device update in background
      device.update?.();
      return res.json({ result: "Config updated" });
    } catch (err) {
      return sendError(res, 500, err.toString());
    }
  },
);

// Сохранить ссылку на WebSocket сервер для использования в API
app.locals.wsServer = jsonrpcServer;

// Подключение новых роутов для работы с метаданными и БД
app.use("/api", apiRoutes);

// Подключение старых роутов (для обратной совместимости)
app.use("/api", api);

// Error handling middleware
app.use((err, req, res, next) => {
  apiLogger.error(err, {
    url: req.originalUrl,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(API_PORT, () => {
  logger.info(`HTTP API server started on port ${API_PORT}`);
  logger.info(`WebSocket server running on port ${WS_PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Log level: ${process.env.LOG_LEVEL || "info"}`);

  if (process.env.LOKI_URL) {
    logger.info(`Loki logging enabled: ${process.env.LOKI_URL}`);
  } else {
    logger.info("Loki logging disabled (set LOKI_URL to enable)");
  }
});
