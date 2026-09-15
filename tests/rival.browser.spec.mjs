import {test,expect} from '@playwright/test';

const errors=new WeakMap();
test.beforeEach(async({page})=>{const found=[];errors.set(page,found);page.on('pageerror',e=>found.push(e.message));page.on('console',m=>{if(m.type()==='error')found.push(m.text());});});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
async function open(page,save={}) {
  await page.addInitScript(value=>localStorage.setItem('monster-skyway.progress.v1',JSON.stringify({version:1,muted:true,...value})),save);
  await page.goto('./',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__skyway);await expect(page.locator('#error')).toBeHidden();
}

test('parents can edit, retain and review feedback without sending it automatically',async({page},info)=>{
  await page.setViewportSize({width:768,height:1024});await open(page);
  await page.locator('#settings-btn').tap();await page.locator('#feedback-btn').tap();
  await page.locator('[data-feedback-kind="bug"]').tap();
  await page.locator('#feedback-summary').fill('Tow & turbo #idea');
  await page.locator('#feedback-details').fill('More muddy turns, please. <b>Keep my text.</b>');
  const selection=await page.locator('#feedback-details').evaluate(e=>{
    e.focus();e.setSelectionRange(0,4);const event=new Event('selectstart',{bubbles:true,cancelable:true});e.dispatchEvent(event);
    return {allowed:!event.defaultPrevented,style:getComputedStyle(e).webkitUserSelect||getComputedStyle(e).userSelect};
  });expect(selection).toEqual({allowed:true,style:'text'});
  await page.getByRole('button',{name:'Prepare feedback',exact:true}).tap();
  const href=await page.locator('[data-feedback-link]').getAttribute('href'),url=new URL(href);
  expect(url.origin).toBe('https://github.com');expect(url.searchParams.get('labels')).toBe('feedback');expect(url.searchParams.get('title')).toBe('[Bug] Tow & turbo #idea');expect(url.searchParams.get('body')).toContain('<b>Keep my text.</b>');
  await expect(page.locator('[data-feedback-status]')).toContainText('Submit new issue');
  await page.screenshot({path:info.outputPath('parent-feedback.png')});
  await page.reload();await page.waitForFunction(()=>window.__skyway);await page.locator('#settings-btn').tap();await page.locator('#feedback-btn').tap();
  await expect(page.locator('#feedback-summary')).toHaveValue('Tow & turbo #idea');
  await expect(page.locator('[data-feedback-kind="bug"]')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');await expect(page.locator('#settings')).toBeVisible();
});

test('race mode and camera choices persist and remain reachable on a phone',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__skyway);
  await expect(page.locator('[data-mode="cruise"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-mode="race"]').tap();await page.screenshot({path:info.outputPath('rival-menu-phone.png')});
  await page.locator('#settings-btn').tap();await page.locator('[name="camera"][value="wide"]').check();await page.locator('[name="rival-rank"][value="2"]').check();await page.locator('#settings-close').tap();
  await page.reload();await page.waitForFunction(()=>window.__skyway);await expect(page.locator('[data-mode="race"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#play-btn').tap();const state=await page.evaluate(()=>window.__skyway);expect(state.raceMode).toBe('race');expect(state.rivalRank).toBe(2);expect(state.cameraView).toBe('wide');
});

test('a real rival can win and stomp the actual field without re-awarding progress',async({page},info)=>{
  test.setTimeout(70000);await open(page,{courseId:'woods',raceMode:'race',rivalRank:2});await page.locator('#play-btn').tap();
  await page.waitForFunction(()=>window.__skyway.phase==='finished',null,{timeout:45000});
  const result=await page.evaluate(()=>window.__skyway);expect(result.result.won).toBe(false);expect(result.winnerId).not.toBe('player');expect(result.ceremony.winnerId).toBe(result.winnerId);
  await expect(page.locator('#result-title')).not.toHaveText('You win!');
  await page.waitForFunction(()=>window.__skyway.ceremony.phase==='restored');
  const complete=await page.evaluate(()=>window.__skyway);expect(complete.ceremony.contactIds).toHaveLength(4);expect(complete.ceremony.contactIds).toContain('player');
  await page.screenshot({path:info.outputPath('rival-trophy.png')});
  await page.locator('#stomp-btn').tap();await page.waitForFunction(()=>window.__skyway.ceremony.phase==='stomping');
  expect(await page.evaluate(()=>window.__skyway.totalStars)).toBe(result.totalStars);expect(await page.evaluate(()=>window.__skyway.races)).toBe(1);
  await page.locator('#race-again-btn').tap();await page.waitForFunction(()=>window.__skyway.phase==='running');expect(await page.evaluate(()=>window.__skyway.ceremony.active)).toBe(false);
});

test('leaving a marked shoulder calls a tow while rivals advance, and pause freezes recovery',async({page},info)=>{
  test.setTimeout(60000);await open(page,{courseId:'woods',raceMode:'race',rivalRank:1});await page.locator('#play-btn').tap();
  await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>!!window.__skyway.recovery,null,{timeout:25000});await page.keyboard.up('ArrowLeft');
  await page.screenshot({path:info.outputPath('tow-rescue.png')});
  await page.locator('#pause-btn').tap();const paused=await page.evaluate(()=>window.__skyway);await page.waitForTimeout(200);
  const still=await page.evaluate(()=>window.__skyway);expect(still.recovery).toEqual(paused.recovery);expect(still.buddies).toEqual(paused.buddies);expect(still.distance).toBe(paused.distance);
  await page.locator('#resume-btn').tap();await page.waitForFunction(()=>!window.__skyway.recovery);
  const rescued=await page.evaluate(()=>window.__skyway);expect(rescued.offCourseCount).toBe(1);expect(Math.abs(rescued.lane)).toBeLessThan(1.1);expect(rescued.buddies.some((b,i)=>b.distance>paused.buddies[i].distance)).toBe(true);
  await page.waitForFunction(paused=>window.__skyway.distance>paused.distance+15,paused);
});

