import { test, expect } from '@playwright/test';

const errors=new WeakMap();
test.beforeEach(({page})=>{
  const list=[];errors.set(page,list);
  page.on('pageerror',e=>list.push(`JavaScript: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')list.push(`Console: ${m.text()}`);});
  page.on('response',r=>{if(r.status()>=400)list.push(`HTTP ${r.status()}: ${r.url()}`);});
  page.on('requestfailed',r=>list.push(`Network: ${r.failure()?.errorText} ${r.url()}`));
});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function open(page){await page.goto('./',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__skyway);}

test('game touches resist zoom and selection while the garage stays scrollable',async({page,browserName},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await open(page);
  await page.locator('#garage-btn').tap();
  await page.waitForFunction(()=>[...document.querySelectorAll('#truck-list img')].every(i=>i.complete&&i.naturalWidth===720));
  const protections=await page.evaluate(()=>{
    const root=document.querySelector('#app'),garage=document.querySelector('#garage');
    const canceled=['gesturestart','gesturechange','gestureend','selectstart','contextmenu','dragstart'].map(type=>!root.dispatchEvent(new Event(type,{bubbles:true,cancelable:true})));
    const move=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(move,'touches',{value:[{}]});
    garage.dispatchEvent(move);
    return {canceled,singleFingerBlocked:move.defaultPrevented,overflow:garage.scrollHeight>garage.clientHeight,select:getComputedStyle(root).userSelect??getComputedStyle(root).webkitUserSelect,pan:getComputedStyle(garage).touchAction};
  });
  expect(protections).toEqual({canceled:[true,true,true,true,true,true],singleFingerBlocked:false,overflow:true,select:'none',pan:'pan-y'});
  if(browserName==='chromium'){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:690,id:1}]});
    for(let y=660;y>=210;y-=30)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{
    // Playwright WebKit has no multi-contact input API. Verify native browser
    // scrolling separately from the cancelable Safari gesture fallback above.
    await page.mouse.move(195,650);await page.mouse.wheel(0,600);
  }
  await expect.poll(()=>page.locator('#garage').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  await page.locator('#garage-close').tap();await page.locator('#play-btn').tap();
  const before=await page.evaluate(()=>visualViewport.scale);
  for(let i=0;i<4;i++)await page.locator('#jump-btn').tap();
  expect(await page.evaluate(()=>visualViewport.scale)).toBe(before);
  expect(await page.evaluate(()=>getSelection().toString())).toBe('');
  const canceled=await page.locator('#game-canvas').evaluate(canvas=>{
    const touch=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(touch,'touches',{value:[{}]});return !canvas.dispatchEvent(touch);
  });expect(canceled).toBe(true);
  await expect(page.locator('#pause-btn')).toBeVisible();await page.locator('#pause-btn').tap();
  await expect(page.locator('#pause-overlay')).toBeVisible();await page.locator('#resume-btn').tap();
  await page.screenshot({path:testInfo.outputPath('phone-touch-controls.png')});
});

test('two actual fingers can steer and jump without pinch zoom or stuck steering',async({page,browserName},testInfo)=>{
  test.skip(browserName!=='chromium','Chromium CDP supplies real multi-contact input; WebKit covers gesture fallback and normal taps.');
  await open(page);await page.locator('#play-btn').tap();
  const cdp=await page.context().newCDPSession(page);
  const center=async id=>{const b=await page.locator(id).boundingBox();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};};
  const right={...await center('#right-btn'),id:1},left={...await center('#left-btn'),id:2},jump={...await center('#jump-btn'),id:3};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right]});
  await page.waitForFunction(()=>window.__skyway.screenLane>.04&&window.__skyway.touchCount===1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right,left]});
  await page.waitForFunction(()=>window.__skyway.touchCount===2);
  // For a partial release Chromium consumes the contacts being released.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[left]});
  await page.waitForFunction(()=>window.__skyway.touchCount===1);
  await expect(page.locator('#right-btn')).toHaveClass(/pressed/);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right,jump]});
  await page.waitForFunction(()=>window.__skyway.height>2);
  await page.screenshot({path:testInfo.outputPath('two-finger-jump.png')});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.waitForFunction(()=>window.__skyway.touchCount===0);
  await expect(page.locator('#right-btn')).not.toHaveClass(/pressed/);
  const lane=await page.evaluate(()=>window.__skyway.targetLane);await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__skyway.targetLane)).toBe(lane);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:300,id:1},{x:600,y:300,id:2}]});
  for(let i=0;i<6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:400-i*25,y:300,id:1},{x:600+i*25,y:300,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>visualViewport.scale)).toBe(1);
  expect(await page.evaluate(()=>getSelection().toString())).toBe('');
  await page.locator('#pause-btn').tap();await expect(page.locator('#pause-overlay')).toBeVisible();
  await cdp.detach();
});
