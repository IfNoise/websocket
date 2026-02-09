# IoT WebSocket Server для управления поливом

Сервер для управления IoT устройствами (ESP32) с системой автоматического полива, использующий JSON-RPC через WebSocket и REST API для управления.

## 🚀 Основные возможности

- **WebSocket JSON-RPC** сервер для связи с ESP32 устройствами
- **WebSocket канал статусов** для публикации обновлений устройств в реальном времени
- **SQLite база данных** для хранения состояния устройств и метаданных
- **REST API** для управления устройствами и таблицами поливов
- **Winston логирование** с опциональной интеграцией Grafana Loki
- **Автоматическая синхронизация** таблиц поливов с устройствами
- **Параметры стратегии полива** для точной настройки режимов

## 📦 Установка

```bash
npm install
```

## 🔧 Конфигурация

Создайте файл `.env` на основе `.env.example`:

```env
# WebSocket и API
WS_PORT=8082
STATUS_WS_PORT=8081
API_PORT=3600

# Логирование
LOG_LEVEL=info
LOG_TO_FILE=false
NODE_ENV=development

# Опционально: Grafana Loki
# LOKI_URL=http://localhost:3100
```

## 🏃 Запуск

```bash
# Запуск сервера
npm run server

# Запуск клиента (React)
npm run client

# Запуск обоих
npm run dev
```

## 📚 Документация

- [**swagger.json**](swagger.json) - 📖 OpenAPI 3.0 спецификация API
- [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) - Архитектура сервера
- [**docs/STATUS_WEBSOCKET.md**](docs/STATUS_WEBSOCKET.md) - WebSocket канал для публикации статусов
- [**docs/LOGGING.md**](docs/LOGGING.md) - Система логирования Winston + Loki
- [**docs/STRATEGY_PARAMS.md**](docs/STRATEGY_PARAMS.md) - Параметры стратегии полива

### 📖 Просмотр API документации

**Онлайн (без установки):**

```bash
# Откройте https://editor.swagger.io и загрузите swagger.json
```

**В проекте:**

```bash
npm install swagger-ui-express

# Добавьте в index.js:
# import swaggerUi from 'swagger-ui-express';
# import swaggerDocument from './swagger.json' assert { type: 'json' };
# app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

# Откройте http://localhost:3600/api-docs
```

## 🎯 API Endpoints

### Управление устройством

```bash
GET  /api/devices/:deviceId/config      # Конфигурация
PUT  /api/devices/:deviceId/config      # Обновить конфигурацию
GET  /api/devices/:deviceId/state       # Состояние
PUT  /api/devices/:deviceId/state       # Обновить состояние
GET  /api/devices/:deviceId/components  # Список компонентов
```

### Универсальный API компонентов

Работает для всех типов: **irrigators, outputs, pcfOutputs, sensors, timers**

```bash
GET  /api/devices/:deviceId/:type/:key  # Получить данные
POST /api/devices/:deviceId/:type/:key  # Установить данные
```

### Примеры использования

**Ирригатор:**

```bash
# Получить
curl http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1

# Установить
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1 \
  -H "Content-Type: application/json" \
  -d '{
    "irrigationTable": [{"start": 43200, "stop": 43800}],
    "strategyParams": {"lightsOnTimeSeconds": 28800, "dripperFlowRateLph": 2}
  }'
```

**Выход:**

```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/outputs/out1 \
  -d '{"description": "Main pump", "maxPower": 500}'
```

**PCF выход:**

```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/pcfOutputs/pcfout1 \
  -d '{"description": "LED strip", "zone": "area-1"}'
```

**Датчик:**

```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/sensors/temp1 \
  -d '{"description": "Temperature", "unit": "celsius"}'
```

### Обратная совместимость

Старый API для ирригаторов продолжает работать:

```bash
# Legacy endpoints (работают)
POST /api/devices/:id/irrigators/:key/irrigation-table
GET  /api/devices/:id/irrigators/:key/irrigation-table
```

## 🧪 Тестирование API

Используйте тестовый скрипт:

```bash
chmod +x test-api.sh
./test-api.sh
```

## 🏗️ Архитектура

