'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
test('tab viewport has hidden scrollbar with left and right chevrons',()=>{
  for(const id of ['tabStrip','tabViewport','tabs','tabLeft','tabRight','tabPickerButton']) {
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/#tabs::-webkit-scrollbar\{display:none\}/);
  assert.match(html,/#tabViewport\{[^}]*overflow:hidden/);
  assert.match(html,/scrollbar-width:none/);
});
test('searchable tab picker exposes search and listbox elements',()=>{
  for(const id of ['tabPicker','tabPickerSearch','tabPickerItems']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(renderer,/function renderTabPicker\(\)/);
  assert.match(renderer,/toLocaleLowerCase\(\)/);
  assert.match(renderer,/function openTabPicker\(\)/);
});
test('renderer avoids rebuilding tab strip on every loading state update',()=>{
  assert.match(renderer,/const orderChanged=tabIds!==lastTabIds;/);
  assert.match(renderer,/if\(orderChanged\)\{\s*\$\('tabs'\)\.replaceChildren\(\);/);
  assert.match(renderer,/scheduleTabNavigationUpdate\(orderChanged\|\|prevActive!==data\.activeId\)/);
});
test('active tab is revealed, chevrons disabled at ends, and resize is handled',()=>{
  assert.match(renderer,/active\.offsetLeft/);
  assert.match(renderer,/strip\.scrollTo\(/);
  assert.match(renderer,/tabLeft'\)\.disabled=strip\.scrollLeft<3/);
  assert.match(renderer,/tabRight'\)\.disabled=strip\.scrollLeft\+strip\.clientWidth/);
  assert.match(renderer,/new ResizeObserver\(/);
});
