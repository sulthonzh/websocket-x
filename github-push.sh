#!/bin/bash

# Script to push websocket-x to GitHub
# Run this after creating the repository on GitHub

echo "Pushing websocket-x to GitHub..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Git repository not initialized. Please run git init first."
    exit 1
fi

# Add files
git add .

# Commit if there are changes
if git diff --staged --quiet; then
    echo "No changes to commit."
else
    git commit -m "Initial release: websocket-x - Zero-dependency WebSocket library

- Full WebSocket implementation (RFC 6455 compliant)
- Server and client functionality
- Built-in CLI tool for testing and debugging
- Comprehensive test suite
- Zero external dependencies
- TypeScript ready
- Error handling and validation

Features:
- WebSocket server with client verification
- WebSocket client with connection management
- Message handling (text/binary)
- Ping/pong support
- Connection lifecycle management
- CLI tools for testing, echo server, and client connections
- HTML test page included"
fi

# Try to push to origin
if git remote -v | grep -q "origin"; then
    git push -u origin main
    echo "Code pushed to GitHub successfully!"
else
    echo "No remote origin found."
    echo "Please run the following commands after creating the repository on GitHub:"
    echo "  git remote add origin https://github.com/sulthonzh/websocket-x.git"
    echo "  git branch -M main"
    echo "  git push -u origin main"
fi