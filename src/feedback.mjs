export const FEEDBACK_REPOSITORY='jamesgarage/jamesgarage.github.io';
export const FEEDBACK_DRAFT_KEY='monster-skyway.feedback.v1';
const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').slice(0,max):'';

export function normalizeFeedback(value={}) {
  const source=value&&typeof value==='object'?value:{};
  return {kind:source.kind==='bug'?'bug':'idea',title:clean(source.title,100),details:clean(source.details,1200)};
}

export function feedbackSubmission(draft,context={}) {
  const value=normalizeFeedback(draft);
  if(!value.title.trim()||!value.details.trim())throw new Error('Add a short title and a few details first.');
  const course=['skyway','woods','loop','bay','canyon'].includes(context.courseId)?context.courseId:'unspecified';
  const mode=context.raceMode==='race'?'Rival Race':'Cruise';
  const title=`[${value.kind==='bug'?'Bug':'Idea'}] ${value.title.trim()}`;
  const body=`${value.kind==='bug'?'What happened / what I expected':'My suggestion'}\n\n${value.details.trim()}\n\n---\nGame context: ${course} / ${mode}\nSubmitted through the parent feedback form. Please review for suitability before implementation.`;
  const url=new URL(`https://github.com/${FEEDBACK_REPOSITORY}/issues/new`);
  url.search=new URLSearchParams({template:'feedback.md',labels:'feedback',title,body}).toString();
  // Keep the handoff usable even for characters requiring many encoded bytes.
  if(url.href.length>7000)throw new Error('Please shorten the details a little, then try again.');
  return {title,body,url:url.href};
}

/** Local drafts never pretend to be a shared inbox. GitHub owns actual submission. */
export function mountFeedback(root,{context=()=>({}),storage=()=>localStorage,clipboard=()=>navigator.clipboard}={}) {
  const form=root.querySelector('form'),kind=root.querySelector('[name="kind"]'),title=root.querySelector('[name="title"]'),details=root.querySelector('[name="details"]');
  const status=root.querySelector('[data-feedback-status]'),link=root.querySelector('[data-feedback-link]'),copy=root.querySelector('[data-feedback-copy]'),fallback=root.querySelector('[data-feedback-fallback]');
  let current;
  const read=()=>normalizeFeedback({kind:kind.value,title:title.value,details:details.value});
  const tell=text=>{status.textContent=text;};
  try {const draft=normalizeFeedback(JSON.parse(storage().getItem(FEEDBACK_DRAFT_KEY)));kind.value=draft.kind;title.value=draft.title;details.value=draft.details;}catch{/* Storage-disabled browsers still allow submission. */}
  const kinds=[...root.querySelectorAll('[data-feedback-kind]')];
  const syncKind=()=>kinds.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.feedbackKind===kind.value)));
  syncKind();
  kinds.forEach(button=>button.addEventListener('click',()=>{kind.value=button.dataset.feedbackKind;syncKind();form.dispatchEvent(new Event('input',{bubbles:true}));}));
  form.addEventListener('input',()=>{
    current=null;link.hidden=true;copy.hidden=true;fallback.hidden=true;
    try{storage().setItem(FEEDBACK_DRAFT_KEY,JSON.stringify(read()));tell('Draft saved on this device. Nothing has been sent.');}
    catch{tell('Draft is kept here while this page stays open. Nothing has been sent.');}
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try {
      current=feedbackSubmission(read(),context());link.href=current.url;link.hidden=false;copy.hidden=false;
      tell('Ready to review on GitHub. Sign in and choose Submit new issue there to send it.');link.focus();
    }catch(error){tell(error.message);}
  });
  link.addEventListener('click',()=>tell('GitHub opens in another tab. Your suggestion is only sent after you submit it there.'));
  copy.addEventListener('click',async()=>{
    if(!current)return;
    const text=`${current.title}\n\n${current.body}`;
    try{await clipboard().writeText(text);tell('Copied. Paste it into a GitHub issue when you are ready.');}
    catch{fallback.value=text;fallback.hidden=false;fallback.focus();fallback.select();tell('Select and copy the text below, then paste it into a GitHub issue.');}
  });
}
