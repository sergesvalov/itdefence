import { TOWER_VARIANT_KEYS, FURNITURE_TYPE_KEYS } from '../config';
import { MetaProgression } from './MetaProgression';

/** Build items in toolbar order: towers first, then furniture. */
const ITEM_KEYS: readonly string[] = [...TOWER_VARIANT_KEYS, ...FURNITURE_TYPE_KEYS];

let allowed: ReadonlySet<string> | null = null;

/** Restricts building to these items (a campaign level's kit); null lifts the restriction. */
export function setAllowedBuilds(keys: readonly string[] | null): void {
  allowed = keys ? new Set(keys) : null;
}

/** Is the toolbar slot at `index` unavailable right now? */
export function isBuildLocked(index: number): boolean {
  if (allowed !== null) return !allowed.has(ITEM_KEYS[index]);
  // The tutorial only lets you use the cooler (0) and the cabinet (6).
  return index > 0 && index !== 6 && !MetaProgression.get().tutorialCompleted;
}
