"""Descarga reproducible de teselas DEM abiertas. Sin credenciales ni datos privados."""
from pathlib import Path
import math, json, urllib.request, concurrent.futures, time
ROOT=Path(__file__).resolve().parents[1]
def xy(lon,lat,z):
 n=2**z
 return int((lon+180)/360*n),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
def get(job):
 rel,url=job; p=ROOT/rel
 if p.exists(): return rel,'cache'
 p.parent.mkdir(parents=True,exist_ok=True)
 for i in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'SalvadorRailwayAcademicViewer/1.0'})
   with urllib.request.urlopen(req,timeout=35) as r:
    b=r.read(); headers=dict(r.headers)
   p.write_bytes(b)
   return rel,headers.get('x-imagery-sources',headers.get('X-Imagery-Sources','ok'))
  except Exception as e:
   if i==2:return rel,'ERROR '+str(e)
   time.sleep(1)
jobs=[('assets/mapa-martin-1911.jpg','https://www.gutenberg.org/files/45102/45102-h/images/illus-249_full.jpg'),('vendor/LICENSE-maplibre.txt','https://unpkg.com/maplibre-gl@5.6.2/LICENSE.txt')]
for z in range(6,13):
 w,s,e,n=(-90.3,12.95,-87.4,14.65) if z<=10 else (-90.02,13.43,-88.98,14.15)
 x0,y0=xy(w,n,z);x1,y1=xy(e,s,z)
 for x in range(x0,x1+1):
  for y in range(y0,y1+1):
   jobs.append((f'data/dem/{z}/{x}/{y}.png',f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'))
print('Descargas:',len(jobs),flush=True)
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for i,r in enumerate(pool.map(get,jobs)):
  results.append(r)
  if i%30==0 or str(r[1]).startswith('ERROR'): print(i,r,flush=True)
(ROOT/'evidencia/descargas-dem.json').write_text(json.dumps({'accessed':'2026-10-15','files':results},ensure_ascii=False,indent=2))
print('Final:',len(results),'errores:',sum(str(x[1]).startswith('ERROR') for x in results),flush=True)
