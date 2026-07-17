import { createGraphRenderer } from '../src/render';
import { graphFromMarkdown } from '../src/graph-from-markdown';
import { DEFAULT_FILTERS, DEFAULT_PALETTE } from '../src/types';
import type { GraphFilters, RawNote, RenderOptions } from '../src/types';

// Standalone browser harness: drives the EXACT plugin render path (render.ts +
// graph-data.ts) against sample notes, so we can verify the real 3D output in a
// plain browser without Obsidian. Sample notes are injected as a global by
// scripts/build-sample.mjs (preview/sample-data.js).

// Plain-browser harness: Obsidian's activeDocument global does not exist here.
const doc = window.document;
const notes: RawNote[] =
  (window as unknown as { AGENTAGE_3D_SAMPLE?: RawNote[] }).AGENTAGE_3D_SAMPLE ?? [];

const filters: GraphFilters = { ...DEFAULT_FILTERS };

const opts: RenderOptions = {
  autoRotate: true,
  rotateSpeed: 1.2,
  nodeSize: 1.8,
  linkThickness: 0.6,
  showArrows: false,
  showLabels: true,
  forces: { centerStrength: 0.1, repelStrength: 10, linkStrength: 0.5, linkDistance: 30 },
  palette: DEFAULT_PALETTE,
};

const host = doc.getElementById('graph');
if (!host) throw new Error('missing #graph');

const renderer = createGraphRenderer(host, opts);
// expose for the headless capture scripts (harness-only; not in the plugin bundle)
(window as unknown as { __renderer?: typeof renderer }).__renderer = renderer;
const fit = () => renderer.resize(window.innerWidth, window.innerHeight);
const rebuild = () => {
  renderer.setData(graphFromMarkdown(notes, filters));
  const count = graphFromMarkdown(notes, filters).nodes.length;
  const badge = doc.getElementById('count');
  if (badge) badge.textContent = `${count} nodes`;
};

rebuild();
fit();
window.addEventListener('resize', fit);

// --- wire the controls -----------------------------------------------------------
const check = (id: string, fn: (v: boolean) => void): void => {
  const el = doc.getElementById(id) as HTMLInputElement | null;
  el?.addEventListener('change', () => fn(el.checked));
};
const range = (id: string, fn: (v: number) => void): void => {
  const el = doc.getElementById(id) as HTMLInputElement | null;
  el?.addEventListener('input', () => fn(Number(el.value)));
};

check('f-tags', (v) => {
  filters.showTags = v;
  rebuild();
});
check('f-attach', (v) => {
  filters.showAttachments = v;
  rebuild();
});
check('f-existing', (v) => {
  filters.hideUnresolved = v;
  rebuild();
});
check('f-orphans', (v) => {
  filters.showOrphans = v;
  rebuild();
});
check('d-labels', (v) => {
  opts.showLabels = v;
  renderer.setOptions({ ...opts });
});
check('d-arrows', (v) => {
  opts.showArrows = v;
  renderer.setOptions({ ...opts });
});
check('r-rotate', (v) => {
  opts.autoRotate = v;
  renderer.setOptions({ ...opts });
});
range('r-speed', (v) => {
  opts.rotateSpeed = v;
  renderer.setOptions({ ...opts });
});
range('fo-distance', (v) => {
  opts.forces.linkDistance = v;
  renderer.setOptions({ ...opts });
});

const settingsBtn = doc.getElementById('settings-btn');
const panel = doc.getElementById('panel');
settingsBtn?.addEventListener('click', () => {
  const open = panel?.classList.toggle('open');
  settingsBtn.classList.toggle('is-active', !!open);
});

doc.getElementById('center-btn')?.addEventListener('click', () => renderer.zoomToFit());

const searchEl = doc.getElementById('f-search') as HTMLInputElement | null;
searchEl?.addEventListener('input', () => {
  filters.search = searchEl.value;
  rebuild();
});
