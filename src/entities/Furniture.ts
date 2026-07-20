import Phaser from 'phaser';
import { FURNITURE_TYPES_DATA, type FurnitureType } from '../config';

/**
 * Furniture — a movable, finite-stock office obstacle (cabinet, drawer,
 * sofa). Purely terrain: no attack, no target. Coworkers collide with it
 * (see Coworker.tick()); TowerPlacer keeps it from overlapping towers,
 * the desk, or other furniture, and lets the player pick it up and drop
 * it elsewhere.
 */
export class Furniture extends Phaser.GameObjects.Container {
  public readonly type: FurnitureType;
  public readonly radius: number;

  private circle?: Phaser.GameObjects.Arc;
  private icon?: Phaser.GameObjects.Text;
  private sprite?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, type: FurnitureType) {
    super(scene, x, y);
    this.type = type;

    const stats = FURNITURE_TYPES_DATA[type];
    this.radius = stats.radius;

    const spriteKey = `sprite-furniture-${type}`;
    let parts: Phaser.GameObjects.GameObject[];
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.image(0, 0, spriteKey).setDisplaySize(stats.radius * 2, stats.radius * 2);
      parts = [this.sprite];
    } else {
      // ── Improved programmatic fallback ──────────────────────────────
      // Draw shaped furniture instead of generic circles
      const gfx = scene.add.graphics();
      const r = stats.radius;

      if (type === 'cabinet') {
        // Tall rectangular filing cabinet (top-down view)
        const w = r * 1.2;
        const h = r * 1.8;
        // Shadow
        gfx.fillStyle(0x000000, 0.2);
        gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 4);
        // Body
        gfx.fillStyle(stats.color);
        gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
        // Highlight edge
        gfx.fillStyle(0xffffff, 0.12);
        gfx.fillRoundedRect(-w / 2, -h / 2, w, h * 0.15, { tl: 4, tr: 4, bl: 0, br: 0 });
        // Drawer lines
        gfx.lineStyle(1, 0x000000, 0.25);
        for (let i = 1; i < 4; i++) {
          const ly = -h / 2 + (h / 4) * i;
          gfx.lineBetween(-w / 2 + 4, ly, w / 2 - 4, ly);
        }
        // Handles
        gfx.fillStyle(0xc0c0c0, 0.7);
        for (let i = 0; i < 4; i++) {
          const ly = -h / 2 + (h / 4) * (i + 0.5);
          gfx.fillRect(-3, ly - 2, 6, 3);
        }
        gfx.lineStyle(2, 0x3d2a1a, 0.6);
        gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

      } else if (type === 'drawer') {
        // Small bedside table / nightstand (top-down, squarish)
        const s = r * 1.5;
        // Shadow
        gfx.fillStyle(0x000000, 0.2);
        gfx.fillRoundedRect(-s / 2 + 2, -s / 2 + 2, s, s, 3);
        // Body
        gfx.fillStyle(stats.color);
        gfx.fillRoundedRect(-s / 2, -s / 2, s, s, 3);
        // Highlight
        gfx.fillStyle(0xffffff, 0.15);
        gfx.fillRoundedRect(-s / 2, -s / 2, s, s * 0.2, { tl: 3, tr: 3, bl: 0, br: 0 });
        // Drawer lines
        gfx.lineStyle(1, 0x000000, 0.2);
        gfx.lineBetween(-s / 2 + 3, 0, s / 2 - 3, 0);
        // Handle
        gfx.fillStyle(0xc0c0c0, 0.6);
        gfx.fillRect(-3, -4, 6, 3);
        gfx.fillRect(-3, 3, 6, 3);
        gfx.lineStyle(2, 0x5a4530, 0.5);
        gfx.strokeRoundedRect(-s / 2, -s / 2, s, s, 3);

      } else if (type === 'sofa') {
        // Sofa (top-down, wide rectangle with armrests)
        const w = r * 2.2;
        const h = r * 1.2;
        const armW = w * 0.12;
        // Shadow
        gfx.fillStyle(0x000000, 0.2);
        gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 6);
        // Main cushion
        gfx.fillStyle(stats.color);
        gfx.fillRoundedRect(-w / 2 + armW, -h / 2, w - armW * 2, h, 4);
        // Left armrest
        gfx.fillStyle(Phaser.Display.Color.ValueToColor(stats.color).darken(15).color);
        gfx.fillRoundedRect(-w / 2, -h / 2, armW + 2, h, { tl: 6, tr: 0, bl: 6, br: 0 });
        // Right armrest
        gfx.fillRoundedRect(w / 2 - armW - 2, -h / 2, armW + 2, h, { tl: 0, tr: 6, bl: 0, br: 6 });
        // Backrest (top strip)
        gfx.fillStyle(Phaser.Display.Color.ValueToColor(stats.color).darken(10).color);
        gfx.fillRoundedRect(-w / 2 + armW, -h / 2, w - armW * 2, h * 0.3, { tl: 4, tr: 4, bl: 0, br: 0 });
        // Cushion divider
        gfx.lineStyle(1, 0x000000, 0.15);
        gfx.lineBetween(-w * 0.12, -h / 2 + h * 0.3, -w * 0.12, h / 2 - 2);
        gfx.lineBetween(w * 0.12, -h / 2 + h * 0.3, w * 0.12, h / 2 - 2);
        // Highlight
        gfx.fillStyle(0xffffff, 0.08);
        gfx.fillRoundedRect(-w / 2 + armW, -h / 2 + h * 0.3, w - armW * 2, h * 0.15, 0);
        // Outline
        gfx.lineStyle(2, 0x2c5570, 0.4);
        gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
      }

      parts = [gfx];
    }

    this.add(parts);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    this.setInteractive(new Phaser.Geom.Circle(0, 0, stats.radius + 4), Phaser.Geom.Circle.Contains);

    this.setScale(0.1);
    scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.Out' });
  }

  /** Visual feedback while carried by the player, before it's dropped. */
  setPicked(picked: boolean): void {
    this.setAlpha(picked ? 0.55 : 1);
  }
}
