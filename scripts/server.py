import http.server
import socketserver
import sys

class DualStackServer(http.server.ThreadingHTTPServer):
    request_queue_size = 128
    def server_bind(self):
        self.socket.setsockopt(http.server.socket.SOL_SOCKET, http.server.socket.SO_REUSEADDR, 1)
        super().server_bind()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
handler = http.server.SimpleHTTPRequestHandler

print(f"Starting multithreaded server on http://127.0.0.1:{port}")
with DualStackServer(('127.0.0.1', port), handler) as httpd:
    httpd.serve_forever()
