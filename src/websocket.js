import { EventEmitter } from 'events';
import { parse } from 'url';
import crypto from 'crypto';
import { WebSocketClient } from './client.js';

export class WebSocketWebSocket extends EventEmitter {
  constructor(server, options = {}) {
    super();
    this.server = server;
    this.clients = new Set();
    this.options = {
      path: '/ws',
      maxPayload: 1024 * 1024, // 1MB
      verifyClient: null,
      ...options
    };
    this.pendingConnections = new Map();
  }

  handleUpgrade(request, socket, head) {
    const { pathname } = parse(request.url);
    
    if (pathname !== this.options.path) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    if (this.options.verifyClient) {
      const info = { req: request };
      if (this.options.verifyClient.length === 2) {
        this.options.verifyClient(info, (authorized, code, message) => {
          if (!authorized) {
            socket.write(`HTTP/1.1 ${code || 401} ${message || 'Unauthorized'}\r\n\r\n`);
            socket.destroy();
            return;
          }
          this.completeUpgrade(request, socket, head);
        });
      } else {
        const result = this.options.verifyClient(info);
        if (!result) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        this.completeUpgrade(request, socket, head);
      }
    } else {
      this.completeUpgrade(request, socket, head);
    }
  }

  completeUpgrade(request, socket, _head) {
    const key = request.headers['sec-websocket-key'];
    const version = parseInt(request.headers['sec-websocket-version'] || '13', 10);
    
    if (!key || version < 13) {
      socket.write('HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\n\r\n');
      socket.destroy();
      return;
    }

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${this.generateAcceptValue(key)}`
    ];

    if (request.headers['sec-websocket-protocol']) {
      response.push(`Sec-WebSocket-Protocol: ${request.headers['sec-websocket-protocol']}`);
    }

    socket.write(`${response.join('\r\n')}\r\n\r\n`);

    const client = new WebSocketClient(socket, request);
    this.clients.add(client);
    this.pendingConnections.set(socket, client);

    client.on('open', () => {
      this.emit('connection', client);
    });

    client.on('close', () => {
      this.clients.delete(client);
      this.pendingConnections.delete(socket);
    });

    client.on('error', (error) => {
      this.emit('error', error);
    });

    socket.on('error', (error) => {
      const client = this.pendingConnections.get(socket);
      if (client) {
        client.emit('error', error);
        this.pendingConnections.delete(socket);
      }
    });
  }

  generateAcceptValue(key) {
    const magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    const sha1 = crypto.createHash('sha1');
    sha1.update(key + magic);
    return sha1.digest('base64');
  }

  close() {
    for (const client of this.clients) {
      client.close(1001, 'Server closing');
    }
    this.clients.clear();
  }

  get clientsCount() {
    return this.clients.size;
  }
}