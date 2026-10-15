from pathlib import Path
import json,math
R=Path(__file__).resolve().parents[1]
def simplify(pts,tol=.00012):
 if len(pts)<4:return pts
 ax,ay=pts[0];bx,by=pts[-1];dx,dy=bx-ax,by-ay;dd=dx*dx+dy*dy
 maxi=0;md=-1
 for i,(x,y) in enumerate(pts[1:-1],1):
  t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/dd)) if dd else 0
  d=(x-ax-t*dx)**2+(y-ay-t*dy)**2
  if d>md:maxi=i;md=d
 if md>tol*tol:return simplify(pts[:maxi+1],tol)[:-1]+simplify(pts[maxi:],tol)
 return [pts[0],pts[-1]]
def ring(pts):
 if len(pts)<6:return pts
 mid=len(pts)//2;a=simplify(pts[:mid+1])[:-1]+simplify(pts[mid:]);return a if len(a)>=4 else pts
j=json.loads((R/'data/hidrografia.geojson').read_text())
for f in j['features']:
 g=f['geometry'];c=g['coordinates']
 if g['type']=='LineString':g['coordinates']=simplify(c)
 elif g['type']=='Polygon':g['coordinates']=[ring(p) for p in c]
 elif g['type']=='MultiPolygon':g['coordinates']=[[ring(p) for p in poly] for poly in c]
(R/'data/hidrografia-visual.geojson').write_text(json.dumps(j,ensure_ascii=False,separators=(',',':')))
print('Vista de hidrografía simplificada a ~13 m; originales preservados.')
