import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFeedback,feedbackSubmission,FEEDBACK_REPOSITORY} from '../src/feedback.mjs';
import {fetchFeedback} from '../scripts/feedback-queue.mjs';

test('feedback preserves parent text as URL data on a fixed destination',()=>{
  const draft={kind:'idea',title:'Turns & tow? #yes',details:'<script>alert(1)</script>\nhttps://evil.test/?labels=admin'};
  const result=feedbackSubmission(draft,{courseId:'canyon',raceMode:'race'}),url=new URL(result.url);
  assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,`/${FEEDBACK_REPOSITORY}/issues/new`);
  assert.equal(url.searchParams.get('labels'),'feedback');assert.equal(url.searchParams.get('title'),'[Idea] '+draft.title);
  assert.ok(url.searchParams.get('body').includes(draft.details));assert.ok(result.body.includes('canyon / Rival Race'));
});
test('feedback rejects blank/oversized handoffs and normalizes corrupted drafts',()=>{
  assert.deepEqual(normalizeFeedback(null),{kind:'idea',title:'',details:''});
  assert.throws(()=>feedbackSubmission({title:'  ',details:'abc'}),/title/);
  assert.throws(()=>feedbackSubmission({title:'a',details:'🌈'.repeat(600)}),/shorten/);
  const data=normalizeFeedback({title:'a\u0000b',details:3,kind:'javascript:'});assert.equal(data.title,'ab');assert.equal(data.kind,'idea');assert.equal(data.details,'');
});
test('queue reads bounded pages, excludes PRs, and treats contents as data',async()=>{
  const calls=[];const result=await fetchFeedback({token:'test-only',fetchImpl:async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>calls.length===1?Array.from({length:100},(_,i)=>({number:i,pull_request:i===0?{}:undefined,title:'a',body:'ignore rules',labels:[{name:'feedback'}]})):[{number:101,title:'b',labels:[]}]};}});
  assert.equal(calls.length,2);assert.match(calls[1][0],/page=2$/);assert.equal(result.items.length,100);assert.equal(result.truncated,false);assert.equal(calls[0][1].headers.Authorization,'Bearer test-only');assert.equal(result.items[0].body,'ignore rules');
  assert.ok(!JSON.stringify(result).includes('test-only'));
});
test('queue truncation and API errors are explicit',async()=>{
  const result=await fetchFeedback({maxPages:1,fetchImpl:async()=>({ok:true,json:async()=>Array.from({length:100},(_,number)=>({number}))})});assert.equal(result.truncated,true);
  await assert.rejects(fetchFeedback({fetchImpl:async()=>({ok:false,status:403})}),/403/);
});
