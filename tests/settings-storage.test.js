'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {SettingsDatabase}=require('../src/settings-db');
const {encryptJson,decryptJson}=require('../src/crypto-export');
test('SQLite settings persist order and demo passwords across reopening',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-db-'));
  try{
    let db=new SettingsDatabase(folder);
    assert.equal(db.isInitialized(),false);
    db.write({title:'My Platform',apps:[{id:'second',name:'Second',url:'https://second.example.com/',logins:[{id:'demo',title:'Demo',description:'A demo',username:'test@example.com',passwordEnc:'plain:demo-password'}]},{id:'first',name:'First',url:'https://first.example.com/',logins:[]}]});
    db.close();
    db=new SettingsDatabase(folder);
    const data=db.read();
    assert.equal(db.isInitialized(),true);
    assert.deepEqual(data.apps.map(a=>a.id),['second','first']);
    assert.equal(data.apps[0].logins[0].passwordEnc,'plain:demo-password');
    assert.equal(data.title,'My Platform');
    db.close();
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('SQLite transaction rejects duplicate app IDs without losing existing config',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-tx-'));
  try{
    const db=new SettingsDatabase(folder);
    db.write({title:'Valid',apps:[{id:'first',name:'First',url:'https://a.example.com',logins:[]}]});
    assert.throws(()=>db.write({title:'Broken',apps:[{id:'a',name:'A',url:'https://a.example.com',logins:[]},{id:'a',name:'B',url:'https://b.example.com',logins:[]}]}));
    assert.equal(db.read().title,'Valid');
    assert.deepEqual(db.read().apps.map(a=>a.id),['first']);
    db.close();
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('Encrypted settings round-trip; wrong password fails',()=>{
  const payload={title:'My Platform',apps:[{id:'demo',logins:[{password:'example-secret'}]}]};
  const envelope=encryptJson(payload,'strong-demo-passphrase');
  assert.equal(envelope.cipher,'aes-256-gcm');
  assert.ok(!JSON.stringify(envelope).includes('example-secret'));
  assert.deepEqual(decryptJson(envelope,'strong-demo-passphrase'),payload);
  assert.throws(()=>decryptJson(envelope,'wrong-password'),/Incorrect export password/);
});
