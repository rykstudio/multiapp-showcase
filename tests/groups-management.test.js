'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {groups}=require('../src/config-features');
const {SettingsDatabase}=require('../src/settings-db');
const {encryptJson,decryptJson}=require('../src/crypto-export');
const template=require('../config/import-template.json');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
const tips=fs.readFileSync(path.join(__dirname,'../src/instant-tooltips.js'),'utf8');

test('Groups validation permits empty groups, derives legacy groups and rejects invalid definitions',()=>{
  assert.deepEqual(groups(undefined,[{group:'Operations'},{group:'Marketing'},{group:'Operations'}]),['Operations','Marketing']);
  assert.deepEqual(groups(['Operations','Unused'],[{group:'Operations'}]),['Operations','Unused']);
  assert.throws(()=>groups(['Operations','operations']),/Duplicate group/);
  assert.throws(()=>groups(['']),/Group names cannot be empty/);
  assert.deepEqual(groups(['a'.repeat(165)]),['a'.repeat(165)]);
  assert.throws(()=>groups(['Operations'],[{group:'Sales'}]),/undefined group/);
  assert.equal(groups(Array.from({length:65},(_,i)=>'Group '+i)).length,65);
});

test('SQLite preserves group definitions independently of app assignment',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'showcase-group-management-'));
  let db;
  try {
    db=new SettingsDatabase(dir);
    const app={id:'ops',name:'Operations App',url:'https://example.com',displayMode:'desktop',group:'Operations',hidden:false,logins:[]};
    db.write({title:'MultiApp Showcase',theme:'auto',groups:['Operations','Empty group'],apps:[app]});
    db.close();db=new SettingsDatabase(dir);
    const initial=db.read();
    assert.deepEqual(initial.groups,['Operations','Empty group']);
    assert.equal(initial.apps[0].group,'Operations');
    db.write({...initial,groups:['Sales','Empty group'],apps:initial.apps.map(a=>({...a,group:'Sales'}))});
    db.close();db=new SettingsDatabase(dir);
    const renamed=db.read();
    assert.deepEqual(renamed.groups,['Sales','Empty group']);
    assert.equal(renamed.apps[0].group,'Sales');
    db.write({...renamed,groups:['Empty group'],apps:renamed.apps.map(a=>({...a,group:''}))});
    assert.deepEqual(db.read().groups,['Empty group']);
    assert.equal(db.read().apps[0].group,'');
  }finally{
    try{db?.close();}catch{}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('JSON template includes groups, layouts, app assignments and safe empty demo passwords',()=>{
  assert.equal(template.formatVersion,1);
  assert.ok(Array.isArray(template.groups)&&template.groups.length>=3);
  assert.ok(template.groups.some(g=>!template.apps.some(a=>a.group===g)));
  assert.ok(template.apps.every(a=>!a.group||template.groups.includes(a.group)));
  assert.ok(template.apps.every(a=>a.logins.every(l=>l.password==='')));
  assert.ok(['vertical','horizontal'].includes(template.tabLayout));
  assert.equal(typeof template.sidebarCollapsed,'boolean');
  assert.ok(Number.isInteger(template.sidebarWidth));
  assert.ok(main.includes("groups:validateGroups(data.groups,apps)"));
  assert.ok(main.includes("groups:config.groups||[]"));
  assert.ok(main.includes("'multiapp-showcase-settings-template.json'"));
});

test('Plain and encrypted JSON both preserve first-class groups',()=>{
  const plain={...template,apps:template.apps.slice(0,2)};
  assert.deepEqual(JSON.parse(JSON.stringify(plain)).groups,template.groups);
  const encrypted=encryptJson(plain,'sample-passphrase-123');
  assert.deepEqual(decryptJson(encrypted,'sample-passphrase-123').groups,template.groups);
  assert.ok(main.includes('input=JSON.parse(fs.readFileSync(file'));
  assert.ok(main.includes("input?.format==='multiapp-encrypted-settings'"));
  assert.ok(main.includes('pendingImport={data:input,filename}'));
  assert.ok(main.includes('decryptJson(pendingImport.data,passphrase)'));
});

test('Groups manager exposes creation, assignment, rename and deletion',()=>{
  for(const id of ['groupsManager','groupManagerList','newGroupName','addGroup','groupCount'])
    assert.ok(html.includes('id="'+id+'"'));
  for(const marker of ['function renderGroupManager()',"$('addGroup').onclick", "button('Rename'", "button('Delete'",'const groupControl=el(\'select\',{class:\'groupSelector\'})','groupControl.onchange']){
    assert.ok(renderer.includes(marker),marker);
  }
  assert.ok(renderer.includes('for(const app of draft.apps)if(app.group===original)app.group=revised'));
  assert.ok(renderer.includes("for(const app of draft.apps)if(app.group===original)app.group=''"));
});

test('Export stays collapsed by default, and clears passphrases when closed',()=>{
  assert.ok(html.includes('<details id="exportAccordion" class="exportAccordion"><summary>'));
  assert.ok(!html.includes('<details id="exportAccordion" open'));
  assert.ok(renderer.includes("$('exportAccordion').open=false;"));
  assert.ok(renderer.includes("$('exportAccordion').addEventListener('toggle'"));
  assert.ok(renderer.includes("if(!$('exportAccordion').open)"));
  assert.ok(renderer.includes("$('exportPassphrase').value=''"));
  assert.ok(renderer.includes("$('exportConfirm').value=''"));
});

test('Login drawer always displays username and password status, even without a saved password',()=>{
  assert.ok(renderer.includes("class:'credentialLabel',text:'Username'"));
  assert.ok(renderer.includes("class:'credentialLabel',text:'Password'"));
  assert.ok(renderer.includes("login.hasPassword?'••••••••':'No password saved'"));
  assert.ok(renderer.includes('passwordCopy.disabled=true;'));
  assert.ok(renderer.includes('passwordPaste.disabled=true;'));
  assert.ok(!renderer.includes('if(login.hasPassword)details.append'));
});

test('Immediate tooltips render as compact labels beneath the full toolbar, never across icons',()=>{
  assert.ok(tips.includes("const headerRect=header.getBoundingClientRect()"));
  assert.ok(tips.includes("Math.max(rect.bottom+margin,headerRect.bottom+margin)"));
  assert.ok(tips.includes("hint.style.width='max-content'"));
  assert.ok(tips.includes("hint.style.maxWidth='220px'"));
  assert.ok(!tips.includes("document.getElementById('address')"));
  assert.ok(!tips.includes("rect.left-size.width-7"));
  assert.ok(!tips.includes('setTimeout'));
});
