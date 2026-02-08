# Параметры стратегии полива (Strategy Parameters)

## Обзор

Параметры стратегии полива используются для настройки и генерации таблицы поливов. Они сохраняются вместе с таблицей для возможности редактирования и пересчёта.

## Структура параметров

```typescript
interface StrategyParams {
  // Параметры освещения
  lightsOnTimeSeconds: number; // Время начала дня в секундах от 00:00 (0-86400)
  lightsOffTimeSeconds: number; // Время окончания дня в секундах от 00:00 (0-86400)

  // Параметры субстрата и системы
  substrateWaterCapacityLiters: number; // Ёмкость субстрата по воде (литры)
  dripperFlowRateLph: number; // Скорость потока капельницы (литры/час)
  emittersPerPot: number; // Количество капельниц на горшок
  waterLossRateLitersPerHour: number; // Скорость потери воды (литры/час)
  evaporationCoefficient: number; // Коэффициент испарения (обычно 1)

  // Целевые параметры влажности
  initialDrybackPercent: number; // Начальный процент просушки (%)
  targetPeakPercent: number; // Целевой пиковый процент влажности (%)
  maintenanceMinPercent: number; // Минимальный процент поддержания влажности (%)

  // Параметры фазы P1 (Старт дня)
  p1StartDelayMinutes: number; // Задержка старта после включения света (минуты)
  p1ShotVolumePercent: number; // Объём одного полива в P1 (% от ёмкости)
  p1ShotIntervalMinutes: number; // Интервал между поливами в P1 (минуты)

  // Параметры фазы P2 (Поддержание)
  p2TargetDrainagePercent: number; // Целевой процент дренажа в P2 (%)

  // Параметры фазы P3 (Просушка)
  p3DrybackMinutes: number; // Время просушки перед выключением света (минуты)
}
```

## Описание параметров

### Параметры освещения

**lightsOnTimeSeconds** и **lightsOffTimeSeconds**

- Определяют начало и окончание светового дня для растений
- Указываются в секундах от 00:00 (начала суток)
- Пример: `28800` = 08:00 (8 часов × 3600 сек), `72000` = 20:00 (20 часов × 3600 сек)
- Между этими временами идут активные поливы
- Продолжительность дня рассчитывается как: `lightsOffTimeSeconds - lightsOnTimeSeconds`

### Параметры системы полива

**substrateWaterCapacityLiters**

- Максимальная ёмкость субстрата по воде
- Используется для расчёта процентов влажности
- Пример: `10` литров для горшка 20л с кокосовым субстратом

**dripperFlowRateLph**

- Скорость потока одной капельницы
- Измеряется в литрах в час
- Пример: `2` л/ч для стандартной капельницы

**emittersPerPot**

- Количество капельниц на один горшок
- Используется для расчёта общего потока
- Пример: `2` капельницы на горшок

**waterLossRateLitersPerHour**

- Скорость испарения и транспирации
- Влияет на частоту поливов в фазе P2
- Пример: `0.1` л/ч базовая потеря

**evaporationCoefficient**

- Коэффициент для корректировки испарения
- Обычно `1.0`, можно увеличить для жарких условий
- Диапазон: `0.5` - `2.0`

### Целевые параметры влажности

**initialDrybackPercent**

- С какого процента влажности начинать день
- Обычно `15-25%` для здорового стресса
- Пример: `20%` - умеренная просушка

**targetPeakPercent**

- До какого процента поднимать влажность в P1
- Обычно `80-90%` для оптимальной доступности воды
- Пример: `85%` - хорошая целевая влажность

**maintenanceMinPercent**

- Минимальная влажность в течение дня (P2)
- Должна быть выше дренажного уровня
- Пример: `60%` - комфортный минимум

### Фаза P1 (Старт дня - Reaching Peak)

**p1StartDelayMinutes**

- Задержка перед первым поливом после включения света
- Даёт время корням "проснуться"
- Пример: `30` минут задержки

**p1ShotVolumePercent**

- Размер одного полива в процентах от ёмкости
- Маленькие порции для постепенного насыщения
- Пример: `5%` - небольшие порции

**p1ShotIntervalMinutes**

- Интервал между поливами в P1
- Частые малые поливы для равномерного насыщения
- Пример: `15` минут между поливами

### Фаза P2 (Поддержание - Maintenance)

**p2TargetDrainagePercent**

