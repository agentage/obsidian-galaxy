# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

**Agentage Galaxy** - an Obsidian plugin that renders the vault as a 3D, rotating
force-graph. A toolbar (ribbon) click opens an `ItemView` hosting the 3D graph.

- **Plugin id:** `agentage-galaxy` (the install/auto-update key) - **Display name:** `Agentage Galaxy`
- It mirrors Obsidian's built-in graph view: same node kinds (file / attachment / tag /
  unresolved), same filters (search, tags, attachments, existing-files-only, orphans),
  same force knobs (center / repel / link / distance), in 3D with auto-orbit.

## Architecture (`src/`)

- **Pure core (no Obsidian import)** - reused verbatim by the browser harness:
  - `types.ts` - graph + filter + force + render option types.
  - `graph-data.ts` - vault -> `{nodes, links}`. `graphFromVault` (from
    `metadataCache.resolvedLinks`/`unresolvedLinks` + file lists + tags) and
    `graphFromMarkdown`/`inputFromMarkdown` (parse `[[wikilinks]]` + `#tags`, for the
    harness/sample). One shared `assemble()` does degree, dedupe, orphan + search filters.
  - `tag-hub.ts` + `camera-state.ts` - tag-hub logic and camera-state persistence helpers (unit tested).
  - `render.ts` - `createGraphRenderer(container, opts)` over 3d-force-graph: orbit
    controls + `controls().autoRotate` + `zoomToCursor`, per-group categorical node colors
    (large-graph style), `three-spritetext` labels, force tuning, one-time `zoomToFit`
    (to connected nodes) on engine stop, exposed via `zoomToFit()` for the Center button.
- **Obsidian-coupled:**
  - `graph-view.ts` - the `ItemView` (`VIEW_TYPE_MEMORY_3D`). Uses the fixed `DEFAULT_PALETTE`
    (near-black bg), builds data off `metadataCache`, hosts the controls panel, refreshes on
    `metadataCache 'resolved'`, opens notes on node click.
  - `controls-panel.ts` - controls panel hidden behind a top-right gear (Filters/Display/
    Forces/Rotation, Obsidian `Setting` rows) + a Center button that resets the view.
  - `settings.ts` + `settings-tab.ts` - persisted defaults (filters mirror the built-in;
    forces use 3D-appropriate defaults).
  - `main.ts` - the `Plugin`: `registerView`, ribbon icon (`brain`, "Open 3D graph"),
    command, settings tab, `activateView`.

## Key facts / gotchas

- **3d-force-graph v1.80 API:** `new ForceGraph3D(el, { controlType: 'orbit' })` (default
  export, NOT `ForceGraph3D()(el)`). Auto-rotate works because the lib's render loop calls
  `controls.update()` every frame; needs `controlType: 'orbit'`.
- **Colors:** nodes are auto-colored per group (folder for files/attachments, kind for
  tags/unresolved) from a categorical palette assigned in `setData`; `nodeAutoColorBy`
  no-ops when a custom `nodeColor` accessor is set, so we assign `__color` ourselves.
- **Framing:** strong repulsion flings orphans far, so `zoomToFit` targets connected
  nodes only (`neighbors.length > 0`); charge has `distanceMax` so orphans don't escape.
- **Bundle:** esbuild bundles three + 3d-force-graph into `main.js` (`isDesktopOnly`);
  only `obsidian`/`electron`/node builtins stay external.

## Develop

```bash
npm install
npm run dev / build / test / verify
npm run build:preview && npm run sample   # browser harness in preview/ (real render path)
npm run install:vault [vault]             # copy build into a vault + enable (default ./test-vault)
```

`test-vault/` is a small interconnected sample vault (files, tags, an attachment, an
unresolved link, an orphan) used by the harness and for in-Obsidian testing.

Inherits global agentage standards (`~/projects/CLAUDE.md`): Node 22+, TS strict ESM,
named exports, Prettier/ESLint, no em dashes. Standards: `~/vaults/engineering/standards/` (start at `README.md`). Release flow: `RELEASING.md`.
