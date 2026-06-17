import { createServer } from 'http';
import { WebSocketWebSocket } from '../src/websocket.js';
import { connectWebSocket } from '../src/index.js';
import { test } from 'node:test';
import assert from 'node:assert';

test('WebSocket server creation', () => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);
  
  assert.ok(wsServer instanceof WebSocketWebSocket);
  assert.strictEqual(wsServer.server, server);
  assert.strictEqual(wsServer.clientsCount, 0);
});

test('WebSocket server handles upgrade request', (done) => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);
  
  let clientConnected = false;
  
  wsServer.on('connection', (client) => {
    clientConnected = true;
    assert.ok(client);
    done();
  });
  
  server.listen(0, () => {
    const port = server.address().port;
    const { WebSocket } = require('ws');
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws.on('open', () => {
      expect(clientConnected).toBe(true);
      ws.close();
      server.close();
    });
  });
});

test('WebSocket server rejects invalid paths', (done) => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server, { path: '/ws' });
  
  server.listen(0, () => {
    const port = server.address().port;
    const net = require('net');
    const socket = net.createConnection(port);
    
    let response = '';
    socket.on('data', (data) => {
      response += data.toString();
      if (response.includes('404')) {
        assert.match(response, /404 Not Found/);
        socket.destroy();
        server.close();
        done();
      }
    });
    
    // Send invalid upgrade request with wrong path
    socket.write('GET /invalid HTTP/1.1\r\n');
    socket.write('Host: localhost\r\n');
    socket.write('Connection: Upgrade\r\n');
    socket.write('Upgrade: websocket\r\n');
    socket.write('Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n');
    socket.write('Sec-WebSocket-Version: 13\r\n');
    socket.write('\r\n');
  });
});

test('WebSocket server validates sec-websocket-key', (done) => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);
  
  server.listen(0, () => {
    const port = server.address().port;
    const net = require('net');
    const socket = net.createConnection(port);
    
    let response = '';
    socket.on('data', (data) => {
      response += data.toString();
      if (response.includes('426')) {
        assert.match(response, /426 Upgrade Required/);
        socket.destroy();
        server.close();
        done();
      }
    });
    
    // Send invalid upgrade request with missing key
    socket.write('GET /ws HTTP/1.1\r\n');
    socket.write('Host: localhost\r\n');
    socket.write('Connection: Upgrade\r\n');
    socket.write('Upgrade: websocket\r\n');
    socket.write('Sec-WebSocket-Version: 13\r\n');
    socket.write('\r\n');
  });
});

test('WebSocket server with verifyClient', (done) => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server, {
    verifyClient: (info, callback) => {
      callback(true);
    }
  });
  
  let connectionCount = 0;
  
  wsServer.on('connection', () => {
    connectionCount++;
    if (connectionCount === 2) {
      server.close();
      done();
    }
  });
  
  server.listen(0, () => {
    const port = server.address().port;
    const { WebSocket } = require('ws');
    
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws1.on('open', () => {
      ws2.on('open', () => {
        assert.strictEqual(connectionCount, 2);
      });
    });
  });
});

test('WebSocket server closes all clients', (done) => {
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);
  
  let client1Closed = false;
  let client2Closed = false;
  
  wsServer.on('connection', (client) => {
    client.on('close', () => {
      if (client === client1) client1Closed = true;
      if (client === client2) client2Closed = true;
      
      if (client1Closed && client2Closed) {
        assert.strictEqual(wsServer.clientsCount, 0);
        server.close();
        done();
      }
    });
  });
  
  server.listen(0, () => {
    const port = server.address().port;
    const { WebSocket } = require('ws');
    
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws1.on('open', () => {
      ws2.on('open', () => {
        wsServer.close();
      });
    });
  });
});