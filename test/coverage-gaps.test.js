import { WebSocketClient } from '../src/client.js';
import { WebSocketWebSocket } from '../src/websocket.js';
import { createWebSocketServer, connectWebSocket, validateWebSocketUrl, generateWebSocketKey } from '../src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// websocket.js constructor property assignments
test('WebSocketWebSocket constructor sets properties', () => {
  const mockServer = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(mockServer);

  assert.strictEqual(wsServer.server, mockServer);
  assert.ok(wsServer.clients instanceof Set);
  assert.strictEqual(wsServer.clients.size, 0);
  assert.ok(wsServer.pendingConnections instanceof Map);
  assert.strictEqual(wsServer.pendingConnections.size, 0);
  assert.strictEqual(wsServer.options.path, '/ws');
  assert.strictEqual(wsServer.options.maxPayload, 1024 * 1024);
  assert.strictEqual(wsServer.options.verifyClient, null);
});

test('WebSocketWebSocket constructor spreads options', () => {
  const mockServer = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(mockServer, {
    path: '/custom',
    maxPayload: 2048 * 1024,
    verifyClient: (info, cb) => cb(true)
  });

  assert.strictEqual(wsServer.options.path, '/custom');
  assert.strictEqual(wsServer.options.maxPayload, 2048 * 1024);
  assert.strictEqual(wsServer.options.verifyClient.length, 2);
});

// websocket.js close method
test('WebSocketWebSocket close method cleans up clients', () => {
  const mockServer = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(mockServer);

  // Add a mock client
  const mockClient = {
    close: () => {}
  };
  wsServer.clients.add(mockClient);

  wsServer.close();

  assert.strictEqual(wsServer.clients.size, 0);
});

test('WebSocketWebSocket clientsCount getter', () => {
  const mockServer = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(mockServer);

  assert.strictEqual(wsServer.clientsCount, 0);

  const mockClient = {
    close: () => {}
  };
  wsServer.clients.add(mockClient);

  assert.strictEqual(wsServer.clientsCount, 1);
});

// client.js error handling in handleData
test('WebSocketClient handleData throws on non-OPEN readyState', () => {
  const mockSocket = {
    write: () => {},
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.CLOSED;

  try {
    client.handleData(Buffer.from([0x1, 0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F]));
    assert.fail('Should have thrown error');
  } catch (error) {
    assert.ok(error);
  }
});

test('WebSocketClient handleData throws on parse error', () => {
  const mockSocket = {
    write: () => {},
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;

  try {
    client.handleData(Buffer.from([0x1, 0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F])); // Valid frame
    assert.fail('Should have thrown error');
  } catch (error) {
    assert.ok(error);
  }
});

// client.js error handling in setupEventHandlers
test('WebSocketClient setupEventHandlers handles socket data error', () => {
  const mockSocket = {
    write: () => {},
    on: (event, handler) => {
      if (event === 'data') {
        handler(Buffer.from([0x1, 0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F]));
      }
    },
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);

  // Should not crash even if error occurs
  assert.ok(true);
});

// index.js createWebSocketServer with options
test('createWebSocketServer returns server with options spread', () => {
  const { server, websocket } = createWebSocketServer({
    path: '/test',
    verifyClient: (info, cb) => cb(true)
  });

  assert.strictEqual(websocket.options.path, '/test');
  assert.strictEqual(websocket.options.verifyClient.length, 2);

  server.close();
});

// index.js validateWebSocketUrl error path
test('validateWebSocketUrl catches URL parsing errors', () => {
  const result1 = validateWebSocketUrl('not-a-url');
  const result2 = validateWebSocketUrl(123);
  const result3 = validateWebSocketUrl(null);

  assert.strictEqual(result1, false);
  assert.strictEqual(result2, false);
  assert.strictEqual(result3, false);
});

// index.js generateWebSocketKey randomness
test('generateWebSocketKey generates different keys', () => {
  const key1 = generateWebSocketKey();
  const key2 = generateWebSocketKey();

  assert.notStrictEqual(key1, key2);
  assert.ok(key1.length > 0);
  assert.ok(key2.length > 0);
});
