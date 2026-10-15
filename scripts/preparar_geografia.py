from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
def save(f,o):(R/f).write_text(json.dumps(o,ensure_ascii=False,separators=(',',':')))
def feature(g,p):return {'type':'Feature','properties':p,'geometry':g}
a=json.loads((R/'evidencia/osm-aguas.json').read_text())['elements']
b=json.loads((R/'evidencia/osm-lagos-pueblos.json').read_text())['elements']
features=[]
for e in a:
 t=e.get('tags',{});coords=[[p['lon'],p['lat']] for p in e.get('geometry',[])]
 if len(coords)<2:continue
 if t.get('waterway')=='river':g={'type':'LineString','coordinates':coords};kind='river'
 elif t.get('natural')=='water' and coords[0]==coords[-1]:g={'type':'Polygon','coordinates':[coords]};kind='water'
 else:continue
 features.append(feature(g,{'osmId':e['id'],'name':t.get('name',''),'kind':kind,'source':'OpenStreetMap, 2026-10-15'}))
def join(lines):
 lines=[list(s) for s in lines];rings=[]
 while lines:
  ring=lines.pop(0);changed=True
  while ring[0]!=ring[-1] and changed:
   changed=False
   for i,s in enumerate(lines):
    if ring[-1]==s[0]:ring+=s[1:]
    elif ring[-1]==s[-1]:ring+=s[-2::-1]
    elif ring[0]==s[-1]:ring=s[:-1]+ring
    elif ring[0]==s[0]:ring=s[:0:-1]+ring
    else:continue
    lines.pop(i);changed=True;break
  if len(ring)>3 and ring[0]==ring[-1]:rings.append(ring)
 return rings
for e in b:
 if e['type']!='relation':continue
 outer=[];inner=[]
 for m in e['members']:
  if m.get('type')!='way' or not m.get('geometry'):continue
  coords=[[p['lon'],p['lat']] for p in m['geometry']]
  (inner if m.get('role')=='inner' else outer).append(coords)
 outers=join(outer);inners=join(inner)
 if not outers:continue
 # En esta selección los lagos con islas tienen un solo anillo exterior.
 polys=[[o]+(inners if len(outers)==1 else []) for o in outers]
 features.append(feature({'type':'MultiPolygon','coordinates':polys},{'osmId':e['id'],'name':e.get('tags',{}).get('name',''),'kind':'water','source':'OpenStreetMap, 2026-10-15'}))
save('data/hidrografia.geojson',{'type':'FeatureCollection','features':features})
places=[]
historic=['Chalchuapa','Atiquizaya','Sonsonate','Armenia','Santa Ana','Coatepeque','El Congo','Sonzacate','Caluco','Izalco','Santa Tecla','San Juan Opico','Nejapa','Apopa','San Salvador','Ciudad Arce','Quezaltepeque','Juayúa','Nahuizalco']
for e in b:
 if e['type']=='node' and e.get('tags',{}).get('name') in historic:
  t=e['tags'];places.append({'id':f'osm-{e["id"]}','name':t['name'],'type':'place','kind':'Localidad de referencia','coordinates':[e['lon'],e['lat']],'description':'Población moderna de referencia territorial. La posición corresponde al nodo de localidad de OpenStreetMap, no a un edificio ni una estación histórica.','precision':'Nodo de localidad OSM; consulta 15/10/2026.','source':'OpenStreetMap (ODbL)','sourceUrl':f'https://www.openstreetmap.org/node/{e["id"]}'})
