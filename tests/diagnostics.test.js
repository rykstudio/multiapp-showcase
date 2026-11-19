'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {recordDiagnostic}=require('../src/diagnostics');
test('diagnostics redact raw URLs, passwords and unrecognized events',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-diagnostics-'));
  try {
    assert.equal(recordDiagnostic(dir,'renderer-crash','web-app','killed'),true);
    assert.equal(recordDiagnostic(dir,'unknown','app','secret'),false);
    assert.equal(recordDiagnostic(dir,'navigation-error','fleet?token=secret','-105'),true);
    const file=path.join(dir,'diagnostics.jsonl');
    const lines=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length,2);
    assert.deepEqual(Object.keys(lines[0]),['time','event','appId','code']);
    assert.equal(lines[1].appId,'unknown');
    assert.equal(lines[1].code,'-105');
    if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o600);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('diagnostics rotate near 1MB instead of growing without bound',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiapp-rotate-'));
  try {
    fs.writeFileSync(path.join(dir,'diagnostics.jsonl'),'x'.repeat(1024*1024));
    assert.equal(recordDiagnostic(dir,'unresponsive','app','hung'),true);
    assert.equal(fs.existsSync(path.join(dir,'diagnostics.previous.jsonl')),true);
    assert.ok(fs.statSync(path.join(dir,'diagnostics.jsonl')).size<1024);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
