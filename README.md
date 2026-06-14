# Kimchi 9router Compatibility Bridge

**Enable Kimchi AI provider in 9router — bypass client-gating blocks**

---

## Quick Start (2 commands)

```bash
# 1. Install the patch tool
npm install -g km9

# 2. Patch — auto-detects 9router, stops it if running, patches, restarts
km9 patch
```

That's it. 9router is now running with Kimchi support. Open the dashboard, add Kimchi provider.

> **How it works:** `km9 patch` is NOT a server. It's a one-time command that:
> 1. Detects if 9router is currently running
> 2. Stops it automatically (if running)
> 3. Installs the compatibility bridge into 9router's source code
> 4. Restarts 9router automatically
>
> If 9router is not running, it just patches the files — then you start it yourself with `9router`.

### All commands

```bash
km9 patch     # Auto stop → patch → restart 9router
km9 unpatch   # Auto stop → unpatch → restart 9router
km9 status    # Check patch status + is 9router running
km9 help      # Show help
```

### Lifecycle

```
Install tool → km9 patch → 9router (patched, Kimchi works)
                                         ↓
                  km9 unpatch → 9router (original, reverted)
                                         ↓
                  npm uninstall -g ... → tool removed from laptop
```

---

## What This Does

9router fails to connect to Kimchi AI (`https://llm.kimchi.dev`) with error:
```
Payment Required: the provider for model <model-name> has exhausted its credits
```

**Root cause:** Kimchi's API gateway blocks non-official clients by checking User-Agent and Accept-Encoding headers. 9router (via AI SDK) sends headers that trigger this block.

**Solution:** This compatibility bridge intercepts HTTP requests to Kimchi and injects the correct headers (`User-Agent: kimchi/0.1.20`) to bypass the block.

---

## Prerequisites

Before starting, you need:

1. **Node.js 18+** installed
   ```bash
   node --version  # Should show v18 or higher
   ```

2. **npm** installed (comes with Node.js)
   ```bash
   npm --version
   ```

3. **9router** installed globally
   ```bash
   npm install -g 9router
   ```

