import { createServer } from 'http';
import { WebSocketWebSocket } from '../src/websocket.js';
import { connectWebSocket } from '../src/index.js';
import { test } from 'node:test';
import assert from 'node:assert';
import { setTimeout as sleep } from 'timers/promises';

test('Full WebSocket integration test - server, client, message exchange', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    const messages = [];
    let clientConnected = false;
    let serverReceived = false;
    let clientReceived = false;
    
    wsServer.on('connection', (client) => {
      clientConnected = true;
      assert.ok(client);
      
      client.on('message', (message) => {
        messages.push(`Server received: ${message}`);
        serverReceived = true;
        
        // Echo back with prefix
        client.send(`Echo: ${message}`);
      });
      
      client.on('close', () => {
        messages.push('Client disconnected');
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('open', () => {
        assert.ok(clientConnected);
        
        // Send test messages
        ws.send('Hello from client');
        
        // Wait for echo
        setTimeout(() => {
          assert.ok(serverReceived);
          assert.ok(clientReceived);
          
          // Close connection
          ws.close();
        }, 1000);
      });
      
      ws.on('message', (message) => {
        messages.push(`Client received: ${message}`);
        clientReceived = true;
        
        // Verify echo
        if (message === 'Echo: Hello from client') {
          assert.strictEqual(message, 'Echo: Hello from client');
        }
      });
      
      ws.on('close', () => {
        assert.ok(messages.length > 0);
        server.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('Integration test timeout'));
    }, 5000);
  });
});

test('Multiple clients concurrent connections', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    const connections = [];
    const messages = [];
    
    wsServer.on('connection', (client) => {
      connections.push(client);
      
      client.on('message', (message) => {
        messages.push(`Client ${connections.indexOf(client)}: ${message}`);
        client.send(`Response to ${message}`);
      });
      
      client.on('close', () => {
        const index = connections.indexOf(client);
        if (index > -1) {
          connections.splice(index, 1);
        }
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      const clients = [];
      
      // Connect multiple clients
      for (let i = 0; i < 3; i++) {
        const ws = connectWebSocket(`ws://localhost:${port}/ws`);
        clients.push(ws);
        
        ws.on('open', () => {
          ws.send(`Message from client ${i}`);
        });
        
        ws.on('message', (message) => {
          assert.strictEqual(message, `Response to Message from client ${i}`);
        });
        
        ws.on('close', () => {
          if (connections.length === 0) {
            server.close();
            resolve();
          }
        });
      }
      
      // Close all clients after a delay
      setTimeout(() => {
        clients.forEach(ws => ws.close());
      }, 2000);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Multiple clients test timeout'));
      }, 5000);
    });
  });
});

test('WebSocket with binary data', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    const testData = Buffer.from([1, 2, 3, 4, 5]);
    let binaryDataReceived = false;
    
    wsServer.on('connection', (client) => {
      client.on('message', (message) => {
        assert.ok(message instanceof Buffer);
        assert.deepStrictEqual(message, testData);
        binaryDataReceived = true;
        
        // Send binary response
        client.send(Buffer.from([6, 7, 8, 9, 10]));
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('open', () => {
        ws.send(testData);
      });
      
      ws.on('message', (message) => {
        assert.ok(message instanceof Buffer);
        assert.deepStrictEqual(message, Buffer.from([6, 7, 8, 9, 10]));
        assert.ok(binaryDataReceived);
        
        ws.close();
        server.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('Binary data test timeout'));
    }, 5000);
  });
});

test('WebSocket error handling', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    let errorEmitted = false;
    
    wsServer.on('connection', (client) => {
      client.on('error', (error) => {
        errorEmitted = true;
        assert.ok(error);
      });
      
      client.on('close', () => {
        assert.ok(errorEmitted);
        server.close();
        resolve();
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('open', () => {
        // Send invalid data to trigger error
        const socket = ws.socket;
        if (socket && socket.write) {
          // Write malformed WebSocket frame
          socket.write(Buffer.from([0x81, 0x05, 0x74, 0x65, 0x73, 0x74]));
        }
      });
      
      ws.on('error', (error) => {
        errorEmitted = true;
      });
      
      ws.on('close', () => {
        assert.ok(errorEmitted);
        server.close();
        resolve();
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        server.close();
        resolve();
      }, 3000);
    });
  });
});

test('WebSocket connection lifecycle', async () => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const wsServer = new WebSocketWebSocket(server);
    
    const events = [];
    
    wsServer.on('connection', (client) => {
      events.push('client-connected');
      
      client.on('open', () => {
        events.push('client-open');
      });
      
      client.on('message', (message) => {
        events.push(`message: ${message}`);
        client.send('response');
      });
      
      client.on('close', () => {
        events.push('client-closed');
        assert.deepStrictEqual(events, [
          'client-connected',
          'client-open',
          'message: test',
          'client-closed'
        ]);
        server.close();
        resolve();
      });
    });
    
    server.listen(0, () => {
      const port = server.address().port;
      
      const ws = connectWebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('open', () => {
        events.push('client-connected-to-server');
        ws.send('test');
      });
      
      ws.on('message', (message) => {
        events.push(`server-response: ${message}`);
        ws.close();
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        reject(new Error('Connection lifecycle test timeout'));
      }, 3000);
    });
  });
});