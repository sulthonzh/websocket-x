import { WebSocketClient } from '../src/client.js';
import { connectWebSocket } from '../src/index.js';
import { test } from 'node:test';
import assert from 'node:assert';

test('WebSocketClient initial state', () => {
  // Mock socket for testing
  const mockSocket = {
    write: () => {},
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {}
  };
  
  const client = new WebSocketClient(mockSocket);
  
  assert.strictEqual(client.readyState, WebSocketClient.CONNECTING);
  assert.strictEqual(client.bufferedAmount, 0);
  assert.strictEqual(client.binaryType, 'arraybuffer');
});

test('WebSocketClient sends text message', () => {
  const mockSocket = {
    write: () => {},
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {}
  };
  
  let writeCalled = false;
  let writtenData;
  
  mockSocket.write = (data) => {
    writeCalled = true;
    writtenData = data;
  };
  
  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN; // Manually set to open for testing
  
  client.send('Hello, World!');
  
  assert.ok(writeCalled);
  assert.ok(writtenData instanceof Buffer);
  assert.strictEqual(writtenData[0] & 0x0F, 0x1); // Text frame opcode
});

test('WebSocketClient sends binary message', () => {
  const buffer = Buffer.from([1, 2, 3, 4, 5]);
  let writeCalled = false;
  let writtenData;
  
  const mockSocket = {
    write: (data) => {
      writeCalled = true;
      writtenData = data;
    },
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {}
  };
  
  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;
  
  client.send(buffer);
  
  assert.ok(writeCalled);
  assert.ok(writtenData instanceof Buffer);
  assert.strictEqual(writtenData[0] & 0x0F, 0x2); // Binary frame opcode
});

test('WebSocketClient handles ping frame', () => {
  const mockSocket = {
    write: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    destroy: jest.fn()
  };
  
  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;
  
  // Simulate ping frame
  const pingFrame = Buffer.from([0x89, 0x02, 0x01, 0x02]); // Ping frame with payload
  client.handleData(pingFrame);
  
  expect(mockSocket.write).toHaveBeenCalled();
  // Should respond with pong frame
  const writtenData = mockSocket.write.mock.calls[0][0];
  assert.strictEqual(writtenData[0] & 0x0F, 0xA); // Pong frame opcode
});

test('WebSocketClient handles close frame', () => {
  const mockSocket = {
    write: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    destroy: jest.fn()
  };
  
  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;
  
  // Mock close event
  let closeEmitted = false;
  client.on('close', () => {
    closeEmitted = true;
  });
  
  // Simulate close frame
  const closeFrame = Buffer.from([0x88, 0x06, 0x03, 0xE8, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // Close frame with code 1000 and "Hello"
  client.handleData(closeFrame);
  
  assert.ok(closeEmitted);
  assert.strictEqual(client.readyState, WebSocketClient.CLOSED);
});

test('WebSocketClient validates WebSocket URLs', () => {
  assert.ok(connectWebSocket.validateWebSocketUrl('ws://example.com'));
  assert.ok(connectWebSocket.validateWebSocketUrl('wss://example.com'));
  assert.ok(!connectWebSocket.validateWebSocketUrl('http://example.com'));
  assert.ok(!connectWebSocket.validateWebSocketUrl('https://example.com'));
  assert.ok(!connectWebSocket.validateWebSocketUrl('invalid-url'));
});

test('WebSocketClient generates valid WebSocket key', () => {
  const key = connectWebSocket.generateWebSocketKey();
  assert.ok(key instanceof Buffer);
  assert.strictEqual(key.length, 16); // 128 bits = 16 bytes
});

test('WebSocketClient with real server integration', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    let clientConnected = false;
    let messageReceived = false;
    
    wsServer.on('connection', (client) => {
      clientConnected = true;
      
      client.on('message', (message) => {
        assert.strictEqual(message, 'Test message');
        messageReceived = true;
        client.close();
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('open', () => {
        assert.ok(clientConnected);
        ws.send('Test message');
      });
      
      ws.on('close', () => {
        assert.ok(messageReceived);
        server.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('Test timeout'));
    }, 5000);
  });
});

test('WebSocketClient connection rejection', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    // Reject all connections
    wsServer.options.verifyClient = () => false;
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('error', (error) => {
        expect(error.message).toContain('not open');
        server.close();
        resolve();
      });
      
      ws.on('open', () => {
        reject(new Error('Connection should not be opened'));
      });
      
      // Timeout after 2 seconds
      setTimeout(() => {
        server.close();
        resolve();
      }, 2000);
    });
  });
});

test('WebSocketClient ping/pong functionality', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    let pongReceived = false;
    
    wsServer.on('connection', (client) => {
      client.on('pong', (data) => {
        pongReceived = true;
        expect(data).toBeInstanceOf(Buffer);
      });
      
      client.on('close', () => {
        expect(pongReceived).toBe(true);
        server.close();
        resolve();
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('open', () => {
        ws.ping();
        
        // Wait for pong
        setTimeout(() => {
          ws.close();
        }, 1000);
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('Test timeout'));
    }, 5000);
  });
});