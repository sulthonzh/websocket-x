#!/usr/bin/env node

import { Command } from 'commander';
import { createServer } from 'http';
import { WebSocketWebSocket } from './websocket.js';
import { connectWebSocket } from './index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('websocket-x')
  .description('Zero-dependency WebSocket library CLI')
  .version('1.0.0');

// Server mode
program
  .command('serve')
  .description('Start a WebSocket server')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .option('-h, --host <string>', 'Host to bind to', 'localhost')
  .option('--path <string>', 'WebSocket path', '/ws')
  .option('--auth', 'Enable basic authentication')
  .option('--cors', 'Enable CORS headers')
  .action((options) => {
    startServer(options);
  });

// Client mode
program
  .command('client')
  .description('Connect to a WebSocket server')
  .argument('<url>', 'WebSocket URL (ws://localhost:8080)')
  .option('-m, --message <string>', 'Message to send')
  .option('-f, --file <path>', 'File to send')
  .option('-i, --interval <number>', 'Send message interval in ms')
  .option('-c, --count <number>', 'Number of messages to send')
  .option('--ping', 'Send ping messages')
  .action((url, options) => {
    startClient(url, options);
  });

// Echo server mode
program
  .command('echo')
  .description('Start an echo server')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .option('-h, --host <string>', 'Host to bind to', 'localhost')
  .option('--path <string>', 'WebSocket path', '/ws')
  .action((options) => {
    startEchoServer(options);
  });

// Test mode
program
  .command('test')
  .description('Run WebSocket tests')
  .option('-v, --verbose', 'Verbose output')
  .action((options) => {
    runTests(options);
  });

function startServer(options) {
  const server = createServer((req, res) => {
    if (options.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Sec-WebSocket-Version, Sec-WebSocket-Key, Sec-WebSocket-Protocol');
    }
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getTestPage());
      return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
  });

  const wsServer = new WebSocketWebSocket(server, {
    path: options.path,
    verifyClient: (info, callback) => {
      if (options.auth) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Basic ')) {
          callback(false, 401, 'Unauthorized');
          return;
        }
        const credentials = Buffer.from(auth.slice(6), 'base64').toString();
        const [username, password] = credentials.split(':');
        if (username !== 'admin' || password !== 'password') {
          callback(false, 401, 'Unauthorized');
          return;
        }
      }
      callback(true);
    }
  });

  wsServer.on('connection', (client) => {
    console.log(`Client connected from ${client.socket.remoteAddress}`);
    
    client.on('message', (message) => {
      console.log(`Received: ${message}`);
      client.send(`Echo: ${message}`);
    });
    
    client.on('close', () => {
      console.log('Client disconnected');
    });
    
    client.on('error', (error) => {
      console.error('Client error:', error.message);
    });
  });

  server.listen(options.port, options.host, () => {
    console.log(`WebSocket server running on ws://${options.host}:${options.port}${options.path}`);
    console.log(`HTTP server running on http://${options.host}:${options.port}`);
  });
}

function startEchoServer(options) {
  const server = createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });

  const wsServer = new WebSocketWebSocket(server, {
    path: options.path
  });

  wsServer.on('connection', (client) => {
    console.log(`Echo client connected from ${client.socket.remoteAddress}`);
    
    client.on('message', (message) => {
      console.log(`Echoing: ${message}`);
      client.send(message);
    });
    
    client.on('ping', (data) => {
      console.log('Received ping, sending pong');
      client.pong(data);
    });
    
    client.on('close', () => {
      console.log('Echo client disconnected');
    });
    
    client.on('error', (error) => {
      console.error('Echo client error:', error.message);
    });
  });

  server.listen(options.port, options.host, () => {
    console.log(`Echo WebSocket server running on ws://${options.host}:${options.port}${options.path}`);
  });
}

