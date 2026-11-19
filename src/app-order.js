'use strict';

// The array sequence in Settings is authoritative. Persist a stable order index
// rather than relying on insertion order of session views or other cached maps.
function withSavedOrder(apps) {
  if (!Array.isArray(apps)) throw new TypeError('Expected apps array');
  return apps.map((app, order) => ({ ...app, order }));
}
function inSavedOrder(apps) {
  if (!Array.isArray(apps)) throw new TypeError('Expected apps array');
  const withIndex = apps.map((app, index) => ({ app, index }));
  // Legacy configs without explicit order preserve their array sequence.
  if (!withIndex.every(({app}) => Number.isSafeInteger(app.order) && app.order >= 0)) {
    return apps.slice();
  }
  withIndex.sort((a,b) => a.app.order - b.app.order || a.index - b.index);
  return withIndex.map(({app}) => app);
}
function moveApp(apps, index, offset) {
  if (!Array.isArray(apps) || !Number.isInteger(index) || ![-1,1].includes(offset)) return false;
  const to = index + offset;
  if (index < 0 || to < 0 || to >= apps.length) return false;
  const [app] = apps.splice(index,1);
  apps.splice(to,0,app);
  return true;
}
module.exports = {withSavedOrder,inSavedOrder,moveApp};
