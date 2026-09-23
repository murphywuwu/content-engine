#!/usr/bin/env python3
"""Serve Content Engine so the workbench reads live vault Markdown.

  python3 workbench/serve.py
  → http://127.0.0.1:8765/workbench/

Live APIs (no rebuild required after Markdown edits):
  GET /api/graph           → current vault graph JSON
  GET /api/fonts           → slideshow font catalog from gateway.easysociable.com
  GET /api/font-file?url=  → same-origin proxy for catalog font files (CORS bypass)
  POST /api/brand          → write brand.md token fields only
  POST /api/media-upload   → multipart image(s) → media/ + index rows
  POST /api/media-delete   → JSON {ids:[M-…]} delete catalog rows + files
  POST /api/media-card     → JSON {id, caption, role, links} complete image card
  POST /api/media-link     → alias of media-card (links-only ok)
  GET /api/events          → SSE; fires when vault .md/.json mtimes change
  GET /workbench/          → template.html (UI shell; graph loaded via /api/graph)

When engine.json vault_root points at a separate vault:
  /workbench/*  → CORE/workbench
  /*            → VAULT
When vault_root is "." (default), CORE == VAULT and behavior matches a single-tree engine.
"""

from __future__ import annotations

import argparse
import cgi
import functools
import http.server
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

from roots import load_roots

_WB = Path(__file__).resolve().parent
CORE, VAULT = load_roots(_WB)
DEFAULT_PORT = 8765
SKIP_DIR_NAMES = {".git", "__pycache__", "node_modules", ".obsidian", "exports"}
FONT_CATALOG_URL = "https://gateway.easysociable.com/Directus/Font?fields=name,url"
FONT_FILE_HOSTS = {"cdn.builditeazy.store", "gateway.easysociable.com"}
_FONT_CACHE: dict = {"at": 0.0, "fonts": []}
_FONT_FILE_CACHE: dict[str, tuple[bytes, str]] = {}


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


