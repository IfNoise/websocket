
import mkrpc from './json-rpc-ws.js';

const rpc = mkrpc();
rpc.onopen = function() {
  console.log('Connected');
  rpc.call("Config.Get",{},5000).then(function(result) {
    console.log('Result:', result);
  }).catch(function(err) {
    console.log('Error:', err);
  } )
  

};
setTimeout(function() {

  rpc.call("Config.Get",{},5000).then(function(result) {
    console.log('Result:', result);
  }).catch(function(err) {
    console.log('Error:', err);
  } )
  
}, 5000);
