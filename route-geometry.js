/* Geometría WGS84 para inspeccionar el trazado sin cortar curvas entre muestras. */
(function(root){
 'use strict';
 const distance=(a,b)=>{const r=Math.PI/180,h=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;return 12742017.6*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
 function cumulative(coords){const d=[0];for(let i=1;i<coords.length;i++)d.push(d[i-1]+distance(coords[i-1],coords[i]));return d;}
 function atDistance(coords,cum,d){d=Math.max(0,Math.min(cum.at(-1),d));let i=1;while(i<cum.length-1&&cum[i]<d)i++;const t=(d-cum[i-1])/(cum[i]-cum[i-1]||1);return {p:coords[i-1].map((v,k)=>v+t*(coords[i][k]-v)),d,index:i-1};}
 function project(p,coords,cum=cumulative(coords)){
  const scale=Math.cos(p[1]*Math.PI/180);let best={offset:Infinity};
  for(let i=1;i<coords.length;i++){
   const a=coords[i-1],b=coords[i],dx=(b[0]-a[0])*scale,dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,(((p[0]-a[0])*scale*dx)+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
   const q=a.map((v,k)=>v+t*(b[k]-v)),offset=distance(p,q);
   if(offset<best.offset)best={p:q,offset,d:cum[i-1]+t*(cum[i]-cum[i-1]),index:i-1};
  }
  return best;
 }
 const api={distance,cumulative,atDistance,project};
 if(typeof module==='object')module.exports=api;else root.RouteGeometry=api;
})(typeof globalThis==='object'?globalThis:this);
