'use strict';
const $ = id => document.getElementById(id);
const numberFormats = new Map();
const fmt = (v, n = 0) => {if(!numberFormats.has(n))numberFormats.set(n,new Intl.NumberFormat('es-SV',{maximumFractionDigits:n,minimumFractionDigits:n}));return numberFormats.get(n).format(Number(v));};
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baseURL = new URL('.', location.href).href;
const initial = {center:[-89.49,13.745],zoom:10.08,pitch:54,bearing:-10};
const initialZoom = () => Math.min(initial.zoom,9.4+Math.log2(Math.max(350,document.querySelector('.map-shell').clientWidth)/600));
const state = {base:'relief',exaggeration:1.5,terrain:true,route:'principal',filter:'all',selected:null,tour:false,followTrain:true,trainSpeed:1,orbit:false,measure:false,measurePoints:[],layers:{rail:true,stations:true,nature:true,places:false,cities:true,hydro:true,contours:false,osm:false,labels:true,borders:true,departments:true,departmentFill:true}};
let captureURL;
let trainFrame, trainLastTime=0, trainHeading=0;
let qualityRatio=1.5, changingQuality=false, qualityTimer;
let routeCoords=[], routeCum=[], routeStops=[], routeDistance=0, routeSections=[], segments;
let map, stations, places, cities, routes, coverage, gridMeta, grid, points, profileSamples = [], profileMarker, measurePopup, tourIndex = 0, tourTimer, orbitFrame, lastOrbitTime, noticeTimer;
const featureCollection = features => ({type:'FeatureCollection',features});
const pointFeature = p => ({type:'Feature',properties:{...p,coordinates:undefined},geometry:{type:'Point',coordinates:p.coordinates}});
const lazyLayers = new Set();
async function ensureLayerData(key){const names={contours:['contours','data/curvas.geojson'],osm:['osm','data/ferrocarriles-osm.geojson'],departments:['departments','data/departamentos.geojson']};if(!names[key]||lazyLayers.has(key))return;lazyLayers.add(key);try{const [id,url]=names[key];map.getSource(id).setData(await getJSON(url));if(key==='departments')map.getSource('department-points').setData(await getJSON('data/etiquetas-departamentos.geojson'));}catch(e){lazyLayers.delete(key);notify('No se pudo cargar la capa solicitada: '+e.message);}}
const getJSON = async p => {const r=await fetch(p+(p.includes('?')?'&':'?')+'v=8');if(!r.ok)throw new Error(`${p}: HTTP ${r.status}`);return r.json();};
function notify(message,ms=6500){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);if(ms)noticeTimer=setTimeout(()=>$('notice').hidden=true,ms);}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function distance(a,b){const r=Math.PI/180;const dLat=(b[1]-a[1])*r,dLon=(b[0]-a[0])*r;const h=Math.sin(dLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLon/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function elevationAt(p){
 if(!grid)return null;
 const n=2**gridMeta.zoom*256;
 const x=(((p[0]+180)/360*n)-gridMeta.tileX*256-gridMeta.pixelCenter)/gridMeta.stride;
 const y=(((1-Math.asinh(Math.tan(p[1]*Math.PI/180))/Math.PI)/2*n)-gridMeta.tileY*256-gridMeta.pixelCenter)/gridMeta.stride;
 const i=Math.floor(x),j=Math.floor(y),w=gridMeta.width,h=gridMeta.height;
 if(i<0||j<0||i>=w-1||j>=h-1)return null;
 const u=x-i,v=y-j;
 return Math.max(0,grid[j*w+i]*(1-u)*(1-v)+grid[j*w+i+1]*u*(1-v)+grid[(j+1)*w+i]*(1-u)*v+grid[(j+1)*w+i+1]*u*v);
}
function boundsOf(coords){return coords.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds());}
async function tileProtocol(params,abortController){
 const u=new URL(params.url),kind=u.hostname;let [z,x,y]=u.pathname.slice(1).split('/').map(Number);const target=[z,x,y];
 while(z>=6){const c=coverage[z];if(c&&x>=c[0]&&x<=c[2]&&y>=c[1]&&y<=c[3])break;z--;x=Math.floor(x/2);y=Math.floor(y/2);}
 if(z<6)throw new Error('Fuera de la cobertura local del relieve.');
 const r=await fetch(`${baseURL}data/${kind}/${z}/${x}/${y}.png`,{signal:abortController.signal});
 if(!r.ok)throw new Error(`Tesela local no disponible: ${z}/${x}/${y}`);
 if(z===target[0])return {data:await r.arrayBuffer()};
 // Fuera del corredor detallado se remuestrea z10; esto no añade resolución real.
 const bitmap=await createImageBitmap(await r.blob());const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d');const scale=2**(target[0]-z),side=256/scale;
 ctx.imageSmoothingEnabled=kind!=='terreno';ctx.drawImage(bitmap,(target[1]-x*scale)*side,(target[2]-y*scale)*side,side,side,0,0,256,256);bitmap.close();return {data:await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer()};
}
function textLayout(field,size=11){return {'text-field':field,'text-font':['Noto Sans Regular'],'text-size':size,'text-variable-anchor':['top','bottom','left','right'],'text-radial-offset':.8,'text-justify':'auto','text-max-width':13,'text-padding':5};}
function addGeoSource(id,data){map.addSource(id,{type:'geojson',data,tolerance:1,maxzoom:13,buffer:64});}
function addLayers(hydro,contours,osm,borders){
 addGeoSource('hydro',hydro);
 map.addLayer({id:'water',type:'fill',source:'hydro',filter:['==',['get','kind'],'water'],paint:{'fill-color':'#548d9b','fill-opacity':.88}});
 map.addLayer({id:'water-edge',type:'line',source:'hydro',filter:['==',['get','kind'],'water'],paint:{'line-color':'#477f8d','line-width':.7}});
 map.addLayer({id:'rivers',type:'line',source:'hydro',filter:['==',['get','kind'],'river'],paint:{'line-color':'#4f8b94','line-width':['interpolate',['linear'],['zoom'],9,.5,14,1.9],'line-opacity':.74}});
 addGeoSource('contours',contours);
 map.addLayer({id:'contours',type:'line',source:'contours',layout:{visibility:'none'},paint:{'line-color':'#4d6348','line-opacity':['case',['==',['get','major'],1],.57,.26],'line-width':['case',['==',['get','major'],1],1,.5]}});
 map.addLayer({id:'contour-labels',type:'symbol',source:'contours',minzoom:11,filter:['==',['get','major'],1],layout:{'symbol-placement':'line','text-field':['concat',['to-string',['get','elevation']],' m'],'text-font':['Noto Sans Regular'],'text-size':9,'symbol-spacing':380,visibility:'none'},paint:{'text-color':'#475d43','text-halo-color':'#e7e4cf','text-halo-width':1}});
 addGeoSource('osm',osm);
 map.addLayer({id:'osm',type:'line',source:'osm',layout:{visibility:'none'},paint:{'line-color':'#668999','line-width':1.8,'line-opacity':.8}});
 addGeoSource('borders',borders);
 map.addLayer({id:'border-halo',type:'line',source:'borders',paint:{'line-color':'#faf2d9','line-width':4.8,'line-opacity':.9}});
 map.addLayer({id:'borders',type:'line',source:'borders',paint:{'line-color':'#514a6c','line-width':2.3,'line-dasharray':[4,1.7]}});
 addGeoSource('departments',featureCollection([]));
 addGeoSource('department-points',featureCollection([]));
 map.addLayer({id:'department-fill',type:'fill',source:'departments',paint:{'fill-color':['coalesce',['get','color'],'#b1ac88'],'fill-opacity':.16}});
 map.addLayer({id:'departments',type:'line',source:'departments',layout:{visibility:'none'},paint:{'line-color':'#8c665b','line-width':1.2,'line-dasharray':[3,2],'line-opacity':.8}});
 map.addLayer({id:'department-labels',type:'symbol',source:'department-points',layout:{...textLayout(['concat','Dpto. ',['get','name']],11),visibility:'none'},paint:{'text-color':'#705751','text-halo-color':'#f3efd9','text-halo-width':1.4}});
 addGeoSource('city-points',featureCollection(cities.map(pointFeature)));
 map.addLayer({id:'city-circles',type:'circle',source:'city-points',paint:{'circle-radius':['case',['get','capital'],4,2.7],'circle-color':'#703e48','circle-stroke-color':'#fff4df','circle-stroke-width':1.4}});
 map.addLayer({id:'city-labels',type:'symbol',source:'city-points',layout:{...textLayout(['concat',['get','name'],' · 1911'],12),'symbol-sort-key':['case',['get','capital'],0,1]},paint:{'text-color':'#62323b','text-halo-color':'#f8f0d9','text-halo-width':1.7}});
 addGeoSource('historic',segments);
 map.addLayer({id:'rail-casing',type:'line',source:'historic',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#fff6d8','line-width':5,'line-opacity':.8}});
 map.addLayer({id:'rail',type:'line',source:'historic',filter:['==',['get','basis'],'osm'],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#a4632c','line-width':2.5,'line-dasharray':[3,1.3]}});
 addGeoSource('selected-route',featureCollection([]));
 map.addLayer({id:'selected-route',type:'line',source:'selected-route',filter:['==',['get','basis'],'osm'],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#e3a14c','line-width':3.3,'line-dasharray':[3,1.3]}});
 map.addLayer({id:'rail-uncertain',type:'line',source:'historic',filter:['==',['get','basis'],'interpolated'],paint:{'line-color':'#97516b','line-width':3,'line-dasharray':[1,2]}});
 map.addLayer({id:'rail-hit',type:'line',source:'historic',paint:{'line-width':18,'line-opacity':0}});
 addGeoSource('station-points',featureCollection(stations.map(s=>pointFeature({...s,type:'station'}))));
 map.addLayer({id:'station-circles',type:'circle',source:'station-points',paint:{'circle-radius':['case',['==',['get','kind'],'Terminal'],5,4],'circle-color':'#fff7df','circle-stroke-color':'#80532c','circle-stroke-width':2.2}});
 map.addLayer({id:'station-labels',type:'symbol',source:'station-points',layout:textLayout(['concat','Est. ',['get','name']],10.5),paint:{'text-color':'#294632','text-halo-color':'#f2eedc','text-halo-width':1.5}});
 addGeoSource('natural-points',featureCollection(places.filter(p=>p.type==='natural').map(pointFeature)));
 map.addLayer({id:'natural-circles',type:'circle',source:'natural-points',paint:{'circle-radius':3,'circle-color':['case',['in',['get','kind'],['literal',['Laguna','Lago en caldera','Costa']]],'#4a8292','#46613b'],'circle-stroke-color':'#f4eedc','circle-stroke-width':1}});
 map.addLayer({id:'natural-labels',type:'symbol',source:'natural-points',layout:textLayout(['get','name'],11),paint:{'text-color':'#314a32','text-halo-color':'#eee9d3','text-halo-width':1.4}});
 addGeoSource('place-points',featureCollection(places.filter(p=>p.type==='place'&&!stations.some(s=>s.name===p.name)).map(pointFeature)));
 map.addLayer({id:'place-labels',type:'symbol',source:'place-points',minzoom:10.8,layout:textLayout(['get','name'],10),paint:{'text-color':'#4c614b','text-halo-color':'#f2eedc','text-halo-width':1.2}});
 map.addLayer({id:'river-labels',type:'symbol',source:'hydro',minzoom:11,filter:['all',['==',['get','kind'],'river'],['!=',['get','name'],'']],layout:{...textLayout(['get','name'],9),'symbol-placement':'line','symbol-spacing':500},paint:{'text-color':'#3d7888','text-halo-color':'#efefdc','text-halo-width':1}});
 addGeoSource('selection',featureCollection([]));map.addLayer({id:'selection',type:'circle',source:'selection',paint:{'circle-radius':10,'circle-color':'#efb45a','circle-opacity':.3,'circle-stroke-width':2,'circle-stroke-color':'#83512b'}});
 addGeoSource('measure',featureCollection([]));map.addLayer({id:'measure-line',type:'line',source:'measure',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#274f65','line-width':2,'line-dasharray':[2,1]}});map.addLayer({id:'measure-points',type:'circle',source:'measure',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#274f65','circle-stroke-color':'#fff','circle-stroke-width':2}});
 map.moveLayer('city-labels');
}
function buildUI(){
 $('routes').innerHTML=routes.features.map((f,i)=>`<button class="route ${i?'':'active'}" data-route="${f.properties.id}" aria-pressed="${i?'false':'true'}"><i></i><span>${escapeHTML(f.properties.name)}</span><small>${f.properties.stationIds.length} paradas</small></button>`).join('');
 $('routes').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b)selectRoute(b.dataset.route,true);});
 const views=[['volcanes','Volcanes de occidente','▲','01',[-89.612,13.842],12,67,-21],['coatepeque-lago','Caldera de Coatepeque','≈','02',[-89.549,13.869],12.2,67,25],['sansalvador-volcan','El Boquerón','▲','03',[-89.294,13.734],12.3,70,-35],['costa','Costa de Acajutla','≈','04',[-89.814,13.608],12.1,65,26]];
 $('viewpoints').innerHTML=views.map(v=>`<button class="viewpoint" data-view="${v[0]}"><span class="v-icon">${v[2]}</span><small>${v[3]} ↗</small><strong>${v[1]}</strong></button>`).join('');
 $('viewpoints').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;const v=views.find(v=>v[0]===b.dataset.view);stopMotion();map.flyTo({center:v[4],zoom:v[5],pitch:v[6],bearing:v[7],duration:1800});};
 const toggles=[['borders','Fronteras y costa · Natural Earth'],['departments','Límites departamentales · 2021'],['departmentFill','Color suave por departamento'],['rail','Itinerarios históricos aproximados'],['stations','18 estaciones del mapa'],['nature','Volcanes, sierras y lagos'],['cities','Ciudades y puertos documentados · 1911'],['places','Poblaciones modernas de referencia'],['hydro','Ríos y cuerpos de agua · OSM'],['contours','Curvas de nivel · cada 100 m'],['osm','Trazas ferroviarias modernas · OSM'],['labels','Nombres en el mapa']];
 $('layerToggles').innerHTML=toggles.map(([k,l])=>`<label class="toggle-row" for="layer-${k}">${l}<input id="layer-${k}" type="checkbox" ${state.layers[k]?'checked':''} data-layer="${k}"></label>`).join('');
 $('layerToggles').onchange=e=>{state.layers[e.target.dataset.layer]=e.target.checked;if(e.target.checked)ensureLayerData(e.target.dataset.layer);applyVisibility();};
 $('sourcesContent').innerHTML=`<p>Consulta de fuentes: <strong>15 de octubre de 2026</strong>. Este visor es una reconstrucción exploratoria del corredor occidental y central; no es un levantamiento ferroviario de precisión.</p>
 <h3>01 / Documento histórico</h3><p>Percy F. Martin, <em>Salvador of the Twentieth Century</em> (1911), capítulo XV, pp. 196–200; lámina del Salvador Railway frente a la p. 198. <a href="https://www.gutenberg.org/files/45102/45102-h/45102-h.htm#Page_197" target="_blank" rel="noreferrer">Texto y mapa en Project Gutenberg ↗</a>. Las 18 estaciones se transcriben de la lámina. Martin describe unos 155 km de red; esa cifra documental no se sustituye por la longitud de los trazos digitales.</p>
 <h3>Ciudades y puertos de la época</h3><p>Se incluyen las 27 ciudades enumeradas por Martin y los puertos de Acajutla y La Libertad: 29 puntos, con las 14 cabeceras departamentales de la tabla de la p. 247. Cada ficha enlaza su página; se conservan Nueva San Salvador (Santa Tecla), Opico, Gotera y Santa Rosa según el uso del libro. No es un ranking demográfico: las cifras del libro son estimaciones de fechas diversas y no se trasladan al visor. Los puntos proceden del <a href="https://download.geonames.org/export/dump/readme.txt" target="_blank" rel="noreferrer">catálogo moderno GeoNames (CC BY 4.0) ↗</a>, consulta 15/10/2026, y no representan la mancha urbana de 1911. La capa de poblaciones modernas está desactivada inicialmente.</p><h3>02 / Elevación real</h3><p><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen Terrain Tiles en AWS ↗</a>, codificación Terrarium. SRTM en esta región: información nominal de 30 m, con las limitaciones indicadas por el proveedor (calidad nominal de 90 m). Teselas de visualización z12 de aproximadamente 37 m/píxel en el corredor; la malla que dibuja el navegador puede ser más generalizada. Consultas y perfil: rejilla remuestreada a unos 74 m. Curvas cada 100 m calculadas sobre una rejilla de unos 148 m. Fuera del corredor se utiliza z10, alrededor de 148 m/píxel.</p><p>El relieve conserva sus coordenadas geográficas; los colores son tintas de elevación, no uso del suelo. La exageración vertical inicia en 1,5× y puede volver a 1×. Los valores negativos del DEM marino se llevan a 0 m para la escena, conservando las teselas originales. No se modelan profundidad de lagos ni batimetría.</p>
 <h3>03 / Geografía e historia natural</h3><p><a href="https://www.snet.gob.sv/ver/geologia/geologia+de+el+salvador/" target="_blank" rel="noreferrer">MARN/SNET, Geología de El Salvador ↗</a> y <a href="https://www.snet.gob.sv/Geologia/Vulcanologia/amenazas/MAPAVSA.pdf" target="_blank" rel="noreferrer">complejo Izalco–Santa Ana–Coatepeque ↗</a>. Coordenadas y cotas de catálogo volcánico: <a href="https://volcano.si.edu/volcano.cfm?vn=343020" target="_blank" rel="noreferrer">Smithsonian GVP ↗</a>. Se diferencia la cota de catálogo del suelo leído del DEM. Izalco: GVP 1.950 m; MARN 1.965 m. El DEM mezcla datos modernos y no reconstruye el paisaje de 1911.</p>
 <h3>04 / Vías, poblaciones y agua</h3><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL ↗</a>, consultas Overpass guardadas con su fecha de base. ${fmt(197)} segmentos de vías de referencia y ${fmt(981)} elementos de hidrografía en el recorte. Estas geometrías pueden estar incompletas y no prueban la situación en 1911. Los ríos conservan los nombres actuales; la lámina permite revisar variantes históricas.</p>
 <h3>05 / Cómo se reconstruyó la ruta</h3><p>Los tres itinerarios respetan la conectividad representada en Martin. Se usa la geometría de los corredores OSM donde hay continuidad y los huecos se muestran con puntos morados como conexiones sin confirmar. <strong>Todo el itinerario naranja es aproximado</strong>, incluidos los tramos apoyados en OSM: no se certifica su alineación de 1911. La Ceiba y los apeaderos menores requieren planos catastrales o levantamiento adicional. Santa Tecla se muestra como población, no como terminal del ferrocarril.</p><p>La distancia digital usa segmentos geodésicos WGS84 y la elevación procede del suelo moderno bajo el trazado, sin corregir puentes, cortes ni terraplenes. No es una rasante ferroviaria ni debe usarse para calcular pendientes de operación. Los puntos de estación se proyectan sobre el segmento más próximo del corredor OSM a partir de anclajes orientativos; se conserva el anclaje original y el desplazamiento en cada registro. Es una colocación gráfica, no la ubicación comprobada del edificio. Los círculos de ciudad conservan su referencia GeoNames: la vía no tiene que atravesar el centro de cada localidad. Dos huecos entre Armenia–Ateos y Ateos–Sitio del Niño se conectan entre extremos OSM identificados (unos 633 y 2.095 m), sin sustituir toda la etapa por una recta. Estos enlaces siguen sin verificar.</p>
 <h3>06 / Fronteras y departamentos</h3><p>Contorno terrestre y costa: Natural Earth Admin 0 Countries, escala 1:10 millones (dominio público), consulta 15/10/2026. Límites departamentales modernos de referencia: <a href="https://www.geoboundaries.org/api/current/gbOpen/SLV/ADM0/" target="_blank" rel="noreferrer">geoBoundaries gbOpen / Open Street Map ↗</a>, año representado 2021, compilación de diciembre de 2023; consulta 15/10/2026. El contorno terrestre representa las fronteras con Guatemala y Honduras y la costa; es una referencia generalizada, no una delimitación de detalle. La geometría ADM0 de geoBoundaries conservada en evidencia no se muestra porque incluye un tramo marino. Los 14 departamentos se cargan en la vista inicial y sus colores se pueden desactivar. Licencia declarada en estos conjuntos: CC BY-SA 2.0. No representan las fronteras de 1911 ni delimitaciones marítimas.</p><h3>07 / Capas en línea y créditos</h3><p>MapLibre GL JS 5.6.2 (BSD-3-Clause). Relieve: Mapzen, USGS, NASA y proveedores de Terrain Tiles; <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">atribuciones del conjunto ↗</a>. Satélite: Esri World Imagery y sus proveedores; fechas y resolución variables. Calles: © OpenStreetMap contributors. El núcleo de relieve, rutas, etiquetas e hidrografía funciona sin conexión una vez servido localmente. Las capas satélite y calles requieren Internet.</p><p><a href="README.md" target="_blank">Metodología y archivos locales ↗</a> · <a href="data/rutas-historicas.geojson" download>Rutas y procedencia GeoJSON ↗</a> · <a href="data/estaciones.json" download>Inventario de estaciones ↗</a></p>`;
 renderPlaces();
}
function renderPlaces(){
 const q=$('search').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filtered=points.filter(p=>(state.filter==='all'||p.type===state.filter)&&p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));
 $('placeCount').textContent=`${filtered.length} lugares`;
 $('placeList').innerHTML=filtered.length?filtered.map(p=>`<button class="place-row ${state.selected===p.id?'selected':''}" data-place="${p.id}"><span class="place-icon">${p.type==='station'?'⊙':p.type==='natural'?'△':p.type==='historic-city'?'◆':'·'}</span><span class="place-name">${p.type==='station'?'Est. ':p.type==='place'?'Actual · ':p.type==='historic-city'?'1911 · ':''}${escapeHTML(p.name)}</span><small>${p.type==='station'?'≈':p.referenceElevation?fmt(p.referenceElevation)+' m':'↗'}</small></button>`).join(''):'<p class="no-results">No hay coincidencias. Prueba otro nombre o cambia el filtro.</p>';
}
function selectPlace(id,fly=true){
 const p=points.find(p=>p.id===id);if(!p)return;
 state.selected=id;stopMotion();$('detail').hidden=false;$('detailKind').textContent=p.kind;$('detailTitle').textContent=p.type==='station'?'Estación de '+p.name:p.name;$('detailText').textContent=p.description;
 const z=elevationAt(p.coordinates);$('detailElevation').innerHTML=(p.referenceElevation!=null?`${fmt(p.referenceElevation)} m<small>Cota de referencia documental</small>`:'')+(z!=null?`<span style="font-size:${p.referenceElevation!=null?'15':'23'}px">${p.referenceElevation!=null?'<br>':''}≈ ${fmt(z)} m</span><small>Suelo en el punto · DEM moderno</small>`:'<small>Fuera de la rejilla de consulta detallada.</small>');
 $('detailStation').hidden=true;
 if(p.type==='historic-city'){
  $('detailText').textContent+=' Este punto representa la localidad, no una estación ferroviaria.';
  const station=stations.find(s=>s.name===p.name);
  if(station){$('detailStation').hidden=false;$('detailStation').textContent=`Ver estación en el corredor ↗`;$('detailStation').onclick=()=>selectPlace(station.id);}
 }
 if(p.type==='station'){
  if(!routes.features.find(r=>r.properties.id===state.route).properties.stationIds.includes(p.id))selectRoute(routes.features.find(r=>r.properties.stationIds.includes(p.id)).properties.id);
  const stop=routeStops.find(s=>s.id===p.id);setRouteDistance(stop.d);tourIndex=Math.round(stop.d/routeCum.at(-1)*420);
 }
 $('detailPrecision').textContent=p.precision;$('detailSource').href=p.sourceUrl;$('detailSource').textContent=p.source+' ↗';$('detailFly').onclick=()=>map.flyTo({center:p.coordinates,zoom:p.type==='natural'?12.7:13.2,pitch:65,offset:[0,-100],duration:1600});
 map.getSource('selection').setData(featureCollection([pointFeature(p)]));if(fly)map.flyTo({center:p.coordinates,zoom:p.type==='natural'?11.9:12.3,pitch:58,offset:[0,-100],duration:1400});renderPlaces();if(innerWidth<681){document.body.classList.add('sidebar-collapsed');$('toggleSidebar').setAttribute('aria-expanded','false');map.resize();}
}
function applyVisibility(){
 const vis=(id,value)=>map.setLayoutProperty(id,'visibility',value?'visible':'none');const l=state.layers;
 for(const id of ['rail-casing','rail','selected-route','rail-uncertain','rail-hit'])vis(id,l.rail);
 profileMarker.getElement().hidden=!l.rail;vis('station-circles',l.stations);vis('station-labels',l.stations&&l.labels);vis('natural-circles',l.nature);vis('natural-labels',l.nature&&l.labels);vis('place-labels',l.places&&l.labels);vis('city-circles',l.cities);vis('city-labels',l.cities&&l.labels);
 for(const id of ['water','water-edge','rivers'])vis(id,l.hydro);vis('river-labels',l.hydro&&l.labels);vis('contours',l.contours);vis('contour-labels',l.contours&&l.labels);vis('osm',l.osm);vis('border-halo',l.borders);vis('borders',l.borders);vis('departments',l.departments);vis('department-fill',l.departments&&l.departmentFill);vis('department-labels',l.departments&&l.labels);
}
function buildProfile(route){
 const c=route.geometry.coordinates,cum=[0];for(let i=1;i<c.length;i++)cum.push(cum[i-1]+distance(c[i-1],c[i]));const total=cum.at(-1);const result=[];let j=1;
 for(let i=0;i<=420;i++){const d=total*i/420;while(j<cum.length-1&&cum[j]<d)j++;const t=(d-cum[j-1])/(cum[j]-cum[j-1]||1);const p=c[j-1].map((v,k)=>v+(c[j][k]-v)*t);result.push({p,d,z:elevationAt(p)});}
 return result;
}
function drawProfile(){
 const samples=profileSamples;if(!samples.length)return;
 const w=Math.max(200,$('profileChart').clientWidth),h=66,pad=31;const vals=samples.map(p=>p.z).filter(v=>v!=null),top=Math.max(100,Math.ceil(Math.max(...vals)/200)*200);const total=samples.at(-1).d;
 const xy=samples.map(s=>[pad+s.d/total*(w-pad-7),h-16-(s.z??0)/top*(h-22)]);const line=xy.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
 $('profileChart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aab7a" stop-opacity=".65"/><stop offset="1" stop-color="#c5cda4" stop-opacity=".12"/></linearGradient></defs><line x1="${pad}" y1="${h-16}" x2="${w-7}" y2="${h-16}" stroke="#c6cfba"/><path d="${line} L${w-7},${h-16} L${pad},${h-16} Z" fill="url(#profileFill)"/><path d="${line}" fill="none" stroke="#6b8055" stroke-width="1.4"/><text x="0" y="11" fill="#7c8a71" font-size="8">${fmt(top)}</text><text x="8" y="${h-15}" fill="#7c8a71" font-size="8">0</text>${[0,.25,.5,.75,1].map(t=>`<text x="${pad+t*(w-pad-7)}" y="${h-2}" text-anchor="${t===1?'end':'start'}" fill="#7c8a71" font-size="8">${fmt(total*t/1000,0)} km</text>`).join('')}<line id="profileCursor" class="profile-cursor" x1="0" x2="0" y1="4" y2="${h-16}" visibility="hidden"/></svg>`;
 $('profileDistance').textContent=`≈ ${fmt(total/1000,1)} km de trazo digital`;$('profileRange').textContent=`Suelo: ${fmt(Math.min(...vals))}–${fmt(Math.max(...vals))} m`;
}
function setRouteDistance(d){
 if(!routeCoords.length)return;
 const s=RouteGeometry.atDistance(routeCoords,routeCum,d);s.z=elevationAt(s.p);routeDistance=s.d;tourIndex=Math.round(s.d/routeCum.at(-1)*420);
 const total=routeCum.at(-1),w=$('profileChart').clientWidth,x=31+s.d/total*(w-38),line=$('profileCursor');
 if(line){line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('visibility','visible');}
 $('profileReadout').textContent=`${fmt(s.d/1000,1)} km · ${s.z!=null?'≈ '+fmt(s.z)+' m s. n. m.':'sin dato'} · ${fmt(s.p[1],4)}° N, ${fmt(Math.abs(s.p[0]),4)}° O`;
 $('routePosition').textContent=`${fmt(s.d/1000,1)} / ${fmt(total/1000,1)} km`;
 $('routeProgress').value=Math.round(s.d/total*1000);$('routeProgress').setAttribute('aria-valuetext',`${fmt(s.d/1000,1)} kilómetros de ${fmt(total/1000,1)}`);
 let n=routeStops.findIndex(p=>p.d>s.d+1);if(n<0)n=routeStops.length-1;
 const exact=routeStops.find(p=>Math.abs(p.d-s.d)<1);
 const section=routeSections.find(p=>s.d>=p.start-0.1&&s.d<p.end-0.1)||routeSections.at(-1);
 $('routeSegment').textContent=(exact?exact.name:`${routeStops[Math.max(0,n-1)].name} → ${routeStops[n].name}`)+(section?.basis==='interpolated'?' · conexión sin confirmar':' · corredor OSM, aproximado');
 $('routeStop').value=exact?.id||'';profileMarker.setLngLat(s.p).addTo(map);
 const look=RouteGeometry.atDistance(routeCoords,routeCum,Math.min(total,s.d+40)).p;
 if(!state.tour&&s.d<total-1){const heading=Math.atan2((look[0]-s.p[0])*Math.cos(s.p[1]*Math.PI/180),look[1]-s.p[1])*180/Math.PI;profileMarker.setRotation(heading);}
 profileMarker.getElement().title=`Locomotora · ${fmt(s.d/1000,1)} km`;
 if(!state.tour)$('trainStatus').textContent=`Detenido · ${fmt(s.d/1000,1)} km`;
 return s;
}
function profileAtIndex(i){return setRouteDistance(routeCum.at(-1)*Math.max(0,Math.min(420,i))/420);}
function centerRoutePoint(){stopMotion();const s=setRouteDistance(routeDistance);map.easeTo({center:s.p,zoom:Math.max(12.5,map.getZoom()),offset:[0,-Math.min(130,$('profile').clientHeight/2)],duration:700});}
function selectRoute(id,fly=false){
 const r=routes.features.find(r=>r.properties.id===id);if(!r)return;
 stopMotion();state.route=id;map.getSource('selected-route').setData(featureCollection(segments.features.filter(f=>f.properties.routeId===id)));$('profileTitle').textContent=r.properties.name;
 routeCoords=r.geometry.coordinates;routeCum=RouteGeometry.cumulative(routeCoords);
 routeStops=r.properties.stationIds.map(id=>{const p=stations.find(p=>p.id===id);return {...p,d:RouteGeometry.project(p.coordinates,routeCoords,routeCum).d};});
 let sectionDistance=0;routeSections=segments.features.filter(f=>f.properties.routeId===id).map(f=>{const start=sectionDistance;sectionDistance+=RouteGeometry.cumulative(f.geometry.coordinates).at(-1);return {start,end:sectionDistance,basis:f.properties.basis};});
 $('routeStop').innerHTML='<option value="">Ir a una parada…</option>'+routeStops.map(p=>`<option value="${p.id}">${escapeHTML(p.name)} · ${fmt(p.d/1000,1)} km</option>`).join('');
 document.querySelectorAll('[data-route]').forEach(b=>{b.classList.toggle('active',b.dataset.route===id);b.setAttribute('aria-pressed',String(b.dataset.route===id));});profileSamples=buildProfile(r);tourIndex=0;drawProfile();setRouteDistance(0);
 if(fly)map.fitBounds(boundsOf(routeCoords),{padding:{top:70,bottom:Math.min(340,map.getContainer().clientHeight*.43),left:40,right:55},pitch:50,duration:1700,maxZoom:12.5});
}
function stopTour(){state.tour=false;clearTimeout(tourTimer);cancelAnimationFrame(trainFrame);trainLastTime=0;$('trainStatus').textContent=`Detenido · ${fmt(routeDistance/1000,1)} km`;$('tourButton').textContent='▷ Recorrer ruta';$('tourButton').setAttribute('aria-pressed','false');}
function stopOrbit(){state.orbit=false;cancelAnimationFrame(orbitFrame);$('orbit').classList.remove('active');$('orbit').setAttribute('aria-pressed','false');}
function stopMotion(){stopTour();stopOrbit();map?.stop();}
// Movimiento por tiempo real a lo largo de cada segmento; máximo 30 actualizaciones/s.
function trainStep(time){
 if(!state.tour)return;
 if(!trainLastTime){trainLastTime=time;trainFrame=requestAnimationFrame(trainStep);return;}
 const elapsed=time-trainLastTime;
 if(elapsed<1000/30){trainFrame=requestAnimationFrame(trainStep);return;}
 trainLastTime=time;
 const dt=Math.min(elapsed/1000,.1),total=routeCum.at(-1);
 const s=setRouteDistance(Math.min(total,routeDistance+300*state.trainSpeed*dt));
 const look=RouteGeometry.atDistance(routeCoords,routeCum,Math.min(total,s.d+120)).p;
 const heading=Math.atan2((look[0]-s.p[0])*Math.cos(s.p[1]*Math.PI/180),look[1]-s.p[1])*180/Math.PI;
 const turn=((heading-trainHeading+540)%360)-180;
 trainHeading+=turn*(1-Math.exp(-dt/1.2));profileMarker.setRotation(trainHeading);
 $('trainStatus').textContent=`En marcha · ${fmt(state.trainSpeed,1)}×`;
 if(state.followTrain)map.easeTo({center:s.p,bearing:trainHeading,zoom:13,pitch:60,offset:[0,-Math.min(130,$('profile').clientHeight/2)],duration:0});
 if(s.d>=total){stopTour();$('trainStatus').textContent='Llegada al final de la ruta';return;}
 trainFrame=requestAnimationFrame(trainStep);
}
function startTrain(){
 stopOrbit();if(routeDistance>=routeCum.at(-1)-1)setRouteDistance(0);
 state.tour=true;$('trainStatus').textContent='Preparando recorrido…';trainLastTime=0;trainHeading=map.getBearing();$('tourButton').textContent='Ⅱ Pausar recorrido';$('tourButton').setAttribute('aria-pressed','true');
 if(state.followTrain){const s=setRouteDistance(routeDistance);map.easeTo({center:s.p,zoom:13,pitch:60,offset:[0,-Math.min(130,$('profile').clientHeight/2)],duration:1100});tourTimer=setTimeout(()=>{if(state.tour)trainFrame=requestAnimationFrame(trainStep);},1150);}
 else trainFrame=requestAnimationFrame(trainStep);
}
function startOrbit(t){if(!state.orbit)return;if(lastOrbitTime){map.jumpTo({bearing:map.getBearing()+Math.min(t-lastOrbitTime,100)*.0035});}lastOrbitTime=t;orbitFrame=requestAnimationFrame(startOrbit);}
function setBase(base){
 if(base!=='relief'&&!navigator.onLine){notify('Sin conexión: el relieve local sigue disponible.');return;}
 state.base=base;map.setLayoutProperty('tintas','visibility',base==='relief'?'visible':'none');
 for(const id of ['satellite','street']){
  if(!map.getSource(id))map.addSource(id,{type:'raster',tiles:[id==='satellite'?'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:id==='satellite'?19:19,attribution:id==='satellite'?'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community':'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
  if(!map.getLayer(id))map.addLayer({id,type:'raster',source:id,layout:{visibility:base===id?'visible':'none'},paint:{'raster-fade-duration':180}},'water');else map.setLayoutProperty(id,'visibility',base===id?'visible':'none');
 }
 $('mapMode').textContent=base==='relief'?(state.terrain?'RELIEVE 3D':'RELIEVE 2D'):base==='satellite'?'SATÉLITE MODERNO':'CALLES MODERNAS';document.querySelectorAll('[data-base]').forEach(b=>{b.classList.toggle('active',b.dataset.base===base);b.setAttribute('aria-pressed',String(b.dataset.base===base));});if(base!=='relief')notify('Capa moderna en línea; no representa el paisaje de 1911.',4000);
}
function updateMeasurement(){const pp=state.measurePoints,features=pp.map(p=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}}));if(pp.length===2)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:pp}});map.getSource('measure').setData(featureCollection(features));if(measurePopup)measurePopup.remove();if(pp.length===2){const midpoint=pp[0].map((v,i)=>(v+pp[1][i])/2);measurePopup=new maplibregl.Popup({closeButton:false,closeOnClick:false}).setLngLat(midpoint).setText(`${fmt(distance(pp[0],pp[1])/1000,2)} km · horizontal`).addTo(map);notify('Medición geodésica horizontal. Marca otro punto para empezar de nuevo.',4500);}}
function bindEvents(){
 $('search').oninput=renderPlaces;$('placeList').onclick=e=>{const b=e.target.closest('[data-place]');if(b)selectPlace(b.dataset.place);};
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderPlaces();});
 for(const [tab,panel] of [['tab-explore','explorePanel'],['tab-layers','layersPanel']])$(tab).onclick=()=>{for(const [t,p] of [['tab-explore','explorePanel'],['tab-layers','layersPanel']]){$(t).setAttribute('aria-selected',String(tab===t));$(p).hidden=panel!==p;}};
 document.querySelectorAll('[role=tab]').forEach(b=>b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const other=b.id==='tab-explore'?$('tab-layers'):$('tab-explore');other.click();other.focus();}});
 $('baseOptions').onclick=e=>{const b=e.target.closest('[data-base]');if(b)setBase(b.dataset.base);};
 let heightTimer;$('exaggeration').oninput=e=>{state.exaggeration=Number(e.target.value);$('exaggerationValue').textContent=fmt(state.exaggeration,1)+'×';clearTimeout(heightTimer);heightTimer=setTimeout(()=>{if(state.terrain)map.setTerrain({source:'dem',exaggeration:state.exaggeration});},140);};
 $('pitch').oninput=e=>{stopMotion();map.setPitch(Number(e.target.value));};$('quality').oninput=e=>{const ratio=Number(e.target.value);qualityRatio=ratio;$('qualityValue').textContent=fmt(ratio,2)+'×';setDrawingQuality(map.isMoving()?Math.min(1,ratio):ratio);};
 // Resolución alta en reposo; reducir solo durante movimiento real. El guard
 // evita que resize() convierta el ajuste en un nuevo movimiento de cámara.
 map.on('movestart',()=>{if(changingQuality)return;clearTimeout(qualityTimer);setDrawingQuality(Math.min(1,qualityRatio));});
 map.on('moveend',()=>{if(changingQuality)return;clearTimeout(qualityTimer);qualityTimer=setTimeout(()=>{if(!map.isMoving())setDrawingQuality(qualityRatio);},160);});
 map.on('pitch',()=>{$('pitchValue').textContent=fmt(map.getPitch())+'°';$('pitch').value=map.getPitch();});
 $('closeDetail').onclick=()=>{$('detail').hidden=true;state.selected=null;map.getSource('selection').setData(featureCollection([]));renderPlaces();};
 $('resetView').onclick=()=>{stopMotion();map.flyTo({...initial,zoom:initialZoom(),duration:1500});};
 $('countryButton').onclick=()=>{stopMotion();map.fitBounds([[-90.14,13.13],[-87.69,14.45]],{padding:60,pitch:35,bearing:0,duration:1900});notify('Vista nacional. Fuera del corredor ferroviario, el DEM local tiene menor resolución; el detalle de ríos y estaciones se concentra en el corredor.');};
 $('view3d').onclick=()=>{stopMotion();state.terrain=!state.terrain;map.setTerrain(state.terrain?{source:'dem',exaggeration:state.exaggeration}:null);map.easeTo({pitch:state.terrain?58:0,duration:900});$('view3d').classList.toggle('active',state.terrain);$('view3d').setAttribute('aria-pressed',String(state.terrain));$('view3d').textContent=state.terrain?'3D':'2D';$('mapMode').textContent=state.base==='relief'?(state.terrain?'RELIEVE 3D':'RELIEVE 2D'):state.base==='satellite'?'SATÉLITE MODERNO':'CALLES MODERNAS';};
 $('orbit').onclick=()=>{if(state.orbit){stopOrbit();return;}stopTour();state.orbit=true;lastOrbitTime=null;$('orbit').classList.add('active');$('orbit').setAttribute('aria-pressed','true');orbitFrame=requestAnimationFrame(startOrbit);};
 $('tourButton').onclick=()=>{if(state.tour){stopTour();map.stop();return;}startTrain();};
 $('followTrain').onchange=e=>{state.followTrain=e.target.checked;};
 $('trainSpeed').onchange=e=>{state.trainSpeed=Number(e.target.value);};
 // map.stop() también detiene los handlers del gesto actual. El usuario debe
 // interrumpir únicamente el recorrido programado, sin cancelar su arrastre.
 for(const ev of ['dragstart','zoomstart','rotatestart','pitchstart'])map.on(ev,e=>{if(e.originalEvent){state.followTrain=false;$('followTrain').checked=false;stopOrbit();}});
 $('toggleSidebar').onclick=()=>{document.body.classList.toggle('sidebar-collapsed');$('toggleSidebar').setAttribute('aria-expanded',String(!document.body.classList.contains('sidebar-collapsed')));map.resize();drawProfile();setRouteDistance(routeDistance);};
 $('collapseProfile').onclick=()=>{const collapsed=!$('profileBody').hidden;$('profileBody').hidden=collapsed;document.body.classList.toggle('profile-collapsed',collapsed);$('collapseProfile').textContent=collapsed?'⌃':'⌄';$('collapseProfile').setAttribute('aria-expanded',String(!collapsed));if(!collapsed){drawProfile();setRouteDistance(routeDistance);}};
 $('profileChart').onclick=e=>{const r=e.currentTarget.getBoundingClientRect(),t=Math.max(0,Math.min(1,(e.clientX-r.left-31)/(r.width-38)));stopMotion();tourIndex=Math.round(t*420);setRouteDistance(t*routeCum.at(-1));};
 $('routeProgress').oninput=e=>{stopMotion();const t=Number(e.target.value)/1000;tourIndex=Math.round(t*420);setRouteDistance(t*routeCum.at(-1));};
 $('routeStop').onchange=e=>{const p=routeStops.find(p=>p.id===e.target.value);if(p){stopMotion();setRouteDistance(p.d);tourIndex=Math.round(p.d/routeCum.at(-1)*420);centerRoutePoint();}};
 $('centerRoutePoint').onclick=centerRoutePoint;
 $('profileChart').onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stopMotion();tourIndex=Math.max(0,Math.min(profileSamples.length-1,tourIndex+(e.key==='ArrowRight'?1:-1)));profileAtIndex(tourIndex);}};
 $('exportRoute').onclick=()=>{const f=routes.features.find(f=>f.properties.id===state.route);download(JSON.stringify(featureCollection([f]),null,2),`salvador-railway-${state.route}-aproximado.geojson`,'application/geo+json');};
 $('measure').onclick=()=>{state.measure=!state.measure;state.measurePoints=[];updateMeasurement();$('measure').classList.toggle('active',state.measure);$('measure').setAttribute('aria-pressed',String(state.measure));map.getCanvas().style.cursor=state.measure?'crosshair':'';if(state.measure){stopMotion();notify('Marca dos puntos en el mapa para medir su distancia horizontal.',5000);}};
 map.on('click',e=>{if(state.measure){if(state.measurePoints.length===2)state.measurePoints=[];state.measurePoints.push([e.lngLat.lng,e.lngLat.lat]);updateMeasurement();return;}const fs=map.queryRenderedFeatures(e.point,{layers:['station-circles','station-labels','natural-circles','natural-labels','place-labels','city-circles','city-labels']});if(fs.length)selectPlace(fs[0].properties.id,false);else {
 const hit=map.queryRenderedFeatures(e.point,{layers:['rail-hit']});
 if(hit.length){const id=hit[0].properties.routeId;if(id!==state.route)selectRoute(id);else stopMotion();const s=RouteGeometry.project([e.lngLat.lng,e.lngLat.lat],routeCoords,routeCum);setRouteDistance(s.d);tourIndex=Math.round(s.d/routeCum.at(-1)*420);return;}
 const hs=map.queryRenderedFeatures(e.point,{layers:['water','rivers']});if(hs[0]?.properties.name)new maplibregl.Popup().setLngLat(e.lngLat).setText(hs[0].properties.name+' · OpenStreetMap').addTo(map);}});
 let lastPointerRead=0;map.on('mousemove',e=>{const now=performance.now();if(now-lastPointerRead<100)return;lastPointerRead=now;$('coordinates').textContent=`${fmt(e.lngLat.lat,4)}° N · ${fmt(Math.abs(e.lngLat.lng),4)}° O`;const h=elevationAt([e.lngLat.lng,e.lngLat.lat]);$('elevation').textContent=h==null?'Fuera de la rejilla de consulta':`Suelo DEM: ≈ ${fmt(h)} m s. n. m.`;});
 $('snapshot').onclick=()=>{notify('Preparando captura…',0);map.once('render',()=>{try{notify('Generando imagen…',0);const canvas=document.createElement('canvas'),src=map.getCanvas();canvas.width=src.width;canvas.height=src.height+105;const ctx=canvas.getContext('2d');ctx.drawImage(src,0,0);if(state.layers.rail){const mr=profileMarker.getElement().getBoundingClientRect(),cr=src.getBoundingClientRect(),scale=src.width/cr.width;ctx.beginPath();ctx.arc((mr.x+mr.width/2-cr.x)*scale,(mr.y+mr.height/2-cr.y)*scale,10*scale,0,Math.PI*2);ctx.fillStyle='#20718d';ctx.fill();ctx.lineWidth=3*scale;ctx.strokeStyle='#fff9e7';ctx.stroke();const img=profileMarker.getElement().querySelector('img');if(img.complete&&img.naturalWidth){ctx.save();ctx.translate((mr.x+mr.width/2-cr.x)*scale,(mr.y+mr.height/2-cr.y)*scale);ctx.rotate((profileMarker.getRotation()-map.getBearing())*Math.PI/180);ctx.drawImage(img,-15*scale,-26*scale,30*scale,52*scale);ctx.restore();}}ctx.fillStyle='#f5f2e9';ctx.fillRect(0,src.height,canvas.width,105);ctx.fillStyle='#243d36';ctx.font='22px Georgia';ctx.fillText('Salvador Railway · Atlas del relieve / 1911',18,src.height+29);ctx.font='12px sans-serif';ctx.fillText('Locomotora: '+fmt(routeDistance/1000,1)+' km · Rutas aproximadas · DEM moderno · Exageración '+state.exaggeration+'× · Base: '+state.base,18,src.height+51);ctx.fillText('Relieve: Mapzen / USGS / NASA · © OSM · Límites: geoBoundaries / OSM, CC BY-SA 2.0',18,src.height+71);ctx.fillText(state.base==='satellite'?'Imágenes © Esri y proveedores · Fuente histórica: P. F. Martin (1911), p. 198':'Martin (1911): mapa p. 198 y ciudades pp. 247–313 · Georreferencia: GeoNames CC BY 4.0',18,src.height+91);canvas.toBlob(blob=>{if(blob){$('notice').hidden=true;if(captureURL)URL.revokeObjectURL(captureURL);captureURL=URL.createObjectURL(blob);$('capturePreview').src=captureURL;$('captureDownload').href=captureURL;$('captureDialog').showModal();}else notify('No se pudo generar la captura.');});}catch(e){notify('No se pudo guardar la captura: '+e.message,0);}});map.triggerRepaint();};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.map-shell').requestFullscreen();}catch{notify('Este navegador no permite pantalla completa; puedes ampliar la ventana.');}};
 document.addEventListener('fullscreenchange',()=>{map.resize();drawProfile();setRouteDistance(routeDistance);});
 for(const [button,dialog] of [['originalButton','originalDialog'],['sourcesButton','sourcesDialog'],['helpButton','helpDialog']])$(button).onclick=()=>$(dialog).showModal();
 document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
 let zoom=100;const imageZoom=d=>{zoom=Math.min(300,Math.max(100,zoom+d));$('originalImage').style.width=zoom+'%';$('imageZoom').textContent=zoom+'%';};$('imageIn').onclick=()=>imageZoom(25);$('imageOut').onclick=()=>imageZoom(-25);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});addEventListener('resize',()=>{drawProfile();setRouteDistance(routeDistance);});addEventListener('offline',()=>{if(state.base!=='relief')setBase('relief');notify('Sin conexión. El relieve y las capas históricas locales siguen disponibles.');});
}

