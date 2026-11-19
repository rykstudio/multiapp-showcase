'use strict';
const {contextBridge, ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('multiApp',{
  ready:()=>ipcRenderer.invoke('app:get-state'),
  toggleFullscreen:()=>ipcRenderer.invoke('window:toggle-fullscreen'),
  windowControl:action=>ipcRenderer.invoke('window:control',action),
  showTooltip:data=>ipcRenderer.invoke('tooltip:show',data),
  hideTooltip:()=>ipcRenderer.invoke('tooltip:hide'),
  activate:id=>ipcRenderer.invoke('tab:activate',id),
  updateLayout:prefs=>ipcRenderer.invoke('layout:update',prefs),
  toggleResponsivePreview:id=>ipcRenderer.invoke('tab:toggle-responsive-preview',id),
  closePopup:id=>ipcRenderer.invoke('tab:close-popup',id),
  navigate:(id,action)=>ipcRenderer.invoke('tab:navigate',{id,action}),
  openSettings:()=>ipcRenderer.invoke('settings:open'),
  setSettingsDirty:dirty=>ipcRenderer.invoke('settings:mark-dirty',dirty),
  closeSettings:()=>ipcRenderer.invoke('settings:close'),
  getSettings:()=>ipcRenderer.invoke('settings:get'),
  saveSettings:data=>ipcRenderer.invoke('settings:save',data),
  importSettings:passphrase=>ipcRenderer.invoke('settings:import',passphrase),
  exportSettings:passphrase=>ipcRenderer.invoke('settings:export',passphrase),
  downloadTemplate:()=>ipcRenderer.invoke('settings:template'),
  setDrawer:visible=>ipcRenderer.invoke('drawer:set',visible),
  listLogins:id=>ipcRenderer.invoke('login:list',id),
  copyLogin:(id,loginId,field)=>ipcRenderer.invoke('login:copy',{id,loginId,field}),
  pasteLogin:(id,loginId,field)=>ipcRenderer.invoke('login:paste',{id,loginId,field}),
  securityStatus:()=>ipcRenderer.invoke('security:status'),
  onState:callback=>{const fn=(_,state)=>callback(state);ipcRenderer.on('app:state',fn);return ()=>ipcRenderer.removeListener('app:state',fn);}
});
