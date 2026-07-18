import ForceGraph3D from '3d-force-graph';
import type { ForceGraph3DInstance } from '3d-force-graph';
import SpriteText from 'three-spritetext';
import type { GraphData, GraphForces, GraphNode, RenderOptions } from './types';
import { serializeCameraState, type CameraState } from './camera-state';
import { spotlightIds, tagNodeVal, tagUsage } from './tag-hub';
import { buildTagHub, type DimMaterial } from './tag-hub-mesh';

// Pure 3D renderer over 3d-force-graph. No Obsidian import -> reused verbatim by the
// browser harness. The Obsidian view feeds it theme colors; the harness feeds a fixed
// dark palette.

// Minimal shape of the d3-force objects we tweak (lib types them loosely).
interface D3Force {
  strength?(s: number): D3Force;
  distance?(d: number): D3Force;
  distanceMax?(d: number): D3Force;
}

const REPEL_SCALE = 5; // built-in "repel" slider -> d3 charge strength
const REPEL_MAX_RANGE = 300; // cap charge range so orphans don't fly off to infinity
const NODE_RESOLUTION = 18; // max sphere segments (smooth balls for small graphs)
const NODE_RESOLUTION_MIN = 4; // floor for huge clouds / far zoom (still reads as round)
const LINK_OPACITY = 0.5; // base link visibility
const DIM_NODE_ALPHA = 0.12; // spotlit-out note spheres fade to a faint ghost
const DIM_LINK_ALPHA = 0.05; // spotlit-out links fade almost fully
const DIM_HUB_FACTOR = 0.15; // spotlit-out tag hubs keep only a sliver of their opacity

// Convert a #rrggbb hex to an rgba() string so we can dim a node/link via its alpha.
const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Links carry string endpoints before the layout resolves them into node objects.
const endId = (end: string | { id?: string }): string =>
  typeof end === 'string' ? end : (end.id ?? '');

// Adaptive level-of-detail: every node is a UV sphere whose triangle count scales with
// its segment resolution, so a big cloud at 18 segments is millions of polygons. Pick a
// resolution from graph size (a few hundred nodes can afford smooth balls; thousands
// cannot) and the camera distance (far-away balls are a few pixels -> no detail needed).
// Returns a bucketed value so we only rebuild geometry when crossing a threshold.
const adaptiveResolution = (count: number, distance: number): number => {
  let base: number;
  if (count <= 250) base = NODE_RESOLUTION;
  else if (count <= 1000) base = 12;
  else if (count <= 3000) base = 8;
  else base = 6;
  if (distance > 1600) base -= 4;
  else if (distance > 800) base -= 2;
  return Math.max(NODE_RESOLUTION_MIN, base);
};

const colorForKind = (node: GraphNode, opts: RenderOptions): string => {
  switch (node.kind) {
    case 'tag':
      return opts.palette.tag;
    case 'attachment':
      return opts.palette.attachment;
    case 'unresolved':
      return opts.palette.unresolved;
    default:
      return opts.palette.file;
  }
};

// Group nodes the way the large-graph example colors by "user": files/attachments by
// their top folder, tags/unresolved by kind. Each group gets a distinct color from a
// categorical palette (d3 "Paired"-style), assigned per data load.
const groupOf = (node: GraphNode): string =>
  node.kind === 'file' || node.kind === 'attachment' ? node.folder || '/' : node.kind;

const CATEGORICAL = [
  '#a6cee3',
  '#1f78b4',
  '#b2df8a',
  '#33a02c',
  '#fb9a99',
  '#e31a1c',
  '#fdbf6f',
  '#ff7f00',
  '#cab2d6',
  '#6a3d9a',
  '#ffd23f',
  '#b15928',
];

// node.val = 1 + link count. Radius = cbrt(nodeVal) * nodeRelSize, so a plain linear
// val gives a gentle size-with-degree (hubs a bit bigger, no extremes).
const nodeRadius = (node: GraphNode, relSize: number): number => Math.cbrt(node.val) * relSize;

export interface GraphRenderer {
  setData(data: GraphData): void;
  setOptions(opts: RenderOptions): void;
  resize(width: number, height: number): void;
  zoomToFit(padding?: number): void;
  onNodeClick(cb: (node: GraphNode) => void): void;
  getCameraState(): CameraState | null;
  applyCameraState(state: CameraState): void;
  onCameraChange(cb: () => void): void;
  destroy(): void;
}

