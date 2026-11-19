'use strict';
const { app, BrowserWindow, BrowserView, WebContentsView, ipcMain, shell, session, Menu, clipboard, safeStorage, dialog, nativeTheme, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {SettingsDatabase}=require('./settings-db');
const {encryptJson,decryptJson}=require('./crypto-export');
const {withSavedOrder,inSavedOrder} = require('./app-order');
const {canOpenEmbedded}=require('./popup-policy');
const {calculateBounds,calculateDrawerBounds}=require('./view-layout');
const {recordDiagnostic}=require('./diagnostics');
const {theme:validateTheme,group:validateGroup,groups:validateGroups,hidden:validateHidden,tabLayout:validateTabLayout,sidebarCollapsed:validateSidebarCollapsed,sidebarWidth:validateSidebarWidth,visibleApps,nextActiveId}=require('./config-features');

// Match the installed .desktop filename so GNOME/KDE can associate the running
// Electron process with the branded app icon instead of an unknown gear icon.
if(process.platform==='linux')app.setDesktopName('com.rykstudio.multiappshowcase.desktop');

// Only the main local UI frame may send privileged IPC requests.
function secureHandle(channel, handler) {
  ipcMain.handle(channel,(event,...args)=>{
    if(!win || win.isDestroyed() || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)
      throw new Error('Unauthorized IPC sender');
    return handler(event,...args);
  });
}
app.on('web-contents-created',(_event,contents)=>{
  contents.on('will-attach-webview',event=>event.preventDefault());
});
const APP_ICON_PATH = path.join(__dirname,'assets','zt-app-icon.png');
function appWindowIcon(){
  const icon=nativeImage.createFromPath(APP_ICON_PATH);
  if(icon.isEmpty())throw new Error('The bundled ZT application PNG icon is missing or unreadable');
  return icon;
}
const BAR_HEIGHT = 71;
const entries = new Map();
let win, config, activeId, configPath, lastError = '';
let settingsDB, pendingImport=null;
let diagnosticsDirectory=null;
function diagnostic(event,appId,code){if(diagnosticsDirectory)recordDiagnostic(diagnosticsDirectory,event,appId,code);}
let settingsVisible = false;
let drawerVisible = false;
let settingsDirty = false;
function toggleFullscreen() { if (!win || win.isDestroyed()) return false; win.setFullScreen(!win.isFullScreen()); return win.isFullScreen(); }

function encryptionReady() {
  return safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
}
// Packaged builds must never silently store new passwords in plaintext.
// Development-only override is deliberately unavailable in published installers.
function encryptPassword(value) {
  if(encryptionReady())return 'os:' + safeStorage.encryptString(value).toString('base64');
  if(!app.isPackaged && process.env.MULTIAPP_ALLOW_PLAINTEXT_DEMO_PASSWORDS==='1')return 'plain:' + value;
  throw new Error('Secure credential storage is unavailable. No new password was saved. Configure an OS keyring, or leave the demo password empty.');
}
function decryptPassword(value) {
  if (!value) return '';
  if(value.startsWith('plain:'))return value.slice(6);
  if(value.startsWith('os:')) {
    if (!encryptionReady())throw new Error('This password requires the OS keyring originally used to store it.');
    return safeStorage.decryptString(Buffer.from(value.slice(3),'base64'));
  }
  // Legacy versions wrote unprefixed safeStorage ciphertext.
  if (!encryptionReady())throw new Error('Cannot read a legacy encrypted password without its OS keyring.');
  return safeStorage.decryptString(Buffer.from(value,'base64'));
}
function sanitizeData(data, previous) {
  if (!data || !Array.isArray(data.apps) || data.apps.length > 40) throw new Error('Configuration must have no more than 40 apps');
  const seen = new Set();
  const oldApps = new Map((previous?.apps || []).map(a => [a.id, a]));
  const apps = inSavedOrder(data.apps).map((raw, i) => {
    if (!raw || typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(raw.id) || seen.has(raw.id)) throw new Error('Invalid or duplicate application ID at row ' + (i + 1));
    seen.add(raw.id);
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100) throw new Error('Application name is required (up to 100 characters)');
    let url;
    try { url = new URL(raw.url); } catch { throw new Error('Invalid URL for ' + raw.id); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are accepted');
    if (!Array.isArray(raw.logins || []) || (raw.logins || []).length > 50) throw new Error('Maximum 50 demo logins per application');
    const oldLogins = new Map((oldApps.get(raw.id)?.logins || []).map(a => [a.id, a]));
    const loginIds = new Set();
    const logins = (raw.logins || []).map((login, n) => {
      if (!login || typeof login.id !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(login.id) || loginIds.has(login.id)) throw new Error('Invalid or duplicate login ID in ' + raw.name);
      loginIds.add(login.id);
      if (typeof login.title !== 'string' || !login.title.trim() || login.title.length > 100) throw new Error('Demo login title required in ' + raw.name);
      const description = String(login.description || '').slice(0, 1000);
      const username = String(login.username || '').slice(0, 500);
      let passwordEnc = oldLogins.get(login.id)?.passwordEnc || '';
      if(passwordEnc.startsWith('plain:') && encryptionReady())passwordEnc=encryptPassword(passwordEnc.slice(6));
      if (Object.hasOwn(login, 'password') && login.password !== '') {
        if (typeof login.password !== 'string' || login.password.length > 2048) throw new Error('Password exceeds 2048 characters');
        passwordEnc = encryptPassword(login.password);
      }
      if (login.clearPassword === true) passwordEnc = '';
      return { id: login.id, title: login.title.trim(), description, username, passwordEnc };
    });
    if(raw.displayMode!==undefined && !['desktop','mobile'].includes(raw.displayMode))throw new Error('Invalid display mode for '+raw.id);
    return { id:raw.id, name:raw.name.trim(), url:url.toString(), displayMode:raw.displayMode||'desktop', group:validateGroup(raw.group), hidden:validateHidden(raw.hidden), logins };
  });
  return {title: String(data.title || 'MultiApp Showcase').trim().slice(0,100),theme:validateTheme(data.theme),tabLayout:validateTabLayout(data.tabLayout),sidebarCollapsed:validateSidebarCollapsed(data.sidebarCollapsed),sidebarWidth:validateSidebarWidth(data.sidebarWidth),groups:validateGroups(data.groups,apps), apps:withSavedOrder(apps)};
}
function validateImportedConfig(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.apps) || data.apps.length > 40) {
    throw new Error('Import JSON requires an apps array containing no more than 40 apps');
  }
  if (data.formatVersion !== undefined && data.formatVersion !== 1) throw new Error('Unsupported import format version');
  const ids = new Set();
  const apps = data.apps.map((a, i) => {
    if (!a || typeof a.id !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(a.id) || ids.has(a.id)) throw new Error('Invalid or duplicate app ID at row ' + (i + 1));
    ids.add(a.id);
    if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 100) throw new Error('Invalid app name for ' + a.id);
    if (typeof a.url !== 'string' || a.url.length > 2048) throw new Error('Invalid URL for ' + a.id);
    let url;
    try { url = new URL(a.url); } catch { throw new Error('Invalid URL for ' + a.id); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are accepted');
    if (a.logins !== undefined && !Array.isArray(a.logins)) throw new Error('Logins must be an array in ' + a.id);
    if ((a.logins || []).length > 50) throw new Error('Maximum 50 logins per application');
    const loginIds = new Set();
    const logins = (a.logins || []).map((l, j) => {
      if (!l || typeof l.id !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(l.id) || loginIds.has(l.id)) throw new Error('Invalid or duplicate login ID at ' + a.id + ':' + (j+1));
      loginIds.add(l.id);
      if (typeof l.title !== 'string' || !l.title.trim() || l.title.length > 100) throw new Error('Invalid login title for ' + a.id);
      if (l.passwordEnc !== undefined || l.clearPassword !== undefined || l.hasPassword !== undefined) throw new Error('Import JSON cannot include internal password fields');
      if (l.password !== undefined && (typeof l.password !== 'string' || l.password.length > 2048)) throw new Error('Invalid password in ' + a.id);
      if (l.username !== undefined && (typeof l.username !== 'string' || l.username.length > 500)) throw new Error('Invalid username in ' + a.id);
      if (l.description !== undefined && (typeof l.description !== 'string' || l.description.length > 1000)) throw new Error('Invalid description in ' + a.id);
      return {id:l.id,title:l.title.trim(),description:l.description || '',username:l.username || '',password:l.password || ''};
    });
    if(a.displayMode!==undefined && !['desktop','mobile'].includes(a.displayMode))throw new Error('Invalid display mode for '+a.id);
    const order=a.order;
    if(order!==undefined && (!Number.isSafeInteger(order)||order<0))throw new Error('Invalid order for '+a.id);
    return {id:a.id,name:a.name.trim(),url:url.toString(),displayMode:a.displayMode||'desktop',group:validateGroup(a.group),hidden:validateHidden(a.hidden),order,logins};
  });
  if (data.title !== undefined && (typeof data.title !== 'string' || data.title.length > 100)) throw new Error('Invalid platform title');
  const hasOrder=apps.some(a=>a.order!==undefined);
  if(hasOrder && (apps.some(a=>a.order===undefined)||new Set(apps.map(a=>a.order)).size!==apps.length))throw new Error('App order must be specified uniquely for every app or omitted entirely');
  if(hasOrder)apps.sort((a,b)=>a.order-b.order);
  return {title:data.title || 'MultiApp Showcase',theme:validateTheme(data.theme),tabLayout:validateTabLayout(data.tabLayout),sidebarCollapsed:validateSidebarCollapsed(data.sidebarCollapsed),sidebarWidth:validateSidebarWidth(data.sidebarWidth),groups:validateGroups(data.groups,apps),apps};
}
async function importSettings(passphrase) {
  let input,filename;
  if (pendingImport && typeof passphrase==='string') {
    input=decryptJson(pendingImport.data,passphrase);
    filename=pendingImport.filename;
    pendingImport=null;
  } else {
    pendingImport=null;
    const selected=await dialog.showOpenDialog(win,{
      title:'Import application settings',properties:['openFile'],
      filters:[{name:'JSON configuration',extensions:['json']}]
    });
    if(selected.canceled||!selected.filePaths.length)return {cancelled:true};
    const file=selected.filePaths[0];
    if(fs.statSync(file).size>1024*1024)throw new Error('Import JSON exceeds 1 MB');
    filename=path.basename(file);
    input=JSON.parse(fs.readFileSync(file,'utf8'));
    if(input?.format==='multiapp-encrypted-settings'){
      pendingImport={data:input,filename};
      return {needsPassword:true,filename};
    }
  }
  const incoming=validateImportedConfig(input);
  return {cancelled:false,settings:incoming,
    summary:{apps:incoming.apps.length,logins:incoming.apps.reduce((n,a)=>n+a.logins.length,0),filename}};
}
async function exportSettings(passphrase) {
  if(typeof passphrase!=='string'||passphrase.length<8)throw new Error('Export password must be at least 8 characters');
  const body={formatVersion:1,title:config.title,theme:config.theme||'auto',tabLayout:config.tabLayout||'horizontal',sidebarCollapsed:!!config.sidebarCollapsed,sidebarWidth:config.sidebarWidth||280,groups:config.groups||[],apps:config.apps.map(a=>({
    id:a.id,name:a.name,url:a.url,displayMode:a.displayMode||'desktop',group:a.group||'',hidden:!!a.hidden,order:a.order,logins:a.logins.map(l=>({
      id:l.id,title:l.title,description:l.description,username:l.username,
      password:l.passwordEnc?decryptPassword(l.passwordEnc):''
    }))
  }))};
  const encrypted=encryptJson(body,passphrase);
  const selected=await dialog.showSaveDialog(win,{
    title:'Export encrypted application settings',
    defaultPath:path.join(app.getPath('downloads'),'multiapp-settings-encrypted.json'),
    filters:[{name:'Encrypted JSON configuration',extensions:['json']}]
  });
  if(selected.canceled||!selected.filePath)return {cancelled:true};
  fs.writeFileSync(selected.filePath,JSON.stringify(encrypted,null,2)+'\n',{mode:0o600,flag:'w'});
  return {cancelled:false,filename:path.basename(selected.filePath)};
}
async function saveImportTemplate() {
  const template = path.join(__dirname, '../config/import-template.json');
  const selected = await dialog.showSaveDialog(win, {
    title:'Download settings JSON template',
    defaultPath:path.join(app.getPath('downloads'),'multiapp-settings-template.json'),
    filters:[{name:'JSON configuration',extensions:['json']}]
  });
  if (selected.canceled || !selected.filePath) return {cancelled:true};
  fs.copyFileSync(template,selected.filePath);
  return {cancelled:false, filename:path.basename(selected.filePath)};
}
function publicConfig() {
  return {title:config.title,theme:config.theme||'auto',tabLayout:config.tabLayout||'horizontal',sidebarCollapsed:!!config.sidebarCollapsed,sidebarWidth:config.sidebarWidth||280,groups:config.groups||[], apps:config.apps.map(a => ({id:a.id,name:a.name,url:a.url,displayMode:a.displayMode||'desktop',group:a.group||'',hidden:!!a.hidden,order:a.order,logins:a.logins.map(l => ({
    id:l.id,title:l.title,description:l.description,username:l.username,hasPassword:!!l.passwordEnc
  }))}))};
}
function saveLayoutPreferences(next) {
  if(!config)return {ok:false};
  const validated={...config,
    tabLayout:validateTabLayout(next.tabLayout===undefined?config.tabLayout:next.tabLayout),
    sidebarCollapsed:validateSidebarCollapsed(next.sidebarCollapsed===undefined?config.sidebarCollapsed:next.sidebarCollapsed),
    sidebarWidth:validateSidebarWidth(next.sidebarWidth===undefined?config.sidebarWidth:next.sidebarWidth)
  };
  settingsDB.write(validated);
  config=validated;
  fitView();
  emit();
  return {ok:true,tabLayout:validated.tabLayout,sidebarCollapsed:validated.sidebarCollapsed,sidebarWidth:validated.sidebarWidth};
}
function saveConfig(next) {
  // Settings order is authoritative even when an imported document has order fields.
  const normalized = {...next, apps:next.apps.map(({order, ...item}) => item)};
  const validated = sanitizeData(normalized, config);
  try{settingsDB.write(validated);}catch(err){diagnostic('settings-save-error','settings','sqlite-write');throw err;}
  applyConfig(validated);
  return {ok:true, order:validated.apps.map(a=>a.id)};
}
function popupDisplayTitle(contents) {
  if(!contents || contents.isDestroyed())return 'Page';
  const raw=String(contents.getTitle()||'').trim();
  if(raw && raw!=='about:blank')return raw.slice(0,160);
  try {
    const url=new URL(contents.getURL());
    return url.hostname && url.hostname!=='blank' ? url.hostname : 'Page';
  } catch {return 'Page';}
}
function state() {
  return { title:config?.title || 'MultiApp Showcase', theme:config?.theme||'auto', tabLayout:config?.tabLayout||'horizontal',sidebarCollapsed:!!config?.sidebarCollapsed,sidebarWidth:config?.sidebarWidth||280, resolvedTheme:nativeTheme.shouldUseDarkColors?'dark':'light', activeId, error:lastError, settingsVisible, fullScreen:win?.isFullScreen() || false, maximized:win?.isMaximized() || false,
    apps:(config?.apps || []).map(a => {
      const entry = entries.get(a.id), wc = (entry?.popup || entry?.view)?.webContents;
      return { id:a.id,name:a.name,url:wc?.getURL() || a.url,
        loading:entry?.loading || false, back:wc?.navigationHistory?.canGoBack() || false, forward:wc?.navigationHistory?.canGoForward() || false,
        failed:entry?.failed || '', loginCount:a.logins.length, popupActive:!!entry?.popup, popupTitle:entry?.popup ? popupDisplayTitle(entry.popup.webContents) : '', displayMode:a.displayMode||'desktop',group:a.group||'',hidden:!!a.hidden, previewMobile:!!entry?.previewMobile };
    })};
}
function emit() { if (win && !win.isDestroyed()) win.webContents.send('app:state',state()); }
function attachActiveView(entry) {
  if(!win || !entry)return;
  if(entry.popup)win.addBrowserView(entry.popup);
  else win.contentView.addChildView(entry.view);
}
function detachActiveView(entry) {
  if(!win || !entry)return;
  try {
    if(entry.popup)win.removeBrowserView(entry.popup);
    else win.contentView.removeChildView(entry.view);
  } catch {}
}
function effectiveDisplayMode(id) {
  const savedMode=config?.apps.find(a=>a.id===id)?.displayMode||'desktop';
  return savedMode==='mobile'||entries.get(id)?.previewMobile ? 'mobile' : 'desktop';
}
function toggleResponsivePreview(id) {
  if(typeof id!=='string'||id!==activeId||settingsVisible)return {ok:false};
  const entry=entries.get(id);
  const item=config?.apps.find(a=>a.id===id);
  if(!entry||!item||item.displayMode==='mobile')return {ok:false};
  // This is viewport-only responsive testing. Preserve the user agent,
  // browser partition and saved Desktop mode; do not reload the page.
  entry.previewMobile=!entry.previewMobile;
  fitView();emit();
  return {ok:true,previewMobile:entry.previewMobile};
}
function fitView() {
  if (!win || !activeId || settingsVisible) return;
  const entry=entries.get(activeId);
  if(!entry)return;
  const [w,h]=win.getContentSize();
  const mode=effectiveDisplayMode(activeId);
  const layout={tabLayout:config?.tabLayout||'horizontal',sidebarCollapsed:!!config?.sidebarCollapsed,sidebarWidth:config?.sidebarWidth||280};
  const bounds=drawerVisible
    ? calculateDrawerBounds(w,h,mode,layout)
    : calculateBounds(w,h,mode,layout);
  (entry.popup || entry.view).setBounds(bounds);
}
function hideView() {
  const entry = entries.get(activeId);
  if (win && entry)detachActiveView(entry);
}
function setSettings(visible) {
  if (settingsVisible === visible) return;
  if (visible) { hideView(); drawerVisible = false; }
  settingsVisible = visible;
  if (!visible)settingsDirty=false;
  if (!visible && activeId && entries.has(activeId) && !drawerVisible) {
    const entry=entries.get(activeId);
    attachActiveView(entry);
    fitView();
  }
  emit();
}
function ensureLoaded(id) {
  const entry=entries.get(id);
  if(!entry || entry.started)return;
  const item=config?.apps.find(a=>a.id===id);
  if(!item)return;
  entry.started=true;
  entry.view.webContents.loadURL(item.url).catch(err=>{
    if(!entries.has(id))return;
    entry.failed='Could not load site: '+err.message;
    emit();
  });
}
function activate(id) {
  if (!entries.has(id) || !win || config?.apps.find(a=>a.id===id)?.hidden) return;
  if (!settingsVisible) hideView();
  activeId = id; settingsVisible = false; drawerVisible = false;
  attachActiveView(entries.get(id));
  fitView();
  ensureLoaded(id);
  emit();
}
function createView(item) {
  const ses = session.fromPartition('persist:multiapp-' + item.id);
  ses.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
  ses.setPermissionCheckHandler(()=>false);
  const view = new WebContentsView({webPreferences:{session:ses,sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}});
  const entry = {view,popup:null,loading:false,failed:'',previewMobile:false,started:false};
  entries.set(item.id,entry);
  const wc=view.webContents;
  entry.defaultUserAgent=wc.getUserAgent();
  if(item.displayMode==='mobile')wc.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36');
  wc.on('before-input-event',(event,input)=>{
    if(input.type==='keyDown' && !input.isAutoRepeat && input.key==='F11') {event.preventDefault();toggleFullscreen();}
  });
  wc.setWindowOpenHandler(({url}) => {
    if(!canOpenEmbedded(url) || entry.popup)return {action:'deny'};
    return {
      action:'allow',
      createWindow:(options)=>{
        // A WebContentsView keeps the popup inside this application's tab
        // while preserving window.opener / postMessage needed by OAuth.
        // BrowserView supports options.webContents, which is required by Electron
        // to associate this popup with its window.open() opener. WebContentsView
        // does not support adopting that pre-created webContents.
        const popup=new BrowserView(options);
        const child=popup.webContents;
        if((config?.apps.find(a=>a.id===item.id)?.displayMode||item.displayMode)==='mobile')child.setUserAgent(wc.getUserAgent());
        if(child!==options.webContents)throw new Error('Popup must adopt Electron-provided webContents');
        child.setWindowOpenHandler(()=>({action:'deny'}));
        child.on('will-navigate',(event,target)=>{
          if(!canOpenEmbedded(target))event.preventDefault();
        });
        child.on('page-title-updated',emit);
        child.on('did-navigate',emit);
        child.on('did-navigate-in-page',emit);
        child.on('did-start-loading',emit);
        child.on('did-stop-loading',emit);
        child.on('destroyed',()=>{
          if(entry.popup!==popup)return;
          entry.popup=null;
          if(win && !win.isDestroyed() && activeId===item.id && !settingsVisible) {
            try {win.removeBrowserView(popup);}catch{}
            win.contentView.addChildView(view);
            fitView();
          }
          emit();
        });
        if(activeId===item.id && !settingsVisible) hideView();
        entry.popup=popup;
        if(win && activeId===item.id && !settingsVisible) {
          win.addBrowserView(popup);
          fitView();
        }
        emit();
        return child;
      }
    };
  });
  wc.on('will-navigate',(event,url)=>{if(!/^https?:\/\//i.test(url)) event.preventDefault();});
  wc.on('did-start-loading',()=>{entry.loading=true;entry.failed='';emit();});
  wc.on('did-stop-loading',()=>{entry.loading=false;emit();});
  wc.on('did-navigate',emit);
  wc.on('did-navigate-in-page',emit);
  wc.on('did-fail-load',(_e,code,desc,_url,isMainFrame)=>{if(isMainFrame && code!==-3){entry.failed='Navigation failed: '+desc;diagnostic('navigation-error',item.id,code);emit();}});
  wc.on('render-process-gone',(_event,details)=>{
    if(!entries.has(item.id))return;
    entry.loading=false;
    entry.failed='Tab crashed ('+String(details.reason||'unknown')+'). Use Reload to recover.';
    diagnostic('renderer-crash',item.id,details.reason);
    emit();
  });
  wc.on('unresponsive',()=>{entry.failed='Tab is unresponsive. Try Reload.';diagnostic('unresponsive',item.id,'hung');emit();});
  wc.on('responsive',()=>{if(entry.failed.startsWith('Tab is unresponsive'))entry.failed='';emit();});
}
function discard(id) {
  const entry=entries.get(id);
  if(!entry)return;
  if(activeId===id){hideView();activeId=undefined;}
  if(entry.popup && !entry.popup.webContents.isDestroyed())entry.popup.webContents.close();
  entry.view.webContents.close();entries.delete(id);
}
function applyConfig(next) {
  const old = new Map((config?.apps || []).map(a=>[a.id,a]));
  for(const id of [...entries.keys()])if(!next.apps.some(a=>a.id===id))discard(id);
  for(const item of next.apps){
    if(!entries.has(item.id))createView(item);
    else {
      const oldItem=old.get(item.id);
      if(item.displayMode==='mobile')entries.get(item.id).previewMobile=false;
      if(oldItem?.displayMode!==item.displayMode){
        const current=entries.get(item.id).view.webContents;
        current.setUserAgent(item.displayMode==='mobile'?'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36':entries.get(item.id).defaultUserAgent);
        current.reload();
      }
      if(oldItem?.url!==item.url && entries.get(item.id).started)entries.get(item.id).view.webContents.loadURL(item.url).catch(err=>{entries.get(item.id).failed='Navigation failed: '+err.message;emit();});
    }
  }
  const targetId=nextActiveId(next.apps,activeId);
  if(activeId!==targetId && !settingsVisible)hideView();
  config=next;lastError='';win?.setTitle(next.title);
  nativeTheme.themeSource=next.theme==='auto'?'system':next.theme;
  if(activeId!==targetId) {
    activeId=targetId;
    if(targetId && !settingsVisible && win){
      attachActiveView(entries.get(targetId));
      fitView();
      ensureLoaded(targetId);
    }
  } else if(activeId && !settingsVisible)fitView();
  if(!targetId && !settingsVisible)setSettings(true);
  emit();
}
function reloadConfig() {
  try {
    applyConfig(settingsDB.read());
    return {ok:true};
  } catch (err) {lastError=err.message;emit();return {ok:false,error:err.message};}
}
function closePopup(id) {
  const entry=entries.get(id);
  if(!entry?.popup)return {ok:false};
  const popup=entry.popup;
  entry.popup=null;
  if(win && !win.isDestroyed() && activeId===id && !settingsVisible && !drawerVisible) {
    try{win.removeBrowserView(popup);}catch{}
    win.contentView.addChildView(entry.view);
    fitView();
  }
  if(!popup.webContents.isDestroyed())popup.webContents.close();
  emit();
  return {ok:true};
}
function nav(id,action){
  if(id!==activeId || settingsVisible)return {ok:false};
  const entry=entries.get(id);
  const wc=(entry?.popup || entry?.view)?.webContents;
  if(!wc)return {ok:false};
  if(action==='back' && wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();
  else if(action==='forward' && wc.navigationHistory.canGoForward())wc.navigationHistory.goForward();
  else if(action==='reload'){
    if(!entry.started)ensureLoaded(id);
    else wc.reload();
  }
  else if(action==='home') {
    if(entry.popup)closePopup(id);
    else wc.loadURL(config.apps.find(a=>a.id===id).url).catch(()=>{});
  }
  emit();return {ok:true};
}
function copyLogin(id,loginId,field) {
  if(id!==activeId || !['username','password'].includes(field))throw new Error('Invalid demo login request');
  const login=config.apps.find(a=>a.id===id)?.logins.find(l=>l.id===loginId);
  if(!login)throw new Error('Demo login not found');
  const value=field==='username' ? login.username : login.passwordEnc ? decryptPassword(login.passwordEnc) : '';
  if(!value)throw new Error('No ' + field + ' configured');
  clipboard.writeText(value);
  return {ok:true};
}
// The value never crosses into the trusted settings renderer or the OS clipboard.
// Only a deliberate Paste click can insert into a currently focused website field.
const FOCUSED_EDITABLE_CHECK=`(()=>{
  const el=document.activeElement;
  if(!el||el===document.body||el===document.documentElement)return false;
  if(el.isContentEditable)return true;
  const tag=el.tagName?.toUpperCase();
  if(tag==='TEXTAREA')return !el.disabled&&!el.readOnly;
  if(tag==='INPUT')return !el.disabled&&!el.readOnly&&
    ['text','password','email','search','tel','url','number'].includes(el.type);
  return false;
})()`;
async function pasteLogin(id,loginId,field){
  if(!drawerVisible||settingsVisible||id!==activeId||!['username','password'].includes(field))
    throw new Error('Paste is only available from the open login drawer');
  const entry=entries.get(id);
  const wc=(entry?.popup||entry?.view)?.webContents;
  if(!wc||wc.isDestroyed())throw new Error('The active website is not available');
  const frame=wc.focusedFrame&&!wc.focusedFrame.isDestroyed()?wc.focusedFrame:wc.mainFrame;
  if(!frame||frame.isDestroyed())throw new Error('Select a website input field before pasting');
  let editable=false;
  try{editable=await frame.executeJavaScript(FOCUSED_EDITABLE_CHECK);}
  catch{throw new Error('Could not identify the active website input field');}
  if(!editable)throw new Error('Click an editable field in the website, then select Paste');
  // Check again after awaiting potentially untrusted page state.
  if(id!==activeId||!drawerVisible||settingsVisible||wc.isDestroyed())throw new Error('Active website changed during Paste');
  const login=config.apps.find(a=>a.id===id)?.logins.find(l=>l.id===loginId);
  if(!login)throw new Error('Demo login not found');
  const value=field==='username'?login.username:(login.passwordEnc?decryptPassword(login.passwordEnc):'');
  if(!value)throw new Error('No '+field+' configured');
  wc.focus();
  await wc.insertText(value);
  return {ok:true};
}
function createWindow(){
  win=new BrowserWindow({width:1320,height:860,minWidth:740,minHeight:540,title:'MultiApp Showcase',frame:false,
    icon:appWindowIcon(),backgroundColor:'#fff',webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname,'index.html'));
  win.on('resize',fitView);
  win.on('close',event=>{
    if(!settingsVisible||!settingsDirty)return;
    const selection=dialog.showMessageBoxSync(win,{
      type:'warning',title:'Unsaved settings',
      message:'You have unsaved changes in Settings.',
      detail:'Closing now will discard those changes.',
      buttons:['Keep editing','Discard and close'],defaultId:0,cancelId:0,noLink:true
    });
    if(selection!==1)event.preventDefault();
  });
  win.on('maximize',emit);
  win.on('unmaximize',emit);
  win.on('enter-full-screen',()=>{fitView();emit();});
  win.on('leave-full-screen',()=>{fitView();emit();});
  win.webContents.on('before-input-event',(event,input)=>{
    if(input.type==='keyDown' && !input.isAutoRepeat && input.key==='F11') { event.preventDefault(); toggleFullscreen(); }
  });
  win.on('closed',()=>{win=null;for(const id of [...entries.keys()])discard(id);});
  reloadConfig();
  win.webContents.on('did-finish-load',emit);
}
app.whenReady().then(()=>{
  // In development macOS runs the generic Electron executable; set Dock icon explicitly.
  // Installed macOS packages also embed the native high-resolution icon from the SVG.
  if(process.platform==='darwin' && !app.isPackaged && app.dock){
    app.dock.setIcon(appWindowIcon());
  }
  nativeTheme.on('updated',emit);
  const userData=app.getPath('userData');
  diagnosticsDirectory=userData;
  configPath=path.join(userData,'apps.json');
  settingsDB=new SettingsDatabase(userData);
  if(!settingsDB.isInitialized()) {
    const source=fs.existsSync(configPath)?configPath:path.join(__dirname,'../config/apps.json');
    const original=JSON.parse(fs.readFileSync(source,'utf8'));
    const migrated=sanitizeData(original);
    for(const a of migrated.apps)for(const l of a.logins){
      const prior=(original.apps.find(x=>x.id===a.id)?.logins||[]).find(x=>x.id===l.id);
      if(prior?.passwordEnc)l.passwordEnc=prior.passwordEnc;
    }
    settingsDB.write(migrated);
    // Keep the legacy JSON for recovery, rather than deleting credentials or
    // risking data loss if a migration is interrupted.
    if(source===configPath) {
      try {fs.renameSync(configPath,configPath+'.pre-sqlite-backup');}catch{}
    }
  }
  secureHandle('app:get-state',()=>state());
  secureHandle('window:toggle-fullscreen',()=>{toggleFullscreen();return state();});
  secureHandle('window:control',(_e,action)=>{
    if(!win || !['minimize','maximize','close'].includes(action))return {ok:false};
    if(action==='minimize')win.minimize();
    if(action==='maximize')win.isMaximized()?win.unmaximize():win.maximize();
    if(action==='close')win.close();
    return {ok:true};
  });
  secureHandle('layout:update',(_e,prefs)=>{
    if(!prefs||typeof prefs!=='object'||Array.isArray(prefs)||settingsVisible)return {ok:false};
    return saveLayoutPreferences(prefs);
  });
  secureHandle('tab:toggle-responsive-preview',(_e,id)=>toggleResponsivePreview(id));
  secureHandle('tab:close-popup',(_e,id)=>typeof id==='string' && id===activeId ? closePopup(id) : {ok:false});
  secureHandle('tab:activate',(_e,id)=>{if(typeof id==='string')activate(id);return state();});
  secureHandle('tab:navigate',(_e,d)=>d && typeof d.id==='string' && ['back','forward','reload','home'].includes(d.action) ? nav(d.id,d.action) : {ok:false});
  secureHandle('settings:open',()=>{settingsDirty=false;setSettings(true);return publicConfig();});
  secureHandle('settings:mark-dirty',(_event,dirty)=>{if(typeof dirty!=='boolean'||!settingsVisible)return {ok:false};settingsDirty=dirty;return {ok:true};});
  secureHandle('settings:close',()=>{setSettings(false);return state();});
  secureHandle('settings:get',()=>publicConfig());
  secureHandle('settings:save',(_e,d)=>saveConfig(d));
  secureHandle('settings:import',(_e,password)=>importSettings(password));
  secureHandle('settings:export',(_e,password)=>exportSettings(password));
  secureHandle('settings:template',saveImportTemplate);
  secureHandle('drawer:set',(_e,visible)=>{
    if(typeof visible!=='boolean' || settingsVisible || !activeId || !entries.has(activeId))return {ok:false};
    // Keep the native website in place and visible. Its bounds exclude the
    // right-side drawer so the trusted HTML UI can appear without z-order issues.
    drawerVisible=visible;
    fitView();
    return {ok:true};
  });
  secureHandle('login:list',(_e,id)=>{
    if(id!==activeId)return [];
    return (config.apps.find(a=>a.id===id)?.logins || []).map(l=>({id:l.id,title:l.title,description:l.description,username:l.username,hasPassword:!!l.passwordEnc}));
  });
  secureHandle('login:copy',(_e,d)=>d&&copyLogin(d.id,d.loginId,d.field));
  secureHandle('login:paste',(_e,d)=>d?pasteLogin(d.id,d.loginId,d.field):{ok:false});
  secureHandle('security:status',()=>({encryptionAvailable:encryptionReady(),developmentPlaintextOverride:!app.isPackaged && process.env.MULTIAPP_ALLOW_PLAINTEXT_DEMO_PASSWORDS==='1'}));
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('before-quit',()=>{settingsDB?.close();settingsDB=null;});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
