'use strict';
// Compact, immediate tooltip. A hover hint is placed below the application
// chrome so it cannot cover neighboring tab, window, or toolbar controls.
(()=>{
  const hint=document.getElementById('instantTooltip');
  const header=document.querySelector('header');
  if(!hint||!header)return;
  let active=null;
  let generation=0;

  function hide(){
    generation++;
    if(active)active.removeAttribute('aria-describedby');
    active=null;
    hint.hidden=true;
    hint.textContent='';
    hint.style.opacity='1';
    const call=window.multiApp?.hideTooltip?.();
    call?.catch?.(()=>{});
  }

  function nativeImageData(message,left,top){
    if(!window.multiApp?.showTooltip||!document.createElement)return null;
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext?.('2d');
    if(!ctx)return null;
    ctx.font='500 11px system-ui, sans-serif';
    const width=Math.max(70,Math.min(220,Math.ceil(ctx.measureText(message).width+20)));
    const height=27;
    const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    canvas.width=Math.ceil(width*scale);
    canvas.height=Math.ceil(height*scale);
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.beginPath();
    ctx.roundRect(0,0,width,height,6);
    ctx.fillStyle='#1a293d';
    ctx.fill();
    ctx.strokeStyle='#40536b';
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.fillStyle='#ffffff';
    ctx.textBaseline='middle';
    ctx.font='500 11px system-ui, sans-serif';
    ctx.fillText(message,10,height/2,width-20);
    return {png:canvas.toDataURL('image/png'),x:left,y:top,width,height};
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

    // A native ImageView remains above Electron's embedded website, unlike
    // a DOM overlay which may be covered by a WebContentsView on Linux.
    const token=++generation;
    const image=nativeImageData(message,Math.round(left),Math.round(top));
    if(image){
      const operation=window.multiApp.showTooltip(image);
      operation?.then?.(result=>{
        if(token===generation&&active===button&&result?.ok)hint.style.opacity='0';
      })?.catch?.(()=>{});
    }
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
