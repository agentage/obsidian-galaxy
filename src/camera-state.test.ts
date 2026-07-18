import { describe, expect, it } from 'vitest';
import { parseCameraState, serializeCameraState } from './camera-state';

const POSITION = { x: 10, y: -20, z: 30 };
const TARGET = { x: 1, y: 2, z: 3 };

describe('serializeCameraState', () => {
  it('builds a state from finite position + target', () => {
    expect(serializeCameraState(POSITION, TARGET)).toEqual({ position: POSITION, target: TARGET });
  });

  it('clones inputs so later mutation cannot corrupt the saved state', () => {
    const pos = { ...POSITION };
    const state = serializeCameraState(pos, TARGET);
    pos.x = 999;
    expect(state?.position.x).toBe(10);
  });

  it('returns null when a coordinate is non-finite', () => {
    expect(serializeCameraState({ x: NaN, y: 0, z: 0 }, TARGET)).toBeNull();
    expect(serializeCameraState(POSITION, { x: Infinity, y: 0, z: 0 })).toBeNull();
  });

  it('returns null for missing or non-object inputs', () => {
    expect(serializeCameraState(undefined, TARGET)).toBeNull();
    expect(serializeCameraState(POSITION, null)).toBeNull();
    expect(serializeCameraState('nope', TARGET)).toBeNull();
  });
});

describe('parseCameraState', () => {
  it('round-trips a valid persisted blob', () => {
    const saved = serializeCameraState(POSITION, TARGET);
    expect(parseCameraState(saved)).toEqual(saved);
  });

  it('falls back to null for missing state', () => {
    expect(parseCameraState(null)).toBeNull();
    expect(parseCameraState(undefined)).toBeNull();
  });

  it('falls back to null for corrupt state', () => {
    expect(parseCameraState({ position: { x: 1, y: 2 }, target: TARGET })).toBeNull();
    expect(parseCameraState({ position: POSITION })).toBeNull();
    expect(parseCameraState('garbage')).toBeNull();
    expect(parseCameraState({ position: 'x', target: 'y' })).toBeNull();
  });
});
