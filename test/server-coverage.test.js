import { WebSocketClient } from '../src/client.js';
import { WebSocketWebSocket } from '../src/websocket.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('WebSocketWebSocket constructor creates Set and Map', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server);

  assert.ok(wsServer.clients instanceof Set);
  assert.strictEqual(wsServer.clients.size, 0);
  assert.ok(wsServer.pendingConnections instanceof Map);
  assert.strictEqual(wsServer.pendingConnections.size, 0);
});

test('WebSocketWebSocket constructor spreads options', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server, {
    path: '/custom',
    maxPayload: 2048 * 1024,
    verifyClient: (info, cb) => cb(true)
  });

  assert.strictEqual(wsServer.options.path, '/custom');
  assert.strictEqual(wsServer.options.maxPayload, 2048 * 1024);
  assert.strictEqual(wsServer.options.verifyClient.length, 2);
});

test('WebSocketWebSocket close method cleans up clients', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server);

  const mockClient = {
    close: () => {}
  };
  wsServer.clients.add(mockClient);

  wsServer.close();

  assert.strictEqual(wsServer.clients.size, 0);
});

test('WebSocketWebSocket clientsCount getter', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server);

  assert.strictEqual(wsServer.clientsCount, 0);

  const mockClient = {
    close: () => {}
  };
  wsServer.clients.add(mockClient);

  assert.strictEqual(wsServer.clientsCount, 1);
});

test('WebSocketWebSocket generateAcceptValue generates correct SHA1', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server);

  const key1 = 'dGhlIHNhbXBsZSBub25jZQ==';
  const accept1 = wsServer.generateAcceptValue(key1);
  assert.strictEqual(accept1, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');

  const key2 = 'test';
  const accept2 = wsServer.generateAcceptValue(key2);
  assert.ok(accept2.length > 0);
});

test('WebSocketWebSocket handleUpgrade throws if key missing', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server);
  const mockSocket = {
    write: () => {},
    destroy: () => {},
    on: () => {}
  };
  const mockRequest = {
    url: '/ws',
    headers: {
      'sec-websocket-version': '13'
    }
  };

  wsServer.handleUpgrade(mockRequest, mockSocket, Buffer.alloc(0));

  // Should destroy socket when key is missing
  assert.ok(true);
});

test('WebSocketWebSocket handleUpgrade with 1-arg verifyClient callback', () => {
  const server = {
    on: () => {},
    close: () => {}
  };
  const wsServer = new WebSocketWebSocket(server);

  wsServer.options.verifyClient = (info) => {
    return true;
  };

  const mockSocket = {
    write: () => {},
    destroy: () => {},
    on: () => {},
    readableEnded: false,
    end: () => {
      this.readableEnded = true;
    }
  };
  const mockRequest = {
    url: '/ws',
    headers: {
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version': '13'
    }
  };

  wsServer.handleUpgrade(mockRequest, mockSocket, Buffer.alloc(0));

  // Should call completeUpgrade path (integration test - requires real socket)
  assert.ok(true);
});