def fetch_font_catalog() -> tuple[list[dict], str]:
    """Slideshow fonts from the public gateway. Cache for 5 minutes."""
    now = time.time()
    if _FONT_CACHE["fonts"] and now - float(_FONT_CACHE["at"]) < 300:
        return list(_FONT_CACHE["fonts"]), ""
    req = urllib.request.Request(
        FONT_CATALOG_URL,
        headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except (OSError, json.JSONDecodeError, TimeoutError) as exc:
        return list(_FONT_CACHE["fonts"]), str(exc)
    rows = payload.get("data") if isinstance(payload, dict) else None
    fonts = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        url = str(row.get("url") or "").strip()
        if name and url.startswith("https://") and len(name) <= 80:
            fonts.append({"name": name, "url": url})
    if not fonts:
        return list(_FONT_CACHE["fonts"]), "empty font catalog"
    _FONT_CACHE["at"] = now
    _FONT_CACHE["fonts"] = fonts
    return list(fonts), ""


def fetch_font_file(url: str) -> tuple[bytes, str]:
    """Fetch a catalog font file. Only allow known CDN hosts."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in FONT_FILE_HOSTS:
        raise ValueError("font host not allowed")
    if url in _FONT_FILE_CACHE:
        return _FONT_FILE_CACHE[url]
    # Prefer gateway storage proxy (same path Authoring uses).
    storage = "https://gateway.easysociable.com/storage/" + urllib.parse.quote(url, safe="")
    req = urllib.request.Request(
        storage,
        headers={"User-Agent": "Mozilla/5.0", "Origin": "http://localhost:5175"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        data = res.read()
        ctype = res.headers.get("Content-Type") or "font/woff2"
    if len(data) > 8_000_000:
        raise ValueError("font too large")
    _FONT_FILE_CACHE[url] = (data, ctype)
    return data, ctype


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
        if path in ("/api/fonts", "/workbench/api/fonts"):
            fonts, err = fetch_font_catalog()
            self._send_json({"fonts": fonts, "error": err})
            return
        if path in ("/api/font-file", "/workbench/api/font-file"):
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            url = (qs.get("url") or [""])[0].strip()
            if not url:
                self._send_json({"error": "missing url"}, status=400)
                return
            try:
                data, ctype = fetch_font_file(url)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            except OSError as exc:
                self._send_json({"error": str(exc)}, status=502)
                return
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(data)
            return
        if path in ("/workbench", "/workbench/", "/workbench/index.html"):
            self._send_workbench_shell()
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path in ("/api/media-upload", "/workbench/api/media-upload"):
            self._handle_media_upload()
            return
        if path in ("/api/media-delete", "/workbench/api/media-delete"):
            self._handle_media_delete()
            return
        if path in ("/api/media-card", "/workbench/api/media-card",
                    "/api/media-link", "/workbench/api/media-link"):
            self._handle_media_card()
            return
        if path not in ("/api/brand", "/workbench/api/brand"):
            self.send_error(404, "not found")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 8000:
            self._send_json({"error": "bad body"}, status=400)
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self._send_json({"error": "bad json"}, status=400)
            return
        if not isinstance(payload, dict):
            self._send_json({"error": "bad json"}, status=400)
            return
        if str(_WB) not in sys.path:
            sys.path.insert(0, str(_WB))
        import importlib
        import build as wb_build  # noqa: WPS433 — local sibling module
        wb_build = importlib.reload(wb_build)
        try:
            saved = wb_build.save_brand(self._vault, payload)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        except OSError as exc:
            self._send_json({"error": str(exc)}, status=500)
            return
        self._send_json({"ok": True, "brand": saved})

    def _wb_build(self):
        if str(_WB) not in sys.path:
            sys.path.insert(0, str(_WB))
        import importlib
        import build as wb_build  # noqa: WPS433
        return importlib.reload(wb_build)

    def _handle_media_delete(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 20_000:
            self._send_json({"error": "bad body"}, status=400)
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self._send_json({"error": "bad json"}, status=400)
            return
        ids = payload.get("ids") if isinstance(payload, dict) else None
        if not isinstance(ids, list):
            self._send_json({"error": "ids must be a list"}, status=400)
            return
        try:
            result = self._wb_build().delete_media(self._vault, ids)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        except OSError as exc:
            self._send_json({"error": str(exc)}, status=500)
            return
        self._send_json({"ok": True, **result})

    def _handle_media_card(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 20_000:
            self._send_json({"error": "bad body"}, status=400)
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self._send_json({"error": "bad json"}, status=400)
            return
        if not isinstance(payload, dict):
            self._send_json({"error": "bad json"}, status=400)
            return
        try:
            result = self._wb_build().update_media_card(self._vault, payload)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        except OSError as exc:
            self._send_json({"error": str(exc)}, status=500)
            return
        self._send_json({"ok": True, "media": result})

    def _handle_media_upload(self) -> None:

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 40_000_000:
            self._send_json({"error": "bad body"}, status=400)
            return
        environ = {
            "REQUEST_METHOD": "POST",
            "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            "CONTENT_LENGTH": str(length),
        }
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ=environ)
        except Exception as exc:  # noqa: BLE001 — surface parse errors to client
            self._send_json({"error": f"multipart: {exc}"}, status=400)
            return
        file_item = form["file"] if "file" in form else None
        if file_item is None:
            self._send_json({"error": "missing file"}, status=400)
            return
        items = file_item if isinstance(file_item, list) else [file_item]
        role = (form.getvalue("role") or "other").strip()
        tags = (form.getvalue("tags") or "photo").strip()
        links = (form.getvalue("links") or "").strip()
        rights = (form.getvalue("rights") or "own-upload").strip()
        default_caption = (form.getvalue("caption") or "").strip()
        wb_build = self._wb_build()
        saved_rows = []
        errors = []
        for item in items:
            if not getattr(item, "file", None):
                continue
            filename = Path(getattr(item, "filename", None) or "").name or "upload.png"
            try:
                raw = item.file.read()
            except OSError as exc:
                errors.append({"file": filename, "error": str(exc)})
                continue
            if not raw:
                continue
            cap = default_caption or Path(filename).stem
            try:
                saved_rows.append(
                    wb_build.save_media_upload(
                        self._vault,
                        raw,
                        filename,
                        role=role,
                        caption=cap,
                        tags=tags,
                        links=links,
                        rights=rights,
                    )
                )
            except ValueError as exc:
                errors.append({"file": filename, "error": str(exc)})
            except OSError as exc:
                errors.append({"file": filename, "error": str(exc)})
        if not saved_rows and errors:
            self._send_json({"error": errors[0]["error"], "errors": errors}, status=400)
            return
        if not saved_rows:
            self._send_json({"error": "missing file"}, status=400)
            return
        payload = {"ok": True, "media": saved_rows[0], "items": saved_rows}
        if errors:
            payload["errors"] = errors
        self._send_json(payload)

    def _send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_graph(self) -> None:
        # Import on demand so --help / cold start stay light; build.py is the parser source of truth.
        # Reload every request: serve processes outlive build.py edits.
        if str(_WB) not in sys.path:
            sys.path.insert(0, str(_WB))
        import importlib
        import build as wb_build  # noqa: WPS433 — local sibling module
        wb_build = importlib.reload(wb_build)

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
        print("Live:  /api/graph  /api/fonts  POST /api/brand  /api/events")
        print("Ctrl+C to stop")
        if not args.no_open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
