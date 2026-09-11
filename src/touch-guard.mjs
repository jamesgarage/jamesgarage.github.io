/** Keep game touches in the game while allowing a single finger to scroll
 * the garage/track picker. Safari's gesture events need an explicit fallback. */
export function installTouchGuard(root) {
  const listeners=[];
  const on=(type,handler,options)=>{root.addEventListener(type,handler,options);listeners.push([type,handler,options]);};
  const stop=event=>{if(event.cancelable)event.preventDefault();};
  const gameplay=event=>!event.target.closest?.('.overlay:not([hidden])')&&root.ownerDocument.body.classList.contains('playing');
  for(const type of ['gesturestart','gesturechange','gestureend','selectstart','contextmenu','dragstart'])on(type,stop,{passive:false});
  on('touchstart',event=>{if(event.touches.length>1)stop(event);},{passive:false});
  on('touchmove',event=>{if(event.touches.length>1||gameplay(event))stop(event);},{passive:false});
  // Driving buttons use pointerdown, so suppressing the compatibility tap
  // cannot swallow their action and prevents rapid tapping from becoming zoom.
  on('touchend',event=>{if(gameplay(event)&&(event.target.closest?.('.drive-button')||event.target.id==='game-canvas'))stop(event);},{passive:false});
  return ()=>listeners.forEach(([type,handler,options])=>root.removeEventListener(type,handler,options));
}
