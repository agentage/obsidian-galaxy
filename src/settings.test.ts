import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings';

describe('mergeSettings', () => {
  it('returns the defaults for nullish input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('back-fills missing top-level fields', () => {
    const merged = mergeSettings({ autoRotate: false });
    expect(merged.autoRotate).toBe(false);
    expect(merged.nodeSize).toBe(DEFAULT_SETTINGS.nodeSize);
    expect(merged.filters).toEqual(DEFAULT_SETTINGS.filters);
    expect(merged.forces).toEqual(DEFAULT_SETTINGS.forces);
  });

  it('merges nested filters/forces per-key (not whole-object replace)', () => {
    const merged = mergeSettings({
      filters: { showTags: true },
      forces: { linkDistance: 99 },
    });
    expect(merged.filters.showTags).toBe(true);
    expect(merged.filters.showOrphans).toBe(DEFAULT_SETTINGS.filters.showOrphans);
    expect(merged.forces.linkDistance).toBe(99);
    expect(merged.forces.repelStrength).toBe(DEFAULT_SETTINGS.forces.repelStrength);
  });

  it('does not throw on junk input', () => {
    expect(() => mergeSettings('nonsense')).not.toThrow();
    expect(() => mergeSettings(42)).not.toThrow();
    expect(mergeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults restoreCamera on and camera to null', () => {
    const merged = mergeSettings({});
    expect(merged.restoreCamera).toBe(true);
    expect(merged.viewState.camera).toBeNull();
  });

  it('restores a valid persisted camera', () => {
    const camera = { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } };
    expect(mergeSettings({ viewState: { camera } }).viewState.camera).toEqual(camera);
  });

  it('drops a corrupt persisted camera to null', () => {
    const merged = mergeSettings({ viewState: { camera: { position: { x: 1 } } } });
    expect(merged.viewState.camera).toBeNull();
  });
});
