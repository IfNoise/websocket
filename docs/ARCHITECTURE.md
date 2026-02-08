# Архитектура сервера с состоянием

## Обзор

Сервер теперь включает полноценное состояние устройств с использованием SQLite и гибкую систему хранения метаданных.

## Структура проекта

```
websocket/
├── src/
│   ├── database/
│   │   └── db.js                 # Инициализация БД и схема
│   ├── models/
│   │   ├── Device.js             # Модель устройства
│   │   └── ComponentMetadata.js  # Модель метаданных компонентов
│   ├── services/
│   │   ├── DeviceService.js      # Бизнес-логика для устройств
│   │   └── MetadataService.js    # Бизнес-логика для метаданных
│   ├── controllers/
│   │   ├── DeviceController.js   # HTTP контроллер устройств
│   │   └── MetadataController.js # HTTP контроллер метаданных
│   ├── routes.js                 # API маршруты
│   └── JSONRPCwsServerWithDB.js  # Расширенный WS сервер с БД
├── data/
│   └── devices.db                # SQLite база данных
├── index.js                      # Главный файл сервера
└── json-rpc-ws.js               # Базовый JSON-RPC сервер
```

## База данных

### Таблица `devices`
Хранит информацию об устройствах:
- `id` - ID устройства (например, "esp32_A8A154")
- `address` - IP адрес
- `status` - Статус (connected/disconnected)
- `config` - JSON с полной конфигурацией устройства
- `state` - JSON с текущим состоянием
- `last_seen` - Последняя активность
- `created_at`, `updated_at` - Временные метки

### Таблица `component_metadata`
Хранит метаданные для компонентов устройств:
- `id` - Автоинкремент ID
- `device_id` - Ссылка на устройство
- `component_type` - Тип компонента ('irrigator', 'timer', 'output')
- `component_key` - Ключ компонента ('irr1', 'light1', и т.д.)
- `metadata` - JSON с произвольными метаданными
- `created_at`, `updated_at` - Временные метки

## API Endpoints

### Устройства в БД

#### `GET /api/db/devices`
Получить все устройства из БД
```bash
curl http://localhost:3600/api/db/devices
# Фильтр по статусу:
curl http://localhost:3600/api/db/devices?status=connected
```

#### `GET /api/db/devices/:deviceId`
Получить конкретное устройство
```bash
curl http://localhost:3600/api/db/devices/esp32_A8A154
```

#### `PUT /api/db/devices/:deviceId/config`
Обновить конфигурацию устройства в БД
```bash
curl -X PUT http://localhost:3600/api/db/devices/esp32_A8A154/config \
  -H "Content-Type: application/json" \
  -d '{"config": {"device": {"id": "esp32_A8A154"}}}'
```

#### `PUT /api/db/devices/:deviceId/state`
Обновить состояние устройства
```bash
curl -X PUT http://localhost:3600/api/db/devices/esp32_A8A154/state \
  -H "Content-Type: application/json" \
  -d '{"state": {"outputs": {"Valve1": true}}}'
```

#### `GET /api/db/devices/:deviceId/components`
Извлечь компоненты из конфигурации устройства
```bash
curl http://localhost:3600/api/db/devices/esp32_A8A154/components
```

Ответ:
```json
{
  "success": true,
  "data": {
    "irrigators": [
      {"key": "irr1", "name": "Irrigator1", "enable": true, ...},
      {"key": "irr2", "name": "Irrigator2", "enable": true, ...}
    ],
    "timers": [
      {"key": "light1", "name": "LightTimer", ...}
    ],
    "pcfOutputs": [
      {"key": "pcfout1", "name": "Light", ...}
    ]
  }
}
```

### Метаданные компонентов

#### `GET /api/devices/:deviceId/metadata`
Получить все метаданные устройства
```bash
curl http://localhost:3600/api/devices/esp32_A8A154/metadata
# Фильтр по типу:
curl http://localhost:3600/api/devices/esp32_A8A154/metadata?componentType=irrigator
```

