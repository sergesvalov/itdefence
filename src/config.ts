// ─── Game-wide constants ────────────────────────────────────────────────────
// Portrait layout for mobile: enemies enter from doors along the top strip
// and walk straight down through Petya's office to the desk at the bottom.

export const GAME_WIDTH  = 480;
export let GAME_HEIGHT = 800;

/** Top of Petya's office — enemies+towers live in [OFFICE_Y_TOP, OFFICE_Y_BOTTOM].
 *  This band is 600px tall = 3/4 of GAME_HEIGHT; the remaining top quarter is
 *  the reception strip where the spawn doors are. */
export const OFFICE_Y_TOP    = 200;
export let OFFICE_Y_BOTTOM = 780;

/** Target – Petya's desk position (bottom of the office) */
export const TOOLBAR_WIDTH = 84;
export const DESK_X = 282; // 84 + (480-84)/2
export let DESK_Y = 700;

export function initLayout() {
  const aspect = window.innerHeight / window.innerWidth;
  // Cap the aspect ratio between 1.5 and 2.5 (phones)
  const clampedAspect = Math.max(1.5, Math.min(2.5, aspect));
  GAME_HEIGHT = Math.floor(GAME_WIDTH * clampedAspect);
  
  OFFICE_Y_BOTTOM = GAME_HEIGHT - 20;
  DESK_Y = GAME_HEIGHT - 100;
}

/** Projectile speed px/s */
export const PROJECTILE_SPEED = 280;

/**
 * Inbox (the "Очередь задач" mechanic): coworkers who reach the desk drop
 * a task in the Inbox instead of hitting Petya directly. If the queue ever
 * exceeds INBOX_LIMIT, it's game over. Petya auto-resolves the task at the
 * front of the queue every INBOX_RESOLVE_INTERVAL_MS.
 */
export const INBOX_LIMIT = 10;
export const INBOX_RESOLVE_INTERVAL_MS = 5000;

/** Chance a spawning coworker carries a red/urgent task, which jumps the
 *  Inbox queue (to the front) instead of joining the back on arrival. */
export const URGENT_TASK_CHANCE = 0.15;

/** Enemy spawn interval range (ms) */
export const SPAWN_INTERVAL_MIN = 2000;
export const SPAWN_INTERVAL_MAX = 3500;

/** Money Petya starts the game with */
export const STARTING_MONEY = 150;

/** Money paid out every time a wave is fully cleared */
export const WAVE_MONEY_AMOUNT = 30;

/** How many coworkers spawn in a wave: BASE + wave * GROWTH */
export const ENEMIES_PER_WAVE_BASE = 6;
export const ENEMIES_PER_WAVE_GROWTH = 1;

/** Coworker HP grows by this fraction of the base every wave after the first */
export const WAVE_HP_GROWTH = 0.15;
/** ...plus this fraction times waves-squared, so late waves outpace maxed-out towers */
export const WAVE_HP_GROWTH_SQ = 0.01;

/** Tower upgrades: max level and per-level bonuses (applied on top of each
 *  variant's own base range/fireRate/damage below) */
export const TOWER_MAX_LEVEL = 3;
/** Each level adds this fraction of the base damage (so cheap and heavy
 *  towers scale alike, instead of a flat +1 tripling the 1-damage ones) */
export const TOWER_UPGRADE_DAMAGE_MULT = 0.6;
export const TOWER_UPGRADE_RANGE_BONUS = 20;
export const TOWER_UPGRADE_FIRE_RATE_MULT = 0.85;

/** Selling a tower returns this fraction of everything spent on it */
export const TOWER_SELL_REFUND = 0.6;

/** "Sleepy storage" levels: an idle tower dozes off after this long, and once
 *  a coworker walks into range it needs the wake delay before it acts again
 *  (shorter while a partner desk is around to "go wake the disks"). */
export const TOWER_SLEEP_AFTER_MS = 5000;
export const TOWER_WAKE_DELAY_MS = 2600;
export const TOWER_WAKE_DELAY_WITH_PARTNER_MS = 1100;

/** Duplicate records ("Пётр и Петр"): HP of each copy as a fraction of the
 *  original's, and the bounty a copy pays */
export const DUPLICATE_HP_FRACTION = 0.45;
export const DUPLICATE_BOUNTY = 2;

/** "Озеро": money for stopping one of the few real problems */
export const LAKE_REAL_BOUNTY = 30;