test('garage reset preserves chosen race and camera preferences through reload',async({page})=>{
  await page.addInitScript(()=>{
    if(sessionStorage.getItem('rival-reset-seeded'))return;
    sessionStorage.setItem('rival-reset-seeded','yes');
    localStorage.setItem('monster-skyway.progress.v1',JSON.stringify({version:1,stars:123,races:9,selected:'mega-titan',
      courseId:'woods',raceMode:'race',rivalRank:2,cameraView:'wide',muted:true,reducedMotion:true,challengeWins:4}));
  });
  await page.goto('./',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__skyway);
  await page.locator('#settings-btn').click();await page.locator('#reset-btn').click();await page.locator('#reset-yes').click();
  await expect(page.locator('#garage')).toBeVisible();
  await page.waitForFunction(()=>[...document.querySelectorAll('#truck-list img')].length===8&&[...document.querySelectorAll('#truck-list img')].every(image=>image.complete&&image.naturalWidth===720));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('monster-skyway.progress.v1')));
  expect(saved).toMatchObject({stars:0,races:0,selected:'rumbler',challengeWins:0,raceMode:'race',rivalRank:2,cameraView:'wide',muted:true,reducedMotion:true});
  await page.locator('#garage-close').click();await page.reload();await page.waitForFunction(()=>window.__skyway);
  await expect(page.locator('[data-mode="race"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#settings-btn').click();
  await expect(page.locator('[name="camera"][value="wide"]')).toBeChecked();
  await expect(page.locator('[name="rival-rank"][value="2"]')).toBeChecked();
  await page.locator('#settings-close').click();await page.locator('#play-btn').click();
  const race=await page.evaluate(()=>window.__skyway);
  expect(race).toMatchObject({raceMode:'race',rivalRank:2,cameraView:'wide',totalStars:0,races:0,selected:'rumbler'});
});

test('nested feedback restores the settings opener and resumes only an interrupted race',async({page})=>{
  await open(page);
  for(const running of [false,true]) {
    if(running)await page.locator('#play-btn').click();
    await page.locator('#settings-btn').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#settings')).toBeVisible();
    expect(await page.evaluate(()=>window.__skyway.phase)).toBe(running?'paused':'ready');
    await page.locator('#feedback-btn').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#feedback')).toBeVisible();
    await page.locator('#feedback-details').focus();await page.keyboard.press('Escape');
    await expect(page.locator('#settings')).toBeVisible();await expect(page.locator('#feedback-btn')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings')).toBeHidden();await expect(page.locator('#settings-btn')).toBeFocused();
    expect(await page.evaluate(()=>window.__skyway.phase)).toBe(running?'running':'ready');
  }
});
