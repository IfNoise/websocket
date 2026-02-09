// API Base URL для HTTP запросов
export const baseUrl = "https://lab-server.lan/wss/";

// WebSocket URL для статусов устройств
// Используйте соответствующий URL вашего сервера:
// - Локальная разработка: ws://localhost:8081
// - Продакшн с SSL: wss://your-domain.com:8081
// - Продакшн с reverse proxy: wss://your-domain.com/status
export const statusWebSocketUrl =
  import.meta.env.VITE_STATUS_WS_URL || "ws://localhost:8081";
