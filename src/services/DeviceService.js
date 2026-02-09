import { DeviceModel } from "../models/Device.js";
import { ComponentMetadataModel } from "../models/ComponentMetadata.js";

// Singleton broadcaster, будет инициализирован через setBroadcaster()
let broadcaster = null;

export class DeviceService {
  /**
   * Установить экземпляр StatusBroadcaster для автоматической публикации обновлений
   * @param {Object} statusBroadcaster
   */
  static setBroadcaster(statusBroadcaster) {
    broadcaster = statusBroadcaster;
  }
  /**
   * Зарегистрировать или обновить устройство
   * @param {Object} deviceData
   */
  static registerDevice({ id, address, config, state }) {
    return DeviceModel.upsert({
      id,
      address,
      status: "connected",
      config,
      state,
    });
  }

  /**
   * Получить устройство по ID
   * @param {string} id
   */
  static getDevice(id) {
    return DeviceModel.findById(id);
  }

  /**
   * Получить все устройства
   * @param {Object} filters
   */
  static getAllDevices(filters = {}) {
    return DeviceModel.findAll(filters);
  }

  /**
   * Обновить статус устройства
   * @param {string} id
   * @param {string} status
   */
  static updateDeviceStatus(id, status) {
    DeviceModel.updateStatus(id, status);
    
    // Отправить обновление через broadcaster
    if (broadcaster) {
      broadcaster.broadcastDeviceStatus(id, status);
    }
  }

  /**
   * Обновить конфигурацию устройства
   * @param {string} id
   * @param {Object} config
   */
  static updateDeviceConfig(id, config) {
    DeviceModel.updateConfig(id, config);
    
    // Отправить обновление через broadcaster
    if (broadcaster) {
      broadcaster.broadcastDeviceConfig(id, config);
    }
    
    return this.getDevice(id);
  }

  /**
   * Обновить состояние устройства
   * @param {string} id
   * @param {Object} state
   */
  static updateDeviceState(id, state) {
    DeviceModel.updateState(id, state);
    
    // Отправить обновление через broadcaster
    if (broadcaster) {
      broadcaster.broadcastDeviceState(id, state);
    }
    
    return this.getDevice(id);
  }

  /**
   * Удалить устройство
   * @param {string} id
   */
  static deleteDevice(id) {
    DeviceModel.delete(id);
  }

  /**
   * Извлечь компоненты из конфигурации устройства
   * Определяет irrigators, timers, outputs и т.д.
   * @param {Object} config
   * @returns {Object} - { irrigators: [], timers: [], outputs: [] }
   */
  static extractComponents(config) {
    const components = {
      irrigators: [],
      timers: [],
      outputs: [],
      pcfOutputs: [],
      pcfInputs: [],
    };

    if (!config) return components;

    // Извлечение ирригаторов (irr1, irr2, ...)
    Object.keys(config).forEach((key) => {
      if (key.startsWith("irr") && key.match(/^irr\d+$/)) {
        components.irrigators.push({
          key,
          ...config[key],
        });
      }
    });

    // Извлечение таймеров света (light1, light2, ...)
    Object.keys(config).forEach((key) => {
      if (key.startsWith("light") && key.match(/^light\d+$/)) {
        components.timers.push({
          key,
          ...config[key],
        });
      }
    });

    // Извлечение PCF выходов (pcfout1, pcfout2, ...)
    Object.keys(config).forEach((key) => {
      if (key.startsWith("pcfout") && key.match(/^pcfout\d+$/)) {
        components.pcfOutputs.push({
          key,
          ...config[key],
        });
      }
    });
    // Извлечение PCF входов (pcfin1, pcfin2, ...)
    Object.keys(config).forEach((key) => {
      if (key.startsWith("pcfin") && key.match(/^pcfin\d+$/)) {
        components.pcfInputs.push({
          key,
          ...config[key],
        });
      }
    });

    return components;
  }
}
