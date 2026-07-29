# websocket-x

Zero-dependency WebSocket library for Node.js — RFC 6455 compliant with server & client implementations, CLI tool, and no external dependencies.

**Perfect for:** Embedded systems, edge computing, containers, and any scenario where dependency bloat matters.

---

## ✨ Why websocket-x?

| Feature | websocket-x | ws | uws |
|---------|-------------|----|-----|
| **Production Dependencies** | 0 | 12+ | 1+ |
| **Bundle Size** | ~8KB | ~120KB | ~60KB |
| **RFC 6455 Compliant** | ✅ | ✅ | ✅ |
| **Server + Client** | ✅ | ✅ | ✅ |
| **CLI Tool** | ✅ | ❌ | ❌ |
| **Zero Configuration** | ✅ | ❌ | ❌ |

**The uniqueness:** websocket-x uses only Node.js built-ins (events, http, url, crypto). No external packages = no dependency updates, no supply chain attacks, no bloat.

---

## 🚀 Quick Start

### Installation

```bash
npm install websocket-x
```

### Echo Server (30 seconds)

```javascript
import { createWebSocketServer } from 'websocket-x';

const { server, websocket } = createWebSocketServer();

websocket.on('connection', (client) => {
  client.on('message', (message) => {
    client.send(`Echo: ${message}`);
  });
});

server.listen(8080, () => {
  console.log('🚀 WebSocket server on ws://localhost:8080/ws');
});
```

### Client Connection

```javascript
import { connectWebSocket } from 'websocket-x';

const ws = connectWebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  ws.send('Hello, Server!');
});

ws.on('message', (message) => {
  console.log('📨 Received:', message);
});
```

---

## 📖 Real-World Examples

### 1. Live Dashboard with Real-Time Updates

```javascript
import { createWebSocketServer } from 'websocket-x';

const { server, websocket } = createWebSocketServer({ maxPayload: 10_485_760 }); // 10MB

const clients = new Set();

websocket.on('connection', (client) => {
  clients.add(client);

  // Send initial data
  client.send(JSON.stringify({ type: 'init', timestamp: Date.now() }));

  // Broadcast updates
  const broadcastInterval = setInterval(() => {
    const data = JSON.stringify({
      type: 'update',
      timestamp: Date.now(),
      metrics: generateMetrics()
    });
    clients.forEach(c => c.send(data));
  }, 1000);

  client.on('close', () => {
    clients.delete(client);
    clearInterval(broadcastInterval);
  });
});

server.listen(3000, () => console.log('Dashboard server on ws://localhost:3000/ws'));
```

### 2. Chat Room with Rooms

```javascript
import { createWebSocketServer } from 'websocket-x';

const { server, websocket } = createWebSocketServer();
const rooms = new Map(); // roomId -> Set<clients>

websocket.on('connection', (client) => {
  let currentRoom = null;

  client.on('message', (data) => {
    const { type, room, message } = JSON.parse(data);

    if (type === 'join' && room) {
      currentRoom = room;
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(client);
      client.send(JSON.stringify({ type: 'joined', room }));
    } else if (type === 'message' && currentRoom) {
      const broadcast = JSON.stringify({ type: 'message', room: currentRoom, message });
      rooms.get(currentRoom)?.forEach(c => c.send(broadcast));
    }
  });

  client.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(client);
    }
  });
});

server.listen(8080, () => console.log('Chat server on ws://localhost:8080/ws'));
```

### 3. Game Server with Ping Optimization

