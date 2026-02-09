# Конфигурация Nginx для WebSocket

> **Примечание**: Если у вас уже настроен WebSocket для устройств (порт 8080),
> нужно добавить только конфигурацию для канала статусов (порт 8081).

## Минимальная конфигурация (только для статусов)

Добавьте в существующий server block:

```nginx
# WebSocket для статусов устройств (для клиентов)
location /ws/status {
    proxy_pass http://localhost:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Таймауты для долгоживущих WebSocket соединений
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;

    # Отключить буферизацию для WebSocket
    proxy_buffering off;
}
```

## Полная конфигурация сервера (при необходимости)

```nginx
# /etc/nginx/sites-available/websocket-server

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ddweed.org;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/ddweed.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ddweed.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # JSON-RPC WebSocket для устройств (если еще не настроено)
    location /ws/devices {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }

    # WebSocket для статусов устройств (для клиентов)
    location /ws/status {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }

    # HTTP API
    location /api/ {
        proxy_pass http://localhost:3600/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
```

## Вариант 2: Прямое проксирование портов

Если хотите использовать прямые порты (wss://ddweed.org:8081):

```nginx
# WebSocket сервер на порту 8081 с SSL
server {
    listen 8081 ssl http2;
    listen [::]:8081 ssl http2;
    server_name ddweed.org;

    ssl_certificate /etc/letsencrypt/live/ddweed.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ddweed.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }
}

# Аналогично для порта 8080 (JSON-RPC для устройств)
server {
    listen 8080 ssl http2;
    listen [::]:8080 ssl http2;
    server_name ddweed.org;

    ssl_certificate /etc/letsencrypt/live/ddweed.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ddweed.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }
}
```

## Применение конфигурации

1. Скопируйте конфигурацию:

```bash
sudo nano /etc/nginx/sites-available/websocket-server
```

2. Создайте симлинк:

```bash
sudo ln -s /etc/nginx/sites-available/websocket-server /etc/nginx/sites-enabled/
```

3. Проверьте конфигурацию:

```bash
sudo nginx -t
```

4. Перезагрузите nginx:

```bash
sudo systemctl reload nginx
```

## Настройка Firewall

При использовании nginx с путем `/ws/status` дополнительные порты открывать не нужно -
трафик идет через порт 443, который уже открыт.

Убедитесь только, что локальные порты 8080 и 8081 **не открыты** наружу для безопасности:

```bash
# Проверка открытых портов
sudo netstat -tlnp | grep -E ':(8080|8081)'

# Порты должны слушать только на localhost (127.0.0.1)
# Правильно: 127.0.0.1:8081
# Неправильно: 0.0.0.0:8081
```

## Проверка работы

```bash
# Проверка доступности WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: ddweed.org" \
  -H "Origin: https://ddweed.org" \
  https://ddweed.org/ws/status

# Логи nginx
sudo tail -f /var/log/nginx/websocket_error.log
sudo tail -f /var/log/nginx/websocket_access.log
```

## Troubleshooting

### WebSocket соединение обрывается

Увеличьте таймауты в nginx:

```nginx
proxy_connect_timeout 1d;
proxy_send_timeout 1d;
proxy_read_timeout 1d;
```

### 502 Bad Gateway

Проверьте, что backend сервис запущен:

```bash
sudo netstat -tlnp | grep 8081
```

### SSL ошибки

Убедитесь, что сертификат валиден:

```bash
sudo certbot renew --dry-run
```

## См. также

- [STATUS_WEBSOCKET.md](./STATUS_WEBSOCKET.md) - Документация WebSocket API
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура системы
