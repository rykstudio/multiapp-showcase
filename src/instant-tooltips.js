'use strict';
// Compact, immediate tooltip. A hover hint is placed below the application
// chrome so it cannot cover neighboring tab, window, or toolbar controls.
(()=>{
  const hint=document.getElementById('instantTooltip');
  const header=document.querySelector('header');
  if(!hint||!header)return;
  let active=null;

  function hide(){
    if(active)active.removeAttribute('aria-describedby');
    active=null;
    hint.hidden=true;
    hint.textContent='';
  }

  function show(button){
    if(!button||button.disabled||button.hidden||!button.isConnected)return hide();
    const message=button.dataset.tooltip;
    if(!message)return hide();

    if(active&&active!==button)active.removeAttribute('aria-describedby');
    active=button;
    hint.textContent=message;
    hint.style.width='max-content';
    hint.style.maxWidth='220px';
    hint.hidden=false;
    button.setAttribute('aria-describedby','instantTooltip');

    const rect=button.getBoundingClientRect();
    const headerRect=header.getBoundingClientRect();
    const tooltipRect=hint.getBoundingClientRect();
    const margin=6;
    // Even for top-row minimize/maximize/close, place below the *entire*
    // header rather than obscuring the navigation controls below.
    const top=Math.max(rect.bottom+margin,headerRect.bottom+margin);
    const centered=rect.left+(rect.width-tooltipRect.width)/2;
    const left=Math.min(
      Math.max(margin,window.innerWidth-tooltipRect.width-margin),
      Math.max(margin,centered)
    );
    hint.style.top=Math.round(top)+'px';
    hint.style.left=Math.round(left)+'px';
  }

  document.addEventListener('pointerover',event=>{
    const button=event.target.closest?.('[data-tooltip]');
    if(button&&active!==button)show(button);
  });
  document.addEventListener('pointerout',event=>{
    if(active&&active.contains(event.target)&&(!event.relatedTarget||!active.contains(event.relatedTarget)))hide();
  });
  document.addEventListener('focusin',event=>{
    const button=event.target.closest?.('[data-tooltip]');
    if(button)show(button);
  });
  document.addEventListener('focusout',event=>{
    if(active&&active.contains(event.target)&&(!event.relatedTarget||!active.contains(event.relatedTarget)))hide();
  });
  document.addEventListener('pointerdown',hide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('resize',hide);
  window.addEventListener('blur',hide);
})();
