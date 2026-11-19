'use strict';
const HEADER_HEIGHT=71;
const VERTICAL_HEADER_HEIGHT=35;
const COLLAPSED_SIDEBAR_WIDTH=56;
const DEFAULT_SIDEBAR_WIDTH=280;
function calculateBounds(width,height,mode='desktop',options={}){
  const w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));
  const vertical=options.tabLayout==='vertical';
  const header=vertical?VERTICAL_HEADER_HEIGHT:HEADER_HEIGHT;
  const sidebar=vertical?(options.sidebarCollapsed?COLLAPSED_SIDEBAR_WIDTH:Math.max(180,Math.min(420,options.sidebarWidth||DEFAULT_SIDEBAR_WIDTH))):0;
  const availableW=Math.max(1,w-sidebar);
  const availableH=Math.max(1,h-header);
  if(mode!=='mobile')return {x:sidebar,y:header,width:availableW,height:availableH};
  const frameWidth=Math.min(440,Math.max(1,availableW-48));
  const frameHeight=Math.min(890,Math.max(1,availableH-36));
  const frameX=sidebar+Math.floor((availableW-frameWidth)/2);
  const frameY=header+Math.floor((availableH-frameHeight)/2);
  return {
    x:frameX+12,
    y:frameY+54,
    width:Math.max(1,frameWidth-24),
    height:Math.max(1,frameHeight-74)
  };
}
module.exports={HEADER_HEIGHT,VERTICAL_HEADER_HEIGHT,COLLAPSED_SIDEBAR_WIDTH,DEFAULT_SIDEBAR_WIDTH,calculateBounds};
