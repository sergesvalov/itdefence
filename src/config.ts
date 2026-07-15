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
export const TOOLBAR_WIDTH = 84;
export const DESK_X = 282; // 84 + (480-84)/2
export const DESK_Y = 700;

/** Projectile speed px/s */
export const PROJECTILE_SPEED = 280;

/**
 * Inbox (the "Очередь задач" mechanic): coworkers who reach the desk drop
 * a task in the Inbox instead of hitting Petya directly. If the queue ever
 * exceeds INBOX_LIMIT, it's game over. Petya auto-resolves the task at the
 * front of the queue every INBOX_RESOLVE_INTERVAL_MS.
 */
export const INBOX_LIMIT = 10;
export const INBOX_RESOLVE_INTERVAL_MS = 2000;

/** Chance a spawning coworker carries a red/urgent task, which jumps the
 *  Inbox queue (to the front) instead of joining the back on arrival. */
export const URGENT_TASK_CHANCE = 0.15;

/** Enemy spawn interval range (ms) */
export const SPAWN_INTERVAL_MIN = 2000;
export const SPAWN_INTERVAL_MAX = 3500;

/** Money Petya starts the game with */
export const STARTING_MONEY = 150;

/** Money paid out every time a wave is fully cleared */
export const WAVE_MONEY_AMOUNT = 40;

/** How many coworkers spawn in a wave: BASE + wave * GROWTH */
export const ENEMIES_PER_WAVE_BASE = 6;
export const ENEMIES_PER_WAVE_GROWTH = 1;

/** Tower upgrades: max level and per-level bonuses (applied on top of each
 *  variant's own base range/fireRate/damage below) */
export const TOWER_MAX_LEVEL = 3;
export const TOWER_UPGRADE_DAMAGE_BONUS = 1;
export const TOWER_UPGRADE_RANGE_BONUS = 20;
export const TOWER_UPGRADE_FIRE_RATE_MULT = 0.85;

// ─── Tower variants ─────────────────────────────────────────────────────
export type TowerVariant = 'cooler' | 'router' | 'docs' | 'coffee' | 'aircon' | 'partner';

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
   *             damages (if damage > 0) + slows everyone currently in range (router)
   * 'stun'    — big single-target hit that also freezes movement (docs)
   * 'lureChain' — lures enemies to approach it once, and unleashes chain damage upon contact.
   * 'partner' — lures enemies (50% chance). After 10 hits, burns out.
   */
  special?: 'slow' | 'aoe' | 'aoeSlow' | 'stun' | 'lureChain' | 'partner';
  /**
   * Bypasses enemy armor/damage-reduction. Currently inert — no enemy in
   * the game has armor yet. Docs is flagged now so that whenever an
   * armored enemy (e.g. a shielded "Manager") gets added, there's an
   * obvious place to check this instead of re-deriving which tower should
   * pierce it.
   */
  armorPiercing?: boolean;
  /** Optional override for radius (e.g., for large objects like desks). Default is TOWER_SIZE. */
  radius?: number;
}

// Order matches how right-click / 1-6 / HUD-tap cycle through variants.
export const TOWER_VARIANT_KEYS: readonly TowerVariant[] =
  ['cooler', 'router', 'docs', 'coffee', 'aircon', 'partner'];

export const TOWER_VARIANTS_DATA: Record<TowerVariant, TowerVariantStats> = {
  // "Кулер": Lures enemies to take a break.
  // Once an enemy reaches it, it deals damage that chain-reacts to others in range.
  cooler: { label: 'Кулер',   icon: '🚰', color: 0x0984e3, range: 110, fireRate: 0,    damage: 1, cost: 45, special: 'lureChain' },
  // "Плохой коннект": pure crowd control, no real damage. Ring-shaped
  // Wi-Fi pulse from the tower itself — everyone in range "hangs loading
  // the page" (slowed), holding them in other towers' kill zones.
  router: { label: 'Router',  icon: '📡', color: 0x6c5ce7, range: 100, fireRate: 1500, damage: 0, cost: 65, special: 'aoeSlow' },
  // "Бюрократия": slow heavy artillery, single target, colossal damage.
  // Ignores armor (armorPiercing) — the intended counter once an armored
  // enemy exists (see the interface comment above).
  docs:   { label: 'Docs',    icon: '📖', color: 0x00b894, range: 160, fireRate: 2200, damage: 5, cost: 90, special: 'stun', armorPiercing: true },
  // Coffee break — slows whatever it hits.
  coffee: { label: 'Coffee',  icon: '☕', color: 0x8b5e3c, range: 110, fireRate: 1200, damage: 1, cost: 55, special: 'slow' },
  // Blast of cold air — splash-damages everyone near the impact point.
  aircon: { label: 'AC',      icon: '🌬️', color: 0x81ecec, range: 140, fireRate: 1600, damage: 1, cost: 80, special: 'aoe' },
  // Partner desk — absorbs 10 tasks, 50% chance to intercept enemies.
  partner:{ label: 'Напарник',icon: '🧑‍💻', color: 0x55efc4, range: 0, fireRate: 0, damage: 0, cost: 200, special: 'partner', radius: 70 },
};

/** Coffee/Router: how much a slow reduces speed, and for how long */
export const SLOW_MULTIPLIER  = 0.5;
export const SLOW_DURATION_MS = 1500;

/** AC: splash-damage radius around the impact point (Router's pulse just
 *  uses its own `range` as the radius — no separate constant needed) */
export const AOE_SPLASH_RADIUS = 50;

/** Docs: how long the stun (RTFM to the face) freezes movement for */
export const STUN_DURATION_MS = 1200;

