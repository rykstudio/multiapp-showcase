'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {SettingsDatabase}=require('../src/settings-db');
const {calculateBounds,HEADER_HEIGHT}=require('../src/view-layout');

test('desktop uses the full available browser area',()=>{
  assert.deepEqual(calculateBounds(1440,900,'desktop'),{x:0,y:HEADER_HEIGHT,width:1440,height:829});
});
test('mobile preview is centered and does not use entire desktop window',()=>{
  const rect=calculateBounds(1440,900,'mobile');
  assert.deepEqual(rect,{x:512,y:143,width:416,height:719});
  assert.ok(rect.width<1440);
  assert.ok(rect.height<829);
});
test('mobile preview uses iPhone-style insets and shrinks within the available area',()=>{
  for(const [w,h] of [[600,650],[375,620],[1200,700]]){
    const r=calculateBounds(w,h,'mobile');
    assert.ok(r.x>=0&&r.y>=HEADER_HEIGHT);
    assert.ok(r.x+r.width<=w);
    assert.ok(r.y+r.height<=h);
  }
});
test('SQLite migration defaults pre-existing apps to Desktop and persists Mobile',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mobile-db-'));
  try{
    const dbPath=path.join(dir,'multiapp-settings.sqlite');
    const legacy=new DatabaseSync(dbPath);
    legacy.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE applications(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,position INTEGER NOT NULL);CREATE TABLE demo_logins(app_id TEXT,id TEXT,title TEXT,description TEXT,username TEXT,password_storage TEXT,position INTEGER,PRIMARY KEY(app_id,id));INSERT INTO settings VALUES('initialized','1');INSERT INTO applications VALUES('legacy','Existing App','https://example.com',0);");
    legacy.close();
    let db=new SettingsDatabase(dir);
    assert.equal(db.read().apps[0].displayMode,'desktop');
    db.write({title:'Test',apps:[{id:'mobile',name:'Mobile App',url:'https://mobile.example.com',displayMode:'mobile',logins:[]},{id:'desktop',name:'Desktop App',url:'https://desktop.example.com',displayMode:'desktop',logins:[]}]});
    db.close();
    db=new SettingsDatabase(dir);
    assert.deepEqual(db.read().apps.map(a=>a.displayMode),['mobile','desktop']);
    db.close();
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
