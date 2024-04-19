import { WebSocketServer } from "ws";

class JSONRPCws {
  constructor(port = 8080, ondevice = null) {
    this.wss = new WebSocketServer({ port }, () => {
      console.log("JSONRPCws listening ");
    });
    this.ondevice = ondevice;
    console.log("JSONRPCws created", this);
  }
  devices = [];
  start() {
    this.wss.on("connection", function connection(ws, req) {
      console.log("connected");
      const device = {
        ws: ws,
        id: 1,
        defaultTimeoutMs: 3000,
        status: "connected",
        address: req.socket.remoteAddress,
        calls: {},
        call: (method, params, timeoutMilli) => {
          return this.call(device, method, params, timeoutMilli);
        }
      };
      device.ws.on("message", function incoming(message) {
        console.log("Rcvd:", ev.data);
        var frame = JSON.parse(message);
        if (this.calls[frame.id]) this.calls[frame.id](frame); // Resolve call promise
        delete this.calls[frame.id];
      });
      device.ws.on("close", () => {
        device.status = "offline";
      });
      console.log("Device connected", device);
      this.addDevice(device);
      if (this.ondevice) this.ondevice(device);
    });
  }
  call(device, method, params, timeoutMilli) {
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
      }, timeoutMilli || this.defaultTimeoutMs);
    });
  }
  addDevice(device) {
    this.devices.push(device);
  }
  getDevices() {
    return this.devices;
  }
}

export default JSONRPCws;
