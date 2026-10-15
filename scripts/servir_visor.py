"""Servidor exclusivamente local para el atlas. Ctrl+C lo detiene."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import argparse, webbrowser, urllib.request, json
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--no-open',action='store_true');args=parser.parse_args()
class Handler(SimpleHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def end_headers(self):
  if self.path.split('?')[0].endswith(('.html','.js','.css','.json')) or self.path.split('?')[0]=='/':self.send_header('Cache-Control','no-cache')
  super().end_headers()
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def do_GET(self):
  if self.path=='/salvador-railway-health':
   b=json.dumps({'app':'salvador-railway-atlas','directory':str(ROOT)}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
  else:super().do_GET()
 def log_message(self,format,*args):
  if args and ('404' in str(args) or '500' in str(args)):super().log_message(format,*args)
class AtlasServer(ThreadingHTTPServer):
 request_queue_size=128
 daemon_threads=True
for port in range(8765,8786):
 try:server=AtlasServer(('127.0.0.1',port),Handler);break
 except OSError:
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/salvador-railway-health',timeout=1) as r:j=json.loads(r.read())
   if j.get('directory')==str(ROOT):
    print('El visor ya está activo.');webbrowser.open(f'http://127.0.0.1:{port}/');raise SystemExit(0)
  except (OSError,ValueError):pass
else:raise SystemExit('No hay un puerto libre entre 8765 y 8785.')
url=f'http://127.0.0.1:{port}/';print(f'Salvador Railway · Atlas del relieve\n{url}\nConserva esta ventana abierta. Ctrl+C para detener.',flush=True)
if not args.no_open:webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:print('\nVisor detenido.')
finally:server.server_close()
