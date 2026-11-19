'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {calculateBounds,HEADER_HEIGHT,VERTICAL_HEADER_HEIGHT,COLLAPSED_SIDEBAR_WIDTH}=require('../src/view-layout');
const {tabLayout,sidebarWidth,sidebarCollapsed}=require('../src/config-features');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const sidebar=fs.readFileSync(path.join(__dirname,'../src/vertical-tabs.js'),'utf8');
const db=fs.readFileSync(path.join(__dirname,'../src/settings-db.js'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');

test('horizontal view retains full-width tab content and 71px header',()=>{
  assert.equal(HEADER_HEIGHT,71);
  assert.deepEqual(calculateBounds(1320,860,'desktop'),{x:0,y:71,width:1320,height:789});
});
test('vertical expanded view reserves sidebar width and 35px toolbar',()=>{
  assert.equal(VERTICAL_HEADER_HEIGHT,35);
  assert.deepEqual(calculateBounds(1320,860,'desktop',{tabLayout:'vertical',sidebarWidth:280}),
    {x:280,y:35,width:1040,height:825});
});
test('vertical collapsed sidebar leaves 56px while retaining actual browser sessions',()=>{
  assert.equal(COLLAPSED_SIDEBAR_WIDTH,56);
  assert.deepEqual(calculateBounds(1320,860,'desktop',{tabLayout:'vertical',sidebarCollapsed:true,sidebarWidth:310}),
    {x:56,y:35,width:1264,height:825});
});
test('phone-like preview is centered in the area not covered by sidebar',()=>{
  assert.deepEqual(calculateBounds(1320,860,'mobile',{tabLayout:'vertical',sidebarWidth:280}),
    {x:592,y:107,width:416,height:715});
});
test('sidebar preferences reject invalid or unsafe sizes and preserve legacy defaults',()=>{
  assert.equal(tabLayout(),'horizontal');
  assert.equal(tabLayout('vertical'),'vertical');
  assert.throws(()=>tabLayout('diagonal'));
  assert.equal(sidebarWidth(),280);
  assert.equal(sidebarWidth(420),420);
  assert.throws(()=>sidebarWidth(100));
  assert.throws(()=>sidebarWidth(421));
  assert.equal(sidebarCollapsed(),false);
  assert.equal(sidebarCollapsed(true),true);
  assert.throws(()=>sidebarCollapsed('true'));
});
test('window controls stay on horizontal tab bar and move to toolbar for vertical tabs',()=>{
  const top=html.slice(html.indexOf('<div id="toprow">'),html.indexOf('<div id="toolbar"'));
  const toolbar=html.slice(html.indexOf('<div id="toolbar"'),html.indexOf('</header>'));
  for(const id of ['tabs','tabLeft','tabRight','tabPickerButton','windowControls','minimizeButton','maximizeButton','closeButton'])
    assert.match(top,new RegExp('id="'+id+'"'));
  for(const id of ['fullscreenButton','settingsButton','tabLayoutToggle','responsivePreview','address'])
    assert.match(toolbar,new RegExp('id="'+id+'"'));
  assert.doesNotMatch(top,/id="fullscreenButton"|id="settingsButton"|id="topActions"/);
  assert.doesNotMatch(toolbar,/id="minimizeButton"|id="maximizeButton"|id="closeButton"/);
  assert.match(sidebar,/const host=vertical\?\$\('toolbar'\):\$\('toprow'\)/);
  assert.match(sidebar,/if\(controls\.parentElement!==host\)host\.append\(controls\)/);
});
test('vertical tabs support filter, collapse, resize, accessible selection and sidebar search',()=>{
  for(const id of ['verticalSidebar','verticalTabList','verticalGroupFilter','sidebarCollapse','sidebarSearch','sidebarResizeHandle','tabLayoutSelect'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/src="vertical-tabs\.js"/);
  assert.match(sidebar,/window\.multiApp\.activate\(app\.id\)/);
  assert.match(sidebar,/window\.multiApp\.updateLayout\(next\)/);
  assert.match(sidebar,/aria-selected/);
  assert.match(sidebar,/sidebarWidth/);
  assert.match(sidebar,/sidebarCollapsed/);
  assert.match(sidebar,/tabLayoutToggle/);
  assert.match(renderer,/window\.verticalTabs\.syncGroups/);
  assert.match(renderer,/window\.verticalTabs\.render/);
});
test('SQLite and encrypted JSON round trip global layout preferences',()=>{
  for(const key of ['tab_layout','sidebar_collapsed','sidebar_width'])assert.ok(db.includes(key));
  for(const key of ['tabLayout:validateTabLayout(data.tabLayout)','sidebarCollapsed:validateSidebarCollapsed(data.sidebarCollapsed)','sidebarWidth:validateSidebarWidth(data.sidebarWidth)'])
    assert.ok(main.includes(key));
  assert.match(main,/secureHandle\('layout:update'/);
  assert.match(preload,/updateLayout:prefs=>ipcRenderer\.invoke\('layout:update',prefs\)/);
});
