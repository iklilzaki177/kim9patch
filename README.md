# km9

Monkey-patch for 9router to bypass Kimchi API client-gating.

## Quick Install

```bash
# One-line install
curl -fsSL https://raw.githubusercontent.com/iklilzaki177/kim9patch/main/install.sh | bash

# Apply patch
km9 patch
```

That's it. 9router now works with Kimchi AI.

## What This Does

9router fails to connect to Kimchi API because it sends headers that trigger client-gating blocks. This tool patches 9router to inject the correct headers automatically.

## Commands

```bash
km9 patch      # Apply patch to 9router
km9 unpatch    # Remove patch
km9 status     # Check if patched
km9 help       # Show help
```

## Manual Install

```bash
git clone https://github.com/iklilzaki177/kim9patch.git
cd kim9patch
npm install -g .
km9 patch
```

## How It Works

1. Detects 9router installation path
2. Backs up original files
3. Injects header-rewriting code into custom-server.js
4. All Kimchi API requests now include proper headers
5. No more "Payment Required" errors

## Uninstall

```bash
km9 unpatch
npm uninstall -g km9
```

## License

MIT
