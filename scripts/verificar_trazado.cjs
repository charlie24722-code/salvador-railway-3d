'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),g=require('../route-geometry.js');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const stations=read('data/estaciones.json'),routes=read('data/rutas-historicas.geojson'),segments=read('data/tramos-historicos.geojson');
const report=[];
// Una curva en L debe conservar la esquina al recorrerla; no cortar entre muestras.
const elbow=[[0,0],[.001,0],[.001,.001]],ec=g.cumulative(elbow);
assert.deepEqual(g.atDistance(elbow,ec,ec[1]).p,elbow[1]);
assert.deepEqual(g.atDistance(elbow,ec,-1).p,elbow[0]);
assert.deepEqual(g.atDistance(elbow,ec,ec[2]+1).p,elbow[2]);
assert(g.project([.0005,.0002],elbow,ec).offset>20);
for(const r of routes.features){
 const c=r.geometry.coordinates,cum=g.cumulative(c);let last=-1;
 for(const id of r.properties.stationIds){
  const s=stations.find(s=>s.id===id),p=g.project(s.coordinates,c,cum);
  assert(p.offset<.05,`${s.name}: estación fuera del trazado`);
  assert(p.d>=last,`${s.name}: orden invertido`);last=p.d;
 }
 const ss=segments.features.filter(s=>s.properties.routeId===r.properties.id);let previous=c[0],length=0;
 for(const s of ss){
  assert(g.distance(previous,s.geometry.coordinates[0])<.01,'Tramos desconectados');
  previous=s.geometry.coordinates.at(-1);length+=g.cumulative(s.geometry.coordinates).at(-1);
  if(s.properties.basis==='osm')assert(s.properties.osmWayId,'Falta procedencia OSM');
 }
 assert(g.distance(previous,c.at(-1))<.01);assert(Math.abs(length-cum.at(-1))<.01,'Tramos no cubren la ruta');
 for(let i=0;i<=1000;i++){const s=g.atDistance(c,cum,cum.at(-1)*i/1000);assert(g.project(s.p,c,cum).offset<.01,'El marcador corta una curva');}
 const gaps=ss.filter(s=>s.properties.basis==='interpolated');
 report.push({route:r.properties.id,km:+(length/1000).toFixed(3),stations:r.properties.stationIds.length,uncertainConnections:gaps.length,uncertainKm:+(gaps.reduce((n,s)=>n+g.cumulative(s.geometry.coordinates).at(-1),0)/1000).toFixed(3)});
}
assert.equal(stations.length,18);
console.log(JSON.stringify({checks:'18 estaciones sobre la vía, orden de paradas, continuidad, procedencia y 3003 posiciones de marcador',routes:report},null,2));
