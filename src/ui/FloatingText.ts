import type Phaser from 'phaser';

/** A small text that pops up and fades out — used for cost/upgrade/salary feedback. */
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
