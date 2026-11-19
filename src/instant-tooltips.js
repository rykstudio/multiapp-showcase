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
    // Never cover neighboring controls: the address field is reserved for
    // toolbar hints, and the credential-value cell is reserved for drawer hints.
    // These areas are trusted HTML chrome rather than the embedded native page.
    const credential=button.closest('.secretrow')?.querySelector('code');
    const anchor=credential||document.getElementById('address');
    if(!anchor)return hide();
    const rect=anchor.getBoundingClientRect();
    if(rect.width<30||rect.height<12)return hide();
    hint.style.width=Math.max(30,Math.floor(rect.width-8))+'px';
    hint.style.maxWidth=Math.max(30,Math.floor(rect.width-8))+'px';
    hint.style.top=Math.round(rect.top+(rect.height-hint.offsetHeight)/2)+'px';
    hint.style.left=Math.round(rect.left+4)+'px';
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
