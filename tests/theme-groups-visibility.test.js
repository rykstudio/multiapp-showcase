'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {SettingsDatabase}=require('../src/settings-db');
const {theme,group,hidden,visibleApps,nextActiveId,moveById}=require('../src/config-features');
const tpl=require('../config/import-template.json');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');

test('validate theme, group and visibility; older configs default safely',()=>{
  assert.equal(theme(undefined),'auto');
  assert.equal(theme('dark'),'dark');
  assert.equal(theme('light'),'light');
  assert.throws(()=>theme('neon'),/Theme/);
  assert.equal(group(undefined),'');
  assert.equal(group('  Operations  '),'Operations');
  assert.throws(()=>group('a'.repeat(65)),/Group/);
  assert.equal(hidden(undefined),false);
  assert.equal(hidden(true),true);
  assert.throws(()=>hidden('yes'),/Hidden/);
});
test('hidden tabs are excluded from navigation, not deleted from config',()=>{
  const apps=[{id:'a',hidden:true},{id:'b',hidden:false},{id:'c',hidden:false}];
  assert.deepEqual(visibleApps(apps).map(a=>a.id),['b','c']);
  assert.equal(nextActiveId(apps,'a'),'b');
  assert.equal(nextActiveId(apps,'c'),'c');
  assert.equal(nextActiveId([{id:'a',hidden:true}], 'a'),undefined);
  assert.equal(apps.length,3);
});
test('drag reorder preserves IDs, metadata, and stable sequence',()=>{
  const apps=[{id:'a',group:'One'},{id:'b',group:'Two'},{id:'c',hidden:true}];
  assert.equal(moveById(apps,'c','a'),true);
  assert.deepEqual(apps.map(a=>a.id),['c','a','b']);
  assert.deepEqual(apps.map(a=>a.order),[0,1,2]);
  assert.equal(apps[0].hidden,true);
  assert.equal(moveById(apps,'missing','b'),false);
});
test('legacy SQLite database gains theme, groups and hidden columns without losing apps',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-groups-'));
  let db;
  try{
    const legacy=new DatabaseSync(path.join(dir,'multiapp-settings.sqlite'));
    legacy.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE applications(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,position INTEGER NOT NULL,display_mode TEXT NOT NULL DEFAULT 'desktop');CREATE TABLE demo_logins(app_id TEXT,id TEXT,title TEXT,description TEXT,username TEXT,password_storage TEXT,position INTEGER,PRIMARY KEY(app_id,id));INSERT INTO applications VALUES('a','Old App','https://old.example.com',0,'desktop');");
    legacy.close();
    db=new SettingsDatabase(dir);
    const original=db.read();
    assert.equal(original.theme,'auto');
    assert.equal(original.apps[0].group,'');
    assert.equal(original.apps[0].hidden,false);
    db.write({title:'Workspace',theme:'dark',apps:[
      {id:'a',name:'Old App',url:'https://old.example.com',displayMode:'desktop',group:'Operations',hidden:true,logins:[]},
      {id:'b',name:'Second',url:'https://second.example.com',displayMode:'mobile',group:'Sales',hidden:false,logins:[]}
    ]});
    db.close();db=new SettingsDatabase(dir);
    const saved=db.read();
    assert.equal(saved.theme,'dark');
    assert.deepEqual(saved.apps.map(a=>[a.id,a.group,a.hidden,a.displayMode]),[
      ['a','Operations',true,'desktop'],['b','Sales',false,'mobile']
    ]);
  }finally{if(db)db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('downloadable JSON template covers every persisted setting and demo logins',()=>{
  assert.equal(tpl.formatVersion,1);
  assert.ok(['auto','light','dark'].includes(tpl.theme));
  assert.ok(tpl.apps.length>=4);
  for(const [i,a] of tpl.apps.entries()){
    assert.equal(typeof a.id,'string');
    assert.equal(typeof a.group,'string');
    assert.equal(typeof a.hidden,'boolean');
    assert.equal(a.order,i);
    assert.ok(['desktop','mobile'].includes(a.displayMode));
    assert.ok(Array.isArray(a.logins));
    for(const l of a.logins){
      for(const k of ['id','title','description','username','password'])assert.equal(typeof l[k],'string');
    }
  }
  assert.ok(tpl.apps.some(a=>a.hidden));
  assert.ok(new Set(tpl.apps.map(a=>a.group)).size>1);
});
test('browser UI exposes appearance, group picker and collapsed app ordering',()=>{
  assert.match(html,/id="themeSelect"/);
  assert.match(html,/id="groupFilter"/);
  assert.match(renderer,/document\.documentElement\.dataset\.theme/);
  assert.match(main,/nativeTheme\.themeSource=/);
  assert.match(renderer,/function visibleTabApps\(data\)/);
  assert.match(renderer,/prevActive!==data\.activeId && tabGroupFilter!=='all'/);
  assert.match(renderer,/function reorderApps\(fromId,toId\)/);
  assert.match(renderer,/grip\.ondragstart=/);
  assert.match(renderer,/panel\.ondrop=/);
  assert.match(renderer,/const up=summaryAction/);
  assert.match(renderer,/const down=summaryAction/);
  assert.match(renderer,/const hide=summaryAction/);
  assert.match(renderer,/class:'loginStatus'/);
  assert.match(renderer,/class:'loginList'/);
  assert.match(renderer,/field\('Group \(optional\)'/);
});
