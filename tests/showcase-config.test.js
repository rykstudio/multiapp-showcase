'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=require('../package.json'),lock=require('../package-lock.json');
const template=require('../config/import-template.json');

test('MultiApp Showcase has independent application and package identity',()=>{
  assert.equal(pkg.name,'multiapp-showcase');
  assert.equal(pkg.version,'1.0.0');
  assert.equal(lock.name,pkg.name);
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[''].name,pkg.name);
  assert.equal(lock.packages[''].version,pkg.version);
  assert.equal(pkg.build.productName,'MultiApp Showcase');
  assert.equal(pkg.build.appId,'com.rykstudio.multiappshowcase');
});
test('branded ZT icon is configured on Windows, macOS and Linux',()=>{
  for(const platform of ['win','mac','linux']){
    assert.equal(pkg.build[platform].icon,'build/zt-multiapp-desktop.svg');
  }
  assert.ok(fs.statSync(path.join(root,'build/zt-multiapp-desktop.svg')).size>1000);
});
test('new repository cannot accidentally execute legacy release deletion',()=>{
  for(const name of ['final-v1.0.0.yml','release.yml','finalize-v1.1.0.yml']){
    assert.equal(fs.existsSync(path.join(root,'.github/workflows',name)),false);
  }
});
test('Showcase import template carries vertical tab preferences',()=>{
  assert.equal(template.title,'My MultiApp Showcase');
  assert.ok(['vertical','horizontal'].includes(template.tabLayout));
  assert.equal(typeof template.sidebarCollapsed,'boolean');
  assert.ok(template.sidebarWidth>=180&&template.sidebarWidth<=420);
  assert.ok(Array.isArray(template.apps));
});
