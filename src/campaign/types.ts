import type { CoworkerVariant, FurnitureType, TowerVariant } from '../config';

/**
 * Campaign levels. Each one is a chapter of the book: a short text before
 * and after, its own set of buildable items, and (later in the act) a
 * mechanic taken straight from the story.
 */
export interface LevelDef {
  id: string;
  title: string;
  /** One line under the title in the chapter list */
  teaser: string;
  /** What the coworkers come with in this chapter — shown above each of them.
   *  Whatever the heroes build, they are defending against these. */
  problems: string[];
  /** The boss's own problem (falls back to a regular one) */
  bossProblem?: string;
  /** Story pages shown before / after the level */
  intro: string[];
  outro: string[];
  /** Waves to survive to win */
  waves: number;
  startMoney: number;
  /** What the player may build here */
  build: (TowerVariant | FurnitureType)[];
  /** Which coworker types can show up (bosses come from `bossWaves`) */
  variants: CoworkerVariant[];
  /** Added to the wave number for enemy count / HP / spawn rate */
  difficulty: number;
  bossWaves?: number[];
  /** Partner desks allowed (omitted = none) */
  partnerLimit?: number;
  /** "Хранилище с характером": idle towers doze off and wake up lazily */
  sleepyTowers?: boolean;
  /** At the start of these waves the priciest tower is taken away */
  towerLoss?: { wave: number; message: string }[];
  /** Who tells this chapter's story (portrait on the text screens); Petya by default */
  avatar?: 'vasya' | 'maria' | 'chief' | 'seva' | 'sasha';
  /** Boss of this chapter, if it isn't the generic one */
  bossVariant?: CoworkerVariant;
  /**
   * "Пётр и Петр": some coworkers carry a record spelled with «ё». Removed by
   * anything but Docs (the script), such a record falls apart into two
   * duplicates. Each entry is [original, duplicate, duplicate].
   */
  duplicates?: { chance: number; names: [string, string, string][] };
  /**
   * "Два миллиона, две недели": every wave has a deadline. Cleared in time —
   * a bonus; overdue — a fine.
   */
  deadline?: { seconds: number; bonus: number; fine: number };
  /**
   * "Этого нет в почте": some coworkers come with a verbal agreement. Closed
   * without a single Docs hit (no letter), they walk back in from the door
   * with `comeback` instead.
   */
  verbal?: { chance: number; label: string; comeback: string };
  /**
   * "Пятничный отчёт": the end-of-wave bonus depends on how many tasks were
   * stopped rather than being flat.
   */
  fridayReport?: { fullBonus: number };
  /** "Из дома": Petya's own inbox rules for this level */
  inbox?: { limit: number; resolveMs: number };
  /**
   * "Граната в песочницу": some coworkers bring a small issue. Hit it with
   * Docs (a formal letter) and it escalates into something much bigger.
   * Each entry is [small issue, what it escalates into].
   */
  escalation?: { chance: number; names: [string, string][] };
  /** Doors the coworkers come from (x on the wall, label above); one central door by default */
  doors?: { x: number; label: string }[];
  /** Flat money for clearing a wave, if not the usual amount ("денег пока нет" — 0) */
  waveBonus?: number;
  /**
   * "База феникс": every so often a tower hangs like a zombie container. A
   * tap restarts it — at level 1, everything invested in it is gone.
   */
  zombieTowers?: { minMs: number; maxMs: number };
  /** "Телефон не умолкает": the next wave starts by itself after this long */
  autoStartMs?: number;
  /** "Харды и софты": abilities charge this many times faster */
  abilityChargeRate?: number;
  /**
   * "Озеро": most coworkers bring things that aren't worth it — they do no
   * harm at the desk and pay nothing. Only the real problems matter.
   */
  lake?: { realChance: number; realProblems: string[] };
  /** Meta money for clearing the level */
  reward: number;
}
