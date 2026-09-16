#!/usr/bin/env python3
"""Serve Content Engine so workbench can fetch live Markdown.

  python3 workbench/serve.py
  → http://127.0.0.1:8765/workbench/

When engine.json vault_root points at a separate vault:
  /workbench/*  → CORE/workbench
  /*            → VAULT
When vault_root is "." (default), CORE == VAULT and behavior matches a single-tree engine.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import urllib.parse
import webbrowser
from pathlib import Path

from roots import load_roots

_WB = Path(__file__).resolve().parent
CORE, VAULT = load_roots(_WB)
DEFAULT_PORT = 8765


class EngineHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, core: Path, vault: Path, **kwargs):
        self._core = core.resolve()
        self._vault = vault.resolve()
        # Base directory unused; translate_path fully overrides.
        super().__init__(*args, directory=str(self._vault), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        super().log_message(fmt, *args)

    def translate_path(self, path: str) -> str:
        parsed = urllib.parse.urlparse(path).path
        rel = urllib.parse.unquote(parsed).lstrip("/")
        if rel == "workbench" or rel.startswith("workbench/"):
            rest = rel[len("workbench") :].lstrip("/")
            target = (self._core / "workbench" / rest).resolve()
            wb_root = (self._core / "workbench").resolve()
            if target != wb_root and wb_root not in target.parents:
                return str(wb_root / "_denied")
            return str(target)
        target = (self._vault / rel).resolve()
        if target != self._vault and self._vault not in target.parents:
            return str(self._vault / "_denied")
        return str(target)


def main() -> None:
    ap = argparse.ArgumentParser(description="Local static server for Content Engine workbench")
    ap.add_argument("-p", "--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--no-open", action="store_true", help="Do not open the browser")
    args = ap.parse_args()

    # Mixed mode: stay in vault (= core). Split mode: handler maps paths; cwd unused for files.
    os.chdir(VAULT if CORE.resolve() == VAULT.resolve() else CORE)
    handler = functools.partial(EngineHandler, core=CORE, vault=VAULT)
    url = f"http://127.0.0.1:{args.port}/workbench/"
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as httpd:
        print(f"Content Engine CORE:  {CORE}")
        print(f"Content Engine VAULT: {VAULT}")
        if CORE.resolve() != VAULT.resolve():
            print("Split mode: /workbench → CORE; other paths → VAULT")
        print(f"Open: {url}")
        print("Ctrl+C to stop")
        if not args.no_open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