#### `GET /api/devices/:deviceId/metadata/:componentType/:componentKey`
Получить метаданные конкретного компонента
```bash
curl http://localhost:3600/api/devices/esp32_A8A154/metadata/irrigator/irr1
```

#### `POST /api/devices/:deviceId/metadata`
Сохранить метаданные компонента
```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "componentType": "irrigator",
    "componentKey": "irr1",
    "metadata": {
      "schedule": {"type": "daily", "times": [43200, 72000]},
      "wateringTable": [
        {"day": 1, "duration": 600, "start": 43200},
        {"day": 2, "duration": 600, "start": 43200}
      ],
      "notes": "Generated for tomatoes",
      "lastModified": 1709817600000
    }
  }'
```

#### `POST /api/devices/:deviceId/metadata/bulk`
Пакетное сохранение метаданных
```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/metadata/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "metadataList": [
      {
        "componentType": "irrigator",
        "componentKey": "irr1",
        "metadata": {"notes": "Tomatoes zone"}
      },
      {
        "componentType": "irrigator",
        "componentKey": "irr2",
        "metadata": {"notes": "Cucumbers zone"}
      }
    ]
  }'
```

### Специализированные методы для ирригаторов

#### `GET /api/devices/:deviceId/irrigators/metadata`
Получить метаданные всех ирригаторов
```bash
curl http://localhost:3600/api/devices/esp32_A8A154/irrigators/metadata
```

#### `GET /api/devices/:deviceId/irrigators/:irrigatorKey/metadata`
Получить метаданные конкретного ирригатора
```bash
curl http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/metadata
```

#### `POST /api/devices/:deviceId/irrigators/:irrigatorKey/metadata`
Сохранить метаданные ирригатора (с авто-добавлением timestamp)
```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "wateringTable": [
        {"day": 1, "duration": 600, "start": 43200},
        {"day": 2, "duration": 600, "start": 43200}
      ],
      "schedule": {
        "type": "interval",
        "interval": 3600,
        "startTime": 43200,
        "endTime": 72000
      },
      "cropType": "tomatoes",
      "notes": "Auto-generated schedule"
    }
  }'
```

### Irrigation Table API

#### `POST /api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table`
Установить таблицу поливов для ирригатора
- Сохраняет в метаданные на сервере
- **АВТОМАТИЧЕСКИ** отправляет на устройство через RPC `Set.IrrigationTable`
- Сохраняет параметры стратегии для истории и редактирования

```bash
curl -X POST http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/irrigation-table \
  -H "Content-Type: application/json" \
  -d '{
    "irrigationTable": [
      {"start": 43200, "stop": 43800},
      {"start": 72000, "stop": 72600}
    ],
    "strategyParams": {
      "lightsOnTimeSeconds": 28800,
      "lightsOffTimeSeconds": 72000,
      "substrateWaterCapacityLiters": 10,
      "dripperFlowRateLph": 2,
      "emittersPerPot": 2,
      "waterLossRateLitersPerHour": 0.1,
      "evaporationCoefficient": 1,
      "initialDrybackPercent": 20,
      "targetPeakPercent": 85,
      "maintenanceMinPercent": 60,
      "p1StartDelayMinutes": 30,
      "p1ShotVolumePercent": 5,
      "p1ShotIntervalMinutes": 15,
      "p2TargetDrainagePercent": 10,
      "p3DrybackMinutes": 60
    }
  }'
```

Подробнее о параметрах стратегии: [STRATEGY_PARAMS.md](STRATEGY_PARAMS.md)

Формат таблицы:
- `start` - время начала полива (секунды с начала дня, 0-86400)
- `stop` - время окончания полива (секунды с начала дня, 0-86400)

#### `GET /api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table`
Получить таблицу поливов

Query параметры:
- `source=metadata` (default) - получить из метаданных сервера
- `source=device` - получить напрямую с устройства через RPC `Get.IrrigationTable`

```bash
# Из метаданных
curl http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/irrigation-table

# С устройства
curl http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/irrigation-table?source=device
```

