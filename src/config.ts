// ─── Game-wide constants ────────────────────────────────────────────────────

export const GAME_WIDTH  = 1024;
export const GAME_HEIGHT = 640;

/** The hallway corridor band (Y range enemies travel within) */
export const HALLWAY_Y_TOP    = 160;
export const HALLWAY_Y_BOTTOM = 480;

/** Target – Petya's desk position */
export const DESK_X = 880;
export const DESK_Y = 320;

/** Tower range in pixels */
export const TOWER_RANGE  = 130;
/** Tower attack cooldown in ms */
export const TOWER_FIRE_RATE = 1000;
/** Projectile speed px/s */
export const PROJECTILE_SPEED = 280;

/** How many tasks reaching the desk triggers game-over */
export const MAX_TASKS = 10;

/** Enemy spawn interval range (ms) */
export const SPAWN_INTERVAL_MIN = 2000;
export const SPAWN_INTERVAL_MAX = 3500;

/** Pixel cost of placing one tower (displayed only – no economy yet) */
export const TOWER_COST = 50;
