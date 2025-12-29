import 'dotenv/config';
import JSONRPCws from "./json-rpc-ws.js ";
import express from "express";
import cors from "cors";
import  bodyParser  from "body-parser";
const app = express();
const api = express.Router();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json({ extended: true }));

const WS_PORT = process.env.WS_PORT || 8080;
const API_PORT = process.env.API_PORT || 3600;

const jsonrpc = JSONRPCws(WS_PORT, (device) => {
  console.log("Device connected", device);

  console.log(jsonrpc.getDevices());
});

api.get("/devices", (req, res) => {
  const devices = jsonrpc.getDevices();
  if (!devices) {
    return res.status(404).send("No devices found");
  }
  res.json(
    devices.map((device, i) => {
      return {
        id: device.deviceId,
        address: device.address,
        status: device.status,
        config: device.config,
      };
    })
  );
});
api.get("/devices/:deviceId/getState", (req, res) => {
  const { deviceId } =req.params;
  const device = jsonrpc.getDevices().filter((device) => device.deviceId === deviceId)[0];
  if (!device) {
    return res.status(404).send("No devices found");
  }
  device.call("Get.State", {}).then((result) => {
  res.json(result);
  }).catch((error) => {
    res.status(500).json({ error: error.toString() });
});
});
api.get("/devices/:deviceId/getConfig", (req, res) => {
  const { deviceId } = req.params;

  const device = jsonrpc.getDevices().filter((device) => device.deviceId === deviceId)[0];
  if (!device) {
    return res.status(404).send("No devices found");
  }
  device.call("Config.Get", {}).then((result) => {
  res.json(result.result);
  }).catch((error) => {
    res.status(500).json({ error: error.toString() });
});
})
api.get("/devices/:deviceId/getOutputs", (req, res) => {
  const { deviceId } = req.params;

  const device = jsonrpc.getDevices().filter((device) => device.deviceId === deviceId)[0];
  if (!device) {
    return res.status(404).send("No devices found");
  }
  device.call("Get.Outputs", {}).then((result) => {
  res.json(result);
  }).catch((error) => {
    res.status(500).json({ error: error.toString() });
});
});
api.post("/devices/:deviceId/call", (req, res) => {
  const { deviceId } = req.params;
  const { method, params } = req.body;

  if (!method) {
    return res.status(400).send("Invalid request");
  }
  const device = jsonrpc.getDevices().find(device => device.deviceId === deviceId);
  if (!device) {
    return res.status(404).send("Device not found");
  }
  device.call(method, params)
    .then((result) => res.json(result))
    .catch((error) => res.status(500).json({ error: error.toString() }));
});
api.post("/devices/:deviceId/setconfig", (req, res) => {
  const { deviceId } = req.params;
  const { reboot,params } = req.body;
  console.log('deviceId:',deviceId)
  console.log('reboot:',reboot)
  console.log('params:',params)  
  if (!deviceId || !params) {
    return res.status(400).send("Invalid request");
  }
  const device=jsonrpc
    .getDevices()
    .filter((device) => device.deviceId === deviceId)[0]
    device.call("Config.Set", {config:params},2000)
    .then((result) => {
      if(result.error)res.json(result);
      else {
        device.config=result.result;
        device.call("Config.Save",{reboot}).then((result)=>{
          if(result.error)res.json(result);
          else {
            res.json({result:"Config updated"});
          }
        device.update();
        }).catch((error) => {
          res.status(500).json({ error: error.toString() });
        });  
        
    }
    })
    .catch((error) => {
      res.status(500).json({ error: error.toString() });
    });
});
app.use("/api", api);
jsonrpc.start();
app.listen(API_PORT, () => {
  console.log(`Server running on port ${API_PORT}`);
});
