import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', function connection(ws, req) {

  console.log('connected');
  console.log('request', req.headers.host);
  
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    console.log('received: %s', data);
  });

  ws.send(JSON.stringify({"id":68,"method":"Config.Get","params":{}}));
});

server.listen(8080);