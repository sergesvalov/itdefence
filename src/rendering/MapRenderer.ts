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
    const tileSize = 48;
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
      const img = scene.add.image(door.x, door.y, 'sprite-door').setDisplaySize(62, 69);
      doorSprites.set(door, img);
    } else {
      doorSprites.set(door, null);
      // Door frame
      gfx.fillStyle(0xe74c3c, 0.9);
      gfx.fillRect(door.x - 26, door.y - 21, 52, 42);
      gfx.lineStyle(2, 0xff6b6b);
      gfx.strokeRect(door.x - 26, door.y - 21, 52, 42);
      // Door knob
      gfx.fillStyle(0xf1c40f);
      gfx.fillCircle(door.x + 16, door.y, 5);
    }
    // Label
    const text = scene.add.text(door.x, door.y + 20, door.label, {
      fontFamily: 'Courier, monospace',
      fontSize: '11px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    text.setShadow(1, 1, '#000000', 2, false, true);
  }

  // ── "PETYA'S OFFICE" label near the top of the room ─────────────────
  const officeText = scene.add.text(GAME_WIDTH / 2, OFFICE_Y_TOP + 8, "PETYA'S OFFICE", {
    fontFamily: 'Courier, monospace',
    fontSize: '12px',
    color: '#93C5FD',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);
  officeText.setShadow(1, 1, '#000000', 2, false, true);

  // Desk zone warning glow (towers can't be placed too close, always drawn)
  gfx.lineStyle(1, 0xe74c3c, 0.4);
  gfx.strokeCircle(DESK_X, DESK_Y, 72);

  // Desk (+ monitor + Petya himself, all baked into the sprite if one is supplied)
  if (scene.textures.exists('sprite-desk')) {
    scene.add.image(DESK_X, DESK_Y - 13, 'sprite-desk').setDisplaySize(156, 140);
  } else {
    gfx.fillStyle(0x8b4513);
    gfx.fillRect(DESK_X - 58, DESK_Y - 32, 117, 65);
    gfx.lineStyle(2, 0xa0522d);
    gfx.strokeRect(DESK_X - 58, DESK_Y - 32, 117, 65);

    // Computer monitor on desk
    gfx.fillStyle(0x2c3e50);
    gfx.fillRect(DESK_X - 25, DESK_Y - 60, 49, 34);
    gfx.fillStyle(0x1abc9c, 0.8);
    gfx.fillRect(DESK_X - 20, DESK_Y - 55, 39, 23);
    gfx.fillStyle(0x7f8c8d);
    gfx.fillRect(DESK_X - 5, DESK_Y - 26, 10, 8);
  }

  // Petya label
  const petyaText = scene.add.text(DESK_X, DESK_Y + 30, '🧑‍💻 Petya', {
    fontFamily: 'Courier, monospace',
    fontSize: '14px',
    color: '#FBBF24',
    fontStyle: 'bold',
    backgroundColor: '#000000',
    padding: { x: 6, y: 4 }
  }).setOrigin(0.5, 0);
  petyaText.setShadow(1, 1, '#000000', 0, false, true);
  
  // Add a slight transparency to the background of Petya text via a graphics underlay if needed, 
  // but backgroundColor works well enough for high contrast.

  return doorSprites;
}
