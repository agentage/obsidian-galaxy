// Builds media/demo.gif - a seamless 360 deg orbit of the graph (agentage vault, labels
// off). Orbits the camera manually (auto-rotate off) so the loop is perfect, captures
// frames, then ffmpeg palette-encodes a small looping gif.
//   node scripts/capture-gif.mjs   (server up on :8731)
import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/vreshch/projects/agentage/e2e/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(ROOT, 'media');
const TMP = '/tmp/m3d-gif';
const URL = 'http://localhost:8731/preview/index.html';
const VAULT = '/home/vreshch/vaults/agentage';
const N = 160; // frames per full orbit
const FPS = 10; // 160/10 = 16s per orbit -> gentle, 2x slower (smooth, not choppy)
const WIDTH = 1000; // 1000x625 = 1.6 ratio (matches galaxy.png); renders at GitHub content width

const check = (id, val) =>
  `(()=>{const e=document.getElementById('${id}'); if(e&&e.checked!==${val}){e.checked=${val}; e.dispatchEvent(new Event('change',{bubbles:true}));}})()`;
const HIDE = `for(const s of ['#count','#settings-btn','#center-btn','.scene-nav-info']){document.querySelectorAll(s).forEach(e=>e.style.display='none');}`;

execFileSync('node', [path.join(ROOT, 'scripts', 'build-sample.mjs'), VAULT], { cwd: ROOT });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1000, height: 625 },
  deviceScaleFactor: 1,
});
await page.goto(`${URL}?t=${Date.now()}`, { waitUntil: 'load' });
await page.waitForTimeout(10000);
// Keep the harness DEFAULTS (labels on, orphans on, no tag/attachment toggles). Only turn
// off auto-rotate so we can drive a seamless manual orbit, and hide the harness chrome.
await page.evaluate(check('r-rotate', false));
await page.waitForTimeout(1000);
await page.evaluate(HIDE);

// Use the default auto-fit framing (no dolly), then read the camera for the orbit.
await page.evaluate(() => window.__renderer.zoomToFit(60));
await page.waitForTimeout(900);
const cam = await page.evaluate(() => {
  const c = document.getElementById('graph').__forceGraph.cameraPosition();
  return { R: Math.hypot(c.x, c.z), y: c.y };
});
console.log('orbit radius', Math.round(cam.R), 'height', Math.round(cam.y));

for (let i = 0; i < N; i++) {
  const theta = (2 * Math.PI * i) / N;
  await page.evaluate(
    ({ R, y, theta }) => {
      const G = document.getElementById('graph').__forceGraph;
      G.cameraPosition({ x: R * Math.sin(theta), y, z: R * Math.cos(theta) }, undefined, 0);
    },
    { R: cam.R, y: cam.y, theta }
  );
  await page.waitForTimeout(110);
  await page.screenshot({ path: path.join(TMP, `f-${String(i).padStart(3, '0')}.png`) });
}
await browser.close();
console.log(`captured ${N} frames`);

const pal = path.join(TMP, 'pal.png');
const OUT = path.join(MEDIA, 'demo.gif');
execSync(
  `ffmpeg -y -framerate ${FPS} -i "${TMP}/f-%03d.png" -vf "scale=${WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" "${pal}"`,
  { stdio: 'ignore' }
);
execSync(
  `ffmpeg -y -framerate ${FPS} -i "${TMP}/f-%03d.png" -i "${pal}" -lavfi "scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle" -loop 0 "${OUT}"`,
  { stdio: 'ignore' }
);
console.log('wrote', OUT);