4. **Kimchi API key** from [llm.kimchi.dev](https://llm.kimchi.dev)

---

## Installation (Choose One Method)

### Method 1: npm install (Recommended)

**Step 1:** Install the patch package globally
```bash
npm install -g km9
```

**Step 2:** Install the compatibility bridge into your 9router installation
```bash
npx km9 patch
```

**Expected output:**
```
9router ditemukan di: /opt/homebrew/lib/node_modules/9router/app/custom-server.js
Compatibility bridge berhasil dipasang!
  Restart 9router untuk efek terbaru.
  Tambahkan provider Kimchi lewat dashboard: https://llm.kimchi.dev/openai/v1
```

---

### Method 2: Clone and install from source

**Step 1:** Clone the repository
```bash
git clone https://github.com/iklilzaki177/km9.git
cd km9
```

**Step 2:** Install globally
```bash
npm install -g .
```

**Step 3:** Apply the patch
```bash
km9 patch
```

---

### Method 3: One-line curl installer

**Step 1:** Run the installer
```bash
curl -sSL https://raw.githubusercontent.com/iklilzaki177/km9/main/install.sh | bash
```

This will:
- Clone the repo to `~/.km9`
- Install globally via npm
- Create symlink in `/usr/local/bin`

**Step 2:** Apply the patch
```bash
km9 patch
```

---

## Verify Installation

**Step 1:** Check if 9router is detected and patch is applied
```bash
km9 status
```

**Expected output:**
```
Install path: /opt/homebrew/lib/node_modules/9router/app/custom-server.js
Patch status: TERPASANG
Patch version: v2
```

**Step 2:** Restart 9router completely
```bash
# Stop 9router if running, then start again
9router
```

---

## Configure Kimchi Provider in 9router

**Step 1:** Open 9router dashboard
- Default URL: `http://localhost:3000`

**Step 2:** Add new provider
- **Provider name:** `kimchi` (or any name you prefer)
- **Base URL:** `https://llm.kimchi.dev/openai/v1`
- **API Key:** Your Kimchi API key (starts with `castai_v1_...`)

**Step 3:** Save and test
- Select a model (e.g., `kimi-k2.6`)
- Send a test message
- Should work without "exhausted credits" error

---

## A/B Test: Prove the Fix Works

Want to demonstrate that the patch actually fixes the issue? Run both patched and unpatched versions side-by-side.

### Option A: Proxy (unpatched baseline) vs Direct (patched)

**Step 1:** Start the local proxy (in a separate terminal)
```bash
cd kimchi_proxy
python3 proxy.py --port 27487
```

**Expected output:**
```
Kimchi Proxy listening on http://127.0.0.1:27487
  Forwarding to: https://llm.kimchi.dev
  User-Agent: kimchi/0.1.20
  Configure 9router provider baseURL: http://127.0.0.1:27487/openai/v1

  Press Ctrl+C to stop
```

**Step 2:** In 9router dashboard, add two providers:

| Provider | Base URL | Purpose |
|----------|----------|---------|
| `kimchi-proxy` | `http://127.0.0.1:27487/openai/v1` | Works via proxy (no patch needed) |
| `kimchi-direct` | `https://llm.kimchi.dev/openai/v1` | Works via compatibility bridge |

**Step 3:** Test both
- Both should work
- Stop the proxy -> `kimchi-proxy` will fail
- Remove the patch -> `kimchi-direct` will fail with "exhausted credits"

---

### Option B: Before/after comparison

**Step 1:** Add provider WITHOUT patch
```bash
km9 unpatch
# Restart 9router
```

Add provider in dashboard -> Test -> Should fail with "exhausted credits"

**Step 2:** Apply patch
```bash
km9 patch
# Restart 9router
```

Test same provider -> Should work

---

## Advanced Usage

### Using a different port for proxy

```bash
python3 kimchi_proxy/proxy.py --port 8080
```

Update 9router provider Base URL to: `http://127.0.0.1:8080/openai/v1`

---

### Custom Kimchi URL (self-hosted)

```bash
python3 kimchi_proxy/proxy.py --kimchi-url https://your-kimchi-instance.com
```

---

### Override 9router detection path

If 9router is installed in a non-standard location:

```bash
export ROUTER_CUSTOM_SERVER=/path/to/9router/app/custom-server.js
km9 patch
```

---

## Uninstall

**Step 1:** Remove the compatibility bridge
```bash
km9 unpatch
```

**Expected output:**
```
Compatibility bridge berhasil dicopot!
  Restart 9router untuk efek terbaru.
```

**Step 2:** Uninstall the npm package
```bash
npm uninstall -g km9
```

---

## Troubleshooting

### Problem: `km9` command not found

**Solution:** npm global bin not in PATH
```bash
# Find npm global bin
npm config get prefix

# Add to PATH (example for bash)
export PATH="$PATH:$(npm config get prefix)/bin"

# Or use npx instead
npx km9 patch
```

---

### Problem: Patch fails with "9router tidak ditemukan"

**Solution 1:** 9router not installed
```bash
npm install -g 9router
```

**Solution 2:** Permission denied
```bash
sudo npx km9 patch
```

**Solution 3:** Manual path override
```bash
export ROUTER_CUSTOM_SERVER=/path/to/9router/app/custom-server.js
km9 patch
```

---

### Problem: Still getting "exhausted credits" after patch

**Checklist:**
1. Verify patch is applied: `km9 status`
2. Restarted 9router completely (not just reload)
3. API key is valid (test with curl below)
4. Using correct model name

**Test API key directly:**
```bash
curl -X POST https://llm.kimchi.dev/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "User-Agent: kimchi/0.1.20" \
  -d '{"model":"kimi-k2.6","messages":[{"role":"user","content":"hello"}]}'
```

If this works but 9router doesn't -> patch issue.
If this fails -> API key or Kimchi service issue.

---

### Problem: Proxy won't start

**Check:**
- Python 3 installed: `python3 --version`
- Port not in use: `lsof -i :27487` (macOS) or `netstat -tulpn | grep 27487` (Linux)
- Try different port: `python3 kimchi_proxy/proxy.py --port 8080`

---

### Problem: 9router dashboard shows old provider after patch

**Solution:** Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R) or restart 9router

---

## Technical Details

### What the patch does

Injects code into 9router's `custom-server.js` that:

1. **Intercepts** all `http.request`, `https.request`, and `globalThis.fetch` calls
2. **Detects** requests to `llm.kimchi.dev`
3. **Modifies headers:**
   - Sets `User-Agent: kimchi/0.1.20`
   - Removes `Accept-Encoding` (which triggers Kimchi's block)
4. **Forwards** to original handler

### Why it works

Kimchi's gateway uses client fingerprinting:
- **Blocks:** AI SDK headers + Node.js default `Accept-Encoding: gzip, deflate, br, zstd`
- **Allows:** `User-Agent: kimchi/0.1.20` + no `Accept-Encoding`

The patch makes 9router requests look like the official Kimchi CLI.

### Backup and rollback

When patch is applied:
- Original `custom-server.js` backed up to `custom-server.js.kimchi-backup`
- `km9 unpatch` restores from backup
- If backup missing, patch code is stripped from file

---

## Files in this repo

```
km9/
  bin/
    km9          # CLI tool
  src/
    detect.js               # Find 9router installation
    index.js                # Module exports
    patch.js                # Apply/remove/verify patch
    postinstall.js          # Auto-patch on npm install
  kimchi_proxy/
    proxy.py                # Local HTTP proxy (alternative to patch)
  test/
    test.js                 # Unit tests
  install.sh                # One-line installer
  package.json
  9router-kimchi-patch.md   # Technical docs for 9router devs
  modifydbinject provider.md # Deep-dive debugging notes
  README.md                 # This file
```

---

## Quick Reference

```bash
# Install
npm install -g km9

# Patch
npx km9 patch

# Check status
npx km9 status

# Unpatch
npx km9 unpatch

# Start proxy (alternative)
python3 kimchi_proxy/proxy.py --port 27487

# Test API key
curl -X POST https://llm.kimchi.dev/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "User-Agent: kimchi/0.1.20" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.6","messages":[{"role":"user","content":"test"}]}'
```

---

MIT License
