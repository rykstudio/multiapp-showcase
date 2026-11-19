'use strict';
const {DatabaseSync} = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

class SettingsDatabase {
  constructor(userDataPath) {
    this.filename = path.join(userDataPath,'multiapp-settings.sqlite');
    this.db = new DatabaseSync(this.filename);
    if(process.platform!=='win32')fs.chmodSync(this.filename,0o600);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS application_groups(name TEXT PRIMARY KEY, position INTEGER NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, position INTEGER NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS demo_logins(app_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE, id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', username TEXT NOT NULL DEFAULT '', password_storage TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL, PRIMARY KEY(app_id,id));"
    );
    // Existing v1.0.0 installations have no display_mode column.
    const columns=this.db.prepare("PRAGMA table_info(applications)").all().map(col=>col.name);
    if(!columns.includes('display_mode'))this.db.exec("ALTER TABLE applications ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'desktop'");
    if(!columns.includes('group_name'))this.db.exec("ALTER TABLE applications ADD COLUMN group_name TEXT NOT NULL DEFAULT ''");
    if(!columns.includes('is_hidden'))this.db.exec("ALTER TABLE applications ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0");
  }
  checkIntegrity() {
    const result=this.db.prepare('PRAGMA quick_check').get();
    if(result?.quick_check!=='ok')throw new Error('Settings database integrity check failed. Restore a verified backup; existing data was not overwritten.');
    return true;
  }
  backup() {
    // VACUUM INTO produces a consistent snapshot even when SQLite uses WAL.
    // Never overwrite the only recovery point before a new snapshot succeeds.
    if(!this.isInitialized())return;
    const dir=path.dirname(this.filename);
    const base=path.join(dir,'multiapp-settings.backup');
    const pending=base+'.pending.sqlite';
    try {
      fs.rmSync(pending,{force:true});
      this.db.exec("VACUUM INTO '"+pending.replaceAll("'","''")+"'");
      if(process.platform!=='win32')fs.chmodSync(pending,0o600);
      for(let i=3;i>=2;i--){
        const target=base+'-'+i+'.sqlite';
        const source=base+'-'+(i-1)+'.sqlite';
        if(fs.existsSync(source))fs.renameSync(source,target);
      }
      fs.renameSync(pending,base+'-1.sqlite');
    }catch(err){
      try{fs.rmSync(pending,{force:true});}catch{}
      throw new Error('Cannot create settings backup. Save cancelled: '+err.message);
    }
  }
  isInitialized() {return !!this.db.prepare("SELECT value FROM settings WHERE key='initialized'").get();}
  read() {
    const title=this.db.prepare("SELECT value FROM settings WHERE key='title'").get()?.value || 'MultiApp Showcase';
    const apps=this.db.prepare("SELECT id,name,url,position,display_mode,group_name,is_hidden FROM applications ORDER BY position,id").all().map(a=>({id:a.id,name:a.name,url:a.url,order:a.position,displayMode:a.display_mode==='mobile'?'mobile':'desktop',group:a.group_name||'',hidden:!!a.is_hidden,logins:[]}));
    const map=new Map(apps.map(a=>[a.id,a]));
    for (const l of this.db.prepare("SELECT app_id,id,title,description,username,password_storage,position FROM demo_logins ORDER BY app_id,position,id").all()) {
      const a=map.get(l.app_id);
      if(a)a.logins.push({id:l.id,title:l.title,description:l.description,username:l.username,passwordEnc:l.password_storage});
    }
    const theme=this.db.prepare("SELECT value FROM settings WHERE key='theme'").get()?.value || 'auto';
    const layout=this.db.prepare("SELECT value FROM settings WHERE key='tab_layout'").get()?.value || 'horizontal';
    const collapsed=this.db.prepare("SELECT value FROM settings WHERE key='sidebar_collapsed'").get()?.value || 'false';
    const width=Number(this.db.prepare("SELECT value FROM settings WHERE key='sidebar_width'").get()?.value || 280);
    const savedGroups=this.db.prepare("SELECT name FROM application_groups ORDER BY position,name").all().map(row=>row.name);
    // On first read of older installations, group names still exist on their apps.
    const groups=[...new Set([...savedGroups,...apps.map(a=>a.group||'').filter(Boolean)])];
    return {title,groups,theme:['auto','light','dark'].includes(theme)?theme:'auto',
      tabLayout:layout==='vertical'?'vertical':'horizontal',
      sidebarCollapsed:collapsed==='true',
      sidebarWidth:Number.isInteger(width)&&width>=180&&width<=420?width:280,
      apps};
  }
  write(config) {
    const db=this.db;
    this.checkIntegrity();
    this.backup();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DELETE FROM demo_logins; DELETE FROM applications; DELETE FROM application_groups;');
      db.prepare("INSERT INTO settings(key,value) VALUES('title',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(config.title);
      db.prepare("INSERT INTO settings(key,value) VALUES('theme',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(config.theme||'auto');
      db.prepare("INSERT INTO settings(key,value) VALUES('tab_layout',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(config.tabLayout||'horizontal');
      db.prepare("INSERT INTO settings(key,value) VALUES('sidebar_collapsed',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(!!config.sidebarCollapsed));
      db.prepare("INSERT INTO settings(key,value) VALUES('sidebar_width',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(config.sidebarWidth||280));
      db.prepare("INSERT INTO settings(key,value) VALUES('initialized','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
      const groupNames=Array.isArray(config.groups)?config.groups:[...new Set(config.apps.map(a=>a.group||'').filter(Boolean))];
      const saveGroup=db.prepare('INSERT INTO application_groups(name,position) VALUES (?,?)');
      groupNames.forEach((name,i)=>saveGroup.run(name,i));
      const apps=db.prepare('INSERT INTO applications(id,name,url,position,display_mode,group_name,is_hidden) VALUES (?,?,?,?,?,?,?)');
      const logins=db.prepare('INSERT INTO demo_logins(app_id,id,title,description,username,password_storage,position) VALUES (?,?,?,?,?,?,?)');
      config.apps.forEach((a,i)=>{
        apps.run(a.id,a.name,a.url,i,a.displayMode==='mobile'?'mobile':'desktop',a.group||'',a.hidden?1:0);
        a.logins.forEach((l,j)=>logins.run(a.id,l.id,l.title,l.description||'',l.username||'',l.passwordEnc||'',j));
      });
      db.exec('COMMIT');
    } catch (e) {db.exec('ROLLBACK');throw e;}
  }
  close(){this.db.close();}
}
module.exports={SettingsDatabase};
