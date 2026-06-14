## Goal

A/B test to prove Kimchi API blocks non-official clients and that a monkey-patch fixes it:

| Provider | BaseURL | Monkey-patch | Purpose |
|---|---|---|---|
| `kimchi` | `https://llm.kimchi.dev/openai/v1` | ❌ No | **Proof of failure** (exhausted error) |
| `kimchi2` | `https://llm.kimchi.dev/openai/v1` | ✅ Yes | **Proof of fix** (works with patch) |

Both providers must coexist in the 9router dashboard to demonstrate the before/after.

---

# 9router + Kimchi AI Provider — Monkey-Patch Fix

> **For 9router developers:** This document describes a bug where 9router cannot connect to the Kimchi AI provider (`https://llm.kimchi.dev`) and a temporary monkey-patch fix applied to `custom-server.js`.

---

## 1. Problem

When registering Kimchi as an OpenAI-compatible provider in 9router, every request returns:

```
Payment Required: the provider for model <model-name> has exhausted its credits and cannot process requests
```

However:
- The Kimchi CLI (`kimchi`) works fine with the same API key.
- Direct `curl` to `https://llm.kimchi.dev/openai/v1` works.
- Direct `node -e "fetch(...)` works **only** when `User-Agent: kimchi/0.1.20` is set.
- 9router (via Next.js standalone) fails consistently.

---

## 2. Root Cause

The Kimchi API gateway appears to **gatekeep non-official clients** using a heuristic based on:

1. **`User-Agent`** — must contain `kimchi/0.1.20` (or similar Kimchi CLI UA).
2. **`Accept-Encoding`** — when Node.js sends `gzip, deflate, br, zstd`, Kimchi returns the "exhausted" error.
3. **AI SDK / undici fingerprint** — `@ai-sdk/openai-compatible` and native `fetch` (undici) send headers that Kimchi’s gateway considers non-Kimchi.

> The "exhausted credits" message is essentially a **soft block** for clients Kimchi does not recognize as its own CLI.

---

## 3. Why the Proxy Works

A local Python proxy (`urllib.request`) forwards to Kimchi. `urllib.request` does **not** send the AI SDK fingerprint headers; it either sends no `Accept-Encoding` or a different default `User-Agent`. Once `User-Agent: kimchi/0.1.20` is added, the proxy succeeds.

---

## 4. Monkey-Patch Applied to 9router

### File Modified

`/opt/homebrew/lib/node_modules/9router/app/custom-server.js`

### Patch (v2 — low-level http/https + fetch)

```js
const http = require("http");
const https = require("https");

function isKimchiHost(options) {
  if (typeof options === "string") return options.includes("llm.kimchi.dev");
  if (options && options.hostname) return options.hostname.includes("llm.kimchi.dev");
  if (options && options.host) return options.host.includes("llm.kimchi.dev");
  return false;
}

function patchOptions(options) {
  if (!options || typeof options === "string") return options;
  options.headers = options.headers || {};
  options.headers["User-Agent"] = "kimchi/0.1.20";
  delete options.headers["Accept-Encoding"];
  delete options.headers["accept-encoding"];
  return options;
}

const _origHttpRequest = http.request;
http.request = function(options, callback) {
  if (isKimchiHost(options)) patchOptions(options);
  return _origHttpRequest(options, callback);
};

const _origHttpsRequest = https.request;
https.request = function(options, callback) {
  if (isKimchiHost(options)) patchOptions(options);
  return _origHttpsRequest(options, callback);
};

if (globalThis.fetch) {
  const _origFetch = globalThis.fetch;
  globalThis.fetch = function(input, init) {
    const url = typeof input === "string" ? input : input.url || input.href || "";
    if (url.includes("llm.kimchi.dev")) {
      init = init || {};
      init.headers = init.headers || {};
      if (typeof init.headers === "object" && !Array.isArray(init.headers)) {
        const h = new Headers(init.headers);
        h.set("User-Agent", "kimchi/0.1.20");
        h.delete("Accept-Encoding");
        init.headers = h;
      }
    }
    return _origFetch(input, init);
  };
}
```

### What the patch does

- Intercepts **all** `http.request` / `https.request` calls (used by `openai-compatible-chat`, `node-fetch`, internal libraries).
- Intercepts **all** `globalThis.fetch` calls (used by `openai-compatible-responses`, undici).
- If the host is `llm.kimchi.dev`, it:
  1. Sets `User-Agent: kimchi/0.1.20`
  2. Removes `Accept-Encoding`
- Then delegates to the original request handler.

> **Note:** The first version only patched `globalThis.fetch`, which fixed `openai-compatible-responses` but **not** `openai-compatible-chat`. The v2 low-level patch fixes both.

---

## 5. Revert

To undo the patch, restore the original `custom-server.js`:

```bash
cd /opt/homebrew/lib/node_modules/9router/app
git checkout custom-server.js
# or re-install 9router:
npm uninstall -g 9router
npm install -g 9router
```

---

## 6. Suggestion for 9router Developers

Instead of a global monkey-patch, consider adding **per-provider custom headers** in the provider configuration UI / API:

```json
{
  "provider": "kimchi",
  "baseURL": "https://llm.kimchi.dev/openai/v1",
  "apiKey": "...",
  "headers": {
    "User-Agent": "kimchi/0.1.20"
  },
  "stripHeaders": ["Accept-Encoding"]
}
```

Or, if Kimchi is a first-class provider, detect `llm.kimchi.dev` and auto-inject the required headers before forwarding.

---

## 7. Environment

| Component | Version |
|-----------|---------|
| OS | macOS |
| 9router | latest (from npm) |
| Kimchi API Key | `castai_v1_*` |
| Node.js | v24+ |
| Date patched | 2026-06-14 |

---

*Document written for 9router developers by Zaki / EasyKripsi team.*
