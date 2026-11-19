'use strict';
// Instant tooltip text is restricted to trusted UI metadata (data-tooltip).
// Keep it inside the header's 35/71px chrome, above native WebContentsView layers.
(()=>{
  const hint=document.getElementById('instantTooltip');
  if(!hint)return;
  let active=null;
  function hide(){
    active=null;
    hint.hidden=true;
    hint.textContent='';
  }
  function show(button){
    if(!button || button.disabled || button.hidden || !button.isConnected)return hide();
    const message=button.dataset.tooltip;
    if(!message)return hide();
    active=button;
    hint.textContent=message;
    hint.hidden=false;
    const rect=button.getBoundingClientRect();
    const size=hint.getBoundingClientRect();
    const toolbarAtTop=rect.top<28;
    const top=toolbarAtTop?Math.max(2,(35-size.height)/2):Math.max(2,rect.top-size.height-3);
    const left=toolbarAtTop?rect.left-size.width-7:rect.left+(rect.width-size.width)/2;
    hint.style.top=Math.round(top)+'px';
    hint.style.left=Math.max(5,Math.min(window.innerWidth-size.width-5,Math.round(left)))+'px';
  }
  document.addEventListener('pointerover',e=>{
    const button=e.target.closest?.('[data-tooltip]');
    if(button && active!==button)show(button);
  });
  document.addEventListener('pointerout',e=>{
    if(active && active.contains(e.target) && (!e.relatedTarget || !active.contains(e.relatedTarget)))hide();
  });
  document.addEventListener('focusin',e=>{
    const button=e.target.closest?.('[data-tooltip]');
    if(button)show(button);
  });
  document.addEventListener('focusout',e=>{
    if(active && active.contains(e.target) && (!e.relatedTarget || !active.contains(e.relatedTarget)))hide();
  });
  document.addEventListener('pointerdown',hide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  window.addEventListener('resize',hide);
  window.addEventListener('blur',hide);
})();
