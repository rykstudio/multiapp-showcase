'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/instant-tooltips.js'),'utf8');

function tooltipHarness(bounds){
  const listeners=new Map();
  const hint={
    hidden:true,style:{},textContent:'',
    getBoundingClientRect(){return {width:120,height:24};}
  };
  const header={getBoundingClientRect(){return {left:0,top:0,bottom:71,height:71};}};
  const button={
    disabled:false,hidden:false,isConnected:true,dataset:{tooltip:'Switch to vertical tabs'},
    getBoundingClientRect(){return bounds;},
    setAttribute(key,value){this[key]=value;},
    removeAttribute(key){delete this[key];},
    contains(target){return target===this;}
  };
  const document={
    getElementById(id){return id==='instantTooltip'?hint:null;},
    querySelector(selector){return selector==='header'?header:null;},
    addEventListener(type,fn){listeners.set(type,fn);}
  };
  const window={innerWidth:1280,addEventListener(){}};
  vm.runInNewContext(source,{document,window});
  return {hint,button,listeners};
}

test('hovering toolbar icons instantly shows compact tooltip below both control rows',()=>{
  const {hint,button,listeners}=tooltipHarness({left:1060,top:40,bottom:69,width:30,height:29});
  listeners.get('pointerover')({target:{closest:()=>button}});
  assert.equal(hint.hidden,false);
  assert.equal(hint.textContent,'Switch to vertical tabs');
  assert.equal(hint.style.width,'max-content');
  assert.equal(hint.style.maxWidth,'220px');
  assert.equal(hint.style.top,'77px');
  assert.equal(hint.style.left,'1015px');
  assert.equal(button['aria-describedby'],'instantTooltip');
  listeners.get('pointerout')({target:button,relatedTarget:null});
  assert.equal(hint.hidden,true);
  assert.equal(button['aria-describedby'],undefined);
});

test('window controls in upper tab strip show tooltip below whole toolbar, not over icons',()=>{
  const {hint,button,listeners}=tooltipHarness({left:1235,top:1,bottom:33,width:30,height:32});
  button.dataset.tooltip='Close window';
  listeners.get('pointerover')({target:{closest:()=>button}});
  assert.equal(hint.style.top,'77px');
  assert.equal(hint.style.left,'1154px');
  assert.equal(hint.hidden,false);
});

test('disabled controls never show tooltips',()=>{
  const {hint,button,listeners}=tooltipHarness({left:1110,top:40,bottom:69,width:30,height:29});
  button.disabled=true;
  listeners.get('focusin')({target:{closest:()=>button}});
  assert.equal(hint.hidden,true);
  assert.equal(button['aria-describedby'],undefined);
});

test('native ImageView receives a compact PNG above embedded website on hover',()=>{
  const listeners=new Map();
  const sent=[];
  const hint={hidden:true,style:{},textContent:'',
    getBoundingClientRect(){return {width:120,height:24};}};
  const button={disabled:false,hidden:false,isConnected:true,dataset:{tooltip:'Settings'},
    getBoundingClientRect(){return {left:1040,top:40,bottom:69,width:30,height:29};},
    setAttribute(){},removeAttribute(){},contains(target){return target===this;}};
  const ctx={
    font:'',fillStyle:'',strokeStyle:'',lineWidth:0,textBaseline:'',
    measureText(){return {width:63};},
    setTransform(){},beginPath(){},roundRect(){},fill(){},stroke(){},fillText(){}
  };
  const canvas={getContext(){return ctx;},toDataURL(){return 'data:image/png;base64,ZGVtbw==';}};
  const document={
    getElementById(id){return id==='instantTooltip'?hint:null;},
    querySelector(){return {getBoundingClientRect(){return {bottom:71};}};},
    createElement(tag){assert.equal(tag,'canvas');return canvas;},
    addEventListener(name,fn){listeners.set(name,fn);}
  };
  const window={innerWidth:1280,devicePixelRatio:1,addEventListener(){},
    multiApp:{
      showTooltip(payload){sent.push({action:'show',payload});return Promise.resolve({ok:true});},
      hideTooltip(){sent.push({action:'hide'});return Promise.resolve({ok:true});}
    }
  };
  vm.runInNewContext(source,{document,window});
  listeners.get('pointerover')({target:{closest:()=>button}});
  assert.equal(sent[0].action,'show');
  assert.equal(sent[0].payload.y,77);
  assert.ok(sent[0].payload.width>=70&&sent[0].payload.width<=220);
  assert.match(sent[0].payload.png,/^data:image\/png;base64,/);
  listeners.get('pointerout')({target:button,relatedTarget:null});
  assert.equal(sent.at(-1).action,'hide');
  assert.equal(hint.hidden,true);
});

test('native tooltip view is added above active website using restricted IPC',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
  const preload=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');
  assert.match(main,/new ImageView\(\)/);
  assert.match(main,/win\.contentView\.addChildView\(tooltipView\)/);
  assert.match(main,/win\.contentView\.removeChildView\(tooltipView\)/);
  assert.match(main,/secureHandle\('tooltip:show'/);
  assert.match(main,/secureHandle\('tooltip:hide'/);
  assert.match(preload,/showTooltip:data=>ipcRenderer\.invoke\('tooltip:show',data\)/);
  assert.match(preload,/hideTooltip:\(\)=>ipcRenderer\.invoke\('tooltip:hide'\)/);
});
