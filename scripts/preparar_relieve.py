from pathlib import Path
import json, math
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[1]
# Altitudes en metros; colores editoriales, no clasificación de cobertura del suelo.
stops=np.array([-1000,0,1,200,500,900,1300,1700,2100,2500,3000])
colors=np.array(['266076','397b88','9cb89b','9db58a','b6bf8b','c9c18f','c4ae85','b29e8a','c7bbab','e7e0ce','fff8e8'])
rgb=np.array([[int(c[i:i+2],16) for i in [0,2,4]] for c in colors])
def dem(path):
 a=np.array(Image.open(path).convert('RGB'),dtype=np.float32)
 return a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768
for path in (R/'data/dem').rglob('*.png'):
 a=dem(path)
 original=np.array(Image.open(path).convert('RGB'));original[original[:,:,0]<128]=[128,0,0]
 surface=R/'data/terreno'/path.relative_to(R/'data/dem');surface.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(original).save(surface,optimize=True)
 c=np.stack([np.interp(a,stops,rgb[:,i]) for i in range(3)],axis=-1).astype('uint8')
 out=R/'data/tintas'/path.relative_to(R/'data/dem');out.parent.mkdir(parents=True,exist_ok=True)
 Image.fromarray(c).save(out,optimize=True)
files=list((R/'data/dem/12').rglob('*.png'))
xs=[int(p.parent.name) for p in files];ys=[int(p.stem) for p in files]
x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
a=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256),dtype=np.float32)
for p in files:
 x,y=int(p.parent.name),int(p.stem)
 a[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=dem(p)
# Un punto cada dos píxeles para consultas y perfil; nunca usar la exageración visual.
grid=a[::2,::2].round().astype('<i2');grid.tofile(R/'data/elevaciones.i16')
meta={'zoom':12,'tileX':x0,'tileY':y0,'stride':2,'width':grid.shape[1],'height':grid.shape[0], 'pixelCenter':0.5,'format':'signed int16 little endian, meters','sampleSpacingAt14N_m':round(math.cos(math.radians(14))*40075016.686/(2**12*256)*2,1),'source':'Mapzen Terrain Tiles (SRTM, consultar atribucion)','accessed':'2026-10-15'}
(R/'data/relieve.json').write_text(json.dumps(meta,indent=2))
# Marching squares sobre rejilla reducida de aproximadamente 148 m. Las cotas son del DEM moderno.
b=a[::4,::4];h,w=b.shape
contours=[]
def ll(p):
 x,y=p
 px=x0*256+x*4+.5;py=y0*256+y*4+.5;n=2**12*256
 return [round(px/n*360-180,6),round(math.degrees(math.atan(math.sinh(math.pi*(1-2*py/n)))),6)]
for level in range(100,2701,100):
 v=[b[:-1,:-1],b[:-1,1:],b[1:,1:],b[1:,:-1]]
 mask=(v[0]>level).astype('uint8')+2*(v[1]>level)+4*(v[2]>level)+8*(v[3]>level)
 yy,xx=np.where((mask!=0)&(mask!=15))
 seg=[]
 for y,x in zip(yy,xx):
  vals=[b[y,x],b[y,x+1],b[y+1,x+1],b[y+1,x]];ps=[(x,y),(x+1,y),(x+1,y+1),(x,y+1)];cross=[]
  for i,j in [(0,1),(1,2),(2,3),(3,0)]:
   if (vals[i]>level)!=(vals[j]>level):
    t=(level-vals[i])/(vals[j]-vals[i]);cross.append((round(float(ps[i][0]+t*(ps[j][0]-ps[i][0])),4),round(float(ps[i][1]+t*(ps[j][1]-ps[i][1])),4)))
  for k in range(0,len(cross)-1,2):seg.append((cross[k],cross[k+1]))
 # Ensamblar segmentos vecinos por clave exacta redondeada.
 adj={}
 for i,(u,vv) in enumerate(seg):
  adj.setdefault(u,[]).append((i,vv));adj.setdefault(vv,[]).append((i,u))
 used=set();lines=[]
 for i,(u,vv) in enumerate(seg):
  if i in used:continue
  used.add(i);line=[u,vv]
  for reverse in [False,True]:
   if reverse:line.reverse()
   while True:
    nxt=next(((j,q) for j,q in adj.get(line[-1],[]) if j not in used),None)
    if nxt is None:break
    used.add(nxt[0]);line.append(nxt[1])
  if len(line)>=6:lines.append([ll(q) for q in line[::2]]+[ll(line[-1])])
 if lines:contours.append({'type':'Feature','properties':{'elevation':level,'major':int(level%500==0)},'geometry':{'type':'MultiLineString','coordinates':lines}})
 print('Curvas',level,len(lines),flush=True)
(R/'data/curvas.geojson').write_text(json.dumps({'type':'FeatureCollection','features':contours},separators=(',',':')))
# Índice de cobertura: evita solicitar teselas inexistentes; fuera del corredor se usa z10.
coverage={}
for z in range(6,13):
 ps=list((R/f'data/dem/{z}').rglob('*.png'));xs=[int(p.parent.name) for p in ps];ys=[int(p.stem) for p in ps]
 coverage[str(z)]=[min(xs),min(ys),max(xs),max(ys)]
(R/'data/cobertura.json').write_text(json.dumps(coverage))
print('Rejilla',grid.shape,meta,'DEM min/max',float(a.min()),float(a.max()))
