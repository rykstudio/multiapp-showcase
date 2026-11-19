'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
const renderer=fs.readFileSync(path.join(root,'src/renderer.js'),'utf8');
const vertical=fs.readFileSync(path.join(root,'src/vertical-tabs.js'),'utf8');
const tooltips=fs.readFileSync(path.join(root,'src/instant-tooltips.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const launcher=fs.readFileSync(path.join(root,'scripts/install-linux-launcher.sh'),'utf8');
const pkg=require('../package.json');

test('layout, fullscreen, settings and preview remain aligned SVG-only toolbar controls',()=>{
  const toolbar=html.slice(html.indexOf('<div id="browserTools"'),html.indexOf('<button id="closeSignIn"'));
  for(const id of ['tabLayoutToggle','fullscreenButton','settingsButton','responsivePreview']){
    assert.match(toolbar,new RegExp('id="'+id+'"'));
    const from=toolbar.indexOf('id="'+id+'"');
    assert.match(toolbar.slice(from,from+650),/<svg class="toolbarGlyph"/);
  }
  assert.match(toolbar,/id="responsivePreview" hidden aria-pressed="false" data-tooltip="Mobile Preview"/);
  assert.doesNotMatch(toolbar,/>▯ Mobile preview<\/button>/);
  assert.match(html,/#browserTools>\.iconTool\[hidden\],#browserTools>#responsivePreview\[hidden\]\{display:none!important\}/);
  assert.match(html,/#browserTools \.toolbarGlyph\{width:17px;height:17px/);
});

test('dynamic state never overwrites inline SVG icons with textContent',()=>{
  assert.doesNotMatch(renderer,/\$\('fullscreenButton'\)\.textContent/);
  assert.doesNotMatch(renderer,/\$\('responsivePreview'\)\.textContent/);
  assert.doesNotMatch(vertical,/\$\('tabLayoutToggle'\)\.textContent/);
  assert.match(renderer,/previewButton\.dataset\.tooltip=previewOn\?'Desktop View':'Mobile Preview'/);
  assert.match(renderer,/previewButton\.querySelector\('\[data-preview-icon="mobile"\]'\)\.hidden=previewOn/);
  assert.match(renderer,/previewButton\.querySelector\('\[data-preview-icon="desktop"\]'\)\.hidden=!previewOn/);
  assert.match(vertical,/\$\('tabLayoutToggle'\)\.dataset\.tooltip/);
});

test('tooltips appear on pointer hover without a timer or native title delay',()=>{
  assert.match(html,/id="instantTooltip" role="tooltip"/);
  assert.match(html,/src="instant-tooltips\.js"/);
  assert.match(tooltips,/addEventListener\('pointerover'/);
  assert.match(tooltips,/function show\(button\)/);
  assert.match(tooltips,/hint\.hidden=false/);
  assert.doesNotMatch(tooltips,/setTimeout\(|setInterval\(/);
});

test('desktop icon has matching package, GNOME launcher and Electron identities',()=>{
  assert.equal(pkg.desktopName,'com.rykstudio.multiappshowcase.desktop');
  assert.equal(pkg.build.linux.syncDesktopName,true);
  assert.equal(pkg.build.linux.icon,'build/zt-multiapp-desktop.svg');
  assert.match(main,/app\.setDesktopName\('com\.rykstudio\.multiappshowcase\.desktop'\)/);
  assert.match(launcher,/desktop_id="com\.rykstudio\.multiappshowcase"/);
  assert.match(launcher,/StartupWMClass=\$desktop_id/);
  assert.match(launcher,/Icon=\$icon/);
  assert.ok(fs.existsSync(path.join(root,'src/assets/zt-app-icon.png')));
});

test('Ubuntu development launcher uses npm start without a hardcoded Electron binary path',()=>{
  const installer=fs.readFileSync(path.join(root,'scripts/install-linux-launcher.sh'),'utf8');
  const helper=fs.readFileSync(path.join(root,'scripts/launch-linux.sh'),'utf8');
  assert.match(installer,/Exec=\/usr\/bin\/bash "\$launcher"/);
  assert.match(installer,/TryExec=\/usr\/bin\/bash/);
  assert.doesNotMatch(installer,/node_modules\/electron\/dist\/electron/);
  assert.match(helper,/exec npm start/);
  assert.match(helper,/node_modules\/electron\/package\.json/);
  assert.doesNotMatch(helper,/node_modules\/electron\/dist\/electron/);
});

test('mobile preview keeps paired SVG icons and uses a centered gear without an offset transform',()=>{
  const toolbar=html.slice(html.indexOf('<div id="browserTools"'),html.indexOf('<button id="closeSignIn"'));
  const settings=toolbar.slice(toolbar.indexOf('id="settingsButton"'),toolbar.indexOf('id="responsivePreview"'));
  assert.match(settings,/<circle cx="12" cy="12" r="2\.8"\/>/);
  assert.doesNotMatch(settings,/transform=/);
  assert.match(toolbar,/data-preview-icon="mobile"/);
  assert.match(toolbar,/data-preview-icon="desktop"/);
  assert.match(html,/#responsivePreview \.toolbarGlyph\[hidden\]\{display:none!important\}/);
  assert.match(html,/#toprow>#windowControls\{/);
  assert.match(html,/#windowControls #closeButton:hover\{/);
});
