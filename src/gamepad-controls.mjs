import { GamepadInput } from './gamepad-input.mjs';

function selectable(root) {
  return [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]')].filter(element=>!element.closest('[hidden]')&&element.getClientRects().length>0);
}

/** DOM navigation and game actions share the same buttons used by touch/keys. */
export class GamepadControls {
  constructor({getPhase,getMenuRoot,jump,turbo,transform,pause,resume,back,status,read=()=>navigator.getGamepads?.()??[]}) {
    Object.assign(this,{getPhase,getMenuRoot,jump,turbo,transform,pause,resume,back,status,read});
    this.input=new GamepadInput();this.connected=false;this.steer=0;this.focused=null;this.lastStatus='';
  }
  clear(){this.input.clear();this.steer=0;}
  focus(element,root){
    if(!element)return;this.focused?.classList.remove('gamepad-focus');this.focused=element;
    element.classList.add('gamepad-focus');element.focus({preventScroll:true});
    if(root?.id!=='app')element.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  defaultFocus(root){
    const choices=selectable(root);
    if(root.id==='app')return choices.find(element=>element.id==='play-btn');
    if(root.id==='settings')return choices.find(element=>element.id==='motion-toggle');
    return choices.find(element=>element.getAttribute('aria-pressed')==='true')
      ??choices.find(element=>['race-again-btn','resume-btn','motion-toggle'].includes(element.id))
      ??choices.find(element=>!element.classList.contains('close-button'))??choices[0];
  }
  navigate(root,x,y){
    const choices=selectable(root);if(!choices.length)return;
    const current=root.contains(document.activeElement)?document.activeElement:this.defaultFocus(root);
    if(!current){this.focus(choices[0],root);return;}
    const from=current.getBoundingClientRect(),cx=from.x+from.width/2,cy=from.y+from.height/2;
    let next=null,best=Infinity;
    for(const element of choices){
      if(element===current)continue;const r=element.getBoundingClientRect(),dx=r.x+r.width/2-cx,dy=r.y+r.height/2-cy;
      const along=x?dx*x:dy*y,across=Math.abs(x?dy:dx);
      if(along>5&&along+across*2.5<best){best=along+across*2.5;next=element;}
    }
    if(!next){const index=choices.indexOf(current);next=choices[(index+(x||y)+choices.length)%choices.length];}
    this.focus(next,root);
  }
  poll(now){
    let pads=[];try{pads=this.read()??[];}catch{/* Unavailable APIs never block touch/keyboard play. */}
    const state=this.input.sample(pads,now),wasConnected=this.connected;
    const replacement=wasConnected&&state.connected&&(this.activeIndex!==state.index||this.activeId!==state.id);
    this.activeIndex=state.index;this.activeId=state.id;
    this.connected=state.connected;this.steer=0;
    let unsupported=false;
    try{for(let i=0;i<Math.min(pads.length,256);i++)if(pads[i]?.connected&&pads[i].mapping!=='standard')unsupported=true;}catch{/* Ignore inaccessible snapshots. */}
    const message=state.connected?'Controller ready · A / ✕ choose · B / ○ back':unsupported?'This controller has an unknown button layout. Touch and keyboard are ready.':'Pair a controller, then press a button to connect.';
    if(message!==this.lastStatus){this.status(message,state.connected);this.lastStatus=message;}
    if(!state.connected){this.focused?.classList.remove('gamepad-focus');this.focused=null;if(wasConnected&&this.getPhase()==='running')this.pause();return 0;}
    if(replacement&&this.getPhase()==='running'){this.pause();return 0;}
    const root=this.getMenuRoot();
    if(root){
      const current=selectable(root).includes(document.activeElement)?document.activeElement:null;
      if(root!==this.menuRoot||!current||this.focused!==current)this.focus(current??this.defaultFocus(root),root);
      this.menuRoot=root;
      if(state.back){this.back();return 0;}
      if(state.pause){
        if(root.id==='pause-overlay')this.resume();
        else if(root.id==='app')root.querySelector('#play-btn')?.click();
        else this.back();
        return 0;
      }
      if(state.navX||state.navY)this.navigate(root,state.navX,state.navY);
      if(state.confirm){const button=root.contains(document.activeElement)?document.activeElement:this.defaultFocus(root);button?.click();}
      return 0;
    }
    this.menuRoot=null;this.focused?.classList.remove('gamepad-focus');this.focused=null;
    if(this.getPhase()!=='running')return 0;
    if(state.pause){this.pause();return 0;}
    if(state.jump)this.jump();if(state.transform)this.transform();if(state.turbo)this.turbo();
    this.steer=state.steer;return this.steer;
  }
}
