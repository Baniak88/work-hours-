"""Serve the exported Expo single-page preview, including direct route reloads."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="dist", **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if not Path(self.translate_path(path)).exists() and not Path(path).suffix:
            self.path = "/index.html"
        super().do_GET()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8081), PreviewHandler).serve_forever()
