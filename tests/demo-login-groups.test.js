'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {SettingsDatabase}=require('../src/settings-db');

test('SQLite round-trips more than 50 demo logins with independent groups and collapsed state',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-login-groups-'));
  let db;
  try{
    db=new SettingsDatabase(dir);
    const logins=Array.from({length:75},(_,i)=>({
      id:'login_'+i,title:'Account '+i,username:'user'+i,
      description:'Example',group:i%2?'Team':'Personal',passwordEnc:''
    }));
    const config={title:'Test',groups:[],apps:[{
      id:'example',name:'Example',url:'https://example.com/',displayMode:'desktop',
      group:'',hidden:false,loginGroups:['Team','Personal','Empty'],
      loginGroupCollapsed:['Personal'],logins
    }]};
    db.write(config);
    const app=db.read().apps[0];
    assert.equal(app.logins.length,75);
    assert.deepEqual(app.loginGroups,['Team','Personal','Empty']);
    assert.deepEqual(app.loginGroupCollapsed,['Personal']);
    assert.equal(app.logins[0].group,'Personal');
    assert.equal(app.logins[1].group,'Team');
  }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('Existing SQLite demo-logins schema migrates to support groups',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-login-migration-'));
  let db;
  try{
    const {DatabaseSync}=require('node:sqlite');
    const legacy=new DatabaseSync(path.join(dir,'multiapp-settings.sqlite'));
    legacy.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);"+
      "CREATE TABLE applications(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,position INTEGER NOT NULL);"+
      "CREATE TABLE demo_logins(app_id TEXT,id TEXT,title TEXT,description TEXT,username TEXT,password_storage TEXT,position INTEGER,PRIMARY KEY(app_id,id));"+
      "INSERT INTO applications VALUES('legacy','Legacy','https://example.com',0);"+
      "INSERT INTO demo_logins VALUES('legacy','first','First','','user','',0);");
    legacy.close();
    db=new SettingsDatabase(dir);
    const app=db.read().apps[0];
    assert.deepEqual(app.loginGroups,[]);
    assert.deepEqual(app.loginGroupCollapsed,[]);
    assert.equal(app.logins[0].group,'');
    assert.equal(app.logins[0].username,'user');
  }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
