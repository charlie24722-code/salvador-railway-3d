from pathlib import Path
import json, math, heapq
R=Path(__file__).resolve().parents[1]
def save(f,obj): (R/f).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')))
def dist(a,b):return math.hypot((a[0]-b[0])*108000,(a[1]-b[1])*111200)
# Coordenadas de anclaje aproximadas: localidades y corredor, no levantamientos de estaciones de 1911.
rows=[
('acajutla','Acajutla',-89.835,13.590,'Terminal portuaria','Punto de partida costero en el mapa. Martin sitúa la apertura del tramo a Sonsonate en 1882.',1882),
('hacienda','Hacienda Nueva',-89.787,13.643,'Estación','Parada intermedia entre Acajutla y Santa Emilia. Posición estimada dentro del corredor ferroviario; requiere cotejo parcelario.',1882),
('emilia','Santa Emilia',-89.755,13.676,'Estación','Parada del tramo costero al sur de Sonsonate. Posición estimada a partir de la secuencia del mapa.',1882),
('sonsonate','Sonsonate',-89.726,13.716,'Estación principal','Nodo entre la planicie costera y el ascenso hacia Armenia. El mapa rotula también Sonzacate al norte.',1882),
('zapote','Zapote',-89.627,13.737,'Estación','Parada en el piedemonte al este de Sonsonate; ubicación aproximada. Se conserva el nombre del mapa.',1884),
('lagartos','Los Lagartos',-89.5667,13.750,'Estación','Parada del corredor de Sonsonate a Armenia. Anclaje aproximado: la lista pluviométrica de 1959 sitúa Los Lagartos en 13°45′ N, 89°34′ O; no identifica el edificio ferroviario.',1884),
('armenia','Armenia',-89.501,13.746,'Estación','El tramo Sonsonate–Armenia aparece terminado en septiembre de 1884 en Martin, p. 197.',1884),
('ateos','Ateos',-89.447,13.748,'Bifurcación','Confluencia del ascenso desde Armenia y el ramal de La Ceiba. Anclaje territorial aproximado.',1887),
('sitio','Sitio del Niño',-89.369,13.804,'Bifurcación principal','Desde este nodo la red se divide hacia Santa Ana y hacia Quezaltepeque–San Salvador. Posición aproximada sobre el corredor OSM.',1895),
('andres','San Andrés',-89.397,13.825,'Estación','Parada entre Sitio del Niño y Chilamatal. No confundir la estación con la ubicación exacta del sitio arqueológico.',1895),
('chilamatal','Chilamatal',-89.445,13.850,'Estación','Topónimo histórico conservado literalmente. Referencia territorial: entorno de la actual Ciudad Arce; el edificio de 1911 no está georreferenciado.',1895),
('coatepeque','Coatepeque',-89.496,13.908,'Estación','Estación rotulada Coatepeque, junto a Congo en el mapa; se usa el corredor de El Congo como referencia, no la orilla del lago.',1896),
('santaana','Santa Ana',-89.554,13.986,'Terminal','Terminal norte del mapa. Martin fecha la sección La Joya–Santa Ana en noviembre de 1896 (p. 197). El punto es un anclaje de localidad.',1896),
('quezaltepeque','Quezaltepeque',-89.277,13.832,'Estación principal','Corredor al norte del volcán de San Salvador. Se mantiene la grafía del mapa histórico.',1898),
('nejapa','Nejapa',-89.230,13.807,'Estación','La sección Sitio del Niño–Nejapa se abrió en febrero de 1898, según Martin, p. 197. El punto coincide aproximadamente con La Estación en OSM.',1898),
('apopa','Apopa',-89.177,13.799,'Estación','Parada antes del ingreso oriental a San Salvador. El corredor bordea el edificio volcánico por el norte y el este.',1900),
('sansalvador','San Salvador',-89.176014,13.701014,'Terminal','El punto usa como referencia moderna la estación FENADESAL de OSM. No se asume que su edificio actual sea el de 1911. Martin fecha el tramo final en marzo de 1900.',1900),
('ceiba','La Ceiba',-89.355,13.713,'Terminal de ramal','Terminal occidental respecto de Santa Tecla en el mapa. Su posición exacta está pendiente: se muestra un anclaje aproximado en el entorno de Colón. La línea no se extiende hasta Santa Tecla.',1890),
]
stations=[]
for id,name,lon,lat,kind,description,year in rows:
 stations.append({'id':id,'name':name,'coordinates':[lon,lat],'kind':kind,'description':description,'openedByMartin':year,'precision':'Ubicación aproximada; no levantamiento de 1911','source':'Martin, 1911, mapa frente a p. 198; cronología pp. 197–198','sourceUrl':'https://www.gutenberg.org/files/45102/45102-h/45102-h.htm#Page_197'})
