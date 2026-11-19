'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
test('mobile preview shell and desktop/mobile selector are connected to app state',()=>{
  assert.match(html,/id="mobileStage"/);
  assert.match(html,/id="phoneFrame"/);
  assert.match(html,/#mobileStage\[hidden\]\{display:none\}/);
  assert.match(renderer,/modeControl\.onchange/);
  assert.match(renderer,/app\.displayMode=modeControl\.value/);
  assert.match(renderer,/\$\('mobileStage'\)\.hidden/);
});
test('display mode persists through save, import/export and session view layout',()=>{
  assert.match(main,/displayMode:raw\.displayMode\|\|'desktop'/);
  assert.match(main,/displayMode:a\.displayMode\|\|'desktop'/);
  // Native views now use layout-aware bounds and reserve a visible browser area
  // while the login drawer is open, including in mobile preview mode.
  assert.match(main,/const bounds=drawerVisible/);
  assert.match(main,/calculateBounds\\(w,h,mode,layout\\)/);
  assert.match(main,/calculateDrawerBounds\\(w,h,mode,layout\\)/);
  assert.match(main,/wc\.setUserAgent/);
});
