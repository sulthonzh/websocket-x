// websocket-x - Zero-dependency WebSocket library for Node.js
// Version: 1.0.0
// Author: sulthonzh
// License: MIT

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { parse } from 'url';

import { EventEmitter } from 'events';

export class WebSocketClient extends EventEmitter {
  constructor(socket, request) {
    super();
    this.socket = socket;
    this.request = request;
    this.readyState = WebSocketClient.CONNECTING;
    this.bufferedAmount = 0;
    this.binaryType = 'arraybuffer';
    
    this.setupEventHandlers();
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  setupEventHandlers() {
    this.socket.on('data', (data) => {
      this.handleData(data);
    });

    this.socket.on('close', () => {
      this.cleanup();
      if (this.readyState !== WebSocketClient.CLOSED) {
        this.readyState = WebSocketClient.CLOSED;
        this.emit('close');
      }
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });

    // Schedule open event
    setImmediate(() => {
      if (this.readyState === WebSocketClient.CONNECTING) {
        this.readyState = WebSocketClient.OPEN;
        this.emit('open');
      }
    });
  }

  handleData(data) {
    if (this.readyState !== WebSocketClient.OPEN) {
      return;
    }

    try {
      const frame = this.parseWebSocketFrame(data);
      
      if (frame) {
        if (frame.opcode === 0x8) {
          // Close frame
          this.handleCloseFrame(frame);
        } else if (frame.opcode === 0x9) {
          // Ping frame
          this.pong(frame.payload);
        } else if (frame.opcode === 0xA) {
          // Pong frame
          this.emit('pong', frame.payload);
        } else if (frame.opcode === 0x1 || frame.opcode === 0x2) {
          // Text or Binary frame
          const payload = frame.payload.toString('utf8');
          this.emit('message', payload);
        }
      }
    } catch (error) {
      this.emit('error', error);
      this.close(1002, 'Protocol error');
    }
  }

  parseWebSocketFrame(data) {
    if (data.length < 2) return null;

    const firstByte = data[0];
    const secondByte = data[1];
    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0F;
    const masked = (secondByte & 0x80) !== 0;
    const payloadLength = secondByte & 0x7F;

    let offset = 2;
    let payload = null;

    if (payloadLength === 126) {
      if (data.length < 4) return null;
      const extendedLength = data.readUInt16BE(2);
      offset += 2;
      payload = Buffer.alloc(extendedLength);
    } else if (payloadLength === 127) {
      if (data.length < 10) return null;
      const extendedLength = data.readBigUInt64BE(2);
      offset += 8;
      payload = Buffer.alloc(Number(extendedLength));
    } else {
      payload = Buffer.alloc(payloadLength);
    }

    if (masked) {
      if (data.length < offset + 4 + payloadLength) return null;
      const maskingKey = data.subarray(offset, offset + 4);
      offset += 4;
      
      for (let i = 0; i < payloadLength; i++) {
        payload[i] = data[offset + i] ^ maskingKey[i % 4];
      }
    } else {
      if (data.length < offset + payloadLength) return null;
      data.copy(payload, 0, offset, offset + payloadLength);
    }

    return { fin, opcode, payload, masked };
  }

  send(data, options = {}) {
    if (this.readyState !== WebSocketClient.OPEN) {
      throw new Error('WebSocket is not open');
    }

    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const opcode = typeof data === 'string' ? 0x1 : 0x2;
    
    const frame = this.createFrame(payload, opcode, options.mask !== false);
    this.socket.write(frame);
    this.bufferedAmount += frame.length;
  }

  createFrame(payload, opcode, masked = true) {
    const length = payload.length;
    let frame = Buffer.alloc(2 + (masked ? 4 : 0) + (length >= 126 ? (length >= 65536 ? 8 : 2) : 0) + length);
    
    let offset = 0;
    
    // First byte: FIN + RSV + opcode
    frame[offset++] = 0x80 | opcode;
    
    // Second byte: MASK + payload length
    if (length < 126) {
      frame[offset++] = masked ? 0x80 | length : length;
    } else if (length < 65536) {
      frame[offset++] = masked ? 0x80 | 126 : 126;
      frame.writeUInt16BE(length, offset);
      offset += 2;
    } else {
      frame[offset++] = masked ? 0x80 | 127 : 127;
      frame.writeBigUInt64BE(BigInt(length), offset);
      offset += 8;
    }
    
    // Masking key (if masked)
    if (masked) {
      const maskingKey = Buffer.from([
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
      ]);
      maskingKey.copy(frame, offset);
      offset += 4;
      
      // Apply mask to payload
      for (let i = 0; i < length; i++) {
        frame[offset + i] = payload[i] ^ maskingKey[i % 4];
      }
    } else {
      payload.copy(frame, offset);
    }
    
    return frame;
  }

  ping(data = Buffer.alloc(0)) {
    if (this.readyState !== WebSocketClient.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    const frame = this.createFrame(data, 0x9);
    this.socket.write(frame);
  }

  pong(data = Buffer.alloc(0)) {
    if (this.readyState !== WebSocketClient.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    const frame = this.createFrame(data, 0xA);
    this.socket.write(frame);
  }

  handleCloseFrame(frame) {
    const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1005;
    const reason = frame.payload.length > 2 ? frame.payload.slice(2).toString('utf8') : '';
    
    this.close(code, reason);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === WebSocketClient.CLOSED || this.readyState === WebSocketClient.CLOSING) {
      return;
    }
    
    this.readyState = WebSocketClient.CLOSING;
    
    const reasonBuffer = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBuffer.length);
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2);
    
    const frame = this.createFrame(payload, 0x8, false);
    this.socket.write(frame);
    
    // Force close after timeout
    setTimeout(() => {
      if (this.readyState !== WebSocketClient.CLOSED) {
        this.socket.end();
      }
    }, 1000);
  }

  cleanup() {
    this.socket.removeAllListeners();
    this.readyState = WebSocketClient.CLOSED;
  }
}

import { EventEmitter } from 'events';

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

  completeUpgrade(request, socket, head) {
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
    const sha1 = require('crypto').createHash('sha1');
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

// Export everything for CommonJS compatibility
module.exports = {
  WebSocketWebSocket,
  WebSocketClient,
  createWebSocketServer,
  connectWebSocket,
  validateWebSocketUrl,
  generateWebSocketKey
};

// Auto-run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Import CLI here to avoid circular dependencies
  import('./cli.js').then(cliModule => {
    cliModule.program.parse();
  }).catch(console.error);
}
