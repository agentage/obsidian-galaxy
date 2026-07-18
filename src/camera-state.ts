// Pure, Obsidian-free camera persistence. The orbit camera is fully described by its
// position plus the look-at target (zoom is the target->position distance, orientation
// is derived by OrbitControls from position + a fixed up vector), so a valid CameraState
// round-trips a session's view. Validation rejects corrupt/partial data.json so a bad
// blob falls back to the default framing instead of throwing.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraState {
  position: Vec3;
  target: Vec3;
}

const isFiniteVec3 = (v: unknown): v is Vec3 => {
  const c = v as Partial<Vec3> | null;
  return (
    typeof c?.x === 'number' &&
    Number.isFinite(c.x) &&
    typeof c.y === 'number' &&
    Number.isFinite(c.y) &&
    typeof c.z === 'number' &&
    Number.isFinite(c.z)
  );
};

const cloneVec3 = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

// Build a CameraState from raw position/target, or null if either is non-finite (e.g. a
// camera read before the scene has laid out returns 0/0/0 or NaN).
export const serializeCameraState = (position: unknown, target: unknown): CameraState | null =>
  isFiniteVec3(position) && isFiniteVec3(target)
    ? { position: cloneVec3(position), target: cloneVec3(target) }
    : null;

// Parse persisted data.json back into a CameraState, or null when missing/corrupt.
export const parseCameraState = (raw: unknown): CameraState | null => {
  const c = raw as Partial<CameraState> | null;
  return serializeCameraState(c?.position, c?.target);
};
