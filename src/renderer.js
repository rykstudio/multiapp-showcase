'use strict';
const $=id=>document.getElementById(id);
let current={apps:[]}, draft=null, drawerOpen=false, demoEntries=[], importSummary=null;
let pickerOpen=false;
let lastTabIds='';
let tabGroupFilter='all';
let groupOptionsFingerprint='';
let draggingAppId=null;
function groupOptionValue(group){return group?'group:'+group:'ungrouped';}
function visibleTabApps(data){return (data.apps||[]).filter(a=>!a.hidden&&(tabGroupFilter==='all'||tabGroupFilter===groupOptionValue(a.group||'')));}
function updateGroupSelector(data){
  const visible=data.apps.filter(a=>!a.hidden);
  const groups=[...new Set(visible.map(a=>a.group||''))];
  const options=[['all','All apps'],...groups.map(g=>[groupOptionValue(g),g||'Ungrouped'])];
  if(!options.some(([value])=>value===tabGroupFilter))tabGroupFilter='all';
  const signature=JSON.stringify(options);
  if(signature!==groupOptionsFingerprint){
    groupOptionsFingerprint=signature;
    const control=$('groupFilter');control.replaceChildren();
    for(const [value,label] of options){const o=el('option',{text:label});o.value=value;control.append(o);}
  }
  $('groupFilter').hidden=groups.length<2;
  $('groupFilter').value=tabGroupFilter;
  window.verticalTabs.syncGroups(options,tabGroupFilter,groups.length>=2);
}
$('groupFilter').onchange=()=>{
  tabGroupFilter=$('groupFilter').value;
  const matching=visibleTabApps(current);
  if(!matching.length){tabGroupFilter='all';render(current);return;}
  if(!matching.some(a=>a.id===current.activeId))window.multiApp.activate(matching[0].id);
  else render(current);
};
let tabScrollFrame=0;
let settingsBaseline=null;
function hasUnsavedSettings(){
  return !!draft && settingsBaseline!==null && JSON.stringify({...draft,title:$('platformTitle').value})!==settingsBaseline;
}
function reportSettingsChanges(){
  if(current.settingsVisible)window.multiApp.setSettingsDirty(hasUnsavedSettings()).catch(()=>{});
}
function discardSettings(){
  if(hasUnsavedSettings() && !confirm('Discard your unsaved application settings and demo-login changes?'))return;
  draft=null;settingsBaseline=null;
  window.multiApp.closeSettings();
}
$('settings').addEventListener('input',reportSettingsChanges);
$('settings').addEventListener('change',reportSettingsChanges);
const expandedAppIds=new Set();
const expandedLoginIds=new Set();
const expandedDrawerLoginIds=new Set();
const initializedDrawerApps=new Set();
const loginKey=(appId,loginId)=>appId+'::'+loginId;
function el(tag,props={},children=[]) {
  const node=document.createElement(tag);
  for(const [k,v] of Object.entries(props)) {
    if(k==='text')node.textContent=v;
    else if(k==='class')node.className=v;
    else if(k==='onClick')node.onclick=v;
    else if(k==='onInput')node.oninput=v;
    else if(k==='value')node.value=v;
    else if(k==='type' && tag==='input')node.type=v;
    else if(k==='placeholder')node.placeholder=v;
    else if(k==='maxLength')node.maxLength=v;
    else if(k==='title')node.title=v;
  }
  for(const child of children)node.append(child);
  return node;
}
function button(text,fn,cls='') {return el('button',{text,onClick:fn,class:cls});}
function field(label,value,onChange,props={}) {
  const tag=props.multiline?'textarea':'input';
  const attributes={value:value??'',placeholder:props.placeholder||'',maxLength:props.maxLength||500,onInput:e=>onChange(e.target.value)};
  if(tag==='input')attributes.type=props.type||'text';
  const input=el(tag,attributes);
  if(props.multiline)input.rows=2;
  return el('label',{class:'field'},[el('span',{text:label}),input]);
}
let toastTimer;
function toast(message) {
  const node=$('toast');node.textContent=message;node.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,3500);
}
function render(data) {
  const prevActive=current.activeId;current=data;
  document.documentElement.dataset.theme=data.resolvedTheme==='dark'?'dark':'light';
  if(data.activeId && prevActive!==data.activeId && tabGroupFilter!=='all' && !visibleTabApps(data).some(a=>a.id===data.activeId))tabGroupFilter='all';
  updateGroupSelector(data);
  $('error').textContent=data.error||'';
  $('fullscreenButton').textContent='⛶';
  $('fullscreenButton').title=data.fullScreen ? 'Exit full screen (F11)' : 'Enter full screen (F11)';
  $('fullscreenButton').setAttribute('aria-label',$('fullscreenButton').title);
  $('maximizeButton').textContent=data.maximized?'❐':'□';
  $('maximizeButton').title=data.maximized?'Restore window':'Maximize window';
  $('settings').hidden=!data.settingsVisible;
  const activeApp=data.apps.find(a=>a.id===data.activeId);
  $('mobileStage').hidden=data.settingsVisible||(activeApp?.displayMode!=='mobile'&&!activeApp?.previewMobile);
  $('responsivePreview').hidden=data.settingsVisible||!activeApp||activeApp.displayMode==='mobile';
  $('responsivePreview').textContent=activeApp?.previewMobile?'▣ Desktop view':'▯ Mobile preview';
  $('responsivePreview').setAttribute('aria-pressed',String(!!activeApp?.previewMobile));
  $('responsivePreview').title=activeApp?.previewMobile?'Return to full-width desktop view':'Preview this Desktop website at mobile width without saving the change';
  const shownApps=visibleTabApps(data);
  window.verticalTabs.render(data,shownApps);
  const tabIds=shownApps.map(a=>a.id).join('\u0000');
  const orderChanged=tabIds!==lastTabIds;
  lastTabIds=tabIds;
  if(orderChanged){
    $('tabs').replaceChildren();
    for(const app of shownApps){
      const tab=button(app.name,()=>window.multiApp.activate(app.id),'tab');
      tab.dataset.appId=app.id;tab.setAttribute('role','tab');
      $('tabs').append(tab);
    }
  }
  for(const app of shownApps) {
    const tab=Array.from($('tabs').children).find(x=>x.dataset.appId===app.id);
    if(!tab)continue;
    tab.textContent=app.name;
    tab.className='tab'+(app.id===data.activeId?' active':'')+(app.loading?' loading':'');
    tab.title=app.name+' \u2022 '+app.url;
    tab.setAttribute('aria-selected',String(app.id===data.activeId));
  }
  scheduleTabNavigationUpdate(orderChanged||prevActive!==data.activeId);
  if(pickerOpen)renderTabPicker();
  const active=data.apps.find(a=>a.id===data.activeId);
  $('address').textContent=active?.url||'';
  $('address').title=active?.failed||active?.url||'';
  $('error').textContent=active?.failed||data.error||'';
  $('error').title=active?.failed||data.error||'';
  for(const id of ['back','forward','reload','home'])$(''+id).disabled=!active||(id==='back'&&!active.back)||(id==='forward'&&!active.forward);
  $('loginMenu').hidden=!active?.loginCount||data.settingsVisible;
  $('closeSignIn').hidden=!active?.popupActive || data.settingsVisible;
  const pageTitle=(active?.popupTitle||'Page').trim();
  $('closeSignIn').textContent='✕ Close '+(pageTitle.length>36?pageTitle.slice(0,33)+'…':pageTitle);
  $('closeSignIn').title='Close '+pageTitle+' and return to '+(active?.name||'the application');
  $('closeSignIn').setAttribute('aria-label','Close '+pageTitle);
  $('empty').hidden=data.apps.some(a=>!a.hidden)||data.settingsVisible;
  if(!active?.loginCount||prevActive!==data.activeId||data.settingsVisible)closeDrawer(false);
}
function scheduleTabNavigationUpdate(ensureActive=false){
  // Layout and scroll position must survive frequent load-status updates.
  cancelAnimationFrame(tabScrollFrame);
  tabScrollFrame=requestAnimationFrame(()=>{
    if(ensureActive){
      const active=Array.from($('tabs').children).find(tab=>tab.dataset.appId===current.activeId);
      if(active){
        const strip=$('tabs');
        const left=active.offsetLeft-strip.offsetLeft;
        const right=left+active.offsetWidth;
        const visibleStart=strip.scrollLeft, visibleEnd=visibleStart+strip.clientWidth;
        if(left<visibleStart+5)strip.scrollTo({left:Math.max(0,left-9),behavior:'smooth'});
        else if(right>visibleEnd-5)strip.scrollTo({left:right-strip.clientWidth+9,behavior:'smooth'});
      }
    }
    updateTabNavigation();
  });
}
function updateTabNavigation(){
  if(current.tabLayout==='vertical')return;
  const strip=$('tabs');
  const overflow=strip.scrollWidth>strip.clientWidth+3;
  for(const id of ['tabLeft','tabRight','tabPickerButton'])$(id).hidden=!overflow;
  if(!overflow && pickerOpen)closeTabPicker();
  $('tabLeft').disabled=strip.scrollLeft<3;
  $('tabRight').disabled=strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-3;
  $('tabPickerButton').setAttribute('aria-expanded',String(pickerOpen));
  $('tabPickerButton').title=overflow?'Search all '+current.apps.length+' tabs':'All tabs';
}
function scrollTabs(direction){
  $('tabs').scrollBy({left:direction*Math.max(200,Math.round($('tabs').clientWidth*.75)),behavior:'smooth'});
}
$('tabLeft').onclick=()=>scrollTabs(-1);
$('tabRight').onclick=()=>scrollTabs(1);
$('tabs').addEventListener('scroll',updateTabNavigation,{passive:true});
$('tabs').addEventListener('wheel',event=>{
  if(Math.abs(event.deltaY)>Math.abs(event.deltaX) && $('tabs').scrollWidth>$('tabs').clientWidth){
    event.preventDefault();
    $('tabs').scrollLeft+=event.deltaY;
  }
},{passive:false});
new ResizeObserver(()=>scheduleTabNavigationUpdate(false)).observe($('tabViewport'));
function renderTabPicker(){
  const query=$('tabPickerSearch').value.toLocaleLowerCase().trim();
  const list=$('tabPickerItems');list.replaceChildren();
  current.apps.filter(a=>!a.hidden).forEach((app,index)=>{
    if(!(app.name+' '+app.url+' '+(app.group||'')).toLocaleLowerCase().includes(query))return;
    const item=button('',async()=>{
      await closeTabPicker();
      if(tabGroupFilter!=='all' && tabGroupFilter!==groupOptionValue(app.group||''))tabGroupFilter='all';
      window.multiApp.activate(app.id);
    },app.id===current.activeId?'selected':'');
    item.setAttribute('role','option');
    item.setAttribute('aria-selected',String(app.id===current.activeId));
    item.append(el('span',{class:'tabPickName',text:app.name}),el('span',{class:'tabPickNum',text:app.group||String(index+1)}));
    item.title=app.url;
    list.append(item);
  });
  if(!list.childElementCount)list.append(el('p',{id:'tabPickerEmpty',text:'No matching tabs'}));
}
async function openTabPicker(){
  if(pickerOpen)return;
  if(drawerOpen)await closeDrawer();
  try{
    const result=await window.multiApp.setDrawer(true);
    if(!result?.ok)return;
    pickerOpen=true;
    $('tabPicker').hidden=false;
    $('tabPickerSearch').value='';
    renderTabPicker();
    $('tabPickerSearch').focus();
    updateTabNavigation();
  }catch(err){toast(err.message);}
}
async function closeTabPicker(){
  if(!pickerOpen)return;
  pickerOpen=false;
  $('tabPicker').hidden=true;
  $('tabPickerSearch').value='';
  updateTabNavigation();
  try{await window.multiApp.setDrawer(false);}catch(err){toast(err.message);}
}
$('tabPickerButton').onclick=()=>pickerOpen?closeTabPicker():openTabPicker();
$('tabPickerSearch').addEventListener('input',renderTabPicker);
$('tabPickerSearch').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const first=$('tabPickerItems').querySelector('button');
    if(first){e.preventDefault();first.click();}
  }
  if(e.key==='Escape'){e.preventDefault();closeTabPicker();}
});
$('closeSignIn').onclick=()=>{if(current.activeId)window.multiApp.closePopup(current.activeId);};
$('responsivePreview').onclick=()=>{if(current.activeId)window.multiApp.toggleResponsivePreview(current.activeId);};
$('fullscreenButton').onclick=()=>window.multiApp.toggleFullscreen();
$('minimizeButton').onclick=()=>window.multiApp.windowControl('minimize');
$('maximizeButton').onclick=()=>window.multiApp.windowControl('maximize');
$('closeButton').onclick=()=>window.multiApp.windowControl('close');
for(const action of ['back','forward','reload','home'])
  $(action).onclick=()=>{if(current.activeId)window.multiApp.navigate(current.activeId,action);};
