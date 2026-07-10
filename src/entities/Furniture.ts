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
      this.circle = scene.add.circle(0, 0, stats.radius, stats.color, 0.92);
      this.circle.setStrokeStyle(2, 0xffffff, 0.35);
      this.icon = scene.add.text(0, 0, stats.icon, { fontSize: `${Math.round(stats.radius * 1.1)}px` }).setOrigin(0.5);
      parts = [this.circle, this.icon];
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
