// Final candidate set (5) from the agentage vault, labels off, rotation off (stable,
// centered). Experiments: different zoom + add/remove connections (orphans on/off,
// existing-files-only). The toolbar/shell variant is produced by frame-shell.mjs.
//   node scripts/capture-final.mjs   (server up on :8731)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/vreshch/projects/agentage/e2e/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media');
const URL = 'http://localhost:8731/preview/index.html';
const VAULT = '/home/vreshch/vaults/agentage';

const check = (id, val) =>
  `(()=>{const e=document.getElementById('${id}'); if(e&&e.checked!==${val}){e.checked=${val}; e.dispatchEvent(new Event('change',{bubbles:true}));}})()`;
const HIDE = `for(const id of ['count','settings-btn','center-btn']){const e=document.getElementById(id); if(e)e.style.display='none';}`;

execFileSync('node', [path.join(ROOT, 'scripts', 'build-sample.mjs'), VAULT], { cwd: ROOT });

const browser = await chromium.launch({
  args: [
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const setSpeed = (v) =>
  `(()=>{const e=document.getElementById('r-speed'); e.value=${v}; e.dispatchEvent(new Event('input',{bubbles:true}));})()`;

await page.goto(`${URL}?t=${Date.now()}`, { waitUntil: 'load' });
await page.waitForTimeout(10000);
await page.evaluate(check('d-labels', false));
await page.evaluate(check('r-rotate', true)); // rotation ON -> each shot a different angle
await page.evaluate(setSpeed(4)); // ~15s/orbit, so a few seconds = a clearly different angle
await page.evaluate(HIDE);

// Fit to frame the cluster, then dolly the camera IN by `factor` of the fit distance
// (factor 1 = wide; 0.3 = close-up into the core). Auto-rotation keeps the angle moving.
const fitThenZoom = async (factor) => {
  await page.evaluate(() => window.__renderer.zoomToFit(70), undefined);
  await page.waitForTimeout(900);
  if (factor !== 1) {
    await page.evaluate((f) => {
      const G = document.getElementById('graph').__forceGraph;
      const c = G.cameraPosition();
      G.cameraPosition({ x: c.x * f, y: c.y * f, z: c.z * f }, undefined, 0);
    }, factor);
  }
};
const shot = async (n) => {
  await page.mouse.move(40, 970);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(MEDIA, n) });
  console.log('  saved', n);
};
const settleRebuild = () => page.waitForTimeout(6000); // re-layout + auto-fit (also rotates)

// gen-2: ALL connections (orphans on), WIDE
await page.evaluate(check('f-orphans', true));
await settleRebuild();
await fitThenZoom(1);
await page.waitForTimeout(1500);
await shot('gen-2-wide.png');

// gen-3: connected web (orphans off), MEDIUM zoom, rotated further
await page.evaluate(check('f-orphans', false));
await settleRebuild();
await fitThenZoom(0.55);
await page.waitForTimeout(4000);
await shot('gen-3-mid.png');

// gen-4: CLOSE-UP into the core, rotated further
await fitThenZoom(0.28);
await page.waitForTimeout(4500);
await shot('gen-4-close.png');

// gen-5: REMOVE connections - existing files only (drops unresolved nodes + their edges)
await page.evaluate(check('f-existing', true));
await settleRebuild();
await fitThenZoom(0.55);
await page.waitForTimeout(4000);
await shot('gen-5-clean.png');

await browser.close();
console.log('done -> media/gen-2..5');
