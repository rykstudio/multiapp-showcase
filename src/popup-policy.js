'use strict';
function canOpenEmbedded(url) {
  if(url==='about:blank')return true;
  try {
    const parsed=new URL(url);
    return parsed.protocol==='https:' || parsed.protocol==='http:';
  } catch {return false;}
}
module.exports={canOpenEmbedded};
