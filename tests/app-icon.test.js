'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('all platform installers use the exact supplied branded vector icon',()=>{
  const root=path.resolve(__dirname,'..');
  const pkg=require('../package.json');
  const icon='build/zt-multiapp-desktop.svg';
  for(const platform of ['win','mac','linux']){
    assert.equal(pkg.build[platform].icon,icon,platform+' should use branded icon');
  }
  const original=fs.readFileSync(path.join(root,icon),'utf8');
  assert.match(original,/<svg\b/);
  assert.match(original,/viewBox="0 0 270\.93333 270\.93333"/);
  assert.match(original,/width="1024"/);
  assert.match(original,/height="1024"/);
  assert.match(original,/fill:#e8a317/);
  assert.ok((original.match(/<path\b/g)||[]).length>5);
});

test('runtime desktop window and macOS development Dock display branded PNG',()=>{
  const root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
  const png=fs.readFileSync(path.join(root,'src/assets/zt-app-icon.png'));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),256);
  assert.equal(png.readUInt32BE(20),256);
  assert.match(source,/const APP_ICON_PATH = path\.join\(__dirname,'assets','zt-app-icon\.png'\)/);
  assert.match(source,/nativeImage\.createFromPath\(APP_ICON_PATH\)/);
  assert.match(source,/icon:appWindowIcon\(\)/);
  assert.match(source,/app\.dock\.setIcon\(appWindowIcon\(\)\)/);
});

test('tab history uses Electron navigationHistory API',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
  assert.match(source,/navigationHistory\.canGoBack\(\)/);
  assert.match(source,/navigationHistory\.canGoForward\(\)/);
  assert.match(source,/navigationHistory\.goBack\(\)/);
  assert.match(source,/navigationHistory\.goForward\(\)/);
  assert.doesNotMatch(source,/wc\.canGoBack\(\)|wc\.canGoForward\(\)/);
});
