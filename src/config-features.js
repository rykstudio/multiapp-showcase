'use strict';
const THEMES=new Set(['auto','light','dark']);
function theme(value='auto'){
  if(value===undefined || value===null)return 'auto';
  if(typeof value!=='string'||!THEMES.has(value))throw new Error('Theme must be auto, light or dark');
  return value;
}
function group(value=''){
  if(value===undefined || value===null)return '';
  if(typeof value!=='string'||value.length>64)throw new Error('Group must be text of 64 characters or less');
  return value.trim();
}
function hidden(value=false){
  if(value===undefined || value===null)return false;
  if(typeof value!=='boolean')throw new Error('Hidden must be true or false');
  return value;
}
function tabLayout(value='horizontal') {
  if(value===undefined || value===null)return 'horizontal';
  if(value!=='horizontal' && value!=='vertical')throw new Error('Tab layout must be horizontal or vertical');
  return value;
}
function sidebarWidth(value=280){
  if(value===undefined || value===null)return 280;
  if(!Number.isInteger(value)||value<180||value>420)throw new Error('Sidebar width must be between 180 and 420 pixels');
  return value;
}
function sidebarCollapsed(value=false) {
  return hidden(value);
}
function visibleApps(apps){
  return (apps||[]).filter(a=>!a.hidden);
}
function nextActiveId(apps,activeId){
  const visible=visibleApps(apps);
  return visible.some(a=>a.id===activeId)?activeId:(visible[0]?.id);
}
function moveById(apps,fromId,toId){
  if(!Array.isArray(apps)||fromId===toId)return false;
  const from=apps.findIndex(x=>x.id===fromId),to=apps.findIndex(x=>x.id===toId);
  if(from<0||to<0)return false;
  const [app]=apps.splice(from,1);
  apps.splice(to,0,app);
  apps.forEach((a,i)=>{a.order=i;});
  return true;
}
module.exports={theme,group,hidden,tabLayout,sidebarCollapsed,sidebarWidth,visibleApps,nextActiveId,moveById};