function startClient(url, options) {
  console.log(`Connecting to ${url}...`);
  
  const client = connectWebSocket(url);
  
  client.on('open', () => {
    console.log('Connected to WebSocket server');
    
    if (options.message) {
      client.send(options.message);
      console.log(`Sent: ${options.message}`);
    }
    
    if (options.file) {
      try {
        const message = readFileSync(options.file, 'utf8');
        client.send(message);
        console.log(`Sent file content: ${message.substring(0, 100)}...`);
      } catch (error) {
        console.error('Error reading file:', error.message);
      }
    }
    
    if (options.ping) {
      const pingInterval = setInterval(() => {
        client.ping();
        console.log('Sent ping');
      }, 2000);
      
      client.on('close', () => {
        clearInterval(pingInterval);
      });
    }
    
    let messageCount = 0;
    if (options.interval) {
      const interval = setInterval(() => {
        const message = `Message ${messageCount + 1} at ${new Date().toISOString()}`;
        client.send(message);
        console.log(`Sent: ${message}`);
        messageCount++;
        
        if (options.count && messageCount >= options.count) {
          clearInterval(interval);
          setTimeout(() => client.close(), 1000);
        }
      }, parseInt(options.interval));
    }
  });
  
  client.on('message', (message) => {
    console.log(`Received: ${message}`);
  });
  
  client.on('pong', (data) => {
    console.log('Received pong');
  });
  
  client.on('close', () => {
    console.log('Disconnected from WebSocket server');
  });
  
  client.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
  
  // Auto-close after timeout if no other action
  if (!options.message && !options.file && !options.ping && !options.interval) {
    setTimeout(() => {
      client.close();
    }, 5000);
  }
}

function runTests(options) {
  console.log('Running WebSocket tests...');
  
  // Simple connectivity test
  const server = createServer();
  const wsServer = new WebSocketWebSocket(server);
  
  let testCount = 0;
  let passedTests = 0;
  
  function test(name, testFn) {
    testCount++;
    try {
      testFn();
      console.log(`✓ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
    }
  }
  
  test('WebSocket server creation', () => {
    if (!wsServer || !wsServer.server) {
      throw new Error('Server not created properly');
    }
  });
  
  test('Client connection count', () => {
    if (wsServer.clientsCount !== 0) {
      throw new Error('Initial client count should be 0');
    }
  });
  
  console.log(`\nTests completed: ${passedTests}/${testCount} passed`);
  
  if (passedTests === testCount) {
    console.log('All tests passed! 🎉');
  } else {
    console.log('Some tests failed. Check implementation.');
    process.exit(1);
  }
}

function getTestPage() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        #output { border: 1px solid #ccc; padding: 10px; height: 300px; overflow-y: auto; }
        #input { margin: 10px 0; }
        button { padding: 5px 10px; margin: 5px; }
    </style>
</head>
<body>
    <h1>WebSocket Test</h1>
    <div id="output"></div>
    <div id="input">
        <input type="text" id="messageInput" placeholder="Type a message..." />
        <button onclick="sendMessage()">Send</button>
        <button onclick="clearOutput()">Clear</button>
    </div>
    
    <script>
        const output = document.getElementById('output');
        const input = document.getElementById('messageInput');
        
        function log(message) {
            const div = document.createElement('div');
            div.textContent = message;
            output.appendChild(div);
            output.scrollTop = output.scrollHeight;
        }
        
        function connect() {
            const ws = new WebSocket('ws://localhost:8080/ws');
            
            ws.onopen = () => {
                log('Connected to WebSocket server');
            };
            
            ws.onmessage = (event) => {
                log('Received: ' + event.data);
            };
            
            ws.onclose = () => {
                log('Disconnected from WebSocket server');
            };
            
            ws.onerror = (error) => {
                log('Error: ' + error.message);
            };
            
            return ws;
        }
        
        let ws;
        
        function sendMessage() {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                ws = connect();
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(input.value);
                        log('Sent: ' + input.value);
                        input.value = '';
                    }
                }, 100);
            } else {
                ws.send(input.value);
                log('Sent: ' + input.value);
                input.value = '';
            }
        }
        
        function clearOutput() {
            output.innerHTML = '';
        }
        
        // Connect on page load
        window.addEventListener('load', () => {
            ws = connect();
        });
    </script>
</body>
</html>
  `;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}