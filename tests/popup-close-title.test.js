'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
test('embedded popup title is exposed in app state and updated as page title changes',()=>{
  assert.match(main,/function popupDisplayTitle\(contents\)/);
  assert.match(main,/contents\.getTitle\(\)/);
  assert.match(main,/popupTitle:entry\?\.popup \? popupDisplayTitle/);
  assert.match(main,/child\.on\('page-title-updated',emit\)/);
});
test('close action uses current popup title with compact label and full accessible name',()=>{
  assert.match(renderer,/active\?\.popupTitle\|\|'Page'/);
  assert.match(renderer,/\$\('closeSignIn'\)\.textContent='✕ Close '/);
  assert.match(renderer,/pageTitle\.slice\(0,33\)/);
  assert.match(renderer,/setAttribute\('aria-label','Close '\+pageTitle\)/);
  assert.match(html,/Close Page<\/button>/);
});
test('close action continues closing same embedded popup',()=>{
  assert.match(renderer,/\$\('closeSignIn'\)\.onclick=\(\)=>\{if\(current\.activeId\)window\.multiApp\.closePopup\(current\.activeId\)/);
  assert.match(main,/secureHandle\('tab:close-popup'/);
});
