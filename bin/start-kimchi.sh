#!/bin/bash

# Kimchi 9Router Auto-Starter
# Patch dan start 9router dengan proxy bypass

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
PROXY_PORT=27487
KIMCHI_BASE="https://llm.kimchi.dev"

echo "[kimchi] Starting auto-upgrader..."

# Kill existing 9router
echo "[kimchi] Stopping existing 9router processes..."
pkill -f "node.*9router" 2>/dev/null || true
sleep 1

# Kill existing proxy
echo "[kimchi] Stopping existing kimchi proxy..."
pkill -f "kimchi_proxy/proxy.py" 2>/dev/null || true
sleep 1

# Check Node version
echo "[kimchi] Checking Node.js version..."
NODE_VERSION=$(node --version 2>&1 || echo "not installed")
if [[ "$NODE_VERSION" == *"not found"* ]] || [[ "$NODE_VERSION" == *"command not found"* ]]; then
    echo "[kimchi] ERROR: Node.js not found. Install Node.js first."
    exit 1
fi
echo "[kimchi] Node.js version: $NODE_VERSION"

# Check npm
NPM_VERSION=$(npm --version 2>&1)
if [[ "$NPM_VERSION" == *"not found"* ]] || [[ "$NPM_VERSION" == *"command not found"* ]]; then
    echo "[kimchi] ERROR: npm not found."
    exit 1
fi
echo "[kimchi] npm version: $NPM_VERSION"

# Install dependencies
echo "[kimchi] Installing dependencies..."
cd "$PROJECT_ROOT"
npm install > /dev/null 2>&1
echo "[kimchi] Dependencies installed."

# Run patching
echo "[kimchi] Running km9 patch..."
cd "$PROJECT_ROOT/src"
node postinstall.js
PATCH_EXIT=$?
if [ $PATCH_EXIT -eq 0 ]; then
    echo "[kimchi] Patch step OK (applied or already patched)."
else
    echo "[kimchi] WARNING: Patch step exited $PATCH_EXIT, continuing anyway..."
fi

# Start proxy in background (detached)
echo "[kimchi] Starting Kimchi proxy on port $PROXY_PORT..."
nohup python3 "$PROJECT_ROOT/kimchi_proxy/proxy.py" --port "$PROXY_PORT" > /tmp/kimchi-proxy.log 2>&1 &
PROXY_PID=$!
echo "[kimchi] Proxy started with PID: $PROXY_PID"

# Wait for proxy to be ready
sleep 2

# Check if proxy is running
if ! ps -p $PROXY_PID > /dev/null; then
    echo "[kimchi] ERROR: Proxy failed to start. Check for errors above."
    exit 1
fi

# Find and start 9router
echo "[kimchi] Finding 9router..."
ROUTER_BIN=$(which 9router 2>/dev/null || echo "")
if [ -z "$ROUTER_BIN" ]; then
    echo "[kimchi] ERROR: 9router not found in PATH. Install it first."
    exit 1
fi
echo "[kimchi] Using 9router: $ROUTER_BIN"

# Start 9router in background (tray mode = daemon)
echo "[kimchi] Starting 9router..."
nohup "$ROUTER_BIN" --tray --skip-update > /tmp/9router.log 2>&1 &
ROUTER_PID=$!

echo ""
echo "======================================"
echo "[kimchi] Setup complete!"
echo "======================================"
echo "[kimchi] Proxy running: http://localhost:$PROXY_PORT"
echo "[kimchi] Provider URL: http://localhost:$PROXY_PORT/openai/v1"
echo "[kimchi] Proxy PID: $PROXY_PID"
echo "[kimchi] Router PID: $ROUTER_PID"
echo "[kimchi] Press Ctrl+C to stop all services"
echo "======================================"
echo ""

# Exit successfully - processes running in background
exit 0
