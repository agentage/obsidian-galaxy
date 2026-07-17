import { Plugin, PluginSettingTab, Setting, type App, type SettingDefinitionItem } from 'obsidian';
import type { Memory3DHost } from './graph-view';

// Defaults for the 3D graph. Live, fine-grained tuning (forces, sizes, search) lives
// in the in-view controls panel; this tab sets the persisted starting point.
export class Memory3DSettingTab extends PluginSettingTab {
  private host: Memory3DHost;

  constructor(app: App, host: Memory3DHost & Plugin) {
    super(app, host);
    this.host = host;
  }

  // Declarative mirror of display() so settings search (Obsidian 1.13+) can index the
  // tab; display() stays the renderer because minAppVersion predates the declarative API.
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: 'group',
        heading: 'View',
        items: [
          {
            name: 'Auto-rotate',
            desc: 'Slowly orbit the camera around the graph.',
            control: { type: 'toggle', key: 'autoRotate' },
          },
          { name: 'Show labels', control: { type: 'toggle', key: 'showLabels' } },
          { name: 'Show arrows', control: { type: 'toggle', key: 'showArrows' } },
        ],
      },
      {
        type: 'group',
        heading: 'Filters',
        items: [
          { name: 'Tags', control: { type: 'toggle', key: 'filters.showTags' } },
          { name: 'Attachments', control: { type: 'toggle', key: 'filters.showAttachments' } },
          {
            name: 'Existing files only',
            control: { type: 'toggle', key: 'filters.hideUnresolved' },
          },
          { name: 'Orphans', control: { type: 'toggle', key: 'filters.showOrphans' } },
        ],
      },
      {
        type: 'group',
        heading: 'Agentage Memory',
        items: [
          {
            name: 'One memory for every AI, owned by you',
            desc:
              'This 3D graph visualizes your local vault. Agentage Memory syncs it to a private ' +
              'memory that Claude, ChatGPT, Cursor, and any MCP client can read and write.',
            action: () => window.open('https://memory.agentage.io'),
          },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>(
        (o, k) => (o as Record<string, unknown> | undefined)?.[k],
        this.host.settings
      );
  }

  setControlValue(key: string, value: unknown): Promise<void> {
    const path = key.split('.');
    const leaf = path.pop() as string;
    const target = path.reduce<Record<string, unknown>>(
      (o, k) => o[k] as Record<string, unknown>,
      this.host.settings as unknown as Record<string, unknown>
    );
    target[leaf] = value;
    return this.host.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.host.settings;
    const save = () => void this.host.saveSettings();

    new Setting(containerEl).setName('View').setHeading();
    new Setting(containerEl)
      .setName('Auto-rotate')
      .setDesc('Slowly orbit the camera around the graph.')
      .addToggle((t) =>
        t.setValue(s.autoRotate).onChange((v) => {
          s.autoRotate = v;
          save();
        })
      );
    new Setting(containerEl).setName('Show labels').addToggle((t) =>
      t.setValue(s.showLabels).onChange((v) => {
        s.showLabels = v;
        save();
      })
    );
    new Setting(containerEl).setName('Show arrows').addToggle((t) =>
      t.setValue(s.showArrows).onChange((v) => {
        s.showArrows = v;
        save();
      })
    );

    new Setting(containerEl).setName('Filters').setHeading();
    new Setting(containerEl).setName('Tags').addToggle((t) =>
      t.setValue(s.filters.showTags).onChange((v) => {
        s.filters.showTags = v;
        save();
      })
    );
    new Setting(containerEl).setName('Attachments').addToggle((t) =>
      t.setValue(s.filters.showAttachments).onChange((v) => {
        s.filters.showAttachments = v;
        save();
      })
    );
    new Setting(containerEl).setName('Existing files only').addToggle((t) =>
      t.setValue(s.filters.hideUnresolved).onChange((v) => {
        s.filters.hideUnresolved = v;
        save();
      })
    );
    new Setting(containerEl).setName('Orphans').addToggle((t) =>
      t.setValue(s.filters.showOrphans).onChange((v) => {
        s.filters.showOrphans = v;
        save();
      })
    );

    new Setting(containerEl).setName('Agentage Memory').setHeading();
    new Setting(containerEl)
      .setName('One memory for every AI, owned by you')
      .setDesc(
        'This 3D graph visualizes your local vault. Agentage Memory syncs it to a private ' +
          'memory that Claude, ChatGPT, Cursor, and any MCP client can read and write.'
      )
      .addButton((b) =>
        b
          .setButtonText('Learn more')
          .setCta()
          .onClick(() => window.open('https://memory.agentage.io'))
      );
  }
}
