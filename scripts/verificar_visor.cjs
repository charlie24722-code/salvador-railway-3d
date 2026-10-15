const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
let errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()+' '+r.failure()?.errorText));
await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.body.dataset.ready||document.body.dataset.error,{timeout:45000});await page.waitForTimeout(2500);
console.log('STATE',await page.evaluate(()=>({ready:document.body.dataset.ready,error:document.body.dataset.error,terrain:window.railwayAtlas?.map.getTerrain(),sources:window.railwayAtlas?.map.isStyleLoaded(),pointCount:window.railwayAtlas?.points.length,loaded:window.railwayAtlas?.map.loaded(),demAtSantaAna:window.railwayAtlas?.elevationAt([-89.630,13.853]),features:window.railwayAtlas?.map.queryRenderedFeatures().length})));
await page.screenshot({path:__dirname+'/../evidencia/visor-general.png',fullPage:true});
console.log('ERRORS',errors);console.log('FAILED',failed);
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
