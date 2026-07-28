import type { GraphNode } from './types';

// Pure tag-hub logic (no three / no Obsidian) so it runs under Vitest and the browser
// harness unchanged. The renderer feeds these into geometry sizing + click-to-spotlight.

export const TAG_HUB_VAL_FACTOR = 4; // tag hubs render markedly larger than note nodes

// A tag's usage count = notes carrying it = its link degree (its neighbors are those notes).
export const tagUsage = (node: GraphNode): number => node.neighbors?.length ?? 0;

// Boosted size weight for a tag node: hubs read as hubs and grow with usage.
export const tagNodeVal = (usage: number): number => (1 + usage) * TAG_HUB_VAL_FACTOR;

// Spotlight = the tag itself + every note it tags; everything else gets dimmed.
export const spotlightIds = (node: GraphNode): Set<string> =>
  new Set<string>([node.id, ...(node.neighbors ?? [])]);
