import type { GraphFilters, GraphForces } from './types';
import { DEFAULT_FILTERS } from './types';
import { parseCameraState, type CameraState } from './camera-state';

// Transient per-vault view state persisted alongside settings (namespaced so it never
// collides with a live-tuning setting). Camera is restored on view open when enabled.
export interface ViewState {
  camera: CameraState | null;
}

// Persisted plugin settings: the built-in graph view's filters (verbatim) + force
// tuning + 3D display/rotation. Forces keep the built-in's knobs but use
// 3D-appropriate defaults (the built-in's 2D distances are an order of magnitude
// larger than a 3D scene wants).
export interface Memory3DSettings {
  filters: GraphFilters;
  forces: GraphForces;
  nodeSize: number;
  linkThickness: number;
  showArrows: boolean;
  showLabels: boolean;
  autoRotate: boolean;
  rotateSpeed: number;
  restoreCamera: boolean;
  viewState: ViewState;
}

export const DEFAULT_FORCES: GraphForces = {
  centerStrength: 0.1,
  repelStrength: 10,
  linkStrength: 0.5,
  linkDistance: 30,
};

export const DEFAULT_SETTINGS: Memory3DSettings = {
  filters: { ...DEFAULT_FILTERS },
  forces: { ...DEFAULT_FORCES },
  nodeSize: 1.8,
  linkThickness: 0.6,
  showArrows: false,
  showLabels: true,
  autoRotate: true,
  rotateSpeed: 1.2,
  restoreCamera: true,
  viewState: { camera: null },
};

// Tolerant merge so older/partial data.json never crashes onload. A corrupt camera blob
// is dropped to null (default framing) rather than restored.
export const mergeSettings = (raw: unknown): Memory3DSettings => {
  const r = (raw ?? {}) as Partial<Memory3DSettings>;
  return {
    filters: { ...DEFAULT_SETTINGS.filters, ...(r.filters ?? {}) },
    forces: { ...DEFAULT_SETTINGS.forces, ...(r.forces ?? {}) },
    nodeSize: r.nodeSize ?? DEFAULT_SETTINGS.nodeSize,
    linkThickness: r.linkThickness ?? DEFAULT_SETTINGS.linkThickness,
    showArrows: r.showArrows ?? DEFAULT_SETTINGS.showArrows,
    showLabels: r.showLabels ?? DEFAULT_SETTINGS.showLabels,
    autoRotate: r.autoRotate ?? DEFAULT_SETTINGS.autoRotate,
    rotateSpeed: r.rotateSpeed ?? DEFAULT_SETTINGS.rotateSpeed,
    restoreCamera: r.restoreCamera ?? DEFAULT_SETTINGS.restoreCamera,
    viewState: { camera: parseCameraState(r.viewState?.camera) },
  };
};
