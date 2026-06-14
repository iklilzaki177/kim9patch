# Kimchi 9router Monkey-Patch

**Complete tutorial: Fix 9router "exhausted credits" error when connecting to Kimchi AI provider**

---

## Quick Start (2 commands)

```bash
# 1. Install the patch tool
npm install -g @iklilzaki177/9router-patch

# 2. Patch — auto-detects 9router, stops it if running, patches, restarts
kimchi-9router patch
```

That's it. 9router is now running with Kimchi support. Open the dashboard, add Kimchi provider.

> **How it works:** `kimchi-9router patch` is NOT a server. It's a one-time command that:
> 1. Detects if 9router is currently running
> 2. Stops it automatically (if running)
> 3. Injects the monkey-patch into 9router's source code
> 4. Restarts 9router automatically
>
> If 9router is not running, it just patches the files — then you start it yourself with `9router`.

### All commands

```bash
kimchi-9router patch     # Auto stop → patch → restart 9router
kimchi-9router unpatch   # Auto stop → unpatch → restart 9router
kimchi-9router status    # Check patch status + is 9router running
kimchi-9router help      # Show help
```

### Lifecycle

```
Install tool → kimchi-9router patch → 9router (patched, Kimchi works)
                                         ↓
                  kimchi-9router unpatch → 9router (original, reverted)
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

**Solution:** This monkey-patch intercepts HTTP requests to Kimchi and injects the correct headers (`User-Agent: kimchi/0.1.20`) to bypass the block.

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
npm install -g @iklilzaki177/9router-patch
```

**Step 2:** Apply the monkey-patch to your 9router installation
```bash
npx kimchi-9router patch
```

**Expected output:**
```
9router ditemukan di: /opt/homebrew/lib/node_modules/9router/app/custom-server.js
Monkey-patch berhasil dipasang!
  Restart 9router untuk efek terbaru.
  Tambahkan provider Kimchi lewat dashboard: https://llm.kimchi.dev/openai/v1
```

---

### Method 2: Clone and install from source

**Step 1:** Clone the repository
```bash
git clone https://github.com/iklilzaki177/9router-patch.git
cd 9router-patch
```

**Step 2:** Install globally
```bash
npm install -g .
```

**Step 3:** Apply the patch
```bash
kimchi-9router patch
```

---

### Method 3: One-line curl installer

**Step 1:** Run the installer
```bash
curl -sSL https://raw.githubusercontent.com/iklilzaki177/9router-patch/main/install.sh | bash
```

This will:
- Clone the repo to `~/.kimchi-9router-patch`
- Install globally via npm
- Create symlink in `/usr/local/bin`

**Step 2:** Apply the patch
```bash
kimchi-9router patch
```

---

## Verify Installation

**Step 1:** Check if 9router is detected and patch is applied
```bash
kimchi-9router status
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
| `kimchi-direct` | `https://llm.kimchi.dev/openai/v1` | Works via monkey-patch |

**Step 3:** Test both
- Both should work
- Stop the proxy -> `kimchi-proxy` will fail
- Remove the patch -> `kimchi-direct` will fail with "exhausted credits"

---

### Option B: Before/after comparison

**Step 1:** Add provider WITHOUT patch
```bash
kimchi-9router unpatch
# Restart 9router
```

Add provider in dashboard -> Test -> Should fail with "exhausted credits"

**Step 2:** Apply patch
```bash
kimchi-9router patch
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
kimchi-9router patch
```

---

## Uninstall

**Step 1:** Remove the monkey-patch
```bash
kimchi-9router unpatch
```

**Expected output:**
```
Monkey-patch berhasil dicopot!
  Restart 9router untuk efek terbaru.
```

**Step 2:** Uninstall the npm package
```bash
npm uninstall -g @iklilzaki177/9router-patch
```

---

## Troubleshooting

### Problem: `kimchi-9router` command not found

**Solution:** npm global bin not in PATH
```bash
# Find npm global bin
npm config get prefix

# Add to PATH (example for bash)
export PATH="$PATH:$(npm config get prefix)/bin"

# Or use npx instead
npx kimchi-9router patch
```

---

### Problem: Patch fails with "9router tidak ditemukan"

**Solution 1:** 9router not installed
```bash
npm install -g 9router
```

**Solution 2:** Permission denied
```bash
sudo npx kimchi-9router patch
```

**Solution 3:** Manual path override
```bash
export ROUTER_CUSTOM_SERVER=/path/to/9router/app/custom-server.js
kimchi-9router patch
```

---

### Problem: Still getting "exhausted credits" after patch

**Checklist:**
1. Verify patch is applied: `kimchi-9router status`
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
- `kimchi-9router unpatch` restores from backup
- If backup missing, patch code is stripped from file

---

## Files in this repo

```
9router-patch/
  bin/
    kimchi-9router          # CLI tool
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
npm install -g @iklilzaki177/9router-patch

# Patch
npx kimchi-9router patch

# Check status
npx kimchi-9router status

# Unpatch
npx kimchi-9router unpatch

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
