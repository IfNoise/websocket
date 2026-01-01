import { WebSocketServer } from "ws";
import { EventEmitter } from "events";

/**
 * JSON-RPC over WebSocket server helper.
 * Provides a cleaner class-based API, event-emitter hooks and improved
 * pending-call management with timeouts and proper cleanup.
 */
class JSONRPCwsServer extends EventEmitter {
  /**
   * @param {number} port
   * @param {(device:object)=>void|null} ondevice
   * @param {object} options
   */
  constructor(port, ondevice = null, options = {}) {
    super();
    this.port = port;
    this.ondevice = ondevice;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 5000;
    this.logger = options.logger || console;

    // Map<deviceKey, deviceObject>
    this.devices = new Map();

    // create server but do not attach connection handlers until start()
    this._wss = new WebSocketServer({ port: this.port }, () => {
      this.logger.info && this.logger.info("JSONRPCws listening on port", this.port);
    });

    // allow graceful start/stop multiple times
    this._started = false;
  }

  /** Internal: generate a key for device map */
  _deviceKey(device) {
    return device.deviceId || device.address || Symbol("device");
  }

  /** Internal: send a JSON-RPC frame and manage pending promise */
  _sendRPC(device, method, params = {}, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!device || !device.ws) return reject(new Error("Invalid device"));
      if (device.ws.readyState !== device.ws.OPEN) return reject(new Error("Socket not open"));

      device._nextId = device._nextId || 1;
      const id = device._nextId++;
      const frame = { id, method, params };
      const payload = JSON.stringify(frame);

      const timeout = setTimeout(() => {
        const pending = device.calls && device.calls.get(id);
        if (pending) {
          device.calls.delete(id);
          pending.reject(new Error("RPC call timeout"));
        }
      }, timeoutMs ?? this.defaultTimeoutMs);

      device.calls = device.calls || new Map();
      device.calls.set(id, { resolve, reject, timeout });