# Fuentes volcánicas: Smithsonian GVP; geomorfología regional MARN/SNET.
geo=[
('ilamatepec','Volcán de Santa Ana',[-89.630,13.853],'Estratovolcán',2381,'Ilamatepec domina el corredor occidental al oeste de la caldera de Coatepeque. Su relieve y sus cráteres se representan con el DEM, sin modelar un cono idealizado. El registro del GVP incluye la erupción de 2005.',343020),
('izalco','Volcán de Izalco',[-89.633,13.813],'Estratovolcán',1950,'Edificio volcánico al sur de Santa Ana. El GVP registra su última erupción en 1966: el relieve moderno no equivale a la forma que tenía en 1911. El MARN publica una altura distinta de 1.965 m.',343030),
('sansalvador-volcan','Volcán de San Salvador',[-89.294,13.734],'Complejo volcánico',1893,'El Boquerón y las laderas del complejo explican el rodeo del ferrocarril por el norte hacia Quezaltepeque, Nejapa y Apopa. La ficha del GVP registra la erupción de 1917. Su cota de referencia no representa todas las cumbres del complejo.',343050),
('coatepeque-lago','Lago de Coatepeque',[-89.548,13.867],'Lago en caldera',None,'El lago ocupa parte de la caldera de Coatepeque, al este de Santa Ana. Se utiliza el contorno de agua de OSM; el DEM aporta el relieve terrestre circundante, no profundidades del lago.',343041),
('cerroverde','Cerro Verde',[-89.625,13.827],'Edificio volcánico',None,'Parte del complejo Izalco–Santa Ana–Coatepeque junto con los edificios de San Marcelino y Cerro Chino. Su ubicación es una referencia aproximada en el complejo; la forma procede del DEM.',None),
('sanmarcelino','San Marcelino',[-89.544,13.806],'Cono volcánico',None,'Edificio del complejo volcánico occidental. Se muestra para contextualizar el relieve entre Coatepeque y el corredor de Armenia. Ubicación aproximada, pendiente de cotejo de detalle.',None),
('apaneca','Sierra de Apaneca',[-89.78,13.86],'Cordillera volcánica',None,'Sector occidental de la cadena volcánica. El sombreado y las curvas permiten seguir las divisorias y barrancos; el marcador señala un área, no una cumbre precisa.',None),
('balsamo','Cordillera del Bálsamo',[-89.41,13.64],'Relieve costero',None,'Laderas al sur del corredor de Armenia–Ateos–La Ceiba. El punto es una referencia regional aproximada. Las formas del terreno proceden del DEM moderno.',None),
('chanmico','Laguna de Chanmico',[-89.35,13.787],'Laguna',None,'Laguna al este del corredor de Sitio del Niño. Se conserva también la grafía Chanmico del mapa de Martin. Su contorno moderno procede de OSM.',None),
('cuzcachapa','Laguna de Cuzcachapa',[-89.675,13.979],'Laguna',None,'Cuerpo de agua junto a Chalchuapa, rotulado Laguna de Cuscachapa en el mapa. El contorno de agua procede de OSM.',None),
('ilopango','Lago de Ilopango',[-89.054,13.676],'Lago en caldera',None,'Referencia regional al este del corredor histórico. El MARN lo identifica como una depresión volcano-tectónica. El lago no aparece completo en la lámina ferroviaria.',None),
('pacifico','Océano Pacífico',[-89.86,13.55],'Costa',0,'La terminal de Acajutla conecta la red con el litoral. El mar se aplana a 0 m en este visor: no se modela batimetría.',None),
]
for id,name,coords,kind,ele,desc,vn in geo:
 url=f'https://volcano.si.edu/volcano.cfm?vn={vn}' if vn else 'https://www.snet.gob.sv/Geologia/Vulcanologia/amenazas/MAPAVSA.pdf'
 if id in ['chanmico','cuzcachapa']:
  for f in features:
   if f['properties']['name'] and (('Chanmico' in f['properties']['name'] and id=='chanmico') or ('Cuzcachapa' in f['properties']['name'] and id=='cuzcachapa')):
    cc=f['geometry']['coordinates'][0];coords=[sum(c[0] for c in cc)/len(cc),sum(c[1] for c in cc)/len(cc)];url=f'https://www.openstreetmap.org/way/{f["properties"]["osmId"]}'
 if id in ['balsamo','ilopango','pacifico']:url='https://www.snet.gob.sv/ver/geologia/geologia+de+el+salvador/'
 places.append({'id':id,'name':name,'coordinates':coords,'type':'natural','kind':kind,'referenceElevation':ele,'description':desc,'precision':'Coordenadas de catálogo GVP' if vn else 'Referencia geográfica aproximada; contornos OSM cuando están disponibles.','source':'Smithsonian, Global Volcanism Program (consulta 15/10/2026)' if vn else 'MARN/SNET y OpenStreetMap; consulta 15/10/2026','sourceUrl':url})
save('data/lugares.json',places)
print(len(features),'elementos hidrográficos;',len(places),'lugares')
