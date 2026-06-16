# km9

Two ways to bypass Kimchi API client-gating in 9router:

1. **Local proxy** (recommended) — runs `kimchi_proxy/proxy.py` on `localhost:27487`, rewrites headers at the transport layer. Set Kimchi provider baseURL to `http://localhost:27487/openai/v1`.
2. **Monkey-patch** — injects header-rewriting code into 9router's `custom-server.js`. Use only if you can't run the proxy.

## Quick Install (proxy mode)

```bash
# Start proxy
python3 kimchi_proxy/proxy.py --port 27487 &

# In 9router dashboard, set Kimchi provider:
#   baseURL = http://localhost:27487/openai/v1
#   apiKey  = <your-kimchi-key>
```

## Quick Install (monkey-patch)

```bash
# One-line install
curl -fsSL https://raw.githubusercontent.com/iklilzaki177/kim9patch/main/install.sh | bash

# Apply patch
km9 patch
```

## What This Does

9router fails to connect to Kimchi API because it sends headers that trigger client-gating blocks (`User-Agent` mismatch, `Accept-Encoding: gzip`, etc.). The proxy and patch both inject:

- `User-Agent: kimchi/0.1.20`
- Strip `Accept-Encoding` (forces uncompressed response)

## Commands

```bash
km9 patch      # Apply monkey-patch to 9router
km9 unpatch    # Remove monkey-patch
km9 status     # Check if patched
km9 help       # Show help
```

## How the Proxy Works

1. Listens on `127.0.0.1:27487`
2. Forwards to `https://llm.kimchi.dev`
3. Injects `User-Agent: kimchi/0.1.20`, strips `Accept-Encoding`
4. Returns 502 if upstream unreachable (no silent 402)

## How the Patch Works

1. Detects 9router installation path
2. Backs up original `custom-server.js`
3. Injects header-rewriting code (http/https/fetch/undici hooks)
4. Idempotent — safe to re-run

## Uninstall

```bash
km9 unpatch         # remove patch
npm uninstall -g km9

# Stop proxy
pkill -f kimchi_proxy/proxy.py
```

## License

MIT
