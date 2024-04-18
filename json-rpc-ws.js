import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { createServer } from "http";
/* 
const mkrpc = function() {
  var id = 1, reconn = true, calls = {}, defaultTimeoutMs = 3000, ws=null;
  var engine = {
    onopen: function() {},   // Called when WS connection is established
    onclose: function() {},  // Called when WS connection is closed
    onin: function() {},     // Called on each incoming frame
    onout: function() {},    // Called on each outgoing frame
    send: function(frame) {  // Send notification to the server
      engine.onout(frame);
      ws?.send(JSON.stringify(frame));
    },
    close: function() {  // Close and stop reconnecting
      reconn = false;
      ws.close();
    },
    call: function(method, params, timeoutMilli) {
      return new Promise(function(resolve, reject) {
        var frame = {id: id++, method, params};
        // console.log('Sent:', JSON.stringify(frame));
        calls[frame.id] = resolve;
        engine.onout(frame);
        ws?.send(JSON.stringify(frame));
        setTimeout(function() {
          if (calls[frame.id]) {
            reject('RPC call timeout' + JSON.stringify(frame));
            delete calls[frame.id];
          }
        }, timeoutMilli || defaultTimeoutMs);
      });
    },
  }; */
/* 
  var start = function() {
    // console.log('Opening WS connection to', url);
    const server = createServer();
    const wss = new WebSocketServer({ server });
    wss.on('connection', function connection(w, req) {
    ws =w
    console.log('Connected',req.headers);
    ws.onopen = function(ev) {
      
      engine.onopen();
    };
    ws.onclose = function(ev) {
      // console.log('Closed WS connection to', url);
      engine.onclose();
    };
    ws.onerror = function(ev) {
      console.log('WS connection error:', ev);
    };
    ws.onmessage = function(ev) {
      console.log('Rcvd:', ev.data);
      var frame = JSON.parse(ev.data);
      engine.onin(frame);
      if (calls[frame.id]) calls[frame.id](frame);  // Resolve call promise
      delete calls[frame.id];
    };
  server.listen(8080);
  })};
  start();

  return engine;
}; */

class JSONRPCws{
  constructor(){
    this.wss = new WebSocketServer({port:8080});
    this.devices=[]
    this.wss.on('connection',function connection(ws,req){
      this.devices.push({ws:ws,status:'connected'})
      ws.on('message',function incoming(message){})

        
    });
  }
  call(method, params, timeoutMilli){

  }

}
export default mkrpc