```javascript
import { createWebSocketServer } from 'websocket-x';

const { server, websocket } = createWebSocketServer();
const players = new Map(); // playerId -> { ws, position, health }

websocket.on('connection', (client) => {
  const playerId = Math.random().toString(36).substring(7);

  client.on('open', () => {
    players.set(playerId, { ws: client, position: { x: 0, y: 0 }, health: 100 });
  });

  // Heartbeat for game state
  const heartbeatInterval = setInterval(() => {
    const state = Array.from(players.entries()).map(([id, p]) => ({
      id,
      position: p.position,
      health: p.health
    }));
    client.send(JSON.stringify({ type: 'state', players: state }));
  }, 1000 / 60); // 60 FPS

  client.on('message', (data) => {
    const { type, action } = JSON.parse(data);
    const player = players.get(playerId);

    if (player) {
      if (type === 'move') {
        player.position = { ...player.position, ...action.position };
      } else if (type === 'attack' && action.targetId) {
        const target = players.get(action.targetId);
        if (target) target.health -= 10;
      }
    }
  });

  client.on('close', () => {
    players.delete(playerId);
    clearInterval(heartbeatInterval);
  });
});

server.listen(9000, () => console.log('Game server on ws://localhost:9000/ws'));
```

---

## 🛠️ CLI Tool

### Start an Echo Server

```bash
npx websocket-x echo --port 8080 --host localhost
```

### Connect to WebSocket

```bash
npx websocket-x client ws://localhost:8080/ws --message "Hello, Server!"
```

### Test WebSocket Server

```bash
npx websocket-x test ws://localhost:8080/ws --verbose
```

---

## 📚 API Reference

### `createWebSocketServer(options)`

Creates a WebSocket server with HTTP upgrade handling.

**Options:**
- `path` (string) — WebSocket path, default: `'/ws'`
- `verifyClient` (function) — Client verification callback: `(info) => boolean`
- `maxPayload` (number) — Maximum payload size in bytes, default: `1048576` (1MB)

**Returns:** `{ server, websocket, listen, close }`

---

### `connectWebSocket(url, protocols)`

Creates a WebSocket client connection.

**Parameters:**
- `url` (string) — WebSocket URL (`ws://` or `wss://`)
- `protocols` (string[]) — Optional subprotocols array

**Returns:** `WebSocketClient` instance with events: `open`, `message`, `close`, `error`, `ping`, `pong`

---

### `validateWebSocketUrl(url)`

Validates WebSocket URL format.

**Returns:** `boolean` — `true` if valid WebSocket URL

---

### `generateWebSocketKey()`

Generates a random WebSocket handshake key (Base64).

**Returns:** `string` — Random 16-byte key in Base64

---

## 🔒 Security

**Built-in protections:**
- ✅ WebSocket version validation (>= 13)
- ✅ Upgrade handshake verification (`sec-websocket-key`)
- ✅ URL validation (`ws://` or `wss://` only)
- ✅ Client verification callback support
- ✅ Error handling in frame parsing

**Recommended practices:**
- Always use `wss://` in production (TLS encryption)
- Implement rate limiting at HTTP level
- Use `verifyClient` callback for authentication
- Set appropriate `maxPayload` limits
- Add application-layer validation for messages

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Development mode with hot reload
npm run dev
```

**Test coverage:** Run `npm run test:coverage` for detailed coverage report.

---

## 📦 Dependencies

**Zero production dependencies.** Uses only Node.js built-ins:
- `events` — EventEmitter for WebSocket events
- `http` — HTTP server for upgrade handling
- `url` — URL parsing and validation
- `crypto` — Secure random key generation

---

## 🏗️ Build

```bash
npm run build
```

Creates `dist/` folder with bundled `websocket-x.js` for distribution.

---

## 📝 License

MIT © sulthonzh

---

## 🤝 Contributing

Contributions welcome! Please ensure:
- All tests pass: `npm test`
- Zero ESLint warnings
- Code follows existing patterns
- Add tests for new features

---

## 🔄 Migration from ws/uws

** websocket-x API is intentionally similar to ws for easy migration:**

```javascript
// Before (ws)
import { WebSocketServer, WebSocket } from 'ws';
const wss = new WebSocketServer({ port: 8080 });

// After (websocket-x)
import { createWebSocketServer, connectWebSocket } from 'websocket-x';
const { server, websocket } = createWebSocketServer();
server.listen(8080);
```

**Key differences:**
- `createWebSocketServer()` returns `{ server, websocket, listen, close }`
- `connectWebSocket()` replaces `new WebSocket()`
- No external dependencies
- Built-in CLI tool

---

**Made with ❤️ for zero-dependency Node.js applications**