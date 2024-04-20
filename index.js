import JSONRPCws from "./json-rpc-ws.js "

const jsonrpc = JSONRPCws(8080,(device) => {
  console.log("Device connected", device);
  
  console.log( jsonrpc.getDevices())
}  
);
jsonrpc.start();



