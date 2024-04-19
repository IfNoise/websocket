import { WebSocketServer } from "ws";
import WebSocket from "ws";


class JSONRPCws {
  constructor(port=8080, ondevice=null) {
    this.wss = new WebSocketServer({ port });
    this.devices = [];
    this.ondevice = null
    this.wss.on("connection", function connection(ws, req) {
      const device = {
        ws: ws,
        id: 1,
        defaultTimeoutMs: 3000,
        status: "connected",
        address: req.headers["x-forwarded-for"],
        calls: {},
        call: function (method, params, timeoutMilli) {
          return new Promise(function (resolve, reject) {
            var frame = { id: this.id++, method, params };
            // console.log('Sent:', JSON.stringify(frame));
            this.calls[frame.id] = resolve;
            this.ws.send(JSON.stringify(frame));
            setTimeout(function () {
              if (this.calls[frame.id]) {
                reject("RPC call timeout" + JSON.stringify(frame));
                delete this.calls[frame.id];
              }
            }, timeoutMilli || this.defaultTimeoutMs);
          });
        },
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
      this.devices.push(device);
      if (this.ondevice) this.ondevice(device);
    });
  }
  getDevices(){return this.devices};

}
export default JSONRPCws;
