'use strict';
const crypto=require('node:crypto');

function encryptJson(payload,passphrase) {
  if(typeof passphrase!=='string'||passphrase.length<8)throw new Error('Export passphrase must be at least 8 characters');
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);
  const key=crypto.scryptSync(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return {format:'multiapp-encrypted-settings',version:1,kdf:'scrypt',kdfParams:{N:32768,r:8,p:1},cipher:'aes-256-gcm',
    salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')};
}
function decryptJson(envelope,passphrase) {
  if(!envelope||envelope.format!=='multiapp-encrypted-settings'||envelope.version!==1||envelope.kdf!=='scrypt'||envelope.cipher!=='aes-256-gcm')throw new Error('Unsupported encrypted settings format');
  const b64=v=>{
    if(typeof v!=='string'||!/^[a-zA-Z0-9+/]*={0,2}$/.test(v))throw new Error('Invalid encrypted JSON payload');
    return Buffer.from(v,'base64');
  };
  const salt=b64(envelope.salt),iv=b64(envelope.iv),tag=b64(envelope.tag),data=b64(envelope.data);
  if(salt.length!==16||iv.length!==12||tag.length!==16||data.length>1024*1024)throw new Error('Invalid encrypted payload');
  try{
    const key=crypto.scryptSync(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
  }catch(err){throw new Error('Incorrect export password or corrupted encrypted settings file');}
}
module.exports={encryptJson,decryptJson};