/** Script: ricochet damage multiplier and max chain length per shot */
export const CHAIN_DAMAGE_MULT = 0.5;
export const CHAIN_MAX_BOUNCES = 3;

// ─── Furniture ──────────────────────────────────────────────────────────
// Movable, finite-stock obstacles the player places in the office — not
// weapons, just terrain. Cabinets and drawers are plain solid obstacles
// (coworkers steer around them); sofas are also solid, but on contact a
// coworker stops and sits down on it for SOFA_SIT_DURATION_MS (towers can
// still shoot them while they're seated) before standing up and moving on.
export type FurnitureType = 'cabinet' | 'drawer' | 'sofa';

export interface FurnitureTypeStats {
  label: string;
  icon: string;
  color: number;
  /** Solid collision radius coworkers steer around / collide with */
  radius: number;
  /** How many of this piece the player can have placed at once */
  maxCount: number;
}

export const FURNITURE_TYPE_KEYS: readonly FurnitureType[] = ['cabinet', 'drawer', 'sofa'];

export const FURNITURE_TYPES_DATA: Record<FurnitureType, FurnitureTypeStats> = {
  cabinet: { label: 'Шкаф',     icon: '🗄️', color: 0x795548, radius: 34, maxCount: 5 },
  drawer:  { label: 'Тумбочка', icon: '🗃️', color: 0xa1887f, radius: 25, maxCount: 6 },
  sofa:    { label: 'Диван',    icon: '🛋️', color: 0x8e44ad, radius: 38, maxCount: 3 },
};

/** How long a coworker sits on a sofa before standing back up and continuing */
export const SOFA_SIT_DURATION_MS = 3000;

// ─── Ultimate: "Создай тикет" ────────────────────────────────────────────
// A long-cooldown global strike. Once fully charged, tapping the HUD
// button instantly removes a fraction of the coworkers currently on
// screen — they're too lazy to file an official Jira ticket, so they
// just leave instead of reaching the desk.
export const ULTIMATE_COOLDOWN_MS = 30000;
/** Fraction of enemies on screen removed per activation (rounded up) */
export const ULTIMATE_KILL_FRACTION = 0.5;

// ─── Shield: "Я на митинге" ──────────────────────────────────────────────
export const SHIELD_COOLDOWN_MS = 25000;
export const SHIELD_DURATION_MS = 6000;
export const SHIELD_DOT_DAMAGE = 1;
export const SHIELD_DOT_INTERVAL_MS = 800;

// ── Coworker Variants (Enemies) ────────────────────────────────────────────────────────

export type CoworkerVariant = 'normal' | 'fast' | 'tank' | 'swarm' | 'boss';

export interface CoworkerStats {
  hpMult: number;
  speedMult: number;
  scale: number;
  tint: number;
  emoji: string;
  name: string;
}

export const COWORKER_VARIANTS: Record<CoworkerVariant, CoworkerStats> = {
  normal: { hpMult: 1, speedMult: 1, scale: 1, tint: 0xffffff, emoji: '', name: 'Коллега' },
  fast:   { hpMult: 0.7, speedMult: 1.5, scale: 0.9, tint: 0xf39c12, emoji: '⚡', name: 'Agile Коуч' },
  tank:   { hpMult: 3, speedMult: 0.65, scale: 1.15, tint: 0x95a5a6, emoji: '🛡️', name: 'Бухгалтер' },
  swarm:  { hpMult: 0.4, speedMult: 1.2, scale: 0.8, tint: 0x2ecc71, emoji: '🐣', name: 'Стажер' },
  boss:   { hpMult: 15, speedMult: 0.35, scale: 1.6, tint: 0xe74c3c, emoji: '👿', name: 'Заказчик' },
};

// ─── Map textures ───────────────────────────────────────────────────────
export interface TextureAsset {
  key: string;
  path: string;
  /** 'tile' = repeating background (Phaser TileSprite), 'sprite' = single image */
  kind: 'tile' | 'sprite';
}

export const TEXTURE_ASSETS: TextureAsset[] = [
  { key: 'tile-corridor-floor', path: 'assets/tiles/corridor-floor.png', kind: 'tile' },
  { key: 'tile-office-floor',   path: 'assets/tiles/office-floor.png',   kind: 'tile' },
  { key: 'tile-wall',           path: 'assets/tiles/wall.png',           kind: 'tile' },
  { key: 'sprite-door',         path: 'assets/sprites/door.png',         kind: 'sprite' },
  { key: 'sprite-door-open',    path: 'assets/sprites/door-open.png',    kind: 'sprite' },
  { key: 'sprite-desk',         path: 'assets/sprites/desk.png',         kind: 'sprite' },
  { key: 'sprite-desk-partner', path: 'assets/sprites/desk-partner.png', kind: 'sprite' },
  { key: 'sprite-tower-partner',  path: 'assets/sprites/desk-partner.png', kind: 'sprite' },
  { key: 'sprite-coworker',       path: 'assets/sprites/coworker.png',     kind: 'sprite' },
  // One sprite slot per tower variant — sprite-tower-script, sprite-tower-router, ...
  ...TOWER_VARIANT_KEYS.map((variant): TextureAsset => ({
    key: `sprite-tower-${variant}`,
    path: `assets/sprites/tower-${variant}.png`,
    kind: 'sprite',
  })),
  // One sprite slot per furniture type — sprite-furniture-cabinet, ...
  ...FURNITURE_TYPE_KEYS.map((type): TextureAsset => ({
    key: `sprite-furniture-${type}`,
    path: `assets/sprites/furniture-${type}.png`,
    kind: 'sprite',
  })),
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
  { x: 282, y: 165, label: 'Reception' },
];