export const createGraphRenderer = (
  container: HTMLElement,
  initial: RenderOptions
): GraphRenderer => {
  let opts = initial;
  let clickCb: (node: GraphNode) => void = () => {};
  let cameraChangeCb: () => void = () => {}; // fires on wheel/drag/auto-rotate for persistence
  let fitted = false; // frame the camera once per data load, then leave it to the user
  let hasLinks = false; // fit to connected nodes when any exist, else to everything
  let nodeCount = 0; // current graph size, drives the LOD floor
  let currentRes = NODE_RESOLUTION; // last applied sphere resolution (avoid needless rebuilds)
  let resScheduled = false; // throttle LOD recompute to one per frame
  let destroyed = false; // guard queued frames after teardown
  let spotlight: Set<string> | null = null; // ids kept bright while a tag is focused
  let spotlightSource: string | null = null; // the tag driving the current spotlight
  const tagMaterials = new Map<string, DimMaterial[]>(); // per-tag hub materials to dim

  const baseColor = (node: GraphNode & { __color?: string }): string =>
    node.__color ?? colorForKind(node, opts);

  // Note/attachment/unresolved spheres are lib-drawn: dim via a low-alpha color when a
  // spotlight is active and this node is outside it (tag hubs dim via their materials).
  const nodeColorFn = (n: object): string => {
    const node = n as GraphNode & { __color?: string };
    const color = baseColor(node);
    return spotlight && !spotlight.has(node.id) ? withAlpha(color, DIM_NODE_ALPHA) : color;
  };

  // Fade links whose endpoints aren't both inside the spotlight.
  const linkColorFn = (l: object): string => {
    if (!spotlight) return opts.palette.link;
    const link = l as { source: string | { id?: string }; target: string | { id?: string } };
    const lit = spotlight.has(endId(link.source)) && spotlight.has(endId(link.target));
    return lit ? opts.palette.link : withAlpha(opts.palette.link, DIM_LINK_ALPHA);
  };

  const graph: ForceGraph3DInstance = new ForceGraph3D(container, { controlType: 'orbit' })
    .backgroundColor(opts.palette.background)
    .nodeRelSize(opts.nodeSize)
    .nodeResolution(NODE_RESOLUTION)
    .nodeVal((n) => (n as GraphNode).val)
    .nodeColor(nodeColorFn)
    .nodeLabel((n) => (n as GraphNode).name)
    .linkColor(linkColorFn)
    .linkWidth(() => opts.linkThickness)
    .linkOpacity(LINK_OPACITY)
    .linkDirectionalArrowLength(() => (opts.showArrows ? 3.5 : 0))
    .linkDirectionalArrowRelPos(1)
    .warmupTicks(20)
    .cooldownTicks(200)
    .onEngineStop(() => {
      if (!fitted) {
        fitted = true;
        fitView();
      }
    })
    .onNodeClick((n) => {
      const node = n as GraphNode;
      // A tag click drives the spotlight; other kinds fall through to the host (open note).
      if (node.kind === 'tag') toggleSpotlight(node);
      else clickCb(node);
    })
    .onBackgroundClick(() => clearSpotlight());

  // e2e/debug affordance: expose the underlying instance on the container so headless
  // capture scripts can drive the camera. Harmless in normal use.
  (container as { __forceGraph?: ForceGraph3DInstance }).__forceGraph = graph;

  // Recompute the adaptive sphere resolution from the current size + camera distance and
  // only rebuild geometry when the bucket actually changes.
  const updateResolution = (): void => {
    const cam = graph.camera() as { position: { x: number; y: number; z: number } };
    const target = (graph.controls() as { target?: { x: number; y: number; z: number } }).target;
    const tx = target?.x ?? 0;
    const ty = target?.y ?? 0;
    const tz = target?.z ?? 0;
    const distance = Math.hypot(cam.position.x - tx, cam.position.y - ty, cam.position.z - tz);
    const res = adaptiveResolution(nodeCount, distance);
    if (res !== currentRes) {
      currentRes = res;
      graph.nodeResolution(res);
    }
  };

  // OrbitControls fires 'change' on every wheel/drag/auto-rotate frame; coalesce to one
  // recompute per animation frame so we never thrash the bucket math.
  const scheduleResolution = (): void => {
    if (resScheduled) return;
    resScheduled = true;
    window.requestAnimationFrame(() => {
      resScheduled = false;
      if (!destroyed) updateResolution();
    });
  };
  const onControlsChange = (): void => {
    scheduleResolution();
    cameraChangeCb();
  };
  (
    graph.controls() as { addEventListener?: (e: string, cb: () => void) => void }
  ).addEventListener?.('change', onControlsChange);

  // Default framing: fit the connected cluster (lone orphans, flung to the periphery
  // by repulsion, shouldn't shrink the whole view); fall back to all nodes.
  const fitView = (padding = 60): void => {
    graph.zoomToFit(600, padding, (n) =>
      hasLinks ? ((n as GraphNode).neighbors?.length ?? 0) > 0 : true
    );
  };

  // Tag nodes REPLACE the default sphere with a distinct hub object; every other kind
  // EXTENDS its sphere with just a label sprite.
  const tagObject = (node: GraphNode): object => {
    const hub = buildTagHub({
      color: baseColor(node),
      radius: nodeRadius(node, opts.nodeSize),
      textColor: opts.palette.text,
      label: opts.showLabels ? node.name : undefined,
    });
    tagMaterials.set(node.id, hub.materials);
    return hub.object;
  };

  const labelObject = (node: GraphNode): object | undefined => {
    if (!opts.showLabels) return undefined;
    const sprite = new SpriteText(node.name);
    sprite.color = opts.palette.text;
    sprite.textHeight = 3;
    sprite.position.y = nodeRadius(node, opts.nodeSize) + 3; // sit just above the ball
    return sprite;
  };

  const applyNodeObjects = (): void => {
    tagMaterials.clear(); // re-populated as the accessor rebuilds every node object
    graph
      .nodeThreeObjectExtend((n) => (n as GraphNode).kind !== 'tag')
      .nodeThreeObject((n) => {
        const node = n as GraphNode;
        return (node.kind === 'tag' ? tagObject(node) : labelObject(node)) as never;
      });
  };

  // Re-evaluate every dimmable channel: lib spheres/links via their accessors, tag hubs
  // via their own materials.
  const refreshHighlight = (): void => {
    for (const [id, mats] of tagMaterials) {
      const dim = spotlight != null && !spotlight.has(id);
      for (const m of mats) m.material.opacity = dim ? m.base * DIM_HUB_FACTOR : m.base;
    }
    graph.nodeColor(nodeColorFn).linkColor(linkColorFn);
  };

  const clearSpotlight = (): void => {
    if (!spotlight) return;
    spotlight = null;
    spotlightSource = null;
    refreshHighlight();
  };

  // Clicking the active tag again clears; a different tag switches focus.
  const toggleSpotlight = (node: GraphNode): void => {
    if (spotlightSource === node.id) {
      clearSpotlight();
      return;
    }
    spotlight = spotlightIds(node);
    spotlightSource = node.id;
    refreshHighlight();
  };

  const applyForces = (f: GraphForces): void => {
    const charge = graph.d3Force('charge') as unknown as D3Force | undefined;
    charge?.strength?.(-f.repelStrength * REPEL_SCALE);
    charge?.distanceMax?.(REPEL_MAX_RANGE);
    const link = graph.d3Force('link') as unknown as D3Force | undefined;
    link?.distance?.(f.linkDistance);
    link?.strength?.(f.linkStrength);
    const center = graph.d3Force('center') as unknown as D3Force | undefined;
    center?.strength?.(f.centerStrength);
  };

  const applyControls = (): void => {
    const controls = graph.controls() as {
      autoRotate?: boolean;
      autoRotateSpeed?: number;
      zoomToCursor?: boolean;
    };
    controls.autoRotate = opts.autoRotate;
    controls.autoRotateSpeed = opts.rotateSpeed;
    controls.zoomToCursor = true; // wheel zooms toward the cursor, not the scene center
  };

  applyNodeObjects();
  applyForces(opts.forces);
  applyControls();

  return {
    setData(data: GraphData): void {
      fitted = false; // re-frame once after the new layout settles
      hasLinks = data.links.length > 0;
      nodeCount = data.nodes.length; // drives the LOD floor for big clouds
      spotlight = null; // new data invalidates any prior focus
      spotlightSource = null;
      // Assign a categorical color per group (folder / kind), like the large-graph
      // example's nodeAutoColorBy. Stable across renders via sorted group order.
      const groups = [...new Set(data.nodes.map(groupOf))].sort();
      const colorByGroup = new Map<string, string>();
      groups.forEach((gp, i) => colorByGroup.set(gp, CATEGORICAL[i % CATEGORICAL.length]));
      for (const node of data.nodes) {
        (node as GraphNode & { __color?: string }).__color = colorByGroup.get(groupOf(node));
        // Tag hubs render larger, scaled by how many notes carry the tag.
        if (node.kind === 'tag') node.val = tagNodeVal(tagUsage(node));
      }
      graph.graphData({ nodes: data.nodes, links: data.links });
      updateResolution(); // size changed -> reset detail before the layout settles
    },
    setOptions(next: RenderOptions): void {
      opts = next;
      graph
        .backgroundColor(opts.palette.background)
        .nodeRelSize(opts.nodeSize)
        .nodeColor(nodeColorFn)
        .linkColor(linkColorFn)
        .linkWidth(() => opts.linkThickness)
        .linkDirectionalArrowLength(() => (opts.showArrows ? 3.5 : 0));
      applyNodeObjects();
      applyForces(opts.forces);
      applyControls();
      graph.d3ReheatSimulation();
    },
    resize(width: number, height: number): void {
      graph.width(width).height(height);
    },
    zoomToFit(padding = 60): void {
      fitView(padding);
    },
    onNodeClick(cb: (node: GraphNode) => void): void {
      clickCb = cb;
    },
    getCameraState(): CameraState | null {
      const position = (graph.camera() as { position?: unknown }).position;
      const target = (graph.controls() as { target?: unknown }).target;
      return serializeCameraState(position, target);
    },
    applyCameraState(state: CameraState): void {
      // Suppress the one-time zoomToFit so the restored view isn't clobbered on engine stop.
      fitted = true;
      graph.cameraPosition(state.position, state.target, 0);
    },
    onCameraChange(cb: () => void): void {
      cameraChangeCb = cb;
    },
    destroy(): void {
      destroyed = true;
      graph._destructor();
      // Obsidian provides container.empty(); the browser harness doesn't, so fall back
      // to a DOM-clearing loop (avoids innerHTML).
      container.empty?.();
      while (container.firstChild) container.removeChild(container.firstChild);
    },
  };
};
