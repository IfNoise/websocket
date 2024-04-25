import JSONRPCws from "./json-rpc-ws.js ";
import express from "express";
import cors from "cors";
import { bodyParser } from "body-parser";
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json({ extended: true }));
const jsonrpc = JSONRPCws(8080, (device) => {
  console.log("Device connected", device);

  console.log(jsonrpc.getDevices());
});
app.get("/devices", (req, res) => {
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
app.post("/call", (req, res) => {
  const { device, method, params } = req.body;
  if (!device || !method) {
    return res.status(400).send("Invalid request");
  }
  jsonrpc
    .getDevices()
    .filter((id) => id === device)
    .call(method, params)
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      res.status(500).json({ error: error.toString() });
    });
});
app.post("/setconfig", (req, res) => {
  const { deviceId,reboot,params } = req.body;
  if (!deviceId || !params||!reboot) {
    return res.status(400).send("Invalid request");
  }
  const device=jsonrpc
    .getDevices()
    .filter((id) => id === deviceId)
    device.call(method, params)
    .then((result) => {
      if(result.error)res.json(result);
      else {
        device.call(Config.Save,{reboot}).then((result)=>{
          if(result.error)res.json(result);
          else {
            res.json({result:"Config updated"});
          }
        }).catch((error) => {
          res.status(500).json({ error: error.toString() });
        });  
    }
    })
    .catch((error) => {
      res.status(500).json({ error: error.toString() });
    });
});
jsonrpc.start();
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
