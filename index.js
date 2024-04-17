
import mkrpc from './json-rpc-ws.js';

const rpc = mkrpc();
rpc.onopen = function() {
  console.log('Connected');
  rpc.call({"id":68,"method":"Config.Get","params":{}}).then(function(result) {
    console.log('Result:', result);
  }).catch(function(err) {
    console.log('Error:', err);
  } )
};
