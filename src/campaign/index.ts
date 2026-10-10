import { ACT1_LEVELS, ACT1_TITLE } from './act1';
import { ACT2_LEVELS, ACT2_TITLE } from './act2';
import { ACT3_LEVELS, ACT3_TITLE } from './act3';
import type { LevelDef } from './types';

export type { LevelDef } from './types';

/** An act is one of Petya's attempts at this life — a chapter of the book. */
export interface ActDef {
  id: string;
  /** Short name for the tab ("Акт I") */
  short: string;
  title: string;
  levels: LevelDef[];
}

export const ACTS: ActDef[] = [
  { id: 'act1', short: 'Акт I', title: ACT1_TITLE, levels: ACT1_LEVELS },
  { id: 'act2', short: 'Акт II', title: ACT2_TITLE, levels: ACT2_LEVELS },
  { id: 'act3', short: 'Акт III', title: ACT3_TITLE, levels: ACT3_LEVELS },
];

export function getAct(id: string | undefined): ActDef {
  return ACTS.find(a => a.id === id) ?? ACTS[0];
}

/** Finds a level by id, along with the act it belongs to and its position there. */
export function findLevel(id: string | null | undefined): { act: ActDef; index: number; level: LevelDef } | null {
  for (const act of ACTS) {
    const index = act.levels.findIndex(l => l.id === id);
    if (index >= 0) return { act, index, level: act.levels[index] };
  }
  return null;
}
