module.exports = {
  apps : [{
    name   : "WebSocketServer",
    script : "./index.js",
     env_production: {
       NODE_ENV: "production",
       WS_PORT: 8080,
       API_PORT: 3600
    },
    env_development: {
       NODE_ENV: "development",
       WS_PORT: 8080,
       API_PORT: 3600
    }
  }]
}
