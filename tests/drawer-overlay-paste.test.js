'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {calculateDrawerWidth,calculateDrawerBounds}=require('../src/view-layout');

const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');

test('desktop website stays visible while side drawer occupies the right edge',()=>{
  assert.equal(calculateDrawerWidth(1320,{tabLayout:'horizontal'}),440);
  assert.deepEqual(calculateDrawerBounds(1320,860,'desktop',{tabLayout:'horizontal'}),
    {x:0,y:71,width:880,height:789});
  assert.deepEqual(calculateDrawerBounds(1320,860,'desktop',{tabLayout:'vertical',sidebarWidth:280}),
    {x:280,y:35,width:600,height:825});
});

test('drawer remains responsive with collapsed or oversized sidebar',()=>{
  assert.deepEqual(calculateDrawerBounds(1320,860,'desktop',{tabLayout:'vertical',sidebarCollapsed:true,sidebarWidth:310}),
    {x:56,y:35,width:824,height:825});
  const narrow=calculateDrawerBounds(740,860,'desktop',{tabLayout:'vertical',sidebarWidth:420});
  assert.equal(narrow.x,420);
  assert.ok(narrow.width>=160);
  assert.deepEqual(calculateDrawerBounds(1320,860,'mobile',{tabLayout:'vertical',sidebarWidth:280}),
    {x:372,y:107,width:416,height:715});
});

test('opening the login drawer does not detach its native browser view',()=>{
  const block=main.slice(main.indexOf("secureHandle('drawer:set'"),main.indexOf("secureHandle('login:list'"));
  assert.match(block,/drawerVisible=visible;/);
  assert.match(block,/fitView\(\)/);
  assert.doesNotMatch(block,/hideView\(|attachActiveView\(/);
  assert.match(main,/const bounds=drawerVisible\s*\? calculateDrawerBounds/);
  assert.match(html,/#drawer\{width:var\(--drawer-width\)/);
  assert.match(renderer,/function updateDrawerChromeLayout\(/);
  assert.match(renderer,/document\.documentElement\.dataset\.drawerOpen/);
});

test('drawer offers separate Copy and Paste for username and password',()=>{
  assert.match(renderer,/copyIconButton\(login\.id,'username'\),\s*pasteIconButton\(login\.id,'username'\)/);
  assert.match(renderer,/const passwordCopy=copyIconButton\(login\.id,'password'\)/);
  assert.match(renderer,/const passwordPaste=pasteIconButton\(login\.id,'password'\)/);
  assert.match(renderer,/el\('span',\{class:'credentialLabel',text:'Password'\}\)/);
  assert.match(renderer,/No password saved/);
  assert.match(renderer,/passwordCopy\.disabled=true/);
  assert.match(renderer,/async function pasteField\(/);
  assert.match(html,/id="drawerFeedback"/);
  assert.match(html,/\.secretrow\{grid-template-columns:minmax\(0,1fr\) 32px 32px/);
});

test('Paste only targets explicitly focused editable website fields and never uses clipboard',()=>{
  const paste=main.slice(main.indexOf("async function pasteLogin("),main.indexOf("function createWindow(){"));
  assert.match(paste,/!drawerVisible\|\|settingsVisible\|\|id!==activeId/);
  assert.match(paste,/frame\.executeJavaScript\(FOCUSED_EDITABLE_CHECK\)/);
  assert.match(paste,/if\(!editable\)throw new Error/);
  assert.match(paste,/wc\.focus\(\)/);
  assert.match(paste,/await wc\.insertText\(value\)/);
  assert.doesNotMatch(paste,/clipboard|send\(|return \{.*value/);
  assert.match(main,/secureHandle\('login:paste'/);
  assert.match(preload,/pasteLogin:\(id,loginId,field\)=>ipcRenderer\.invoke\('login:paste'/);
});
