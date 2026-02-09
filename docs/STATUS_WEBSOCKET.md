# WebSocket канал для публикации статусов устройств

Система включает отдельный WebSocket сервер для публикации обновлений статусов устройств в реальном времени.

## Быстрый старт

### 1. Настройка

Добавьте порт для WebSocket канала статусов в `.env`:

```bash
WS_PORT=8080
STATUS_WS_PORT=8081
API_PORT=3600
```

### 2. Запуск сервера

```bash
npm start
```

Сервер автоматически запустит:
- JSON-RPC WebSocket сервер на порту 8080 (для устройств)
- Status WebSocket сервер на порту 8081 (для клиентов)
- HTTP API сервер на порту 3600

### 3. Подключение клиента

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8081');

ws.on('open', () => {
  console.log('Connected to status broadcaster');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## Типы событий

### Обновление состояния устройства

```json
{
  "type": "device_update",
  "deviceId": "esp32_A8A154",
  "data": {
    "eventType": "state_changed",
    "state": {
      "outputs": {
        "Valve1": true,
        "Valve2": false
      },
      "sensors": {
        "temp": 25.5,
        "humidity": 60
      }
    }
  },
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

### Изменение статуса подключения

```json
{
  "type": "device_update",
  "deviceId": "esp32_A8A154",
  "data": {
    "eventType": "status_changed",
    "status": "connected"
  },
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

### Обновление конфигурации

```json
{
  "type": "device_update",
  "deviceId": "esp32_A8A154",
  "data": {
    "eventType": "config_changed",
    "config": {
      "device": {
        "id": "esp32_A8A154",
        "name": "Greenhouse Controller"
      }
    }
  },
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

### Ошибка устройства

```json
{
  "type": "device_update",
  "deviceId": "esp32_A8A154",
  "data": {
    "eventType": "error",
    "error": "Connection timeout"
  },
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

## Команды клиента

### Подписка на конкретное устройство

По умолчанию клиент получает обновления от всех устройств. Можно подписаться на конкретное устройство:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  deviceId: 'esp32_A8A154'
}));
```

Ответ:
```json
{
  "type": "subscribed",
  "deviceId": "esp32_A8A154",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

### Отписка от устройства

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  deviceId: 'esp32_A8A154'
}));
```

### Ping/Pong

Для проверки соединения:

```javascript
ws.send(JSON.stringify({ type: 'ping' }));
```

Ответ:
```json
{
  "type": "pong",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

## Примеры использования

### Базовый клиент

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8081');

ws.on('open', () => {
  console.log('Connected');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'device_update') {
    const { deviceId, data } = message;
    
    switch (data.eventType) {
      case 'state_changed':
        console.log(`${deviceId} state:`, data.state);
        break;
      case 'status_changed':
        console.log(`${deviceId} status:`, data.status);
        break;
    }
  }
});
```

### Запуск примера клиента

Готовый пример клиента включен в проект:

```bash
# Получать обновления от всех устройств
node examples/status-client.js

# Подписаться на конкретное устройство
node examples/status-client.js ws://localhost:8081 esp32_A8A154

# Подключиться к другому серверу
node examples/status-client.js ws://192.168.1.100:8081
```

### React/Vue.js пример

```javascript
import { useEffect, useState } from 'react';

function DeviceStatus({ deviceId }) {
  const [status, setStatus] = useState(null);
  const [state, setState] = useState(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8081');

    ws.onopen = () => {
      // Подписаться на конкретное устройство
      ws.send(JSON.stringify({
        type: 'subscribe',
        deviceId
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'device_update' && message.deviceId === deviceId) {
        const { eventType, state, status } = message.data;
        
        if (eventType === 'state_changed') {
          setState(state);
        }
        if (eventType === 'status_changed') {
          setStatus(status);
        }
      }
    };

    return () => ws.close();
  }, [deviceId]);

  return (
    <div>
      <h3>Device: {deviceId}</h3>
      <p>Status: {status}</p>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
```

## Архитектура

### Автоматическая публикация

Обновления публикуются автоматически при вызове методов `DeviceService`:

- `updateDeviceState()` → отправляет `state_changed`
- `updateDeviceStatus()` → отправляет `status_changed`
- `updateDeviceConfig()` → отправляет `config_changed`

### Интеграция

StatusBroadcaster интегрирован с:
- **DeviceService** - автоматическая публикация при изменениях
- **JSONRPCwsServerWithDB** - инициализация и управление жизненным циклом

### Производительность

- Поддержка множества одновременных подключений
- Фильтрация сообщений по подпискам (только релевантные устройства)
- Автоматическая очистка закрытых соединений
- Минимальная нагрузка на основной JSON-RPC сервер

## Безопасность

Рекомендации:
- Используйте `wss://` (WebSocket Secure) в продакшене
- Добавьте аутентификацию через токены
- Настройте CORS и rate limiting
- Используйте reverse proxy (nginx) для дополнительной защиты

Пример с токеном:

```javascript
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
});
```

## Мониторинг

Логи WebSocket канала доступны через основную систему логирования:

```javascript
import logger from './src/utils/logger.js';

// Все события канала статусов логируются автоматически
```

## Отладка

Включите режим отладки:

```bash
LOG_LEVEL=debug npm start
```

Вы увидите детальные логи:
- Подключения/отключения клиентов
- Отправленные сообщения
- Подписки на устройства
- Ошибки отправки

## FAQ

**Q: Можно ли использовать несколько клиентов одновременно?**  
A: Да, система поддерживает неограниченное количество одновременных подключений.

**Q: Как получить исторические данные?**  
A: Используйте HTTP API для получения текущего состояния:
```bash
curl http://localhost:3600/api/db/devices/esp32_A8A154
```

**Q: Что происходит при потере соединения?**  
A: Клиент должен реализовать автоматическое переподключение. При переподключении отправьте команды подписки заново.

**Q: Можно ли отправлять команды через этот канал?**  
A: Нет, этот канал только для получения обновлений. Для отправки команд используйте HTTP API или прямое JSON-RPC соединение.

## См. также

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Полная архитектура системы
- [API_ROUTES.md](../docs/API_ROUTES.md) - HTTP API документация
- [examples/status-client.js](./status-client.js) - Готовый пример клиента
