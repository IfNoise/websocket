# Логирование в IoT WebSocket сервере

## Обзор

Сервер использует **Winston** для структурированного логирования с поддержкой:
- **Консольный вывод** с цветами (всегда включен)
- **Файловое логирование** (опционально)
- **Grafana Loki** для централизованного логирования (опционально)

## Быстрый старт

### Базовая конфигурация (.env)

```env
# Уровень логирования: error, warn, info, debug
LOG_LEVEL=info

# Логирование в файлы (опционально)
LOG_TO_FILE=false

# Grafana Loki (опционально, для централизованного логирования)
# LOKI_URL=http://localhost:3100
# LOKI_USERNAME=
# LOKI_PASSWORD=

# Идентификация сервера в логах
SERVER_NAME=main
NODE_ENV=development
```

## Типы логов

### 1. Логи устройств (deviceLogger)

```javascript
import { deviceLogger } from './src/utils/logger.js';

// Подключение устройства
deviceLogger.connect(deviceId, address);

// Отключение устройства
deviceLogger.disconnect(deviceId, address);

// Ошибка устройства
deviceLogger.error(deviceId, error, { context: 'additional info' });

// RPC вызов
deviceLogger.rpcCall(deviceId, 'Config.Get', { params });

// RPC ответ
deviceLogger.rpcResponse(deviceId, 'Config.Get', true, duration);
```

### 2. API логи (apiLogger)

```javascript
import { apiLogger } from './src/utils/logger.js';

// Middleware для логирования всех запросов (уже установлен в index.js)
app.use(apiLogger.request);

// Логирование ошибок API
apiLogger.error(error, { url, method });
```

### 3. Логи базы данных (dbLogger)

```javascript
import { dbLogger } from './src/utils/logger.js';

// Логирование запроса
dbLogger.query(sqlQuery, duration);

// Логирование ошибки БД
dbLogger.error(error, sqlQuery);
```

### 4. Логи метаданных (metadataLogger)

```javascript
import { metadataLogger } from './src/utils/logger.js';

// Сохранение метаданных
metadataLogger.save(deviceId, componentType, componentKey);

// Удаление метаданных
metadataLogger.delete(id, deviceId);
```

### 5. Базовое логирование

```javascript
import logger from './src/utils/logger.js';

logger.error('Error message', { context: 'data' });
logger.warn('Warning message');
logger.info('Info message', { extra: 'info' });
logger.debug('Debug message');
```

## Структура логов

Каждый лог содержит:
- `timestamp` - Временная метка
- `level` - Уровень (error, warn, info, debug)
- `message` - Сообщение
- `event` - Тип события (device.connect, api.request, и т.д.)
- Дополнительные поля в зависимости от типа лога

Пример:
```json
{
  "timestamp": "2026-02-07 19:04:47",
  "level": "info",
  "message": "Device connected",
  "event": "device.connect",
  "deviceId": "esp32_A8A154",
  "address": "192.168.1.100"
}
```

## Файловое логирование

Для включения файлового логирования:

```env
LOG_TO_FILE=true
```

Создаются файлы:
- `logs/combined.log` - все логи
- `logs/error.log` - только ошибки
- `logs/exceptions.log` - неотловленные исключения
- `logs/rejections.log` - неотловленные Promise rejection

## Grafana Loki (опционально)

### Запуск Loki + Grafana локально

```bash
docker-compose -f docker-compose.loki.yml up -d
```

Это запустит:
- **Loki** на `http://localhost:3100`
- **Grafana** на `http://localhost:3000` (admin/admin)
- **Promtail** для сбора файловых логов

### Настройка

Обновите `.env`:
```env
LOKI_URL=http://localhost:3100
```

### Доступ к Grafana

1. Откройте http://localhost:3000
2. Логин: `admin`, пароль: `admin`
3. Loki уже настроен как источник данных

### Примеры запросов в Grafana

```logql
# Все логи приложения
{app="iot-websocket-server"}

# Логи конкретного устройства
{app="iot-websocket-server"} |= "esp32_A8A154"

# Только ошибки
{app="iot-websocket-server"} | level="error"

# События подключения устройств
{app="iot-websocket-server",event="device.connect"}

# API запросы с кодом 500
{app="iot-websocket-server",event="api.request"} | statusCode >= 500

# RPC вызовы
{app="iot-websocket-server",event="device.rpc.call"}
```

## Уровни логирования

- `error` - Ошибки, требующие внимания
- `warn` - Предупреждения
- `info` - Информационные сообщения (по умолчанию)
- `debug` - Детальная отладочная информация

Установите нужный уровень в `.env`:
```env
LOG_LEVEL=debug  # Показывать все логи
LOG_LEVEL=info   # Скрыть debug логи (рекомендуется для production)
LOG_LEVEL=warn   # Показывать только предупреждения и ошибки
LOG_LEVEL=error  # Показывать только ошибки
```

## События логирования

### Устройства
- `device.connect` - Подключение устройства
- `device.disconnect` - Отключение устройства
- `device.error` - Ошибка устройства
- `device.rpc.call` - RPC вызов к устройству
- `device.rpc.response` - RPC ответ от устройства

### API
- `api.request` - HTTP запрос
- `api.error` - Ошибка API

### База данных
- `db.query` - SQL запрос
- `db.error` - Ошибка БД

### Метаданные
- `metadata.save` - Сохранение метаданных
- `metadata.delete` - Удаление метаданных

## Production рекомендации

1. **Уровень логирования**
   ```env
   LOG_LEVEL=info
   ```

2. **Файловое логирование**
   ```env
   LOG_TO_FILE=true
   ```

3. **Централизованное логирование**
   - Используйте Loki для production
   - Настройте ротацию логов (retention в `loki-config.yaml`)
   - Настройте алерты в Grafana

4. **Мониторинг**
   - Создайте дашборды в Grafana для ключевых метрик
   - Настройте уведомления на критичные ошибки

## Примеры использования

### В контроллерах

```javascript
import { apiLogger } from '../utils/logger.js';

export class MyController {
  static async myMethod(req, res) {
    try {
      // ваш код
      return res.json({ success: true });
    } catch (error) {
      apiLogger.error(error, { 
        operation: 'myMethod',
        userId: req.user?.id 
      });
      return res.status(500).json({ error: error.message });
    }
  }
}
```

### При работе с устройствами

```javascript
import { deviceLogger } from './utils/logger.js';

// Вызов RPC
deviceLogger.rpcCall(deviceId, method, params);

const startTime = Date.now();
try {
  const result = await device.call(method, params);
  deviceLogger.rpcResponse(deviceId, method, true, Date.now() - startTime);
  return result;
} catch (error) {
  deviceLogger.error(deviceId, error, { method, params });
  throw error;
}
```

## Troubleshooting

### Логи не отправляются в Loki

1. Проверьте что Loki запущен:
   ```bash
   curl http://localhost:3100/ready
   ```

2. Проверьте переменную окружения:
   ```bash
   echo $LOKI_URL
   ```

3. Проверьте логи контейнера:
   ```bash
   docker logs loki
   ```

### Большой размер логов

1. Уменьшите уровень логирования в production:
   ```env
   LOG_LEVEL=warn
   ```

2. Настройте retention в `loki-config.yaml`:
   ```yaml
   limits_config:
     retention_period: 168h  # 7 дней
   ```

3. Включите ротацию файловых логов (можно добавить logrotate)
