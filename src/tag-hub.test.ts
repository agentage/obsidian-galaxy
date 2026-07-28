import { describe, expect, it } from 'vitest';
import { spotlightIds, tagNodeVal, tagUsage, TAG_HUB_VAL_FACTOR } from './tag-hub';
import type { GraphNode } from './types';

const tag = (over: Partial<GraphNode> = {}): GraphNode => ({
  id: '#idea',
  name: '#idea',
  folder: '',
  kind: 'tag',
  val: 1,
  neighbors: ['A.md', 'B.md'],
  ...over,
});

describe('tagUsage', () => {
  it('counts the notes carrying the tag (its neighbors)', () => {
    expect(tagUsage(tag())).toBe(2);
  });

  it('is zero when a tag has no neighbors', () => {
    expect(tagUsage(tag({ neighbors: [] }))).toBe(0);
    expect(tagUsage(tag({ neighbors: undefined }))).toBe(0);
  });
});

describe('tagNodeVal', () => {
  it('scales the size weight by usage and the hub factor', () => {
    expect(tagNodeVal(0)).toBe(TAG_HUB_VAL_FACTOR);
    expect(tagNodeVal(3)).toBe(4 * TAG_HUB_VAL_FACTOR);
  });

  it('grows monotonically with usage', () => {
    expect(tagNodeVal(5)).toBeGreaterThan(tagNodeVal(2));
  });
});

describe('spotlightIds', () => {
  it('includes the tag itself plus every tagged note', () => {
    expect([...spotlightIds(tag())].sort()).toEqual(['#idea', 'A.md', 'B.md']);
  });

  it('is just the node when it has no neighbors', () => {
    expect([...spotlightIds(tag({ neighbors: [] }))]).toEqual(['#idea']);
  });
});
