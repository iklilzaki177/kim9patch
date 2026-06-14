#!/usr/bin/env python3
"""
Kimchi API Proxy — Local proxy that adds required headers for Kimchi gateway.
Bypasses client-gating that causes "exhausted credits" errors.

Usage:
    python3 proxy.py --port 27487
    python3 proxy.py --port 27487 --host 127.0.0.1
    python3 proxy.py --port 27487 --kimchi-url https://llm.kimchi.dev
"""

import http.server
import json
import argparse
import sys
import urllib.request
import urllib.error

KIMCHI_BASE = "https://llm.kimchi.dev"
PROXY_PORT = 27487
PROXY_HOST = "127.0.0.1"
USER_AGENT = "kimchi/0.1.20"

STRIP_HEADERS = [
    "accept-encoding",
    "connection",
    "host",
]

INJECT_HEADERS = {
    "User-Agent": USER_AGENT,
}


class KimchiProxyHandler(http.server.BaseHTTPRequestHandler):
    """Forward requests to Kimchi with patched headers."""

    kimchi_base = KIMCHI_BASE

    def do_GET(self):
        self._proxy("GET")

    def do_POST(self):
        self._proxy("POST")

    def do_PUT(self):
        self._proxy("PUT")

    def do_DELETE(self):
        self._proxy("DELETE")

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def _proxy(self, method):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        target_url = f"{self.kimchi_base}{self.path}"

        headers = {}
        for key, value in self.headers.items():
            lower = key.lower()
            if lower not in STRIP_HEADERS:
                headers[key] = value

        for key, value in INJECT_HEADERS.items():
            headers[key] = value

        headers.pop("Accept-Encoding", None)
        headers.pop("accept-encoding", None)

        try:
            req = urllib.request.Request(
                target_url,
                data=body,
                headers=headers,
                method=method,
            )

            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)

                for key, value in resp.getheaders():
                    lower = key.lower()
                    if lower not in ("transfer-encoding", "connection"):
                        self.send_header(key, value)

                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            error_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(error_body)

        except urllib.error.URLError as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": {
                    "message": f"Proxy upstream error: {e.reason}",
                    "type": "proxy_error",
                }
            }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": {
                    "message": f"Internal proxy error: {str(e)}",
                    "type": "proxy_error",
                }
            }).encode())

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def log_message(self, format, *args):
        sys.stderr.write(f"[proxy] {args[0]}\n")


def main():
    parser = argparse.ArgumentParser(description="Kimchi API Proxy")
    parser.add_argument("--port", type=int, default=PROXY_PORT, help=f"Listen port (default: {PROXY_PORT})")
    parser.add_argument("--host", default=PROXY_HOST, help=f"Listen host (default: {PROXY_HOST})")
    parser.add_argument("--kimchi-url", default=KIMCHI_BASE, help=f"Kimchi upstream URL (default: {KIMCHI_BASE})")
    args = parser.parse_args()

    KimchiProxyHandler.kimchi_base = args.kimchi_url.rstrip("/")

    server = http.server.HTTPServer((args.host, args.port), KimchiProxyHandler)

    print(f"Kimchi Proxy listening on http://{args.host}:{args.port}")
    print(f"  Forwarding to: {KimchiProxyHandler.kimchi_base}")
    print(f"  User-Agent: {USER_AGENT}")
    print(f"  Configure 9router provider baseURL: http://{args.host}:{args.port}/openai/v1")
    print(f"\n  Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nProxy stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
