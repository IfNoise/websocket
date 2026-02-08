# API Routes Documentation

## Device Management Routes

### GET `/api/devices/:deviceId/config`
Получить конфигурацию устройства через RPC.
- **Параметры**: `deviceId` - ID устройства
- **Ответ**: `{ success: true, data: {...config} }`

### PATCH `/api/devices/:deviceId/config`
Обновить конфигурацию устройства на ESP32.
- **Параметры**: `deviceId` - ID устройства
- **Body**: `{ config: {...}, reboot?: boolean }`
- **Логика**: Вызывает `Config.Set` → `Config.Save` на устройстве

### GET `/api/devices/:deviceId/state` *(read-only)*
Получить текущее состояние устройства.
- **Параметры**: `deviceId` - ID устройства
- **Ответ**: `{ success: true, data: {...state} }`

### GET `/api/devices/:deviceId/outputs` *(read-only)*
Получить состояние всех выходов устройства.
- **Параметры**: `deviceId` - ID устройства
- **Ответ**: `{ success: true, data: {...outputs} }`

### POST `/api/devices/:deviceId/call`
Универсальный вызов RPC метода на устройстве.
- **Параметры**: `deviceId` - ID устройства
- **Body**: `{ method: "Method.Name", params?: {...} }`
- **Пример**:
```json
{
  "method": "Get.Sensors",
  "params": {}
}
```

### GET `/api/devices/:deviceId/components`
Получить список всех компонентов устройства (irrigators, outputs, sensors, timers, pcfOutputs).
- **Параметры**: `deviceId` - ID устройства
- **Ответ**: `{ success: true, data: { irrigators: [...], outputs: [...], ... } }`

---

## Universal Component Routes

### GET `/api/devices/:deviceId/:componentType/:componentKey`
Получить данные компонента.
- **Параметры**:
  - `deviceId` - ID устройства
  - `componentType` - тип компонента (`irrigators`, `outputs`, `sensors`, `timers`, `pcfOutputs`)
  - `componentKey` - ключ компонента (например `out1`, `irrigator_0`)
- **Query**: `source=metadata|device` (по умолчанию `metadata`)

### PATCH `/api/devices/:deviceId/:componentType/:componentKey`
Обновить конфигурацию компонента.
- **Параметры**: те же что и в GET
- **Body**: объект с данными компонента
- **Логика**: Сохраняет в БД и синхронизирует с устройством

**Пример для irrigators:**
```bash
PATCH /api/devices/ESP32_001/irrigators/irrigator_0
{
  "name": "Грядка №1",
  "enabled": true,
  "output": "out1"
}
```

---

## Irrigation Table Routes *(Primary API)*

### GET `/api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table`
Получить таблицу поливов ирригатора.
- **Query**: `source=metadata|device`
- **Ответ**:
```json
{
  "success": true,
  "data": {
    "irrigationTable": [...],
    "strategyParams": {
      "enabled": true,
      "soilMoistureThreshold": 30,
      ...
    },
    "lastUpdate": "2026-02-08T05:30:00Z"
  }
}
```

### POST `/api/devices/:deviceId/irrigators/:irrigatorKey/irrigation-table`
Установить таблицу поливов для ирригатора.
- **Body**:
```json
{
  "irrigationTable": [
    { "hour": 6, "minute": 0, "duration": 30, "enabled": true },
    { "hour": 18, "minute": 0, "duration": 20, "enabled": true }
  ],
  "strategyParams": {
    "enabled": true,
    "strategy": "time",
    "soilMoistureThreshold": 30,
    "minInterval": 360,
    "maxDailyIrrigations": 4,
    ...
  }
}
```
- **Логика**: Сохраняет в БД → Синхронизирует с устройством через RPC

---

## HTTP Methods Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/devices/:id/config` | Получить конфигурацию через RPC |
| PATCH | `/devices/:id/config` | Обновить конфигурацию на ESP32 |
| GET | `/devices/:id/state` | Получить состояние *(read-only)* |
| GET | `/devices/:id/outputs` | Получить outputs *(read-only)* |
| POST | `/devices/:id/call` | Универсальный RPC вызов |
| GET | `/devices/:id/components` | Список компонентов |
| GET | `/devices/:id/:type/:key` | Данные компонента |
| PATCH | `/devices/:id/:type/:key` | Обновить компонент |
| GET | `/devices/:id/irrigators/:key/irrigation-table` | Таблица поливов |
| POST | `/devices/:id/irrigators/:key/irrigation-table` | Установить таблицу |

---

## Legacy Routes (index.js)

Старые роуты из `index.js` остаются доступными для обратной совместимости:
- GET `/api/devices` - список устройств
- GET `/api/devices/:deviceId/getState`
- GET `/api/devices/:deviceId/getConfig`
- GET `/api/devices/:deviceId/getOutputs`
- POST `/api/devices/:deviceId/call`
- POST `/api/devices/:deviceId/setconfig`

**Рекомендация**: Используйте новые роуты из `src/routes.js` для нового кода.
