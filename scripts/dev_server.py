import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1] / "frontend"
PORT = 8000


def asset_version():
    files = list(ROOT.glob("app.js")) + list((ROOT / "js").rglob("*.js")) + [ROOT / "styles.css"]
    return str(int(max(path.stat().st_mtime for path in files if path.exists())))


def version_js_imports(source):
    version = asset_version()

    def add_version(match):
        prefix, specifier, suffix = match.groups()
        separator = "&" if "?" in specifier else "?"
        return f"{prefix}{specifier}{separator}v={version}{suffix}"

    source = re.sub(r'(from\s+["\'])([^"\']+\.js)(["\'])', add_version, source)
    return re.sub(r'(import\s+["\'])([^"\']+\.js)(["\'])', add_version, source)


def version_html(source):
    version = asset_version()
    source = re.sub(r'src="app\.js(?:\?[^"]*)?"', f'src="app.js?v={version}"', source)
    return re.sub(r'href="styles\.css(?:\?[^"]*)?"', f'href="styles.css?v={version}"', source)


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        request_path = unquote(urlsplit(self.path).path)
        relative = request_path.lstrip("/") or "index.html"
        file_path = (ROOT / relative).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if file_path.is_file() and file_path.suffix in {".html", ".js"}:
            self.send_versioned_file(file_path)
            return
        super().do_GET()

    def send_versioned_file(self, file_path):
        content = file_path.read_text(encoding="utf-8")
        if file_path.suffix == ".html":
            content = version_html(content)
            content_type = "text/html; charset=utf-8"
        else:
            content = version_js_imports(content)
            content_type = "text/javascript; charset=utf-8"
        body = content.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler)
    print(f"Serving {ROOT} at http://127.0.0.1:{PORT}")
    server.serve_forever()
