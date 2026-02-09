/**
 * Пример клиента для подключения к WebSocket каналу статусов устройств
 * 
 * Запуск:
 *   node examples/status-client.js
 * 
 * Или с параметрами:
 *   node examples/status-client.js ws://localhost:8081 esp32_A8A154
 */

import WebSocket from 'ws';

// Параметры подключения
const WS_URL = process.argv[2] || 'ws://localhost:8081';
const DEVICE_ID = process.argv[3] || null; // Опционально: подписка на конкретное устройство

console.log('Connecting to status broadcaster:', WS_URL);
if (DEVICE_ID) {
  console.log('Will subscribe to device:', DEVICE_ID);
}

const ws = new WebSocket(WS_URL);

// Обработчик подключения
ws.on('open', () => {
  console.log('✓ Connected to status broadcaster');
  
  // Если указан ID устройства, подписываемся на него
  if (DEVICE_ID) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      deviceId: DEVICE_ID
    }));
    console.log(`Subscribing to device: ${DEVICE_ID}`);
  } else {
    console.log('Listening to all device updates');
  }
});

// Обработчик сообщений
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    handleMessage(message);
  } catch (err) {
    console.error('Failed to parse message:', err.message);
  }
});

// Обработчик различных типов сообщений
function handleMessage(message) {
  const { type, deviceId, data, timestamp } = message;
  
  switch (type) {
    case 'welcome':
      console.log('📩', message.message);
      break;
    
    case 'subscribed':
      console.log(`✓ Subscribed to device: ${deviceId}`);
      break;
    
    case 'unsubscribed':
      console.log(`✓ Unsubscribed from device: ${deviceId}`);
      break;
    
    case 'device_update':
      handleDeviceUpdate(deviceId, data, timestamp);
      break;
    
    case 'pong':
      console.log('Pong received');
      break;
    
    default:
      console.log('Unknown message type:', type);
  }
}

// Обработка обновлений устройства
function handleDeviceUpdate(deviceId, data, timestamp) {
  const { eventType } = data;
  const time = new Date(timestamp).toLocaleTimeString();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[${time}] Device Update: ${deviceId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  switch (eventType) {
    case 'state_changed':
      console.log('🔄 State Changed:');
      console.log(JSON.stringify(data.state, null, 2));
      break;
    
    case 'status_changed':
      const statusEmoji = data.status === 'connected' ? '🟢' : '🔴';
      console.log(`${statusEmoji} Status Changed: ${data.status}`);
      break;
    
    case 'config_changed':
      console.log('⚙️  Config Changed:');
      console.log(JSON.stringify(data.config, null, 2));
      break;
    
    case 'error':
      console.log('❌ Error:', data.error);
      break;
    
    default:
      console.log('Unknown event type:', eventType);
      console.log(JSON.stringify(data, null, 2));
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Обработчик ошибок
ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
});

// Обработчик закрытия соединения
ws.on('close', () => {
  console.log('✗ Disconnected from status broadcaster');
  process.exit(0);
});

// Отправка ping каждые 30 секунд
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\nClosing connection...');
  ws.close();
});

console.log('\nPress Ctrl+C to exit\n');
