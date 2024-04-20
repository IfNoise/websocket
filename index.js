/* import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', function connection(ws, req) {

  console.log('connected');
  console.log('request', ws._socket.remoteAddress);
  
  ws.on('error', console.error);

  ws.on('rpc', function message(data) {
    console.log('received: %s', data);
  });

  ws.send(JSON.stringify({"id":68,"method":"Config.Get","params":{}}));
});

server.listen(8080); */
import JSONRPCws from "./json-rpc-ws.js "

const jsonrpc = JSONRPCws(8080,(device) => {
  console.log("Device connected", device);
  device.call("Config.Get", {}).then((result) => {
    console.log("Config.Get result", result);
    
  });
  console.log( jsonrpc.getDevices())
}  
);
jsonrpc.start();



