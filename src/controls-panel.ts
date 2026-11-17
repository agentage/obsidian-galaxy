import { Setting, setIcon } from 'obsidian';
import type { Memory3DSettings } from './settings';

// onFilters: a data-affecting control changed (rebuild the graph from the vault).
// onDisplay: a render-affecting control changed (re-apply renderer options only).
interface ControlsCallbacks {
  onFilters(): void;
  onDisplay(): void;
  onCenter(): void;
}

const section = (parent: HTMLElement, title: string, startOpen: boolean): HTMLElement => {
  const wrap = parent.createDiv({ cls: 'm3d-section' });
  const header = wrap.createDiv({ cls: 'm3d-section-head' });
  const chevron = header.createSpan({ cls: 'm3d-chevron' });
  header.createSpan({ cls: 'm3d-section-title', text: title });
  const body = wrap.createDiv({ cls: 'm3d-section-body' });
  let open = startOpen;
  const sync = (): void => {
    body.toggleClass('is-collapsed', !open);
    setIcon(chevron, open ? 'chevron-down' : 'chevron-right');
  };
  header.addEventListener('click', () => {
    open = !open;
    sync();
  });
  sync();
  return body;
};

export const buildControlsPanel = (
  container: HTMLElement,
  settings: Memory3DSettings,
  cb: ControlsCallbacks
): HTMLElement => {
  // Gear button (top-right); the panel is hidden until it's clicked. Uses Obsidian's
  // native clickable-icon styling, like the built-in graph view's controls buttons.
  const toggle = container.createDiv({ cls: 'm3d-settings-btn clickable-icon' });
  toggle.setAttribute('aria-label', 'Graph settings');
  setIcon(toggle, 'settings');

  const panel = container.createDiv({ cls: 'm3d-controls is-hidden' });
  toggle.addEventListener('click', () => {
    const nowHidden = panel.classList.toggle('is-hidden');
    toggle.classList.toggle('is-active', !nowHidden);
  });

  // Center button (under the gear): reset the camera to the default fit.
  const center = container.createDiv({ cls: 'm3d-center-btn clickable-icon' });
  center.setAttribute('aria-label', 'Center view');
  setIcon(center, 'locate-fixed');
  center.addEventListener('click', () => cb.onCenter());

  // --- Filters (mirrors the built-in graph view) ---
  const filters = section(panel, 'Filters', true);
  new Setting(filters)
    .setName('Search')
    .setClass('m3d-row-text')
    .addText((t) =>
      t
        .setPlaceholder('Filter notes…')
        .setValue(settings.filters.search)
        .onChange((v) => {
          settings.filters.search = v;
          cb.onFilters();
        })
    );
  new Setting(filters).setName('Tags').addToggle((t) =>
    t.setValue(settings.filters.showTags).onChange((v) => {
      settings.filters.showTags = v;
      cb.onFilters();
    })
  );
  new Setting(filters).setName('Attachments').addToggle((t) =>
    t.setValue(settings.filters.showAttachments).onChange((v) => {
      settings.filters.showAttachments = v;
      cb.onFilters();
    })
  );
  new Setting(filters).setName('Existing files only').addToggle((t) =>
    t.setValue(settings.filters.hideUnresolved).onChange((v) => {
      settings.filters.hideUnresolved = v;
      cb.onFilters();
    })
  );
  new Setting(filters).setName('Orphans').addToggle((t) =>
    t.setValue(settings.filters.showOrphans).onChange((v) => {
      settings.filters.showOrphans = v;
      cb.onFilters();
    })
  );

  // --- Display ---
  const display = section(panel, 'Display', false);
  new Setting(display).setName('Labels').addToggle((t) =>
    t.setValue(settings.showLabels).onChange((v) => {
      settings.showLabels = v;
      cb.onDisplay();
    })
  );
  new Setting(display).setName('Arrows').addToggle((t) =>
    t.setValue(settings.showArrows).onChange((v) => {
      settings.showArrows = v;
      cb.onDisplay();
    })
  );
  new Setting(display)
    .setName('Node size')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(1, 12, 0.5)
        .setValue(settings.nodeSize)
        .onChange((v) => {
          settings.nodeSize = v;
          cb.onDisplay();
        })
    );
  new Setting(display)
    .setName('Link thickness')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(0, 4, 0.1)
        .setValue(settings.linkThickness)
        .onChange((v) => {
          settings.linkThickness = v;
          cb.onDisplay();
        })
    );

  // --- Forces (mirrors the built-in graph view) ---
  const forces = section(panel, 'Forces', false);
  new Setting(forces)
    .setName('Center force')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(0, 1, 0.01)
        .setValue(settings.forces.centerStrength)
        .onChange((v) => {
          settings.forces.centerStrength = v;
          cb.onDisplay();
        })
    );
  new Setting(forces)
    .setName('Repel force')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(0, 40, 1)
        .setValue(settings.forces.repelStrength)
        .onChange((v) => {
          settings.forces.repelStrength = v;
          cb.onDisplay();
        })
    );
  new Setting(forces)
    .setName('Link force')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(0, 2, 0.05)
        .setValue(settings.forces.linkStrength)
        .onChange((v) => {
          settings.forces.linkStrength = v;
          cb.onDisplay();
        })
    );
  new Setting(forces)
    .setName('Link distance')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(5, 200, 1)
        .setValue(settings.forces.linkDistance)
        .onChange((v) => {
          settings.forces.linkDistance = v;
          cb.onDisplay();
        })
    );

  // --- Rotation (3D-specific) ---
  const rotation = section(panel, 'Rotation', false);
  new Setting(rotation).setName('Auto-rotate').addToggle((t) =>
    t.setValue(settings.autoRotate).onChange((v) => {
      settings.autoRotate = v;
      cb.onDisplay();
    })
  );
  new Setting(rotation)
    .setName('Speed')
    .setClass('m3d-row-slider')
    .addSlider((s) =>
      s
        .setLimits(0, 6, 0.1)
        .setValue(settings.rotateSpeed)
        .onChange((v) => {
          settings.rotateSpeed = v;
          cb.onDisplay();
        })
    );

  // Footer: funnel to the Agentage product.
  const footer = panel.createDiv({ cls: 'm3d-footer' });
  const link = footer.createEl('a', {
    cls: 'm3d-footer-link',
    text: 'Part of Agentage',
    href: 'https://agentage.io',
  });
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener');

  return panel;
};