function id(prefix){return prefix+'_'+Math.random().toString(36).slice(2,11);}
function showSettings(){
  closeTabPicker();
  closeDrawer(false);
  Promise.all([window.multiApp.openSettings(),window.multiApp.securityStatus()]).then(([config,status])=>{
    draft=structuredClone(config);
    settingsBaseline=JSON.stringify(config);
    expandedAppIds.clear();expandedLoginIds.clear();
    if(draft.apps[0])expandedAppIds.add(draft.apps[0].id);
    $('securityNote').textContent=status.encryptionAvailable
      ? 'Settings are saved in a local SQLite database. Demo passwords use OS keyring encryption when available. Exported settings are encrypted with the password you supply.'
      : status.developmentPlaintextOverride
        ? 'DEVELOPMENT ONLY: plaintext demo password storage is explicitly enabled. Never use real credentials. Packaged builds block new plaintext passwords.'
        : 'No secure OS credential vault is available. New demo passwords cannot be saved in packaged builds. Existing legacy plaintext demo passwords may remain until cleared. Configure an OS keyring to store new passwords securely.';
    importSummary=null; $('importPreview').hidden=true; $('unlockImport').hidden=true;
    $('platformTitle').value=draft.title;
    $('themeSelect').value=draft.theme||'auto';
    $('tabLayoutSelect').value=draft.tabLayout||'horizontal';
    renderSettings();
  }).catch(err=>toast(err.message));
}
$('themeSelect').onchange=()=>{if(!draft)return;draft.theme=$('themeSelect').value;reportSettingsChanges();};
$('tabLayoutSelect').onchange=()=>{if(!draft)return;draft.tabLayout=$('tabLayoutSelect').value;reportSettingsChanges();};
function appMetaText(app){
  return (app.hidden?'Hidden · ':'')+(app.group?app.group+' · ':'')+
    (app.displayMode==='mobile'?'Mobile':'Desktop')+' · '+app.logins.length+' '+(app.logins.length===1?'login':'logins');
}
function reorderApps(fromId,toId){
  if(!draft||fromId===toId)return;
  const from=draft.apps.findIndex(a=>a.id===fromId),to=draft.apps.findIndex(a=>a.id===toId);
  if(from<0||to<0)return;
  const [app]=draft.apps.splice(from,1);
  draft.apps.splice(to,0,app);
  draft.apps.forEach((a,i)=>{a.order=i;});
  draggingAppId=null;
  renderSettings();
  toast('Application order updated. Save changes to apply.');
}
function summaryAction(text,description,action){
  const control=button(text,event=>{
    event.preventDefault();
    event.stopPropagation();
    action();
  });
  control.title=description;
  control.setAttribute('aria-label',description);
  return control;
}
function renderSettings(){
  if(!draft)return;
  draft.title=$('platformTitle').value||draft.title;
  $('platformTitle').value=draft.title;
  const target=$('appEditor');
  target.replaceChildren();
  draft.apps.forEach((app,index)=>{
    const panel=el('details',{class:'appEditor'+(app.hidden?' isHidden':'')});
    panel.open=expandedAppIds.has(app.id);
    panel.addEventListener('toggle',()=>{if(panel.open)expandedAppIds.add(app.id);else expandedAppIds.delete(app.id);});
    const grip=el('span',{class:'dragGrip',text:'⠿'});
    grip.title='Drag to reorder '+(app.name||'application');
    grip.setAttribute('role','img');
    grip.setAttribute('aria-label','Drag handle for '+(app.name||'application')+'. Arrow buttons also reorder.');
    grip.draggable=true;
    grip.onclick=e=>{e.preventDefault();e.stopPropagation();};
    grip.ondragstart=e=>{
      draggingAppId=app.id;
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',app.id);
    };
    grip.ondragend=()=>{draggingAppId=null;panel.classList.remove('dragTarget');};
    panel.ondragover=e=>{
      if(!draggingAppId||draggingAppId===app.id)return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      panel.classList.add('dragTarget');
    };
    panel.ondragleave=e=>{if(!panel.contains(e.relatedTarget))panel.classList.remove('dragTarget');};
    panel.ondrop=e=>{
      e.preventDefault();
      panel.classList.remove('dragTarget');
      const source=draggingAppId||e.dataTransfer.getData('text/plain');
      reorderApps(source,app.id);
    };
    const meta=el('span',{class:'summaryMeta',text:appMetaText(app)});
    const heading=el('span',{class:'summaryTitle',text:(index+1)+'. '+(app.name||'New application')});
    const up=summaryAction('↑','Move '+app.name+' up',()=>moveApp(index,-1));
    const down=summaryAction('↓','Move '+app.name+' down',()=>moveApp(index,1));
    up.disabled=index===0;down.disabled=index===draft.apps.length-1;
    const hide=summaryAction(app.hidden?'Show':'Hide',(app.hidden?'Show ':'Hide ')+(app.name||'application'),()=>{
      app.hidden=!app.hidden;
      renderSettings();
      toast(app.hidden?'Application hidden from tabs. Save changes to apply.':'Application visible in tabs after saving.');
    });
    hide.className='visibilityToggle'+(app.hidden?' isHidden':'');
    const summary=el('summary',{},[
      grip,heading,meta,
      el('span',{class:'summaryActions'},[up,down,hide])
    ]);
    panel.append(summary);
    const content=el('div',{class:'appContent'});
    const head=el('div',{class:'editHead'},[
      el('strong',{text:'Application details'}),
      button('Delete',()=>{
        if(confirm('Permanently remove '+app.name+' from this configuration? Browser storage is not automatically deleted.')){
          draft.apps.splice(index,1);
          expandedAppIds.delete(app.id);
          renderSettings();
        }
      },'danger')
    ]);
    content.append(head);
    content.append(el('div',{class:'grid2'},[
      field('Application name',app.name,v=>{
        app.name=v;
        heading.textContent=(index+1)+'. '+(v||'New application');
      },{maxLength:100}),
      field('Stable ID',app.id,v=>app.id=v,{maxLength:48})
    ]));
    content.append(field('Website URL',app.url,v=>app.url=v,{placeholder:'https://app.example.com',maxLength:2048}));
    const modeControl=el('select');
    for(const [value,label] of [['desktop','Desktop (full window)'],['mobile','Mobile (phone preview)']]){
      const option=el('option',{text:label});
      option.value=value;
      modeControl.append(option);
    }
    modeControl.value=app.displayMode||'desktop';
    modeControl.onchange=()=>{app.displayMode=modeControl.value;meta.textContent=appMetaText(app);reportSettingsChanges();};
    content.append(el('div',{class:'grid2'},[
      el('label',{class:'field'},[el('span',{text:'Display mode'}),modeControl]),
      field('Group (optional)',app.group||'',v=>{
        app.group=v;
        meta.textContent=appMetaText(app);
      },{maxLength:64,placeholder:'e.g. Operations, Sales or Personal'})
    ]));
    const loginTitle=el('div',{class:'settingsTools'},[
      el('div',{},[
        el('h3',{text:'Demo accounts ('+app.logins.length+')'}),
        el('span',{class:'note',text:'Each account has its own title, username, description and optional demo password.'})
      ]),
      el('div',{class:'actions'},[
        button('Expand logins',()=>{for(const l of app.logins)expandedLoginIds.add(loginKey(app.id,l.id));renderSettings();}),
        button('Collapse logins',()=>{for(const l of app.logins)expandedLoginIds.delete(loginKey(app.id,l.id));renderSettings();})
      ])
    ]);
    content.append(loginTitle);
    const loginList=el('div',{class:'loginList'});
    app.logins.forEach((login,j)=>{
      const box=el('details',{class:'loginEditor'});
      const key=loginKey(app.id,login.id);
      box.open=expandedLoginIds.has(key);
      box.addEventListener('toggle',()=>{if(box.open)expandedLoginIds.add(key);else expandedLoginIds.delete(key);});
      const loginHeading=el('span',{class:'summaryTitle',text:login.title||'New demo account'});
      const loginUsername=el('span',{class:'summaryMeta',text:login.username||'No username'});
      const status=el('span',{class:'loginStatus',text:(login.hasPassword||login.password)?'Password set':'No password'});
      const loginSummary=el('summary',{},[loginHeading,loginUsername,status]);
      box.append(loginSummary);
      const loginContent=el('div',{class:'loginContent'});
      loginContent.append(el('div',{class:'editHead'},[
        el('strong',{text:'Account details'}),
        button('↑',()=>moveLogin(app,j,-1)),
        button('↓',()=>moveLogin(app,j,1)),
        button('Remove',()=>{
          if(!confirm('Remove demo account '+login.title+'?'))return;
          app.logins.splice(j,1);renderSettings();
        },'danger')
      ]));
      loginContent.append(el('div',{class:'grid2'},[
        field('Title',login.title,v=>{login.title=v;loginHeading.textContent=v||'New demo account';},{maxLength:100}),
        field('Username / email',login.username,v=>{login.username=v;loginUsername.textContent=v||'No username';},{maxLength:500})
      ]));
      loginContent.append(field('Description',login.description,v=>login.description=v,{multiline:true,maxLength:1000}));
      const pwd=field(login.hasPassword?'Replace saved password (leave blank to keep)':'Password (optional)',login.password||'',v=>{
        login.password=v;
        if(v)login.clearPassword=false;
        status.textContent=(login.hasPassword||v)?'Password set':'No password';
      },{type:'password',maxLength:2048});
      loginContent.append(pwd);
      if(login.hasPassword)loginContent.append(button('Clear saved password',()=>{
        login.clearPassword=true;login.hasPassword=false;
        delete login.password;
        renderSettings();
      },'danger'));
      box.append(loginContent);
      loginList.append(box);
    });
    content.append(loginList);
    content.append(button('+ Add demo account',()=>{
      if(app.logins.length>=50){toast('Maximum 50 demo accounts per app');return;}
      const login={id:id('login'),title:'Demo account '+(app.logins.length+1),description:'',username:'',password:''};
      app.logins.push(login);
      expandedAppIds.add(app.id);
      expandedLoginIds.add(loginKey(app.id,login.id));
      renderSettings();
      const cards=target.children[index]?.querySelectorAll('.loginEditor');
      const latest=cards?.[cards.length-1];
      latest?.scrollIntoView({behavior:'smooth',block:'center'});
      latest?.querySelector('input')?.focus();
    },'secondary'));
    panel.append(content);
    target.append(panel);
  });
  reportSettingsChanges();
}
$('expandAllApps').onclick=()=>{if(!draft)return;for(const app of draft.apps)expandedAppIds.add(app.id);renderSettings();};
$('collapseAllApps').onclick=()=>{expandedAppIds.clear();renderSettings();};
function moveApp(i,delta){
  // The editor is a draft. It will be included in the unsaved-changes check.
  const j=i+delta;
  if(!draft || j<0 || j>=draft.apps.length)return;
  const [app]=draft.apps.splice(i,1);
  draft.apps.splice(j,0,app);
  draft.apps.forEach((item,index)=>{item.order=index;});
  renderSettings();
  toast('Tab order updated. Save changes to apply.');
}
function moveLogin(a,i,delta){const j=i+delta;if(j<0||j>=a.logins.length)return;[a.logins[i],a.logins[j]]=[a.logins[j],a.logins[i]];renderSettings();}
function previewImport(result){
  const {apps,logins,filename}=result.summary;
  const existing=draft.apps.length;
  if(!confirm('Import '+apps+' apps and '+logins+' demo logins from "'+filename+'"?\n\nThis will REPLACE the '+existing+' apps currently shown in Settings. Nothing is saved until you click Save changes. Existing passwords for matching app and login IDs remain if imported password is empty.'))return;
  draft=structuredClone(result.settings);
  $('themeSelect').value=draft.theme||'auto';
  $('tabLayoutSelect').value=draft.tabLayout||'horizontal';
  expandedAppIds.clear();expandedLoginIds.clear();
  if(draft.apps[0])expandedAppIds.add(draft.apps[0].id);
  importSummary=result.summary;
  $('platformTitle').value=draft.title;
  renderSettings();
  reportSettingsChanges();
  $('unlockImport').hidden=true;
  $('importPassphrase').value='';
  $('importPreview').hidden=false;
  $('importPreview').textContent='Preview imported from '+filename+': '+apps+' apps and '+logins+' demo logins. Review then Save changes to apply, or Cancel to discard.';
  toast('Import loaded for review. Save changes to apply.');
}
$('unlockImportButton').onclick=async()=>{
  const password=$('importPassphrase').value;
  if(!password){toast('Enter the export password');return;}
  try{
    const result=await window.multiApp.importSettings(password);
    previewImport(result);
  }catch(err){
    $('importPreview').hidden=false;
    $('importPreview').textContent='Decryption failed: '+err.message;
  }
};
$('cancelImportButton').onclick=()=>{$('unlockImport').hidden=true;$('importPassphrase').value='';};
$('exportSettings').onclick=async()=>{
  const passphrase=$('exportPassphrase').value;
  if(passphrase.length<8){toast('Export password must be at least 8 characters');return;}
  if(passphrase!==$('exportConfirm').value){toast('Export passwords do not match');return;}
  const btn=$('exportSettings');btn.disabled=true;
  try{
    const result=await window.multiApp.exportSettings(passphrase);
    if(!result.cancelled)toast('Encrypted settings exported: '+result.filename);
  }catch(err){toast('Export failed: '+err.message);}
  finally{$('exportPassphrase').value='';$('exportConfirm').value='';btn.disabled=false;}
};
$('importSettings').onclick=async()=>{
  if(!draft)return;
  const button=$('importSettings'); button.disabled=true;
  try{
    const result=await window.multiApp.importSettings();
    if(result.cancelled)return;
    if(result.needsPassword){
      $('unlockImport').hidden=false;
      $('importPassphrase').focus();
      toast('Encrypted import selected. Enter its password.');
      return;
    }
    previewImport(result);
  }catch(err){
    $('importPreview').hidden=false;
    $('importPreview').textContent='Import error: '+err.message;
    toast('Import failed: '+err.message);
  }finally{button.disabled=false;}
};
$('downloadTemplate').onclick=async()=>{
  const button=$('downloadTemplate');button.disabled=true;
  try{
    const result=await window.multiApp.downloadTemplate();
    if(!result.cancelled)toast('Template saved: '+result.filename);
  }catch(err){toast('Download failed: '+err.message);}finally{button.disabled=false;}
};
$('settingsButton').onclick=()=>current.settingsVisible ? discardSettings() : showSettings();
$('cancelSettings').onclick=discardSettings;
$('addApp').onclick=()=>{if(draft.apps.length>=40){toast('Maximum 40 apps');return;}const app={id:id('app'),name:'',url:'https://',displayMode:'desktop',group:'',hidden:false,logins:[]};draft.apps.push(app);expandedAppIds.add(app.id);renderSettings();};
$('saveSettings').onclick=async()=>{
  if(!draft)return;
  draft.title=$('platformTitle').value;
  const btn=$('saveSettings');btn.disabled=true;
  try{
    for (const app of draft.apps) {
      if(!app.name?.trim())throw new Error('Each application needs a name');
      for(const login of app.logins){
        if(!login.title?.trim())throw new Error('A demo login in '+app.name+' needs a title');
      }
    }
    const result=await window.multiApp.saveSettings(draft);
    if(!result.ok)throw new Error(result.error||'Could not save');
    const expectedOrder=draft.apps.map(a=>a.id);
    if(JSON.stringify(result.order)!==JSON.stringify(expectedOrder))throw new Error('Saved tab order does not match Settings');
    draft=null;settingsBaseline=null;await window.multiApp.closeSettings();
    const restored=await window.multiApp.ready();
    if(JSON.stringify(restored.apps.map(a=>a.id))!==JSON.stringify(expectedOrder))throw new Error('Tabs are not displaying in the saved order');
    toast('Settings saved. Tabs updated in the selected order.');
  }catch(err){
    $('importPreview').hidden=false;
    $('importPreview').textContent='Could not save settings: '+err.message;
    $('importPreview').scrollIntoView({behavior:'smooth',block:'nearest'});
    toast('Save failed: '+err.message);
  }finally{btn.disabled=false;}
};
function copyIconButton(loginId,field){
  const label=field==='username'?'Copy username':'Copy password';
  const control=button('',()=>copyField(loginId,field),'copyIconButton');
  control.title=label;
  control.setAttribute('aria-label',label);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  for(const d of ['M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2','M10 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z']){
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d',d);
    svg.append(p);
  }
  control.append(svg);
  return control;
}
async function openDrawer(){
  if(pickerOpen)await closeTabPicker();
  if(!current.activeId||!current.apps.find(a=>a.id===current.activeId)?.loginCount)return;
  try {
    demoEntries=await window.multiApp.listLogins(current.activeId);
    if(!demoEntries.length)return;
    if(!initializedDrawerApps.has(current.activeId)){
      initializedDrawerApps.add(current.activeId);
      expandedDrawerLoginIds.add(loginKey(current.activeId,demoEntries[0].id));
    }
    await window.multiApp.setDrawer(true);
    drawerOpen=true;$('drawer').hidden=false;$('drawerTitle').textContent='Demo logins';
    $('loginCards').replaceChildren();
    for(const login of demoEntries){
      const card=el('details',{class:'loginCard'});
      const key=loginKey(current.activeId,login.id);
      card.open=expandedDrawerLoginIds.has(key);
      card.addEventListener('toggle',()=>{if(card.open)expandedDrawerLoginIds.add(key);else expandedDrawerLoginIds.delete(key);});
      card.append(el('summary',{},[
        el('span',{class:'summaryTitle',text:login.title}),
        el('span',{class:'summaryMeta',text:login.username||'No username'})
      ]));
      const details=el('div',{class:'loginCardContent'},[
        el('p',{text:login.description}),
        el('div',{class:'secretrow'},[
          el('code',{text:login.username||'No username'}),
          copyIconButton(login.id,'username')
        ])
      ]);
      if(login.hasPassword)details.append(el('div',{class:'secretrow'},[
        el('code',{text:'••••••••'}),
        copyIconButton(login.id,'password')
      ]));
      card.append(details);
      $('loginCards').append(card);
    }
  }catch(err){toast(err.message);}
}
async function copyField(loginId,field){
  try{await window.multiApp.copyLogin(current.activeId,loginId,field);toast(field==='password'?'Password copied to clipboard':'Username copied to clipboard');}
  catch(err){toast('Copy failed: '+err.message);}
}
async function closeDrawer(notify=true){
  if(!drawerOpen)return;
  drawerOpen=false;$('drawer').hidden=true;
  if(notify)try{await window.multiApp.setDrawer(false);}catch(err){toast(err.message);}
  else window.multiApp.setDrawer(false).catch(()=>{});
}
$('loginMenu').onclick=()=>drawerOpen?closeDrawer():openDrawer();
$('closeDrawer').onclick=()=>closeDrawer();
window.multiApp.onState(render);
window.multiApp.ready().then(render);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && pickerOpen){e.preventDefault();closeTabPicker();return;}
  if(e.key==='Escape' && drawerOpen)closeDrawer();
  if(e.key==='Escape' && current.settingsVisible){discardSettings();}
  if(current.settingsVisible)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r'){e.preventDefault();if(current.activeId)window.multiApp.navigate(current.activeId,'reload');}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openTabPicker();return;}
  const navApps=visibleTabApps(current);
  if((e.ctrlKey||e.metaKey)&&e.key==='Tab'&&navApps.length){e.preventDefault();const i=navApps.findIndex(a=>a.id===current.activeId);window.multiApp.activate(navApps[(i+(e.shiftKey?-1:1)+navApps.length)%navApps.length].id);}
});
