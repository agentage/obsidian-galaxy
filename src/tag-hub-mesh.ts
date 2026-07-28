import {
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  WireframeGeometry,
  type Material,
} from 'three';
import SpriteText from 'three-spritetext';

// Distinct three.js identity for tag nodes: a diamond core inside a wireframe aura cage,
// so a tag reads as a hub from every angle (a flat ring vanishes edge-on under auto-orbit).
// Not unit-tested (headless three has no GL); the sizing/spotlight math lives in tag-hub.ts.

// Shared unit geometries -> every hub scales one instance: no per-node geometry and no
// per-frame allocation.
const CORE_GEOMETRY = new OctahedronGeometry(1, 0);
const CAGE_GEOMETRY = new WireframeGeometry(new OctahedronGeometry(1, 1));

const CORE_SCALE = 1.1; // diamond core a touch larger than the note spheres it replaces
const CAGE_SCALE = 1.9; // aura cage floats around the core
const CORE_OPACITY = 0.9;
const CAGE_OPACITY = 0.35;
const LABEL_HEIGHT = 4; // taller than note labels so #name stays readable at hub size

// A material paired with its lit opacity, so the renderer can dim then restore it.
export interface DimMaterial {
  material: Material;
  base: number;
}

export interface TagHub {
  object: Group;
  materials: DimMaterial[];
}

export interface TagHubOptions {
  color: string;
  radius: number;
  textColor: string;
  label?: string; // omitted when labels are toggled off
}

export const buildTagHub = (opts: TagHubOptions): TagHub => {
  const group = new Group();
  const coreMat = new MeshBasicMaterial({
    color: opts.color,
    transparent: true,
    opacity: CORE_OPACITY,
  });
  const core = new Mesh(CORE_GEOMETRY, coreMat);
  core.scale.setScalar(opts.radius * CORE_SCALE);
  const cageMat = new LineBasicMaterial({
    color: opts.color,
    transparent: true,
    opacity: CAGE_OPACITY,
  });
  const cage = new LineSegments(CAGE_GEOMETRY, cageMat);
  cage.scale.setScalar(opts.radius * CAGE_SCALE);
  group.add(core, cage);
  if (opts.label) group.add(buildLabel(opts.label, opts.textColor, opts.radius));
  return {
    object: group,
    materials: [
      { material: coreMat, base: CORE_OPACITY },
      { material: cageMat, base: CAGE_OPACITY },
    ],
  };
};

const buildLabel = (text: string, color: string, radius: number): SpriteText => {
  const sprite = new SpriteText(text);
  sprite.color = color;
  sprite.textHeight = LABEL_HEIGHT;
  sprite.position.y = radius * CAGE_SCALE + 3; // sit just above the aura cage
  return sprite;
};