/** Partner desk: tasks it takes over per wave before burning out (rested by the next wave) */
export const PARTNER_TASKS_PER_WAVE = 5;

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
   * 'partner' — takes over every second coworker, up to PARTNER_TASKS_PER_WAVE per wave.
   */
  special?: 'slow' | 'aoe' | 'aoeSlow' | 'stun' | 'lureChain' | 'partner';
  /** Ignores enemy armor (see CoworkerStats.armor) */
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
  cooler: { label: 'Кулер',   icon: '🚰', color: 0x0984e3, range: 110, fireRate: 0,    damage: 3, cost: 45, special: 'lureChain' },
  // "Плохой коннект": pure crowd control, no real damage. Ring-shaped
  // Wi-Fi pulse from the tower itself — everyone in range "hangs loading
  // the page" (slowed), holding them in other towers' kill zones.
  router: { label: 'Router',  icon: '📡', color: 0x6c5ce7, range: 100, fireRate: 1500, damage: 0, cost: 50, special: 'aoeSlow' },
  // "Бюрократия": slow heavy artillery, single target, colossal damage.
  // Ignores armor (armorPiercing) — the counter to the armored Бухгалтер.
  docs:   { label: 'Docs',    icon: '📖', color: 0x00b894, range: 160, fireRate: 2600, damage: 6, cost: 100, special: 'stun', armorPiercing: true },
  // Coffee break — cheap rapid-fire workhorse, slows whatever it hits.
  coffee: { label: 'Coffee',  icon: '☕', color: 0x8b5e3c, range: 110, fireRate: 700,  damage: 1, cost: 55, special: 'slow' },
  // Blast of cold air — splash-damages everyone near the impact point.
  aircon: { label: 'AC',      icon: '🌬️', color: 0x81ecec, range: 140, fireRate: 1600, damage: 2, cost: 85, special: 'aoe' },
  // Partner desk — intercepts every second coworker (PARTNER_TASKS_PER_WAVE per wave).
  partner:{ label: 'Напарник',icon: '🧑‍💻', color: 0x55efc4, range: 0, fireRate: 0, damage: 0, cost: 150, special: 'partner', radius: 45 },
};

/** Coffee/Router: how much a slow reduces speed, and for how long */
export const SLOW_MULTIPLIER  = 0.5;
export const SLOW_DURATION_MS = 1500;

/** AC: splash-damage radius around the impact point (Router's pulse just
 *  uses its own `range` as the radius — no separate constant needed) */
export const AOE_SPLASH_RADIUS = 60;

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
  cabinet: { label: 'Шкаф',     icon: '🗄️', color: 0x5a3f2b, radius: 34, maxCount: 5 },
  drawer:  { label: 'Тумбочка', icon: '🗃️', color: 0x8b6b4a, radius: 25, maxCount: 6 },
  sofa:    { label: 'Диван',    icon: '🛋️', color: 0x4a7a9b, radius: 38, maxCount: 3 },
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
/** Bosses can't be ticketed away — they lose this fraction of max HP instead */
export const ULTIMATE_BOSS_DAMAGE_FRACTION = 0.2;

// ─── Shield: "Я на митинге" ──────────────────────────────────────────────
export const SHIELD_COOLDOWN_MS = 25000;
export const SHIELD_DURATION_MS = 6000;
export const SHIELD_DOT_DAMAGE = 1;
export const SHIELD_DOT_INTERVAL_MS = 800;

// ── Coworker Variants (Enemies) ────────────────────────────────────────────────────────

export type CoworkerVariant = 'normal' | 'fast' | 'tank' | 'swarm' | 'boss' | 'remote' | 'maria';

export interface CoworkerStats {
  hpMult: number;
  speedMult: number;
  scale: number;
  tint: number;
  emoji: string;
  name: string;
  /** Money paid out when a tower kills this coworker */
  bounty: number;
  /** Fraction of non-piercing damage ignored (0..1) */
  armor?: number;
  /** Opens a boss wave; can't be removed by the ultimate */
  boss?: boolean;
}

