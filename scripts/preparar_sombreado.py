from pathlib import Path
from PIL import Image
import numpy as np, math
R=Path(__file__).resolve().parents[1]
for z in range(6,13):
 ps=list((R/f'data/terreno/{z}').rglob('*.png'));xs=[int(p.parent.name) for p in ps];ys=[int(p.stem) for p in ps]
 x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
 a=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256),dtype=np.float32)
 for p in ps:
  x,y=int(p.parent.name),int(p.stem);rgb=np.array(Image.open(p).convert('RGB'),dtype=np.float32)
  a[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768
 # Sombreado estático: luz noroeste, evita calcular una capa DEM adicional en cada cuadro.
 step=math.cos(math.radians(14))*40075016.686/(256*2**z)
 gy,gx=np.gradient(a,step);norm=np.sqrt(gx*gx+gy*gy+1)
 shade=(-gx*.5-gy*.5+.7071)/norm
 factor=np.clip(.68+.43*shade,.50,1.13)
 for p in ps:
  x,y=int(p.parent.name),int(p.stem)
  c=np.array(Image.open(R/'data/tintas'/p.relative_to(R/'data/terreno')).convert('RGB'),dtype=np.float32)
  f=factor[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]
  c=np.clip(c*f[:,:,None],0,255).astype('uint8');o=R/'data/sombreado'/p.relative_to(R/'data/terreno');o.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(c).save(o,optimize=True)
 print('Sombreado z',z,flush=True)
