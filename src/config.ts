// ─── Game-wide constants ────────────────────────────────────────────────────
// Portrait layout for mobile: enemies enter from doors along the top strip
// and walk straight down through Petya's office to the desk at the bottom.

export const GAME_WIDTH  = 480;
export const GAME_HEIGHT = 800;

/** Top of Petya's office — enemies+towers live in [OFFICE_Y_TOP, OFFICE_Y_BOTTOM].
 *  This band is 600px tall = 3/4 of GAME_HEIGHT; the remaining top quarter is
 *  the reception strip where the spawn doors are. */
export const OFFICE_Y_TOP    = 200;
export const OFFICE_Y_BOTTOM = 780;

/** Target – Petya's desk position (bottom of the office) */
export const DESK_X = 240;
export const DESK_Y = 700;

/** Projectile speed px/s */
export const PROJECTILE_SPEED = 280;

/** How many tasks reaching the desk triggers game-over */
export const MAX_TASKS = 10;

/** Enemy spawn interval range (ms) */
export const SPAWN_INTERVAL_MIN = 2000;
export const SPAWN_INTERVAL_MAX = 3500;

/** Money Petya starts the game with */
export const STARTING_MONEY = 150;

/** Salary paid out every SALARY_INTERVAL_WAVES waves */
export const SALARY_AMOUNT = 100;
export const SALARY_INTERVAL_WAVES = 10;

/** Tower upgrades: max level and per-level bonuses (applied on top of each
 *  variant's own base range/fireRate/damage below) */
export const TOWER_MAX_LEVEL = 3;
export const TOWER_UPGRADE_DAMAGE_BONUS = 1;
export const TOWER_UPGRADE_RANGE_BONUS = 20;
export const TOWER_UPGRADE_FIRE_RATE_MULT = 0.85;

// ─── Tower variants ─────────────────────────────────────────────────────
export type TowerVariant = 'script' | 'router' | 'docs' | 'coffee' | 'chair' | 'aircon';

export interface TowerVariantStats {
  label: string;
  icon: string;
  color: number;
  /** Range in pixels at level 1 */
  range: number;
  /** Ms between shots at level 1 */
  fireRate: number;
  /** Damage per hit at level 1 */
  damage: number;
  /** Money cost to place (and base unit for upgrade cost: cost * level) */
  cost: number;
  /**
   * 'slow'    — single-target slow on hit (coffee)
   * 'aoe'     — projectile splash-damages everyone near the impact point (aircon)
   * 'aoeSlow' — no projectile: an expanding ring pulse from the tower itself,
   *             damages + slows everyone currently in range (router)
   * 'stun'    — big single-target hit that also freezes movement (docs)
   */
  special?: 'slow' | 'aoe' | 'aoeSlow' | 'stun';
}

// Order matches how right-click / 1-6 / HUD-tap cycle through variants.
export const TOWER_VARIANT_KEYS: readonly TowerVariant[] =
  ['script', 'router', 'docs', 'coffee', 'chair', 'aircon'];

export const TOWER_VARIANTS_DATA: Record<TowerVariant, TowerVariantStats> = {
  // Basic rapid-fire gun — sprays matrix-green 0s and 1s.
  script: { label: 'Script',  icon: '📜', color: 0x0984e3, range: 110, fireRate: 500,  damage: 1, cost: 45 },
  // Ring-shaped Wi-Fi pulse from the tower itself ("ping is high, the task
  // is loading slowly") — damages and slows everyone currently in range.
  router: { label: 'Router',  icon: '📡', color: 0x6c5ce7, range: 100, fireRate: 1500, damage: 1, cost: 65, special: 'aoeSlow' },
  // Slow heavy artillery — hurls RTFM tomes that hit hard and stun.
  docs:   { label: 'Docs',    icon: '📖', color: 0x00b894, range: 160, fireRate: 1800, damage: 3, cost: 75, special: 'stun' },
  // Coffee break — slows whatever it hits.
  coffee: { label: 'Coffee',  icon: '☕', color: 0x8b5e3c, range: 110, fireRate: 1200, damage: 1, cost: 55, special: 'slow' },
  // Cheap starter tower — low stats, low cost.
  chair:  { label: 'Chair',   icon: '🪑', color: 0xe17055, range: 90,  fireRate: 800,  damage: 1, cost: 30 },
  // Blast of cold air — splash-damages everyone near the impact point.
  aircon: { label: 'AC',      icon: '🌬️', color: 0x81ecec, range: 140, fireRate: 1600, damage: 1, cost: 80, special: 'aoe' },
};

/** Coffee/Router: how much a slow reduces speed, and for how long */
export const SLOW_MULTIPLIER  = 0.5;
export const SLOW_DURATION_MS = 1500;

/** AC: splash-damage radius around the impact point (Router's pulse just
 *  uses its own `range` as the radius — no separate constant needed) */
export const AOE_SPLASH_RADIUS = 50;

/** Docs: how long the stun (RTFM to the face) freezes movement for */
export const STUN_DURATION_MS = 1200;

// ─── Ultimate: "Создай тикет" ────────────────────────────────────────────
// A long-cooldown global strike. Once fully charged, tapping the HUD
// button instantly removes a fraction of the coworkers currently on
// screen — they're too lazy to file an official Jira ticket, so they
// just leave instead of reaching the desk.
export const ULTIMATE_COOLDOWN_MS = 30000;
/** Fraction of enemies on screen removed per activation (rounded up) */
export const ULTIMATE_KILL_FRACTION = 0.5;

// ─── Shield: "Я на митинге" ──────────────────────────────────────────────
// Temporary invulnerability for Petya's office door. While active, anyone
// who reaches the desk instead gets stuck at the "Не беспокоить" sign and
// takes periodic damage from waiting — towers can still finish them off.
// If the shield expires before they die, they barge in immediately.
export const SHIELD_COOLDOWN_MS = 25000;
/** How long one activation stays up */
export const SHIELD_DURATION_MS = 5000;
export const SHIELD_DOT_DAMAGE = 1;
export const SHIELD_DOT_INTERVAL_MS = 1000;

// ─── Map textures ───────────────────────────────────────────────────────
// Drop matching files under public/assets/... (see the README files there)
// and MainScene will use them automatically — nothing else to wire up.
// Until a file exists, that slot silently falls back to the current
// programmatic Graphics drawing, so the game works with none, some, or
// all of these present.
export interface TextureAsset {
  key: string;
  path: string;
  /** 'tile' = repeating background (Phaser TileSprite), 'sprite' = single image */
  kind: 'tile' | 'sprite';
}

export const TEXTURE_ASSETS: TextureAsset[] = [
  { key: 'tile-wall',         path: 'assets/tiles/wall.png',          kind: 'tile' },
  { key: 'tile-office-floor', path: 'assets/tiles/office-floor.png',  kind: 'tile' },
  { key: 'sprite-door',       path: 'assets/sprites/door.png',        kind: 'sprite' },
  { key: 'sprite-desk',       path: 'assets/sprites/desk.png',        kind: 'sprite' },
];

// ─── Spawn doors ────────────────────────────────────────────────────────
// Reception strip along the top edge, one row, below where the HUD panel
// sits (top-left corner) so nothing gets visually covered.
export interface DoorDef {
  x: number;
  y: number;
  label: string;
}

export const SPAWN_DOORS: DoorDef[] = [
  { x: 60,  y: 165, label: 'HR' },
  { x: 180, y: 165, label: 'Finance' },
  { x: 300, y: 165, label: 'PM' },
  { x: 420, y: 165, label: 'Legal' },
];