```
├── index.js                    # Главный файл сервера
├── json-rpc-ws.js             # Базовый JSON-RPC сервер
└── src/
    ├── database/
    │   └── db.js              # Инициализация SQLite
    ├── models/
    │   ├── Device.js          # Модель устройства
    │   └── ComponentMetadata.js  # Модель метаданных
    ├── services/
    │   ├── DeviceService.js   # Бизнес-логика устройств
    │   ├── MetadataService.js # Бизнес-логика метаданных
    │   └── StatusBroadcaster.js  # WebSocket публикация статусов
    ├── controllers/
    │   ├── DeviceController.js   # HTTP контроллер устройств
    │   └── MetadataController.js # HTTP контроллер метаданных
    ├── routes.js              # API маршруты
    ├── utils/
    │   └── logger.js          # Winston логгеры
    └── JSONRPCwsServerWithDB.js  # Расширенный WS сервер
```

### WebSocket каналы

- **:8080** - JSON-RPC для устройств (ESP32)
- **:8081** - Публикация статусов для клиентов (новое!)
- **:3600** - HTTP REST API

## 🗄️ База данных

SQLite с двумя основными таблицами:

**devices** - состояние устройств

- id, address, status
- config (JSON) - конфигурация
- state (JSON) - текущее состояние
- last_seen, created_at, updated_at

**component_metadata** - метаданные компонентов

- device_id, component_type, component_key
- metadata (JSON) - произвольные данные
  - irrigationTable - таблица поливов
  - strategyParams - параметры стратегии
  - cropType, notes и др.

## 📡 API Endpoints

### Устройства

- `GET /api/db/devices` - список устройств
- `GET /api/db/devices/:deviceId` - информация об устройстве
- `PUT /api/db/devices/:deviceId/config` - обновить конфигурацию
- `PUT /api/db/devices/:deviceId/state` - обновить состояние
- `GET /api/db/devices/:deviceId/components` - извлечь компоненты

### Метаданные

- `GET /api/devices/:deviceId/metadata` - все метаданные
- `POST /api/devices/:deviceId/metadata` - сохранить метаданные
- `GET /api/devices/:deviceId/irrigators/metadata` - метаданные ирригаторов

### Таблицы поливов

- `POST /api/devices/:deviceId/irrigators/:key/irrigation-table` - установить таблицу
- `GET /api/devices/:deviceId/irrigators/:key/irrigation-table` - получить таблицу
- `PUT /api/devices/:deviceId/irrigators/:key/irrigation-table/sync` - синхронизировать

## 🔌 RPC методы устройств

Устройства ESP32 поддерживают следующие RPC методы:

- `Get.State` - получить состояние устройства
- `Get.Outputs` - получить состояние выходов
- `Set.IrrigationTable` - установить таблицу поливов
- `Get.IrrigationTable` - получить таблицу поливов
- `Config.Get` - получить конфигурацию

## 📡 WebSocket канал статусов

Клиенты могут подписаться на обновления устройств в реальном времени:

```javascript
const ws = new WebSocket('ws://localhost:8081');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'device_update') {
    console.log(`Device ${message.deviceId}: ${message.data.eventType}`);
  }
};
```

**Пример запуска:**
```bash
node examples/status-client.js
```

Подробнее см. [docs/STATUS_WEBSOCKET.md](docs/STATUS_WEBSOCKET.md)

## 📊 Логирование

Структурированное логирование через Winston:

- **deviceLogger** - события устройств (подключение, RPC)
- **apiLogger** - HTTP запросы и ошибки
- **dbLogger** - SQL запросы и ошибки БД
- **metadataLogger** - операции с метаданными

### Опциональная интеграция Loki

```bash
# Запустить Loki + Grafana
docker-compose -f docker-compose.loki.yml up -d

# Открыть Grafana
open http://localhost:3000
# Логин: admin / admin
```

## 🛠️ Технологии

- **Node.js** - серверная платформа
- **Express** - HTTP сервер
- **WebSocket (ws)** - WebSocket сервер
- **better-sqlite3** - SQLite база данных
- **Winston** - логирование
- **winston-loki** - интеграция с Grafana Loki
- **express-validator** - валидация запросов

## 🤝 Разработка

### Структура коммитов

Используем conventional commits:

```bash
feat: добавить новую функцию
fix: исправить баг
docs: обновить документацию
refactor: рефакторинг кода
test: добавить тесты
```

### Ветки

- `main` - стабильная версия
- `feature/*` - новые функции
- `fix/*` - исправления

## 📝 Лицензия

ISC

## 👥 Автор

IfNoise