export const COWORKER_VARIANTS: Record<CoworkerVariant, CoworkerStats> = {
  normal: { hpMult: 1, speedMult: 1, scale: 1.0, tint: 0xffffff, emoji: '', name: 'Коллега', bounty: 5 },
  fast:   { hpMult: 0.7, speedMult: 1.5, scale: 0.9, tint: 0xf39c12, emoji: '⚡', name: 'Agile Коуч', bounty: 6 },
  tank:   { hpMult: 2.5, speedMult: 0.65, scale: 1.15, tint: 0x95a5a6, emoji: '🛡️', name: 'Бухгалтер', bounty: 12, armor: 0.5 },
  swarm:  { hpMult: 0.4, speedMult: 1.2, scale: 0.8, tint: 0x2ecc71, emoji: '🐣', name: 'Стажер', bounty: 3 },
  boss:   { hpMult: 15, speedMult: 0.35, scale: 1.3, tint: 0xe74c3c, emoji: '👿', name: 'Заказчик', bounty: 60, boss: true },
  remote: { hpMult: 0.8, speedMult: 1.2, scale: 1.0, tint: 0x8e44ad, emoji: '💻', name: 'Удаленщик', bounty: 7 },
  // Марья Ивановна, главный бухгалтер — the boss of the "Программа" chapter
  maria:  { hpMult: 13, speedMult: 0.4, scale: 1.25, tint: 0xb56576, emoji: '📎', name: 'Марья Ивановна', bounty: 60, boss: true, armor: 0.3 },
};

// ─── Sprites ────────────────────────────────────────────────────────────
// Every sprite is a vector (SVG) generated by tools/generate-art.mjs and
// rasterised by Phaser at load time to the size given here — roughly twice
// its on-screen size, so it stays crisp when scaled up in the menu.
export interface TextureAsset {
  key: string;
  path: string;
  width: number;
  height: number;
}

const sprite = (key: string, file: string, width: number, height: number): TextureAsset =>
  ({ key: `sprite-${key}`, path: `assets/sprites/${file}.svg`, width, height });

export const TEXTURE_ASSETS: TextureAsset[] = [
  sprite('door',            'door',            124, 138),
  sprite('door-open',       'door-open',       124, 138),
  sprite('desk',            'desk',            312, 280),
  sprite('avatar-petya',    'avatar-petya',    192, 192),
  sprite('avatar-vasya',    'avatar-vasya',    192, 192),
  sprite('avatar-maria',    'avatar-maria',    192, 192),
  sprite('avatar-chief',    'avatar-chief',    192, 192),
  sprite('avatar-seva',     'avatar-seva',     192, 192),
  sprite('avatar-sasha',    'avatar-sasha',    192, 192),
  sprite('coworker',        'coworker',        120, 192),
  sprite('coworker-fast',   'coworker-fast',   120, 192),
  sprite('coworker-swarm',  'coworker-swarm',  120, 192),
  sprite('coworker-remote', 'coworker-remote', 120, 192),
  sprite('coworker-tank',   'coworker-tank',   150, 192),
  sprite('coworker-boss',   'coworker-boss',   150, 192),
  sprite('coworker-maria',  'coworker-maria',  150, 192),
  // sprite-tower-cooler, sprite-tower-router, ...
  ...TOWER_VARIANT_KEYS.map(variant => sprite(`tower-${variant}`, `tower-${variant}`, 192, 192)),
  // sprite-furniture-cabinet, ...
  ...FURNITURE_TYPE_KEYS.map(type => sprite(`furniture-${type}`, `furniture-${type}`, 192, 192)),
];

/** Asset URL with a per-build version suffix, so a new deploy busts the
 *  browser cache while repeat visits to the same build still hit it. */
export function assetUrl(asset: TextureAsset): string {
  return `${asset.path}?v=${__ASSET_VERSION__}`;
}

// ─── Spawn doors ────────────────────────────────────────────────────────
// Reception strip along the top edge, one row, below where the HUD panel
// sits (top-left corner) so nothing gets visually covered.
export interface DoorDef {
  x: number;
  y: number;
  label: string;
}

const DOOR_Y = 165.5;
const DEFAULT_DOORS: DoorDef[] = [{ x: 282, y: DOOR_Y, label: 'Reception' }];

export let SPAWN_DOORS: DoorDef[] = DEFAULT_DOORS;

/** Sets the doors for the level about to start; null restores the single default door. */
export function setSpawnDoors(doors: { x: number; label: string }[] | null | undefined): void {
  SPAWN_DOORS = doors ? doors.map(d => ({ x: d.x, y: DOOR_Y, label: d.label })) : DEFAULT_DOORS;
}
