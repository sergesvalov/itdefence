import type Phaser from 'phaser';
import { TEXTURE_ASSETS, assetUrl } from '../config';

/** Key of a small soft dot generated in code — used for particle trails. */
export const DOT_TEXTURE = 'fx-dot';

/** Queues every sprite for loading. Call from a scene's preload(). */
export function preloadTextures(scene: Phaser.Scene): void {
  for (const asset of TEXTURE_ASSETS) {
    if (scene.textures.exists(asset.key)) continue;
    scene.load.svg(asset.key, assetUrl(asset), { width: asset.width, height: asset.height });
  }
}

/** Creates the code-generated textures (idempotent). Call from create(). */
export function ensureGeneratedTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(DOT_TEXTURE)) return;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle(8, 8, 8);
  gfx.generateTexture(DOT_TEXTURE, 16, 16);
  gfx.destroy();
}
