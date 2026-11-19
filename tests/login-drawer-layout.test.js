'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');

test('login drawer has bounded responsive width and disables horizontal scrolling',()=>{
  assert.match(html,/#drawer\{[^}]*width:min\(440px,calc\(100vw - 16px\)\)/);
  assert.match(html,/#drawer\{[^}]*overflow-x:hidden/);
  assert.match(html,/#loginCards\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(html,/\.loginCard\{[^}]*min-width:0/);
});
test('credential copy icon always occupies a fixed column',()=>{
  assert.match(html,/\.secretrow\{[^}]*grid-template-columns:minmax\(0,1fr\) 32px/);
  assert.match(html,/\.secretrow code\{[^}]*text-overflow:ellipsis/);
  assert.match(html,/\.secretrow code\{[^}]*white-space:nowrap/);
  assert.match(html,/\.copyIconButton\{[^}]*flex:0 0 32px/);
  assert.match(renderer,/copyIconButton\(login\.id,'username'\)/);
  assert.match(renderer,/copyIconButton\(login\.id,'password'\)/);
});
