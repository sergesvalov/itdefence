import type Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  OFFICE_Y_TOP, OFFICE_Y_BOTTOM,
  DESK_X, DESK_Y,
  SPAWN_DOORS,
} from '../config';

import type { DoorDef } from '../config';

/**
 * Draws the static map once per game: reception strip (doors) on top,
 * Petya's office (the battlefield) below, desk at the bottom. Uses a
 * texture for any slot whose asset was loaded (see TEXTURE_ASSETS in
 * config.ts), otherwise falls back to programmatic Graphics.
 * Returns a map of door definitions to their created image sprites (if any).
 */
export function drawMap(scene: Phaser.Scene): Map<DoorDef, Phaser.GameObjects.Image | null> {
  const doorSprites = new Map<DoorDef, Phaser.GameObjects.Image | null>();
  const gfx = scene.add.graphics();

  // ── Floor background (base layer, always drawn) ─────────────────────
  gfx.fillStyle(0x1e2a3a);
  gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // ── Reception strip (top 1/4) — the corridor the doors open onto ────
  if (scene.textures.exists('tile-corridor-floor')) {
    scene.add.tileSprite(0, 0, GAME_WIDTH, OFFICE_Y_TOP, 'tile-corridor-floor').setOrigin(0, 0);
  } else {
    gfx.fillStyle(0x2d3e50);
    gfx.fillRect(0, 0, GAME_WIDTH, OFFICE_Y_TOP);
  }

  // ── Bottom wall strip ────────────────────────────────────────────────
  if (scene.textures.exists('tile-wall')) {
    scene.add.tileSprite(0, OFFICE_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - OFFICE_Y_BOTTOM, 'tile-wall').setOrigin(0, 0);
  } else {
    gfx.fillStyle(0x2d3e50);
    gfx.fillRect(0, OFFICE_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - OFFICE_Y_BOTTOM);
  }

  // ── Petya's office (bottom 3/4) — the battlefield ───────────────────
  if (scene.textures.exists('tile-office-floor')) {
    scene.add.tileSprite(0, OFFICE_Y_TOP, GAME_WIDTH, OFFICE_Y_BOTTOM - OFFICE_Y_TOP, 'tile-office-floor').setOrigin(0, 0);
  } else {
    gfx.fillStyle(0x1a5276, 0.55);
    gfx.fillRect(0, OFFICE_Y_TOP, GAME_WIDTH, OFFICE_Y_BOTTOM - OFFICE_Y_TOP);

    // Placeholder floor tile grid — a real floor texture already has its
    // own pattern, so only draw this when there isn't one.
    gfx.lineStyle(1, 0x4a6b8a, 0.25);
    const tileSize = 40;
    for (let x = 0; x < GAME_WIDTH; x += tileSize) {
      gfx.lineBetween(x, OFFICE_Y_TOP, x, OFFICE_Y_BOTTOM);
    }
    for (let y = OFFICE_Y_TOP; y <= OFFICE_Y_BOTTOM; y += tileSize) {
      gfx.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  // ── Office border lines (gameplay boundary, always drawn) ───────────
  gfx.lineStyle(3, 0x3498db, 0.8);
  gfx.lineBetween(0, OFFICE_Y_TOP,    GAME_WIDTH, OFFICE_Y_TOP);
  gfx.lineBetween(0, OFFICE_Y_BOTTOM, GAME_WIDTH, OFFICE_Y_BOTTOM);

  // ── Spawn doors ───────────────────────────────────────────────────
  const hasDoorSprite = scene.textures.exists('sprite-door');
  for (const door of SPAWN_DOORS) {
    if (hasDoorSprite) {
      const img = scene.add.image(door.x, door.y, 'sprite-door').setDisplaySize(40, 44);
      doorSprites.set(door, img);
    } else {
      doorSprites.set(door, null);
      // Door frame
      gfx.fillStyle(0xe74c3c, 0.9);
      gfx.fillRect(door.x - 20, door.y - 16, 40, 32);
      gfx.lineStyle(2, 0xff6b6b);
      gfx.strokeRect(door.x - 20, door.y - 16, 40, 32);
      // Door knob
      gfx.fillStyle(0xf1c40f);
      gfx.fillCircle(door.x + 12, door.y, 4);
    }
    // Label
    scene.add.text(door.x, door.y + 20, door.label, {
      fontSize: '9px',
      color: '#ff7675',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
  }

  // ── "PETYA'S OFFICE" label near the top of the room ─────────────────
  scene.add.text(GAME_WIDTH / 2, OFFICE_Y_TOP + 8, "PETYA'S OFFICE", {
    fontSize: '11px',
    color: '#74b9ff',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);

  // Desk zone warning glow (towers can't be placed too close, always drawn)
  gfx.lineStyle(1, 0xe74c3c, 0.4);
  gfx.strokeCircle(DESK_X, DESK_Y, 60);

  // Desk (+ monitor + Petya himself, all baked into the sprite if one is supplied)
  if (scene.textures.exists('sprite-desk')) {
    scene.add.image(DESK_X, DESK_Y - 10, 'sprite-desk').setDisplaySize(100, 90);
  } else {
    gfx.fillStyle(0x8b4513);
    gfx.fillRect(DESK_X - 45, DESK_Y - 25, 90, 50);
    gfx.lineStyle(2, 0xa0522d);
    gfx.strokeRect(DESK_X - 45, DESK_Y - 25, 90, 50);

    // Computer monitor on desk
    gfx.fillStyle(0x2c3e50);
    gfx.fillRect(DESK_X - 19, DESK_Y - 46, 38, 26);
    gfx.fillStyle(0x1abc9c, 0.8);
    gfx.fillRect(DESK_X - 15, DESK_Y - 42, 30, 18);
    gfx.fillStyle(0x7f8c8d);
    gfx.fillRect(DESK_X - 4, DESK_Y - 20, 8, 6);
  }

  // Petya label
  scene.add.text(DESK_X, DESK_Y + 30, '🧑‍💻 Petya', {
    fontSize: '12px',
    color: '#74b9ff',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);

  return doorSprites;
}
