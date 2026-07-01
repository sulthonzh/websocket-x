import { WebSocketClient } from '../src/client.js';
import { connectWebSocket, validateWebSocketUrl, generateWebSocketKey } from '../src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('WebSocketClient initial state', () => {
  const mockSocket = {
    write: () => {},
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);

  assert.strictEqual(client.readyState, WebSocketClient.CONNECTING);
  assert.strictEqual(client.bufferedAmount, 0);
  assert.strictEqual(client.binaryType, 'arraybuffer');
});

test('WebSocketClient sends text message', () => {
  let writeCalled = false;
  let writtenData;

  const mockSocket = {
    write: (data) => { writeCalled = true; writtenData = data; },
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;

  client.send('Hello, World!');

  assert.ok(writeCalled, 'write should have been called');
  assert.ok(writtenData instanceof Buffer);
  assert.strictEqual(writtenData[0] & 0x0F, 0x1); // Text frame opcode
});

test('WebSocketClient sends binary message', () => {
  const buffer = Buffer.from([1, 2, 3, 4, 5]);
  let writeCalled = false;
  let writtenData;

  const mockSocket = {
    write: (data) => { writeCalled = true; writtenData = data; },
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;

  client.send(buffer);

  assert.ok(writeCalled, 'write should have been called');
  assert.ok(writtenData instanceof Buffer);
  assert.strictEqual(writtenData[0] & 0x0F, 0x2); // Binary frame opcode
});

test('WebSocketClient handles ping frame', () => {
  let writtenData;
  const mockSocket = {
    write: (data) => { writtenData = data; },
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;

  // Simulate ping frame
  const pingFrame = Buffer.from([0x89, 0x02, 0x01, 0x02]); // Ping frame with payload
  client.handleData(pingFrame);

  assert.ok(writtenData, 'should have written a pong frame');
  assert.strictEqual(writtenData[0] & 0x0F, 0xA); // Pong frame opcode
});

test('WebSocketClient handles close frame', () => {
  let writtenData;
  const mockSocket = {
    write: (data) => { writtenData = data; },
    on: () => {},
    removeAllListeners: () => {},
    destroy: () => {},
    end: () => {}
  };

  const client = new WebSocketClient(mockSocket);
  client.readyState = WebSocketClient.OPEN;

  // Simulate close frame
  const closeFrame = Buffer.from([0x88, 0x06, 0x03, 0xE8, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // Close frame with code 1000 and "Hello"
  client.handleData(closeFrame);

  // After receiving close frame, client should be in CLOSING state and send a close frame back
  assert.strictEqual(client.readyState, WebSocketClient.CLOSING);
  assert.ok(writtenData, 'should have sent a close frame back');
  assert.strictEqual(writtenData[0] & 0x0F, 0x8); // Close frame opcode
});

test('validateWebSocketUrl accepts valid URLs', () => {
  assert.ok(validateWebSocketUrl('ws://example.com'));
  assert.ok(validateWebSocketUrl('wss://example.com'));
});

test('validateWebSocketUrl rejects invalid URLs', () => {
  assert.ok(!validateWebSocketUrl('http://example.com'));
  assert.ok(!validateWebSocketUrl('https://example.com'));
  assert.ok(!validateWebSocketUrl('invalid-url'));
});

test('generateWebSocketKey returns valid base64 string', () => {
  const key = generateWebSocketKey();
  assert.ok(typeof key === 'string', 'key should be a base64 string');
  assert.ok(key.length > 0, 'key should not be empty');
  // Decoded should be 16 bytes (128 bits per RFC 6455)
  const decoded = Buffer.from(key, 'base64');
  assert.ok(decoded.length >= 16, 'decoded key should be at least 16 bytes');
});
