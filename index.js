import JSONRPCws from "./json-rpc-ws.js "
import express from "express";
import cors from "cors";
const app = express();
app.use(cors());
app.use(express.json());

const jsonrpc = JSONRPCws(8080,(device) => {
  console.log("Device connected", device);
  
  console.log( jsonrpc.getDevices())
}  
);
app.get("/devices", (req, res) => {
  res.json(jsonrpc.getDevices());
});
jsonrpc.start();
app.listen(3000, () => {
  console.log("Server running on port 3000");
})



