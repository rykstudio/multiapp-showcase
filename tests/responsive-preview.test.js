'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');

test('responsive preview is per-tab and not persisted in saved settings',()=>{
  assert.match(main,/function effectiveDisplayMode\(id\)/);
  assert.match(main,/entry\.previewMobile=!entry\.previewMobile/);
  assert.match(main,/item\.displayMode==='mobile'\)return \{ok:false\}/);
  assert.match(main,/tab:toggle-responsive-preview/);
  // Native views now use layout-aware bounds and reserve a visible browser area
  // while the login drawer is open, including in mobile preview mode.
  assert.match(main,/const bounds=drawerVisible/);
  assert.match(main,/calculateBounds\\(w,h,mode,layout\\)/);
  assert.match(main,/calculateDrawerBounds\\(w,h,mode,layout\\)/);
  assert.match(main,/previewMobile:!!entry\?\.previewMobile/);
  assert.doesNotMatch(main,/settingsDB\.write\(.*previewMobile/);
  assert.match(preload,/toggleResponsivePreview/);
});
test('responsive preview uses same mobile shell and is available on desktop tabs',()=>{
  assert.match(renderer,/activeApp\?\.previewMobile/);
  assert.match(renderer,/activeApp\.displayMode==='mobile'/);
  assert.match(renderer,/\$\('responsivePreview'\)\.onclick/);
  assert.match(renderer,/aria-pressed/);
  assert.match(html,/id="responsivePreview"/);
  assert.match(html,/id="mobileStage"/);
});
test('demo credentials use icon copy buttons with accessible names',()=>{
  assert.match(renderer,/function copyIconButton\(loginId,field\)/);
  assert.match(renderer,/document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
  assert.match(renderer,/control\.setAttribute\('aria-label',label\)/);
  assert.match(renderer,/copyIconButton\(login\.id,'username'\)/);
  assert.match(renderer,/copyIconButton\(login\.id,'password'\)/);
  assert.doesNotMatch(renderer,/button\('Copy username'/);
  assert.doesNotMatch(renderer,/button\('Copy password'/);
});
