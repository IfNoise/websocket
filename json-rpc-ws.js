import { WebSocketServer } from "ws";

function JSONRPCws(port, ondevice = null) {
  const devices = [];
  const defaultTimeoutMs = 5000;

  const wss = new WebSocketServer({ port }, () => {
    console.log("JSONRPCws listening on port", port);
  });

  // pluggable logger (defaults to console)
  let logger = console;

  // Internal RPC sender: stores pending promises with timeouts
  const sendRPC = (device, method, params = {}, timeoutMs) => {
    return new Promise((resolve, reject) => {
      if (!device || !device.ws) return reject(new Error("Invalid device"));
      if (device.ws.readyState !== device.ws.OPEN) return reject(new Error("Socket not open"));

      const id = device._nextId = (device._nextId || 1);
      const frame = { id: id, method, params };
      device._nextId = id + 1;

      const payload = JSON.stringify(frame);

      const timeout = setTimeout(() => {
        // if still pending, reject and cleanup
        const pending = device.calls && device.calls[frame.id];
        if (pending) {
          delete device.calls[frame.id];
          pending.reject(new Error("RPC call timeout: " + JSON.stringify(frame)));
        }
      }, timeoutMs ?? defaultTimeoutMs);

      device.calls = device.calls || {};
      device.calls[frame.id] = { resolve, reject, timeout };

      try {
        device.ws.send(payload);
      } catch (err) {
        clearTimeout(timeout);
        delete device.calls[frame.id];
        return reject(err);
      }
    });
  };

  const addDevice = (device) => {
    // remove duplicates: prefer deviceId if available, otherwise address
    const key = device.deviceId || device.address;
    const existingIndex = devices.findIndex((d) => (d.deviceId || d.address) === key);
    if (existingIndex !== -1) devices.splice(existingIndex, 1);
    devices.push(device);
  };

  const removeDevice = (device) => {
    const idx = devices.indexOf(device);
    if (idx >= 0) devices.splice(idx, 1);
  };

  const engine = {
    start: () => {
      wss.on("connection", function connection(ws, req) {
        console.log("Client connected from", req.socket.remoteAddress);

        const device = {
          ws,
          config: {},
          deviceId: '',
          status: "connected",
          address: req.socket.remoteAddress,
          calls: {},
          call: (method, params = {}, timeoutMs) => sendRPC(device, method, params, timeoutMs),
          update: () => {
            return device.call("Config.Get", {}).then((result) => {
              device.config = result.result || {};
              device.deviceId = device.config?.device?.id || device.deviceId;
              return device.config;
            }).catch((err) => {
              console.warn("Config.Get failed:", err && err.message ? err.message : err);
            });
          },
        };

        ws.on("message", function incoming(message) {
          let frame;
          try {
            logger.debug && logger.debug("Raw message from", device.address, message);
            frame = JSON.parse(message);
          } catch (err) {
            logger.warn("Invalid JSON from", device.address, err && err.message);
            return;
          }
          logger.debug && logger.debug("Received frame:", frame);

          // If frame has id and there's a pending call, resolve it.
          if (frame && typeof frame.id !== 'undefined') {
            const pending = device.calls && device.calls[frame.id];
            if (pending) {
              clearTimeout(pending.timeout);
              // Preserve original behaviour: resolve with full frame
              pending.resolve(frame);
              delete device.calls[frame.id];
              return;
            }
          }

          // Notification (no id) or unsolicited frame
          logger.info && logger.info("Unhandled frame from", device.address, frame);
        });

        ws.on("close", () => {
          device.status = "offline";
          logger.info && logger.info("Client disconnected", device.address);
          // reject any pending RPCs for this device
          if (device.calls) {
            Object.keys(device.calls).forEach((id) => {
              try {
                const p = device.calls[id];
                clearTimeout(p.timeout);
                p.reject(new Error("Device disconnected"));
              } catch (e) {
                /* ignore */
              }
            });
          }
          device.calls = {};
          // do not remove device immediately; engine.close will cleanup, but mark offline
        });

        ws.on("error", (err) => {
          logger.error && logger.error("WebSocket error for", device.address, err && err.message);
        });

        // Try to initialize device config; don't block connection flow
        // Try to initialize device config; don't block connection flow
        device.call("Config.Get", {}).then((result) => {
          device.config = result.result || {};
          device.deviceId = device.config?.device?.id || device.deviceId;
          addDevice(device);
          if (ondevice) ondevice(device);
        }).catch((err) => {
          // still add device even if Config.Get failed
          addDevice(device);
          if (ondevice) ondevice(device);
          logger.warn && logger.warn("Initial Config.Get failed for", device.address, err && err.message);
        });
      });

      wss.on("close", function close() {
        logger.info && logger.info("WebSocket server closed");
        // reject all pending RPCs and cleanup
        devices.forEach((d) => {
          if (d.calls) {
            Object.keys(d.calls).forEach((id) => {
              try {
                const p = d.calls[id];
                clearTimeout(p.timeout);
                p.reject(new Error("Server closed"));
              } catch (e) {
                /* ignore */
              }
            });
            d.calls = {};
          }
        });
        // cleanup offline devices
        devices.filter((d) => d.status === 'offline').forEach((d) => removeDevice(d));
      });
    },

    getDevices: () => devices,

    // Broadcast a method to all connected devices. Returns array of promise results (allSettled)
    broadcast: (method, params = {}, timeoutMs) => {
      const senders = devices.map((d) => {
        if (d.ws && d.ws.readyState === d.ws.OPEN) return sendRPC(d, method, params, timeoutMs).catch((e) => e);
        return Promise.resolve(new Error("Socket not open"));
      });
      return Promise.allSettled(senders);
    },

    // Close a single device connection and cleanup pending RPCs
    closeDevice: (device) => {
      if (!device) return;
      try {
        if (device.calls) {
          Object.keys(device.calls).forEach((id) => {
            const p = device.calls[id];
            clearTimeout(p.timeout);
            p.reject(new Error("Device closed manually"));
          });
        }
      } catch (e) {/* ignore */}
      try { device.ws && device.ws.close(); } catch (e) {/* ignore */}
      removeDevice(device);
    },

    // Close server gracefully and cleanup
    close: () => {
      try {
        wss.close();
      } catch (e) { /* ignore */ }
      devices.forEach((d) => {
        try { if (d.calls) {
          Object.keys(d.calls).forEach((id) => { clearTimeout(d.calls[id].timeout); try { d.calls[id].reject(new Error('Server closed')); } catch(e){}});
          d.calls = {};
        }} catch(e) {}
        try { d.ws && d.ws.terminate(); } catch (e) {}
      });
      devices.length = 0;
    },

    setLogger: (l) => { logger = l || console; },

    // For convenience expose the underlying server (read-only)
    _server: wss,
  };

  return engine;
}

export default JSONRPCws;
