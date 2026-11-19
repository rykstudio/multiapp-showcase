'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {SettingsDatabase}=require('../src/settings-db');

test('tab layout and sidebar width/collapse survive SQLite reopen',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'showcase-sidebar-'));
  let db;
  try{
    db=new SettingsDatabase(folder);
    const app={id:'demo',name:'Demo',url:'https://example.com',displayMode:'desktop',group:'Operations',hidden:false,logins:[]};
    db.write({title:'MultiApp Showcase',theme:'auto',tabLayout:'vertical',sidebarCollapsed:true,sidebarWidth:320,apps:[app]});
    db.close();db=new SettingsDatabase(folder);
    const cfg=db.read();
    assert.equal(cfg.title,'MultiApp Showcase');
    assert.equal(cfg.tabLayout,'vertical');
    assert.equal(cfg.sidebarCollapsed,true);
    assert.equal(cfg.sidebarWidth,320);
    assert.equal(cfg.apps[0].id,'demo');
    db.write({...cfg,tabLayout:'horizontal',sidebarCollapsed:false});
    const updated=db.read();
    assert.equal(updated.tabLayout,'horizontal');
    assert.equal(updated.sidebarCollapsed,false);
    assert.equal(updated.sidebarWidth,320);
  }finally{try{db?.close();}catch{}fs.rmSync(folder,{recursive:true,force:true});}
});
test('older configuration has horizontal tabs with safe default sidebar width',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'showcase-sidebar-default-'));
  let db;
  try{
    db=new SettingsDatabase(folder);
    const original=db.read();
    assert.equal(original.tabLayout,'horizontal');
    assert.equal(original.sidebarCollapsed,false);
    assert.equal(original.sidebarWidth,280);
  }finally{try{db?.close();}catch{}fs.rmSync(folder,{recursive:true,force:true});}
});
