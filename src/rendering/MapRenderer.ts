import type Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  OFFICE_Y_TOP, OFFICE_Y_BOTTOM,
  DESK_X, DESK_Y,
  SPAWN_DOORS,
} from '../config';

import type { DoorDef } from '../config';

// ─── Color Palette ──────────────────────────────────────────────────────
// Warm office palette derived from the desk/character art style:
//   Wall:    warm cream/beige tones
//   Floor:   dark blue-navy carpet
//   Accents: walnut brown, soft gold, muted teal
const PAL = {
  floorBase:     0x1a2a3a,   // dark navy — fallback floor fill
  floorGrid:     0x243648,   // subtle grid lines on floor
  wallFill:      0xd4c5a9,   // warm cream (wall fallback)
  wallBaseboard: 0x5a3f2b,   // dark walnut baseboard
  borderShadow:  0x0e1a26,   // very dark navy for shadow line at wall-floor junction
  labelBg:       0x1a2430,   // dark chip behind text labels
  labelStroke:   0x4a7a9b,   // muted teal for label borders
  deskGlow:      0xc0392b,   // warm red danger glow around desk
  petyaGold:     0xfbbf24,   // gold for Petya's name
};

/**
 * Draws the static map once per game: wall strip (doors) on top,
 * Petya's office (the battlefield) below, desk at the bottom. Uses a
 * texture for any slot whose asset was loaded (see TEXTURE_ASSETS in
 * config.ts), otherwise falls back to programmatic Graphics.
 * Returns a map of door definitions to their created image sprites (if any).
 */
export function drawMap(scene: Phaser.Scene): Map<DoorDef, Phaser.GameObjects.Image | null> {
  const doorSprites = new Map<DoorDef, Phaser.GameObjects.Image | null>();
  const gfx = scene.add.graphics();

  // ── Floor background (base layer, always drawn) ─────────────────────
  gfx.fillStyle(PAL.floorBase);
  gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // ── Wall strip (top 200px) — the wall the doors are embedded in ─────
  if (scene.textures.exists('tile-corridor-floor')) {
    scene.add.tileSprite(0, 0, GAME_WIDTH, OFFICE_Y_TOP, 'tile-corridor-floor').setOrigin(0, 0);
  } else {
    // Programmatic wall fallback
    gfx.fillStyle(PAL.wallFill);
    gfx.fillRect(0, 0, GAME_WIDTH, OFFICE_Y_TOP);
    // Baseboard strip at the bottom of the wall
    gfx.fillStyle(PAL.wallBaseboard);
    gfx.fillRect(0, OFFICE_Y_TOP - 6, GAME_WIDTH, 6);
  }

  // ── Bottom wall strip ────────────────────────────────────────────────
  if (scene.textures.exists('tile-wall')) {
    scene.add.tileSprite(0, OFFICE_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - OFFICE_Y_BOTTOM, 'tile-wall').setOrigin(0, 0);
  } else {
    gfx.fillStyle(PAL.wallFill);
    gfx.fillRect(0, OFFICE_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - OFFICE_Y_BOTTOM);
    // Baseboard at top of bottom wall
    gfx.fillStyle(PAL.wallBaseboard);
    gfx.fillRect(0, OFFICE_Y_BOTTOM, GAME_WIDTH, 5);
  }

  // ── Petya's office (the battlefield) ────────────────────────────────
  if (scene.textures.exists('tile-office-floor')) {
    scene.add.tileSprite(0, OFFICE_Y_TOP, GAME_WIDTH, OFFICE_Y_BOTTOM - OFFICE_Y_TOP, 'tile-office-floor').setOrigin(0, 0);
  } else {
    // Plain dark floor — no grid lines (they looked like Excel)
    gfx.fillStyle(PAL.floorBase);
    gfx.fillRect(0, OFFICE_Y_TOP, GAME_WIDTH, OFFICE_Y_BOTTOM - OFFICE_Y_TOP);
  }

  // ── Wall-floor junction shadows (soft transitions for depth) ────────
  // Top wall → floor shadow
  const shadowGfx = scene.add.graphics();
  shadowGfx.fillStyle(PAL.borderShadow, 0.5);
  shadowGfx.fillRect(0, OFFICE_Y_TOP, GAME_WIDTH, 4);
  shadowGfx.fillStyle(PAL.borderShadow, 0.25);
  shadowGfx.fillRect(0, OFFICE_Y_TOP + 4, GAME_WIDTH, 4);
  shadowGfx.fillStyle(PAL.borderShadow, 0.1);
  shadowGfx.fillRect(0, OFFICE_Y_TOP + 8, GAME_WIDTH, 4);

  // Floor → bottom wall shadow
  shadowGfx.fillStyle(PAL.borderShadow, 0.3);
  shadowGfx.fillRect(0, OFFICE_Y_BOTTOM - 4, GAME_WIDTH, 4);
  shadowGfx.fillStyle(PAL.borderShadow, 0.15);
  shadowGfx.fillRect(0, OFFICE_Y_BOTTOM - 8, GAME_WIDTH, 4);

  // ── Spawn doors ───────────────────────────────────────────────────
  // Doors are positioned so their bottom edge sits exactly at the
  // wall-floor junction (OFFICE_Y_TOP = 200).
  const hasDoorSprite = scene.textures.exists('sprite-door');
  for (const door of SPAWN_DOORS) {
    if (hasDoorSprite) {
      const img = scene.add.image(door.x, door.y, 'sprite-door').setDisplaySize(62, 69);
      doorSprites.set(door, img);
    } else {
      doorSprites.set(door, null);
      // Door frame — warm brown, matching palette
      gfx.fillStyle(PAL.wallBaseboard, 0.9);
      gfx.fillRect(door.x - 26, door.y - 21, 52, 42);
      gfx.lineStyle(2, 0x8b6b4a);
      gfx.strokeRect(door.x - 26, door.y - 21, 52, 42);
      // Door knob — soft gold
      gfx.fillStyle(PAL.petyaGold);
      gfx.fillCircle(door.x + 16, door.y, 4);
    }
    // Label above door
    const text = scene.add.text(door.x, door.y - 42, door.label, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    
    const labelBg = scene.add.graphics();
    labelBg.fillStyle(PAL.labelBg, 0.85);
    labelBg.lineStyle(1, PAL.labelStroke, 0.4);
    labelBg.fillRoundedRect(door.x - text.width / 2 - 8, door.y - 42 - text.height / 2 - 4, text.width + 16, text.height + 8, 4);
    labelBg.strokeRoundedRect(door.x - text.width / 2 - 8, door.y - 42 - text.height / 2 - 4, text.width + 16, text.height + 8, 4);
    text.setDepth(1);
  }



  // Desk zone warning glow — muted red, not screaming
  gfx.lineStyle(1, PAL.deskGlow, 0.25);
  gfx.strokeCircle(DESK_X, DESK_Y, 72);

  // Desk (+ monitor + Petya himself, all baked into the sprite if one is supplied)
  if (scene.textures.exists('sprite-desk')) {
    scene.add.image(DESK_X, DESK_Y - 13, 'sprite-desk').setDisplaySize(156, 140);
  } else {
    gfx.fillStyle(0x8b6b4a);
    gfx.fillRect(DESK_X - 58, DESK_Y - 32, 117, 65);
    gfx.lineStyle(2, 0xa0825d);
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
    fontFamily: 'Inter, system-ui, sans-serif',
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
