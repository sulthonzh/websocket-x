import { createServer } from 'http';
import { WebSocketWebSocket } from '../src/websocket.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('WebSocket server creation', () => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);

  assert.ok(wsServer instanceof WebSocketWebSocket);
  assert.strictEqual(wsServer.server, server);
  assert.strictEqual(wsServer.clientsCount, 0);
  server.close();
});

test('WebSocket server accepts custom path option', () => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server, { path: '/ws' });

  assert.strictEqual(wsServer.options.path, '/ws');
  assert.strictEqual(wsServer.clientsCount, 0);
  server.close();
});

test('WebSocket server tracks clients count', () => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);

  assert.strictEqual(wsServer.clientsCount, 0);
  server.close();
});

test('WebSocket server close cleans up', () => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);

  wsServer.close();
  server.close();
  assert.strictEqual(wsServer.clientsCount, 0);
});
