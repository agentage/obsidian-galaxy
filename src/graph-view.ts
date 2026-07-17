import { ItemView, TFile, debounce, getAllTags, type WorkspaceLeaf } from 'obsidian';
import { createGraphRenderer, type GraphRenderer } from './render';
import { graphFromVault } from './graph-data';
import { DEFAULT_PALETTE } from './types';
import type { GraphNode, RenderOptions, VaultGraphInput } from './types';
import { buildControlsPanel } from './controls-panel';
import type { Memory3DSettings } from './settings';

export const VIEW_TYPE_MEMORY_3D = 'agentage-memory-3d-graph';

// Minimal host the view needs from the plugin: live settings + a way to persist.
export interface Memory3DHost {
  settings: Memory3DSettings;
  saveSettings(): Promise<void>;
}

export class Memory3DView extends ItemView {
  private renderer?: GraphRenderer;
  private host: Memory3DHost;
  private graphHost!: HTMLElement;
  private readonly rebuild = debounce(() => this.refreshData(), 400, true);

  constructor(leaf: WorkspaceLeaf, host: Memory3DHost) {
    super(leaf);
    this.host = host;
  }

  getViewType(): string {
    return VIEW_TYPE_MEMORY_3D;
  }

  getDisplayText(): string {
    return '3D graph';
  }

  getIcon(): string {
    return 'brain';
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('m3d-root');
    this.graphHost = root.createDiv({ cls: 'm3d-host' });

    buildControlsPanel(root, this.host.settings, {
      onFilters: () => {
        void this.host.saveSettings();
        this.refreshData();
      },
      onDisplay: () => {
        void this.host.saveSettings();
        this.renderer?.setOptions(this.renderOptions());
      },
      onCenter: () => this.renderer?.zoomToFit(),
    });

    this.renderer = createGraphRenderer(this.graphHost, this.renderOptions());
    this.renderer.onNodeClick((node) => this.openNode(node));
    this.refreshData();

    // 3d-force-graph has no internal ResizeObserver and defaults the canvas to window
    // size, so measure the actual pane once layout is ready and on every resize. A bare
    // synchronous read in onOpen is often 0x0 (leaf not laid out yet) and leaves the
    // canvas overflowing the pane.
    this.app.workspace.onLayoutReady(() => this.sizeToHost());
    const ro = new ResizeObserver(() => this.sizeToHost());
    ro.observe(this.graphHost);
    this.register(() => ro.disconnect());

    // Rebuild when the link graph settles after edits/renames/deletes.
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.rebuild()));
  }

  async onClose(): Promise<void> {
    this.renderer?.destroy();
    this.renderer = undefined;
  }

  onResize(): void {
    this.sizeToHost();
  }

  private sizeToHost(): void {
    const w = this.graphHost?.clientWidth || this.contentEl.clientWidth;
    const h = this.graphHost?.clientHeight || this.contentEl.clientHeight;
    if (w > 0 && h > 0) this.renderer?.resize(w, h);
  }

  private renderOptions(): RenderOptions {
    const s = this.host.settings;
    return {
      autoRotate: s.autoRotate,
      rotateSpeed: s.rotateSpeed,
      nodeSize: s.nodeSize,
      linkThickness: s.linkThickness,
      showArrows: s.showArrows,
      showLabels: s.showLabels,
      forces: s.forces,
      // large-graph example look: near-black bg + nodeAutoColorBy clusters.
      palette: DEFAULT_PALETTE,
    };
  }

  private vaultInput(): VaultGraphInput {
    const markdownPaths = this.app.vault.getMarkdownFiles().map((f) => f.path);
    const allPaths = this.app.vault.getFiles().map((f) => f.path);
    const tagsByFile: Record<string, string[]> = {};
    if (this.host.settings.filters.showTags) {
      for (const file of this.app.vault.getMarkdownFiles()) {
        const cache = this.app.metadataCache.getFileCache(file);
        const tags = cache ? getAllTags(cache) : null;
        if (tags && tags.length) tagsByFile[file.path] = tags;
      }
    }
    return {
      markdownPaths,
      allPaths,
      resolvedLinks: this.app.metadataCache.resolvedLinks,
      unresolvedLinks: this.app.metadataCache.unresolvedLinks,
      tagsByFile,
    };
  }

  private refreshData(): void {
    if (!this.renderer) return;
    const data = graphFromVault(this.vaultInput(), this.host.settings.filters);
    this.renderer.setData(data);
  }

  private openNode(node: GraphNode): void {
    if (node.kind !== 'file' && node.kind !== 'attachment') return;
    const file = this.app.vault.getAbstractFileByPath(node.id);
    if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
  }
}
