#!/usr/bin/env python3
"""Serve Content Engine so the workbench reads live vault Markdown.

  python3 workbench/serve.py
  → http://127.0.0.1:8765/workbench/

Live APIs (no rebuild required after Markdown edits):
  GET /api/graph           → current vault graph JSON
  GET /api/events          → SSE; fires when vault .md/.json mtimes change
  GET /workbench/          → template.html (UI shell; graph loaded via /api/graph)

When engine.json vault_root points at a separate vault:
  /workbench/*  → CORE/workbench
  /*            → VAULT
When vault_root is "." (default), CORE == VAULT and behavior matches a single-tree engine.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import sys
import time
import urllib.parse
import webbrowser
from pathlib import Path

from roots import load_roots

_WB = Path(__file__).resolve().parent
CORE, VAULT = load_roots(_WB)
DEFAULT_PORT = 8765
SKIP_DIR_NAMES = {".git", "__pycache__", "node_modules", ".obsidian", "exports"}


def vault_fingerprint(vault: Path) -> float:
    """Max mtime of vault markdown/json — cheap change signal for SSE."""
    latest = 0.0
    if not vault.is_dir():
        return latest
    for root, dirs, files in os.walk(vault):
        dirs[:] = [d for d in dirs if d not in SKIP_DIR_NAMES and not d.startswith(".")]
        for name in files:
            if not (name.endswith(".md") or name.endswith(".json")):
                continue
            try:
                latest = max(latest, (Path(root) / name).stat().st_mtime)
            except OSError:
                continue
    return latest


class EngineHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, core: Path, vault: Path, **kwargs):
        self._core = core.resolve()
        self._vault = vault.resolve()
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

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path in ("/api/graph", "/workbench/api/graph"):
            self._send_graph()
            return
        if path in ("/api/events", "/workbench/api/events"):
            self._send_events()
            return
        if path in ("/workbench", "/workbench/", "/workbench/index.html"):
            self._send_workbench_shell()
            return
        super().do_GET()

    def _send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_graph(self) -> None:
        # Import on demand so --help / cold start stay light; build.py is the parser source of truth.
        if str(_WB) not in sys.path:
            sys.path.insert(0, str(_WB))
        import build as wb_build  # noqa: WPS433 — local sibling module

        try:
            graph = wb_build.build_graph()
        except Exception as exc:  # noqa: BLE001 — surface to the observatory
            self._send_json({"error": str(exc), "nodes": [], "edges": []}, status=500)
            return
        self._send_json(graph)

    def _send_workbench_shell(self) -> None:
        """Serve template.html so UI edits apply without build.py; graph comes from /api/graph."""
        tpl = self._core / "workbench" / "template.html"
        if not tpl.is_file():
            self.send_error(404, "workbench/template.html missing")
            return
        raw = tpl.read_text(encoding="utf-8")
        # Keep the /*__GRAPH__*/null sentinel so the SPA boot path always fetches live.
        if "/*__GRAPH__*/" not in raw:
            raw = raw.replace("const GRAPH = null;", "const GRAPH = /*__GRAPH__*/null;", 1)
        body = raw.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_events(self) -> None:
        """SSE: notify when vault fingerprint changes. Client refetches /api/graph."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        last = vault_fingerprint(self._vault)
        try:
            hello = json.dumps({"mtime": last}, ensure_ascii=False)
            self.wfile.write(f"data: {hello}\n\n".encode("utf-8"))
            self.wfile.flush()
            while True:
                time.sleep(1.0)
                now = vault_fingerprint(self._vault)
                if now <= last:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                last = now
                payload = json.dumps({"mtime": last}, ensure_ascii=False)
                self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            return


def main() -> None:
    ap = argparse.ArgumentParser(description="Local static server for Content Engine workbench")
    ap.add_argument("-p", "--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--no-open", action="store_true", help="Do not open the browser")
    args = ap.parse_args()

    os.chdir(VAULT if CORE.resolve() == VAULT.resolve() else CORE)
    handler = functools.partial(EngineHandler, core=CORE, vault=VAULT)
    url = f"http://127.0.0.1:{args.port}/workbench/"
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as httpd:
        print(f"Content Engine CORE:  {CORE}")
        print(f"Content Engine VAULT: {VAULT}")
        if CORE.resolve() != VAULT.resolve():
            print("Split mode: /workbench → CORE; other paths → VAULT")
        print(f"Open: {url}")
        print("Live:  /api/graph  /api/events  (Markdown edits refresh the observatory)")
        print("Ctrl+C to stop")
        if not args.no_open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
