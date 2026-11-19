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