function setDrawingQuality(ratio){
 if(map.getPixelRatio()===ratio)return;
 changingQuality=true;
 try{map.setPixelRatio(ratio);}finally{changingQuality=false;}
}
function observeNavigation(){
 let start=0,frames=0;
 const gl=map.getCanvas().getContext('webgl2')||map.getCanvas().getContext('webgl');
 const info=gl?.getExtension('WEBGL_debug_renderer_info');
 const renderer=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'';
 const backend=/swiftshader|llvmpipe|software/i.test(renderer)?'software':'WebGL';
 map.on('movestart',()=>{if(changingQuality)return;start=performance.now();frames=0;});
 map.on('render',()=>{if(start)frames++;});
 map.on('moveend',()=>{if(changingQuality||!start)return;const elapsed=performance.now()-start;if(elapsed>300&&frames>1){const fps=Math.round(frames*1000/elapsed);$('navigationStats').textContent=`Último movimiento: ${fps} fps · ${backend}`;$('navigationStats').dataset.fps=fps;$('navigationStats').dataset.renderer=renderer;}start=0;});
}

async function init(){
 try{
  [stations,places,routes,coverage,gridMeta,cities,segments]=await Promise.all(['data/estaciones.json','data/lugares.json','data/rutas-historicas.geojson','data/cobertura.json','data/relieve.json','data/ciudades-1911.json','data/tramos-historicos.geojson'].map(getJSON));
  const [buf,hydro,contours,osm,borders]=await Promise.all([fetch('data/elevaciones.i16').then(r=>{if(!r.ok)throw new Error('No se pudo leer la rejilla DEM');return r.arrayBuffer();}),getJSON('data/hidrografia-visual.geojson'),Promise.resolve(featureCollection([])),Promise.resolve(featureCollection([])),getJSON('data/frontera-nacional.geojson')]);grid=new Int16Array(buf);points=[...stations.map(s=>({...s,type:'station'})),...cities,...places];
  if(!window.maplibregl)throw new Error('No se pudo cargar el motor cartográfico local.');
  maplibregl.addProtocol('localtile',tileProtocol);
  map=new maplibregl.Map({container:'map',...initial,zoom:initialZoom(),maxPitch:80,minZoom:7,maxZoom:17,maxBounds:[[-90.29,12.96],[-87.42,14.63]],attributionControl:false,pixelRatio:1.5,renderWorldCopies:false,maxTileCacheSize:72,fadeDuration:0,canvasContextAttributes:{preserveDrawingBuffer:false,antialias:true},style:{version:8,glyphs:baseURL+'vendor/fonts/{fontstack}/{range}.pbf',sources:{tintas:{type:'raster',tiles:['localtile://sombreado/{z}/{x}/{y}'],tileSize:256,minzoom:6,maxzoom:12,attribution:'Relieve: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / USGS / NASA</a>'},dem:{type:'raster-dem',tiles:['localtile://terreno/{z}/{x}/{y}'],tileSize:256,encoding:'terrarium',minzoom:6,maxzoom:12}},layers:[{id:'background',type:'background',paint:{'background-color':'#d9dfca'}},{id:'tintas',type:'raster',source:'tintas',paint:{'raster-fade-duration':0}}],terrain:{source:'dem',exaggeration:1.5},sky:{'sky-color':'#bfd3d0','horizon-color':'#f2eddb','fog-color':'#e5e6d5','sky-horizon-blend':.7,'horizon-fog-blend':.6,'fog-ground-blend':.2}}});
  window.railwayAtlas={state,get map(){return map;},elevationAt,selectRoute,selectPlace,get profile(){return profileSamples;},get points(){return points;}};
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');map.addControl(new maplibregl.ScaleControl({maxWidth:110,unit:'metric'}),'bottom-left');map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://www.openstreetmap.org/copyright">© OSM</a> · <a href="https://www.geoboundaries.org/">geoBoundaries / OSM · CC BY-SA 2.0</a> · Natural Earth · Martin 1911 · GeoNames CC BY 4.0'}),'bottom-right');
  const markerEl=document.createElement('div');markerEl.className='route-point';markerEl.innerHTML='<img src="assets/locomotora.svg" alt="" draggable="false">';markerEl.setAttribute('aria-label','Locomotora del recorrido');markerEl.setAttribute('role','img');profileMarker=new maplibregl.Marker({element:markerEl,opacity:1,opacityWhenCovered:1,rotationAlignment:'map',pitchAlignment:'viewport'});
  map.on('load',()=>{addLayers(hydro,contours,osm,borders);buildUI();bindEvents();observeNavigation();ensureLayerData('departments');applyVisibility();$('pitch').value=map.getPitch();$('pitchValue').textContent=fmt(map.getPitch())+'°';selectRoute('principal');if(innerWidth<681){document.body.classList.add('sidebar-collapsed');$('toggleSidebar').setAttribute('aria-expanded','false');}map.resize();$('loading').hidden=true;document.body.dataset.ready='true';});
  let errorCount=0;map.on('error',e=>{console.error('Map error:',e.error);if(state.base!=='relief'&&errorCount++<2){setBase('relief');notify('La capa en línea no respondió. Se muestra el relieve local.');}else if(errorCount++<3)notify('No se pudo cargar una parte de la cartografía. Consulta la consola o vuelve a la vista inicial.');});
 }catch(e){console.error(e);$('loading').hidden=true;notify(e.message+' Usa INICIAR VISOR.command para abrir el servidor local.',0);document.body.dataset.error=e.message;}
}
init();
