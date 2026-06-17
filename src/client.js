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