#### `PUT /api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table/sync`
Синхронизировать таблицу поливов с устройством
- Берет таблицу из метаданных сервера
- Отправляет на устройство через RPC

```bash
curl -X PUT http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/irrigation-table/sync
```

## RPC интеграция

### Отправка таблицы на устройство

При вызове POST `/irrigation-table` с `syncToDevice: true`, сервер автоматически вызывает:

```javascript
device.call('Set.IrrigationTable', {
  irrigator_name: 'Irrigator1',  // из config.irr1.name
  reg_map: '[{"start":43200,"stop":43800}]'
});
```

### Получение таблицы с устройства

При вызове GET `/irrigation-table?source=device`, сервер вызывает:

```javascript
device.call('Get.IrrigationTable', {
  irrigator_name: 'Irrigator1'
});
```

Устройство возвращает:
```json
{
  "reg_map": "[{\"start\":43200,\"stop\":43800}]"
}
```

## Пример использования

### 1. Сохранение таблицы поливов для ирригатора

```javascript
// Пример: сохранить таблицу поливов с метаданными
const response = await fetch(
  'http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/metadata',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metadata: {
        wateringTable: [
          { day: 1, duration: 600, start: 43200 },
          { day: 2, duration: 600, start: 43200 },
          { day: 3, duration: 900, start: 43200 }
        ],
        schedule: {
          type: 'daily',
          timesPerDay: 24,
          windowSize: 150
        },
        cropType: 'tomatoes',
        soilType: 'loam',
        area: 50, // квадратных метров
        flowRate: 2.5, // литров в минуту
        notes: 'Оптимизированный график для томатов в теплице'
      }
    })
  }
);

const result = await response.json();
console.log('Saved:', result);
```

### 2. Получение всех метаданных ирригаторов

```javascript
const response = await fetch(
  'http://localhost:3600/api/devices/esp32_A8A154/irrigators/metadata'
);
const { data } = await response.json();

// data будет массивом всех метаданных ирригаторов
data.forEach(item => {
  console.log(`${item.component_key}:`, item.metadata);
});
```

### 3. Работа с компонентами устройства

```javascript
// Получить компоненты устройства
const response = await fetch(
  'http://localhost:3600/api/db/devices/esp32_A8A154/components'
);
const { data } = await response.json();

// Сохранить метаданные для каждого ирригатора
for (const irrigator of data.irrigators) {
  await fetch(
    `http://localhost:3600/api/devices/esp32_A8A154/irrigators/${irrigator.key}/metadata`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: {
          name: irrigator.name,
          enabled: irrigator.enable,
          mode: irrigator.mode,
          // дополнительные метаданные
          customSchedule: { ... }
        }
      })
    }
  );
}
```

## Автоматическое сохранение состояния

Сервер автоматически:
1. Сохраняет устройства при подключении
2. Обновляет статус при отключении
3. Периодически обновляет last_seen (каждые 30 секунд)
4. Сохраняет конфигурацию при получении от устройства

## Миграция существующего кода

Старые эндпоинты остались без изменений для обратной совместимости:
- `GET /api/devices` - список подключенных устройств (из памяти)
- `GET /api/devices/:deviceId/getState` - получить состояние от устройства
- `POST /api/devices/:deviceId/call` - вызвать метод на устройстве
- и т.д.

Новые эндпоинты добавлены с префиксами:
- `/api/db/*` - работа с БД
- `/api/devices/:deviceId/metadata` - работа с метаданными

## Расширяемость

Система легко расширяется для новых типов компонентов:

1. Добавить извлечение в `DeviceService.extractComponents()`
2. Создать специализированные методы в `MetadataService` (по примеру irrigator)
3. Добавить роуты в `routes.js`
4. Добавить контроллеры в `MetadataController`

Например, для таймеров света:
```javascript
// В MetadataService
static saveLightTimerMetadata(deviceId, timerKey, metadata) {
  return this.saveMetadata(deviceId, 'timer', timerKey, {
    ...metadata,
    updatedAt: Date.now(),
  });
}
```