      try {
        device.ws.send(payload);
      } catch (err) {
        clearTimeout(timeout);
        device.calls.delete(id);
        return reject(err);
      }
    });
  }

  /** Start listening for connections and wire handlers. Safe to call once. */
  start() {
    if (this._started) return;
    this._started = true;

    this._wss.on("connection", (ws, req) => {
      const address = req?.socket?.remoteAddress || "unknown";
      this.logger.info && this.logger.info("Client connected from", address);

      const device = {
        ws,
        config: {},
        deviceId: "",
        status: "connected",
        address,
        calls: new Map(),
        _nextId: 1,
        call: (method, params = {}, timeoutMs) => this._sendRPC(device, method, params, timeoutMs),
        update: () => device.call("Config.Get", {}).then((result) => {
          device.config = result.result || {};
          device.deviceId = device.config?.device?.id || device.deviceId;
          return device.config;
        }).catch((err) => {
          this.logger.warn && this.logger.warn("Config.Get failed:", err && err.message ? err.message : err);
        }),
      };

      const key = this._deviceKey(device);
      // store device by key (address until deviceId known)
      this.devices.set(key, device);

      ws.on("message", (message) => {
        let frame;
        try {
          this.logger.debug && this.logger.debug("Raw message from", device.address, message);
          frame = JSON.parse(message);
        } catch (err) {
          const msgStr = typeof message === 'string' ? message : (message && message.toString ? message.toString() : '');
          this.logger.warn && this.logger.warn(`Invalid JSON from ${device.address}: ${err && err.message}\nPayload: ` + msgStr);
          if (process.env.NODE_ENV === 'development' && err && err.stack) {
            this.logger.warn(err.stack);
          }
          return;
        }

        this.logger.debug && this.logger.debug("Received frame:", frame);

        if (frame && typeof frame.id !== 'undefined') {
          const pending = device.calls && device.calls.get(frame.id);
          if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(frame);
            device.calls.delete(frame.id);
            return;
          }
        }

        // unsolicited notification
        this.logger.info && this.logger.info("Unhandled frame from", device.address, frame);
        this.emit('notification', device, frame);
      });

      ws.on("close", () => {
        device.status = "offline";
        this.logger.info && this.logger.info("Client disconnected", device.address);
        if (device.calls) {
          device.calls.forEach((p) => {
            try {
              clearTimeout(p.timeout);
              p.reject(new Error("Device disconnected"));
            } catch (e) { /* ignore */ }
          });
          device.calls.clear();
        }
        this.emit('disconnect', device);
      });

      ws.on("error", (err) => {
        this.logger.error && this.logger.error("WebSocket error for", device.address, err && err.message);
        this.emit('error', err, device);
      });

      // Try to initialize device config; don't block connection flow
      device.call("Config.Get", {}).then((result) => {
        device.config = result.result || {};
        device.deviceId = device.config?.device?.id || device.deviceId;
        // If deviceId is available, ensure device is mapped by it
        const newKey = this._deviceKey(device);
        if (newKey !== key) {
          this.devices.delete(key);
          this.devices.set(newKey, device);
        }
        if (this.ondevice) this.ondevice(device);
        this.emit('device', device);
      }).catch((err) => {
        if (this.ondevice) this.ondevice(device);
        this.emit('device', device);
        this.logger.warn && this.logger.warn("Initial Config.Get failed for", device.address, err && err.message);
      });
    });

    this._wss.on("close", () => {
      this.logger.info && this.logger.info("WebSocket server closed");
      // reject all pending RPCs and cleanup
      this.devices.forEach((d) => {
        if (d.calls) {
          d.calls.forEach((p) => {
            try { clearTimeout(p.timeout); p.reject(new Error("Server closed")); } catch (e) {}
          });
          d.calls.clear();
        }
      });
      // remove offline devices
      Array.from(this.devices.values()).filter((d) => d.status === 'offline').forEach((d) => {
        const k = this._deviceKey(d);
        this.devices.delete(k);
      });
    });
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  findDeviceById(deviceId) {
    for (const d of this.devices.values()) {
      if (d.deviceId === deviceId) return d;
    }
    return null;
  }

  broadcast(method, params = {}, timeoutMs) {
    const senders = Array.from(this.devices.values()).map((d) => {
      if (d.ws && d.ws.readyState === d.ws.OPEN) return this._sendRPC(d, method, params, timeoutMs).catch((e) => e);
      return Promise.resolve(new Error("Socket not open"));
    });
    return Promise.allSettled(senders);
  }

  closeDevice(device) {
    if (!device) return;
    try {
      if (device.calls) {
        device.calls.forEach((p) => {
          clearTimeout(p.timeout);
          try { p.reject(new Error("Device closed manually")); } catch (e) {}
        });
        device.calls.clear();
      }
    } catch (e) { /* ignore */ }
    try { device.ws && device.ws.close(); } catch (e) { /* ignore */ }
    const key = this._deviceKey(device);
    this.devices.delete(key);
  }

  close() {
    try { this._wss.close(); } catch (e) { /* ignore */ }
    this.devices.forEach((d) => {
      try {
        if (d.calls) {
          d.calls.forEach((p) => { clearTimeout(p.timeout); try { p.reject(new Error('Server closed')); } catch(e){} });
          d.calls.clear();
        }
      } catch(e) {}
      try { d.ws && d.ws.terminate(); } catch (e) {}
    });
    this.devices.clear();
    this._started = false;
  }

  setLogger(l) { this.logger = l || console; }
  setDefaultTimeout(ms) { this.defaultTimeoutMs = ms; }

  // expose server for advanced use (read-only)
  get _server() { return this._wss; }
}

/**
 * Backwards-compatible factory function
 * @param {number} port
 * @param {function|null} ondevice
 * @param {object} options
 */
function JSONRPCws(port, ondevice = null, options = {}) {
  return new JSONRPCwsServer(port, ondevice, options);
}

export default JSONRPCws;
