#!/bin/bash

# Примеры запросов к новому API сервера
# Убедитесь что сервер запущен: npm run server

BASE_URL="http://localhost:3600/api"
DEVICE_ID="esp32_A8A154"

echo "=== Тестирование нового API ==="
echo ""

# 1. Получить все устройства из БД
echo "1. Получить все устройства из БД:"
curl -s "${BASE_URL}/db/devices" | jq '.'
echo ""

# 2. Получить конкретное устройство
echo "2. Получить устройство ${DEVICE_ID}:"
curl -s "${BASE_URL}/db/devices/${DEVICE_ID}" | jq '.'
echo ""

# 3. Сохранить метаданные для ирригатора irr1
echo "3. Сохранить метаданные для ирригатора irr1:"
curl -s -X POST "${BASE_URL}/devices/${DEVICE_ID}/irrigators/irr1/metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "wateringTable": [
        {"day": 1, "duration": 600, "start": 43200},
        {"day": 2, "duration": 600, "start": 43200},
        {"day": 3, "duration": 900, "start": 43200}
      ],
      "schedule": {
        "type": "daily",
        "timesPerDay": 24,
        "windowSize": 150
      },
      "cropType": "tomatoes",
      "soilType": "loam",
      "area": 50,
      "flowRate": 2.5,
      "notes": "Оптимизированный график для томатов в теплице"
    }
  }' | jq '.'
echo ""

# 4. Сохранить метаданные для ирригатора irr2
echo "4. Сохранить метаданные для ирригатора irr2:"
curl -s -X POST "${BASE_URL}/devices/${DEVICE_ID}/irrigators/irr2/metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "wateringTable": [
        {"day": 1, "duration": 300, "start": 79200},
        {"day": 2, "duration": 300, "start": 79200}
      ],
      "schedule": {
        "type": "interval",
        "timesPerDay": 5,
        "windowSize": 180
      },
      "cropType": "cucumbers",
      "notes": "График для огурцов"
    }
  }' | jq '.'
echo ""

# 5. Получить все метаданные ирригаторов
echo "5. Получить все метаданные ирригаторов устройства:"
curl -s "${BASE_URL}/devices/${DEVICE_ID}/irrigators/metadata" | jq '.'
echo ""

# 6. Получить метаданные конкретного ирригатора
echo "6. Получить метаданные ирригатора irr1:"
curl -s "${BASE_URL}/devices/${DEVICE_ID}/irrigators/irr1/metadata" | jq '.'
echo ""

# 7. Сохранить общие метаданные компонента
echo "7. Сохранить метаданные для таймера света:"
curl -s -X POST "${BASE_URL}/devices/${DEVICE_ID}/metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "componentType": "timer",
    "componentKey": "light1",
    "metadata": {
      "schedule": {
        "startTime": 28800,
        "endTime": 72000
      },
      "intensity": 100,
      "notes": "Основное освещение теплицы"
    }
  }' | jq '.'
echo ""

# 8. Получить все метаданные устройства
echo "8. Получить все метаданные устройства:"
curl -s "${BASE_URL}/devices/${DEVICE_ID}/metadata" | jq '.'
echo ""

# 9. Получить метаданные по типу компонента
echo "9. Получить только метаданные ирригаторов (через фильтр):"
curl -s "${BASE_URL}/devices/${DEVICE_ID}/metadata?componentType=irrigator" | jq '.'
echo ""

# 10. Пакетное сохранение метаданных
echo "10. Пакетное сохранение метаданных для нескольких компонентов:"
curl -s -X POST "${BASE_URL}/devices/${DEVICE_ID}/metadata/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "metadataList": [
      {
        "componentType": "output",
        "componentKey": "pcfout1",
        "metadata": {"description": "Главное освещение", "maxPower": 100}
      },
      {
        "componentType": "output",
        "componentKey": "pcfout8",
        "metadata": {"description": "Главный насос", "maxPower": 500}
      }
    ]
  }' | jq '.'
echo ""

echo "=== Тестирование завершено ==="
