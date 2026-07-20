import Phaser from 'phaser';
import { TOWER_VARIANTS_DATA, type TowerVariant } from '../config';
export const TOWER_SIZE = 40;

export class TowerView {
  private base?: Phaser.GameObjects.Rectangle;
  private icon?: Phaser.GameObjects.Text;
  private sprite?: Phaser.GameObjects.Image;
  private rangeCircle: Phaser.GameObjects.Arc;
  private barrelLine: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    variant: TowerVariant,
    initialRange: number,
    private maxLevel: number
  ) {
    const stats = TOWER_VARIANTS_DATA[variant];
    const color = stats.color;
    const radius = stats.radius || TOWER_SIZE;

    // ── Range indicator (initially hidden) ───────────────────────────────
    this.rangeCircle = scene.add.arc(0, 0, initialRange, 0, 360, false, color, 0.03);
    this.rangeCircle.setStrokeStyle(1, color, 0.15);
    this.rangeCircle.setVisible(false);

    // ── Barrel graphic ───────────────────────────────────────────────────
    this.barrelLine = scene.add.graphics();

    // ── Tower body ───────────────────────────────────────────────────────
    const spriteKey = `sprite-tower-${variant}`;
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.image(0, 0, spriteKey).setDisplaySize(radius * 2, radius * 2);
    } else {
      this.base = scene.add.rectangle(0, 0, radius * 2, radius * 2, color);
      this.base.setStrokeStyle(2, 0xffffff, 0.4);
      this.icon = scene.add.text(0, 0, stats.icon, { fontSize: '18px' }).setOrigin(0.5, 0.5);
    }

    // ── Level indicator ──────────────────────────────────────────────────
    this.levelText = scene.add.text(0, TOWER_SIZE + 4, this.levelStars(1), {
      fontSize: '10px',
      color: '#ffeaa7',
    }).setOrigin(0.5, 0);

    const body = this.sprite ? [this.sprite] : [this.base!, this.icon!];
    this.container.add([this.rangeCircle, this.barrelLine, ...body, this.levelText]);

    // Show range on hover
    this.container.setInteractive(new Phaser.Geom.Rectangle(-TOWER_SIZE, -TOWER_SIZE, TOWER_SIZE * 2, TOWER_SIZE * 2), Phaser.Geom.Rectangle.Contains);
    this.container.on('pointerover', () => this.rangeCircle.setVisible(true));
    this.container.on('pointerout',  () => this.rangeCircle.setVisible(false));

    // Placement pop animation
    this.container.setScale(0.1);
    scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.Out' });
  }

  private levelStars(level: number): string {
    return '★'.repeat(level) + '☆'.repeat(this.maxLevel - level);
  }

  public playUpgradeAnimation(newLevel: number, newRange: number): void {
    this.rangeCircle.radius = newRange;
    this.levelText.setText(this.levelStars(newLevel));

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.2, scaleY: 1.2,
      duration: 140,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  public playPartnerSolveAnimation(): void {
    this.scene.tweens.add({
      targets: this.container, scaleX: 1.1, scaleY: 1.1, duration: 80, yoyo: true
    });
  }

  public aimAt(angle: number): void {
    this.barrelLine.clear();
    this.barrelLine.lineStyle(2, 0xd4c5a9, 0.4);
    const barrelLen = TOWER_SIZE + 6;
    this.barrelLine.lineBetween(0, 0, Math.cos(angle) * barrelLen, Math.sin(angle) * barrelLen);
  }

  public clearAim(): void {
    this.barrelLine.clear();
  }

  public createPulseRing(range: number): void {
    const ring = this.scene.add.arc(this.container.x, this.container.y, 6, 0, 360, false, 0x6c5ce7, 0);
    ring.setStrokeStyle(3, 0xa29bfe, 0.9);

    this.scene.tweens.add({
      targets: ring,
      radius: range,
      alpha: 0,
      duration: 350,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
  }

  public createRicochetBolt(fromX: number, fromY: number, toX: number, toY: number): void {
    const bolt = this.scene.add.graphics();
    bolt.lineStyle(2, 0x00ff9d, 0.9);
    bolt.lineBetween(fromX, fromY, toX, toY);
    this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 150, onComplete: () => bolt.destroy() });
  }
}
