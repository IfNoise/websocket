import { WebSocketServer } from "ws";

function JSONRPCws(port = 8080, ondevice = null) {
  const devices = [];
  const defaultTimeoutMs = 3000;
  const wss = new WebSocketServer({ port }, () => {
    console.log("JSONRPCws listening ");
  });
  const call = (device, method, params, timeoutMilli) => {
      return new Promise(function (resolve, reject) {
        var frame = { id: device.id++, method, params };
        // console.log('Sent:', JSON.stringify(frame));
        device.calls[frame.id] = resolve;
        device.ws.send(JSON.stringify(frame));
        setTimeout(function () {
          if (device.calls[frame.id]) {
            reject("RPC call timeout" + JSON.stringify(frame));
            delete device.calls[frame.id];
          }
        }, timeoutMilli || defaultTimeoutMs);
      });
    };
    const addDevice= (device) => {
      devices.push(device);
    };
    const engine = {
      start: () => {
        wss.on("connection", function connection(ws, req) {
          console.log("connected");
          const device = {
            ws: ws,
            config: {},
            id: 1,
            status: "connected",
            address: req.socket.remoteAddress,
            calls: {},
            call: (method, params, timeoutMilli) => {
              return call(device, method, params, timeoutMilli);
            },
          };
          device.ws.on("message", function incoming(message) {
            var frame = JSON.parse(message);
           console.log('Received:', frame);
            if (device.calls[frame.id]) device.calls[frame.id](frame); // Resolve call promise
            delete device.calls[frame.id];
          });
          device.ws.on("close", () => {
            device.status = "offline";
          });
          console.log("Device connected", device);
          device.call("Config.Get", {}).then((result) => {
            device.config = result;
          });
          addDevice(device);
          if (ondevice) ondevice(device);
        });
      },
      getDevices: () => {
        return devices;
      },
    };
  return engine;
}

export default JSONRPCws;