save('data/estaciones.json',stations)
# Red moderna OSM; los itinerarios reconstruidos siguen su corredor donde hay continuidad.
osm=json.loads((R/'evidencia/osm-overpass.json').read_text())
nodes={};graph={}
for e in osm['elements']:
 if e['type']!='way' or e.get('tags',{}).get('railway') not in ['rail','disused','abandoned','razed']:continue
 ids=e['nodes'];g=e['geometry']
 for i,c in zip(ids,g):nodes[i]=[c['lon'],c['lat']];graph.setdefault(i,[])
 for u,v in zip(ids,ids[1:]):
  d=dist(nodes[u],nodes[v]);graph[u].append((v,d,e['id']));graph[v].append((u,d,e['id']))
# Unir únicamente extremos próximos, anotándolos como interpolación (sin atribuirlos a OSM).
ends=[n for n,v in graph.items() if len(v)==1]
bridges=0
for k,u in enumerate(ends):
 for v in ends[k+1:]:
  d=dist(nodes[u],nodes[v])
  if d<180:graph[u].append((v,d,None));graph[v].append((u,d,None));bridges+=1
byid={s['id']:s for s in stations}
def nearest(p):return min(nodes,key=lambda n:dist(nodes[n],p))
def path(a,b):
 s,t=nearest(a),nearest(b);pq=[(0,s)];seen={s:0};prev={}
 while pq:
  d,u=heapq.heappop(pq)
  if u==t:break
  if d>seen[u]:continue
  for v,dd,way in graph[u]:
   nd=d+dd
   if nd<seen.get(v,1e20):seen[v]=nd;prev[v]=(u,way);heapq.heappush(pq,(nd,v))
 if t not in seen:return [a,b],[],True
 ids=[t];ways=[]
 while ids[-1]!=s:
  u,way=prev[ids[-1]];ids.append(u);ways.append(way)
 pts=[nodes[n] for n in reversed(ids)]
 return pts,sorted(set(x for x in ways if x is not None)),None in ways
routes=[]
for id,name,color,chain in [
('principal','Acajutla → San Salvador','#e5a356',['acajutla','hacienda','emilia','sonsonate','zapote','lagartos','armenia','ateos','sitio','quezaltepeque','nejapa','apopa','sansalvador']),
('santaana','Sitio del Niño → Santa Ana','#e5a356',['sitio','andres','chilamatal','coatepeque','santaana']),
('ceiba','Ateos → La Ceiba','#e5a356',['ateos','ceiba'])]:
 coords=[];ways=set();gaps=[]
 for aa,bb in zip(chain,chain[1:]):
  a,b=byid[aa]['coordinates'],byid[bb]['coordinates']
  if id=='ceiba':pts=[a,[-89.426,13.738],[-89.397,13.725],[-89.375,13.719],b];ws=[];gap=True
  else:pts,ws,gap=path(a,b)
  # Conectores rectos sólo cuando falta red; todos se declaran interpretativos.
  if coords and dist(coords[-1],pts[0])>1:coords.append(pts[0]);gaps.append([aa,bb])
  coords.extend(pts if not coords else pts[1:]);ways.update(ws)
  if gap:gaps.append([aa,bb])
 routes.append({'type':'Feature','properties':{'id':id,'name':name,'status':'Reconstrucción aproximada del itinerario de 1911 sobre corredores OSM modernos; no certifica alineación histórica','osmWayIds':sorted(ways),'interpolatedSections':gaps,'stationIds':chain},'geometry':{'type':'LineString','coordinates':coords}})
 print(name,len(coords),'ways',len(ways),'interpolados',gaps)
save('data/rutas-historicas.geojson',{'type':'FeatureCollection','features':routes})
# Capa OSM bruta disponible aparte: no se atribuye al año 1911.
# Posiciones de las estaciones conservan su precisión declarada; puntos no se desplazan automáticamente a vías.
print(len(stations),'estaciones;',bridges,'conexiones entre extremos próximos')
