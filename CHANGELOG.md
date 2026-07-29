# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-07-10

### Added
- Initial release of websocket-x
- Zero-dependency WebSocket server implementation (RFC 6455 compliant)
- Zero-dependency WebSocket client implementation
- CLI tool with `serve`, `client`, `echo`, and `test` commands
- WebSocket upgrade handshake with `sec-websocket-key` validation
- WebSocket version checking (>= 13)
- Client verification callback support (`verifyClient`)
- URL validation (`validateWebSocketUrl`)
- Random WebSocket key generation (`generateWebSocketKey`)
- Frame parsing with opcode support (text, binary, close, ping, pong)
- Error handling in frame parsing
- 12 comprehensive tests (8 client tests, 4 server tests)
- ESM module support (Node >= 18)
- TypeScript definitions ready (pure JS implementation)
- Build system with `npm run build`

### Features
- Zero production dependencies (Node.js built-ins only)
- Server and client in single package
- CLI tool for testing and debugging
- Comprehensive error handling
- Configurable max payload size (default: 1MB)
- Custom WebSocket path support (default: `/ws`)
- Event-driven architecture (connection, message, close, error, ping, pong)

### Documentation
- Comprehensive README.md with examples
- API documentation
- CLI usage guide
- Security recommendations
- Migration guide from ws/uws

---

## [Unreleased]

### Fixed
- `connectWebSocket()` now properly creates an HTTP request and returns `Promise<WebSocketClient>` (was passing URL string as socket — broken since inception)
- `WebSocketClient` close event now correctly emits when socket closes (was suppressed by `cleanup()` setting `readyState = CLOSED` before the conditional check)
- `WebSocketClient` import added to `websocket.js` (was referenced but never imported — caused `ReferenceError` in `completeUpgrade`)

### Added
- 30 new tests covering: server path mismatch, verifyClient rejection paths, subprotocol echo, client error relay, socket error cleanup, extended payload lengths (16-bit/64-bit), unmasked frames, binary send, large payload framing, ping/pong errors, close frame parsing, insufficient data handling
- Coverage: 79% → 96% statements, 71% → 88% branches

### Changed
- Test scripts updated to include `coverage-polish.test.js`

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
- **MAJOR** — Incompatible API changes
- **MINOR** — Backwards-compatible functionality additions
- **PATCH** — Backwards-compatible bug fixes

---

## Release Notes

**1.0.0** — Initial stable release with full WebSocket protocol implementation, zero external dependencies, and comprehensive testing.

---

**Last updated:** 2026-07-29 17:47 UTC