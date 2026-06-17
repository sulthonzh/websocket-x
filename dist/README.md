# websocket-x

Zero-dependency WebSocket library for Node.js with practical utilities and CLI tool.

## Features

- 🚀 **Zero dependencies** - No external dependencies required
- 🔧 **Full WebSocket implementation** - RFC 6455 compliant
- 📡 **Server & Client** - Both WebSocket server and client implementations
- 🎯 **CLI tool** - Built-in CLI for testing and debugging
- 🔒 **Error handling** - Comprehensive error handling and validation
- 📦 **TypeScript ready** - Full TypeScript support
- 🧪 **Well tested** - Comprehensive test suite

## Installation

```bash
npm install websocket-x
```

Or use the CLI tool directly:

```bash
npx websocket-x --help
```

## Quick Start

### Server

```javascript
import { createWebSocketServer } from 'websocket-x';

const { server, websocket } = createWebSocketServer({
  path: '/ws'
});

websocket.on('connection', (client) => {
  client.on('message', (message) => {
    console.log('Received:', message);
    client.send('Echo: ' + message);
  });
});

server.listen(8080, () => {
  console.log('WebSocket server running on ws://localhost:8080/ws');
});
```

### Client

```javascript
import { connectWebSocket } from 'websocket-x';

const ws = connectWebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  ws.send('Hello, Server!');
});

ws.on('message', (message) => {
  console.log('Received:', message);
});

ws.on('close', () => {
  console.log('Disconnected');
});
```

## CLI Usage

### Start a WebSocket server

```bash
websocket-x serve --port 8080 --host localhost
```

### Connect to a WebSocket server

```bash
websocket-x client ws://localhost:8080/ws --message "Hello, Server!"
```

### Start an echo server

```bash
websocket-x echo --port 8080
```

### Run tests

```bash
websocket-x test --verbose
```

## API Reference

### createWebSocketServer(options)

Creates a WebSocket server.

- `options.path` - WebSocket path (default: '/ws')
- `options.verifyClient` - Client verification function
- `options.maxPayload` - Maximum payload size (default: 1MB)

### connectWebSocket(url, protocols)

Creates a WebSocket client connection.

- `url` - WebSocket URL
- `protocols` - Optional protocols array

### WebSocketWebSocket

WebSocket server implementation with events:
- `connection` - New client connected
- `error` - Error occurred

### WebSocketClient

WebSocket client implementation with events:
- `open` - Connection opened
- `message` - Message received
- `close` - Connection closed
- `error` - Error occurred
- `ping` - Ping received
- `pong` - Pong received

## License

MIT

## Contributing

Feel free to submit issues and pull requests. For major changes, please open an issue first to discuss what you would like to change.

## Changelog

### 1.0.0
- Initial release
- Full WebSocket implementation
- CLI tool
- Comprehensive test suite
