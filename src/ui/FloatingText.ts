import type Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

/** A small text that pops up and fades out — used for cost/upgrade/wave-money feedback. */
export function showFloatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const txt = scene.add.text(x, y - 20, text, {
    fontSize: '13px',
    color,
    fontStyle: 'bold',
    stroke: '#000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(25);

  scene.tweens.add({
    targets: txt,
    y: y - 50,
    alpha: 0,
    duration: 700,
    ease: 'Quad.Out',
    onComplete: () => txt.destroy(),
  });
}

/** A big centred announcement that drifts up and fades (new wave, story events). */
export function showBanner(scene: Phaser.Scene, text: string, color = '#ffeaa7'): void {
  const txt = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, text, {
    fontSize: '30px', fontStyle: 'bold', color, align: 'center',
    stroke: '#1a2330', strokeThickness: 6, wordWrap: { width: GAME_WIDTH - 120 },
  }).setOrigin(0.5).setDepth(20);

  scene.tweens.add({
    targets: txt,
    alpha: 0,
    y: GAME_HEIGHT / 2 - 110,
    duration: 1800,
    ease: 'Quad.In',
    onComplete: () => txt.destroy(),
  });
}
