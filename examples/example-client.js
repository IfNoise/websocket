import WebSocket from 'ws';

if (process.argv.length < 3) {
  console.log('Usage: node examples/example-client.js ws://localhost:8080');
  process.exit(1);
}

const url = process.argv[2];
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Connected to', url);
});

ws.on('message', (data) => {
  try {
    const frame = JSON.parse(data.toString());
    console.log('Received frame:', frame);

    // If it's a method call (has method and id) reply with a simple result
    if (frame && frame.method && typeof frame.id !== 'undefined') {
      if (frame.method === 'Config.Get') {
        const res = { id: frame.id, result: { device: { id: 'example-device-1' }, configValue: 123 } };
        ws.send(JSON.stringify(res));
      } else {
        // echo params back
        const res = { id: frame.id, result: { echo: frame.params || null } };
        ws.send(JSON.stringify(res));
      }
    }
  } catch (e) {
    console.warn('Invalid frame', e && e.message);
  }
});

ws.on('close', () => console.log('Disconnected'));
ws.on('error', (err) => console.error('WS error', err && err.message));