- Целевой процент дренажа при поливах P2
- Контролирует количество воды на полив
- Пример: `10%` - умеренный дренаж для вымывания солей

### Фаза P3 (Просушка - Dryback)

**p3DrybackMinutes**

- Время просушки перед выключением света
- Позволяет корням "подышать" перед ночью
- Пример: `60` минут без полива

## Пример полного набора параметров

```json
{
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
```

## Типичные сценарии

### Томаты в кокосе (агрессивная стратегия)

```json
{
  "lightsOnTimeSeconds": 28800, // 08:00
  "lightsOffTimeSeconds": 72000, // 20:00
  "substrateWaterCapacityLiters": 10,
  "dripperFlowRateLph": 2,
  "emittersPerPot": 2,
  "waterLossRateLitersPerHour": 0.15,
  "evaporationCoefficient": 1.2,
  "initialDrybackPercent": 25, // Больше стресса
  "targetPeakPercent": 90, // Высокая влажность
  "maintenanceMinPercent": 65,
  "p1StartDelayMinutes": 30,
  "p1ShotVolumePercent": 4, // Меньше порции
  "p1ShotIntervalMinutes": 10, // Чаще поливы
  "p2TargetDrainagePercent": 15, // Больше дренажа
  "p3DrybackMinutes": 90
}
```

### Огурцы (мягкая стратегия)

```json
{
  "lightsOnTimeSeconds": 25200, // 07:00
  "lightsOffTimeSeconds": 75600, // 21:00
  "substrateWaterCapacityLiters": 12,
  "dripperFlowRateLph": 2,
  "emittersPerPot": 2,
  "waterLossRateLitersPerHour": 0.12,
  "evaporationCoefficient": 1,
  "initialDrybackPercent": 15, // Меньше стресса
  "targetPeakPercent": 85,
  "maintenanceMinPercent": 70, // Выше минимум
  "p1StartDelayMinutes": 20,
  "p1ShotVolumePercent": 6, // Больше порции
  "p1ShotIntervalMinutes": 20, // Реже поливы
  "p2TargetDrainagePercent": 8, // Меньше дренажа
  "p3DrybackMinutes": 45
}
```

## Использование в API

При отправке таблицы поливов, параметры стратегии сохраняются для истории:

```javascript
const response = await fetch(
  'http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/irrigation-table',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      irrigationTable: [...],
      strategyParams: {
        lightsOnTimeSeconds: 28800,
        // ... все параметры
      },
      syncToDevice: true
    })
  }
);
```

При получении данных параметры возвращаются вместе с таблицей:

```javascript
const response = await fetch(
  "http://localhost:3600/api/devices/esp32_A8A154/irrigators/irr1/irrigation-table",
);

const { irrigationTable, strategyParams } = await response
  .json()
  .then((r) => r.data);

// Можно редактировать параметры и пересчитать таблицу
const modifiedParams = { ...strategyParams, targetPeakPercent: 90 };
const newTable = recalculateTable(modifiedParams);
```

## Валидация параметров

Рекомендуемые диапазоны значений:

| Параметр                     | Минимум | Максимум | Рекомендуемое             |
| ---------------------------- | ------- | -------- | ------------------------- |
| lightsOnTimeSeconds          | 0       | 86400    | 25200-32400 (07:00-09:00) |
| lightsOffTimeSeconds         | 0       | 86400    | 72000-79200 (20:00-22:00) |
| substrateWaterCapacityLiters | 1       | 100      | 8-15                      |
| dripperFlowRateLph           | 0.5     | 8        | 2-4                       |
| emittersPerPot               | 1       | 8        | 2-4                       |
| waterLossRateLitersPerHour   | 0.05    | 1        | 0.1-0.2                   |
| evaporationCoefficient       | 0.5     | 2        | 1-1.2                     |
| initialDrybackPercent        | 10      | 40       | 15-25                     |
| targetPeakPercent            | 70      | 95       | 80-90                     |
| maintenanceMinPercent        | 50      | 85       | 60-70                     |
| p1StartDelayMinutes          | 0       | 120      | 20-40                     |
| p1ShotVolumePercent          | 2       | 15       | 4-6                       |
| p1ShotIntervalMinutes        | 5       | 60       | 10-20                     |
| p2TargetDrainagePercent      | 5       | 25       | 10-15                     |
| p3DrybackMinutes             | 30      | 180      | 60-90                     |
