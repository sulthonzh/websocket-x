import { createServer, request as httpRequest } from 'http';
import { WebSocketWebSocket } from './websocket.js';
import { WebSocketClient } from './client.js';

export { WebSocketWebSocket, WebSocketClient };

export function createWebSocketServer(options = {}) {
  const server = createServer();
  const websocketServer = new WebSocketWebSocket(server, options);
  
  server.on('upgrade', (request, socket, head) => {
    websocketServer.handleUpgrade(request, socket, head);
  });
  
  return {
    server,
    websocket: websocketServer,
    listen: (...args) => server.listen(...args),
    close: () => server.close()
  };
}

export function connectWebSocket(url, _protocols = []) {
  const parsed = new URL(url);
  const port = parsed.port || (parsed.protocol === 'wss:' ? 443 : 80);

  const request = httpRequest({
    hostname: parsed.hostname,
    port: port,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Key': generateWebSocketKey(),
      'Sec-WebSocket-Version': '13'
    }
  });

  return new Promise((resolve, reject) => {
    request.on('upgrade', (response, socket, _head) => {
      const client = new WebSocketClient(socket, request);
      resolve(client);
    });

    request.on('error', reject);

    request.end();
  });
}

export function validateWebSocketUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

export function generateWebSocketKey() {
  return Buffer.from(Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15))
    .toString('base64');
}