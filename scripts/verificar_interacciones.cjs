const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert');
let browser;
(async()=>{
browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1360,height:900},deviceScaleFactor:2,reducedMotion:'reduce'});let errors=[],failed=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ABORTED'))failed.push(r.url()+' '+r.failure()?.errorText);});
// Bloquear Internet verifica que el núcleo de cartografía no depende de CDN ni servicios externos.
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
await page.goto('http://127.0.0.1:8765/?qa=fluido',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.ready||document.body.dataset.error,null,{timeout:45000});
assert.equal(await page.getAttribute('body','data-ready'),'true');checks.push('Carga y WebGL sin Internet');
await page.waitForFunction(()=>window.railwayAtlas.map.areTilesLoaded(),null,{timeout:30000});
let stats=await page.evaluate(()=>{const a=window.railwayAtlas,m=a.map;return {terrain:m.getTerrain(),pixelRatio:m.getPixelRatio(),cssWidth:m.getCanvas().clientWidth,canvasWidth:m.getCanvas().width,points:a.points.length,sources:Object.keys(m.getStyle().sources),elevationSantaAna:a.elevationAt([-89.630,13.853]),resources:performance.getEntriesByType('resource').length};});assert.equal(stats.pixelRatio,1);assert.equal(stats.canvasWidth,stats.cssWidth);assert(!stats.sources.includes('shade'));checks.push('Una sola capa DEM y resolución 1× en pantalla Retina');
await page.locator('[data-route="santaana"]').click();assert((await page.locator('#profileTitle').textContent()).includes('Santa Ana'));checks.push('Cambio de ruta y perfil');
await page.fill('#search','Izalco');assert((await page.locator('#placeCount').textContent()).startsWith('3 '));await page.locator('[data-place="izalco"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('#detailTitle').textContent(),'Volcán de Izalco');await page.click('#closeDetail');checks.push('Búsqueda y ficha de volcán');
await page.click('#view3d');assert.equal(await page.evaluate(()=>railwayAtlas.map.getTerrain()),null);await page.click('#view3d');checks.push('Cambio 2D/3D');
await page.click('#tab-layers');await page.check('#layer-contours');await page.waitForFunction(()=>railwayAtlas.map.getSource('contours')._data.features?.length>0,null,{timeout:15000});checks.push('Carga de curvas bajo demanda');await page.uncheck('#layer-contours');
await page.locator('#quality').evaluate(el=>{el.value='.75';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>railwayAtlas.map.getPixelRatio()),.75);checks.push('Resolución fluida regulable');
await page.click('#originalButton');await page.click('#imageIn');assert.equal(await page.locator('#imageZoom').textContent(),'125%');await page.locator('#originalDialog .close-dialog').click();checks.push('Original histórico y ampliación');
await page.click('#sourcesButton');assert(await page.locator('#sourcesDialog').isVisible());await page.locator('#sourcesDialog .close-dialog').click();checks.push('Fuentes y precisión');
await page.click('#resetView');await page.locator('#quality').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#tab-explore');await page.fill('#search','');
await page.waitForFunction(()=>railwayAtlas.map.areTilesLoaded(),null,{timeout:25000});await page.screenshot({path:__dirname+'/../evidencia/visor-general.png'});
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.body.classList.add('sidebar-collapsed');railwayAtlas.map.resize();});await page.waitForTimeout(300);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow);checks.push('Pantalla móvil sin desbordamiento horizontal');await page.screenshot({path:__dirname+'/../evidencia/visor-movil.png'});
const result={date:'2026-10-15',engine:'Chromium / SwiftShader, prueba funcional; no mide GPU del usuario',checks,stats,errors,failed};fs.writeFileSync(__dirname+'/../evidencia/verificacion.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();if(errors.length||failed.length)process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
