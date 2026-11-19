'use strict';
// Vertical tab presentation and interactions. State and navigation stay in Electron.
(function(){
  const $=id=>document.getElementById(id);
  let current={apps:[],tabLayout:'horizontal',sidebarCollapsed:false,sidebarWidth:280};
  let lastIds='',dragStart=null;
  function statusError(err){console.error('Sidebar action failed:',err);}
  function persist(next){return window.multiApp.updateLayout(next).catch(statusError);}
  function render(data,shownApps){
    current=data;
    const vertical=data.tabLayout==='vertical',collapsed=!!data.sidebarCollapsed;
    // Vertical mode has no top tab strip. Keep the same window buttons available
    // at the right of its single toolbar without creating duplicate controls.
    const controls=$('windowControls');
    const host=vertical?$('toolbar'):$('toprow');
    if(controls.parentElement!==host)host.append(controls);
    const width=collapsed?56:(data.sidebarWidth||280);
    document.documentElement.dataset.tabLayout=vertical?'vertical':'horizontal';
    document.documentElement.dataset.sidebarCollapsed=String(collapsed);
    document.documentElement.style.setProperty('--sidebar-visible-width',width+'px');
    $('verticalSidebar').hidden=!vertical||!!data.settingsVisible;
    // Keep the inline SVG glyph mounted; only update the description.
    $('tabLayoutToggle').dataset.tooltip=vertical?'Switch to horizontal tabs':'Switch to vertical tabs';
    $('tabLayoutToggle').setAttribute('aria-label',$('tabLayoutToggle').dataset.tooltip);
    $('tabLayoutToggle').disabled=!!data.settingsVisible;
    $('sidebarCollapse').textContent=collapsed?'»':'«';
    $('sidebarCollapse').title=collapsed?'Expand application sidebar':'Collapse application sidebar';
    $('sidebarCollapse').setAttribute('aria-label',$('sidebarCollapse').title);
    $('sidebarCollapse').setAttribute('aria-expanded',String(!collapsed));
    const ids=shownApps.map(a=>a.id).join('\u0000');
    if(ids!==lastIds){
      lastIds=ids;
      const items=$('verticalTabList');items.replaceChildren();
      for(const app of shownApps){
        const tab=document.createElement('button');
        tab.type='button';tab.className='sideTab';tab.dataset.appId=app.id;
        tab.setAttribute('role','tab');
        const glyph=document.createElement('span');glyph.className='sideGlyph';
        glyph.setAttribute('aria-hidden','true');
        const label=document.createElement('span');label.className='sideTabName';
        const group=document.createElement('span');group.className='sideTabGroup';
        tab.append(glyph,label,group);
        tab.onclick=()=>window.multiApp.activate(app.id);
        items.append(tab);
      }
    }
    for(const app of shownApps){
      const tab=Array.from($('verticalTabList').children).find(x=>x.dataset.appId===app.id);
      if(!tab)continue;
      tab.className='sideTab'+(app.id===data.activeId?' active':'')+(app.loading?' loading':'');
      tab.title=app.name+(app.group?' · '+app.group:'');
      tab.setAttribute('aria-selected',String(app.id===data.activeId));
      tab.setAttribute('aria-label',app.name);
      tab.querySelector('.sideGlyph').textContent=(app.name?.trim()?.charAt(0)||'?').toUpperCase();
      tab.querySelector('.sideTabName').textContent=app.name;
      tab.querySelector('.sideTabGroup').textContent=app.group||'';
    }
  }
  function syncGroups(options,value,shown){
    const select=$('verticalGroupFilter');
    const desired=JSON.stringify(options);
    if(select.dataset.signature!==desired){
      select.dataset.signature=desired;select.replaceChildren();
      for(const [v,label] of options){
        const o=document.createElement('option');o.value=v;o.textContent=label;select.append(o);
      }
    }
    select.hidden=!shown;
    select.value=value;
  }
  $('verticalGroupFilter').onchange=()=>{
    const top=$('groupFilter');top.value=$('verticalGroupFilter').value;top.onchange?.();
  };
  $('tabLayoutToggle').onclick=()=>persist({tabLayout:current.tabLayout==='vertical'?'horizontal':'vertical'});
  $('sidebarCollapse').onclick=()=>{if(current.tabLayout==='vertical')persist({sidebarCollapsed:!current.sidebarCollapsed});};
  $('sidebarSearch').onclick=()=>$('tabPickerButton').onclick?.();
  const handle=$('sidebarResizeHandle');
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||current.tabLayout!=='vertical'||current.sidebarCollapsed)return;
    dragStart={x:event.clientX,width:current.sidebarWidth||280};event.preventDefault();
  });
  document.addEventListener('pointermove',event=>{
    if(!dragStart)return;
    const width=Math.min(420,Math.max(180,Math.round(dragStart.width+event.clientX-dragStart.x)));
    document.documentElement.style.setProperty('--sidebar-visible-width',width+'px');
  });
  document.addEventListener('pointerup',event=>{
    if(!dragStart)return;
    const width=Math.min(420,Math.max(180,Math.round(dragStart.width+event.clientX-dragStart.x)));
    dragStart=null;
    persist({sidebarWidth:width});
  });
  document.addEventListener('pointercancel',()=>{
    if(!dragStart)return;
    dragStart=null;
    render(current,current.apps.filter(a=>!a.hidden));
  });
  handle.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    persist({sidebarWidth:Math.min(420,Math.max(180,(current.sidebarWidth||280)+(event.key==='ArrowRight'?20:-20)))});
  });
  window.verticalTabs={render,syncGroups};
})();
