import { createServer } from 'http';
import { parse } from 'url';
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

export function connectWebSocket(url, protocols = []) {
  return new WebSocketClient(url, protocols);
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