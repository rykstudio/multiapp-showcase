'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {SettingsDatabase}=require('../src/settings-db');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');

function config(title){
  return {title,apps:[{id:'app',name:'App',url:'https://example.com/',displayMode:'desktop',logins:[]}]};
}
test('saves create rotating, recoverable SQLite snapshots without replacing live DB',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-recovery-'));
  let db;
  try{
    db=new SettingsDatabase(dir);
    assert.equal(db.checkIntegrity(),true);
    db.write(config('Initial'));
    assert.equal(fs.existsSync(path.join(dir,'multiapp-settings.backup-1.sqlite')),false);
    for(const name of ['Second','Third','Fourth','Fifth'])db.write(config(name));
    assert.equal(db.read().title,'Fifth');
    const expected=['Fourth','Third','Second'];
    for(let i=1;i<=3;i++){
      const backup=path.join(dir,'multiapp-settings.backup-'+i+'.sqlite');
      assert.equal(fs.existsSync(backup),true);
      const snapshot=new DatabaseSync(backup);
      assert.equal(snapshot.prepare("SELECT value FROM settings WHERE key='title'").get().value,expected[i-1]);
      snapshot.close();
      if(process.platform!=='win32')assert.equal(fs.statSync(backup).mode&0o777,0o600);
    }
    assert.equal(fs.existsSync(path.join(dir,'multiapp-settings.backup.pending.sqlite')),false);
    if(process.platform!=='win32')assert.equal(fs.statSync(db.filename).mode&0o777,0o600);
  }finally{if(db)db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('main UI IPC calls have a central sender+frame guard',()=>{
  assert.match(main,/function secureHandle\(channel, handler\)/);
  assert.match(main,/event\.sender!==win\.webContents/);
  assert.match(main,/event\.senderFrame!==win\.webContents\.mainFrame/);
  assert.doesNotMatch(main,/\n  ipcMain\.handle\('settings:save'/);
});
test('packaged apps refuse silent plaintext demo passwords',()=>{
  assert.match(main,/!app\.isPackaged && process\.env\.MULTIAPP_ALLOW_PLAINTEXT_DEMO_PASSWORDS==='1'/);
  assert.match(main,/Secure credential storage is unavailable/);
  assert.match(main,/passwordEnc\.startsWith\('plain:'\) && encryptionReady\(\)/);
});
test('inactive tabs do not navigate until first selection and crashes can be recovered',()=>{
  assert.match(main,/function ensureLoaded\(id\)/);
  assert.match(main,/entry\.started=true/);
  assert.match(main,/ensureLoaded\(id\);/);
  assert.match(main,/wc\.on\('render-process-gone'/);
  assert.match(main,/Use Reload to recover/);
});
test('closing settings or window warns for unsaved changes',()=>{
  assert.match(main,/win\.on\('close',event=>\{/);
  assert.match(main,/if\(!settingsVisible\|\|!settingsDirty\)return/);
  assert.match(main,/settings:mark-dirty/);
  assert.match(preload,/setSettingsDirty:/);
  assert.match(renderer,/function hasUnsavedSettings\(\)/);
  assert.match(renderer,/Discard your unsaved application settings/);
});
