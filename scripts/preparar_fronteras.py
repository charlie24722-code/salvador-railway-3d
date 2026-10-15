"""Límites de referencia geoBoundaries/OSM, año representado 2021; no históricos."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
COLORS=['#ba8d63', '#849cb3', '#b89e68', '#8baa87', '#bc8d91', '#8fa6a6', '#bfa57e', '#a3a07c', '#9d8caf', '#c39b82', '#829e92', '#a2a8be', '#c0af72', '#ad9795']
for level,name in [('ADM1','departamentos')]:
 src=json.loads((R/f'evidencia/fronteras-{level}.geojson').read_text())
 meta=json.loads((R/f'evidencia/fronteras-{level}-metadata.json').read_text())
 features=[]
 for i,f in enumerate(src['features']):
  p=f['properties'];f['properties']={'name':p['shapeName'].replace('Departamento de ',''),'shapeID':p['shapeID'],'year':meta['boundaryYearRepresented'],'source':'geoBoundaries gbOpen / Open Street Map','license':meta['boundaryLicense'],'sourceUrl':f'https://www.geoboundaries.org/api/current/gbOpen/SLV/{level}/','type':level}
  if level=='ADM1': f['properties']['color']=COLORS[i % len(COLORS)]
  features.append(f)
 (R/f'data/{name}.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
 print(name,len(features))

# Un punto por departamento evita rótulos repetidos por tesela/polígono.
def ring_centroid(ring):
 pairs=list(zip(ring,ring[1:]))
 cross=[a[0]*b[1]-b[0]*a[1] for a,b in pairs]
 area=sum(cross)
 return [sum((a[k]+b[k])*v for (a,b),v in zip(pairs,cross))/(3*area) for k in (0,1)], abs(area)
labels=[]
for f in features:
 g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 center=max((ring_centroid(poly[0]) for poly in polys),key=lambda x:x[1])[0]
 labels.append({'type':'Feature','properties':f['properties'],'geometry':{'type':'Point','coordinates':center}})
(R/'data/etiquetas-departamentos.geojson').write_text(json.dumps({'type':'FeatureCollection','features':labels},ensure_ascii=False,separators=(',',':')))

# ADM0 geoBoundaries incluye un tramo marino; el visor usa el contorno terrestre de Natural Earth.
f=json.loads((R/'evidencia/natural-earth-SLV.geojson').read_text())
f['properties']={'name':'El Salvador','source':'Natural Earth Admin 0 Countries 1:10m','license':'Public domain','accessed':'2026-10-15','sourceUrl':'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/'}
(R/'data/frontera-nacional.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[f]},ensure_ascii=False,separators=(',',':')))
