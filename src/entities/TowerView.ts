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
    let bodyParts: Phaser.GameObjects.GameObject[] = [];
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.image(0, 0, spriteKey).setDisplaySize(radius * 2, radius * 2);
      bodyParts.push(this.sprite);
    } else {
      const gfx = scene.add.graphics();
      // Drop shadow for depth
      gfx.fillStyle(0x000000, 0.25);
      
      if (variant === 'cooler') {
        gfx.fillCircle(2, 4, radius);
        // Base
        gfx.fillStyle(0xecf0f1);
        gfx.fillRoundedRect(-radius * 0.7, -radius * 0.7, radius * 1.4, radius * 1.4, 6);
        gfx.lineStyle(2, 0xbdc3c7);
        gfx.strokeRoundedRect(-radius * 0.7, -radius * 0.7, radius * 1.4, radius * 1.4, 6);
        // Water bottle (top down)
        gfx.fillStyle(0x3498db, 0.75);
        gfx.fillCircle(0, 0, radius * 0.6);
        gfx.lineStyle(2, 0x2980b9);
        gfx.strokeCircle(0, 0, radius * 0.6);
        // Reflection
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillCircle(-radius * 0.2, -radius * 0.2, radius * 0.2);
      } else if (variant === 'router') {
        gfx.fillRoundedRect(-radius + 2, -radius * 0.7 + 4, radius * 2, radius * 1.4, 6);
        // Body
        gfx.fillStyle(0x2c3e50);
        gfx.fillRoundedRect(-radius, -radius * 0.7, radius * 2, radius * 1.4, 6);
        gfx.lineStyle(2, 0x1a252f);
        gfx.strokeRoundedRect(-radius, -radius * 0.7, radius * 2, radius * 1.4, 6);
        // Antennas
        gfx.lineStyle(4, 0x34495e);
        gfx.lineBetween(-radius * 0.7, -radius * 0.7, -radius * 0.9, -radius * 1.2);
        gfx.lineBetween(radius * 0.7, -radius * 0.7, radius * 0.9, -radius * 1.2);
        // Blinking LEDs
        gfx.fillStyle(0x2ecc71);
        gfx.fillCircle(-radius * 0.6, radius * 0.4, 3);
        gfx.fillCircle(-radius * 0.3, radius * 0.4, 3);
        gfx.fillStyle(0xe74c3c);
        gfx.fillCircle(0, radius * 0.4, 3);
      } else if (variant === 'docs') {
        gfx.fillRect(-radius * 0.9 + 2, -radius * 0.8 + 4, radius * 1.8, radius * 1.6);
        // Paper stack
        gfx.fillStyle(0xf1f2f6);
        gfx.fillRect(-radius * 0.8, -radius * 0.9, radius * 1.6, radius * 1.8);
        // Folder cover
        gfx.fillStyle(0x00b894);
        gfx.fillRect(-radius * 0.9, -radius * 0.8, radius * 1.8, radius * 1.6);
        gfx.lineStyle(2, 0x00a884);
        gfx.strokeRect(-radius * 0.9, -radius * 0.8, radius * 1.8, radius * 1.6);
        // Binding
        gfx.fillStyle(0x2d3436);
        gfx.fillRect(-radius * 0.9, -radius * 0.8, 12, radius * 1.6);
      } else if (variant === 'coffee') {
        gfx.fillRoundedRect(-radius * 0.9 + 2, -radius * 0.9 + 4, radius * 1.8, radius * 1.8, 8);
        // Machine body
        gfx.fillStyle(0x2d3436);
        gfx.fillRoundedRect(-radius * 0.9, -radius * 0.9, radius * 1.8, radius * 1.8, 8);
        gfx.lineStyle(2, 0x1e272e);
        gfx.strokeRoundedRect(-radius * 0.9, -radius * 0.9, radius * 1.8, radius * 1.8, 8);
        // Drip tray
        gfx.fillStyle(0x95a5a6);
        gfx.fillRect(-radius * 0.6, radius * 0.3, radius * 1.2, radius * 0.4);
        // Cup
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(0, radius * 0.1, radius * 0.4);
        gfx.fillStyle(0x8b5e3c); // coffee
        gfx.fillCircle(0, radius * 0.1, radius * 0.3);
      } else if (variant === 'aircon') {
        gfx.fillRect(-radius * 1.2 + 2, -radius * 0.8 + 4, radius * 2.4, radius * 1.6);
        // Unit body
        gfx.fillStyle(0xf5f6fa);
        gfx.fillRect(-radius * 1.2, -radius * 0.8, radius * 2.4, radius * 1.6);
        gfx.lineStyle(2, 0xdcdde1);
        gfx.strokeRect(-radius * 1.2, -radius * 0.8, radius * 2.4, radius * 1.6);
        // Fan grate
        gfx.fillStyle(0x7f8c8d);
        gfx.fillCircle(0, 0, radius * 0.65);
        gfx.lineStyle(2, 0x34495e);
        gfx.beginPath();
        for(let i = 0; i < 4; i++) {
          gfx.moveTo(-radius * 0.6, -radius * 0.4 + i * (radius * 0.25));
          gfx.lineTo(radius * 0.6, -radius * 0.4 + i * (radius * 0.25));
        }
        gfx.strokePath();
      } else {
        // Fallback or Partner
        gfx.fillRoundedRect(-radius + 2, -radius + 4, radius * 2, radius * 2, 4);
        gfx.fillStyle(color);
        gfx.fillRoundedRect(-radius, -radius, radius * 2, radius * 2, 4);
        gfx.lineStyle(2, 0xffffff, 0.4);
        gfx.strokeRoundedRect(-radius, -radius, radius * 2, radius * 2, 4);
      }

      bodyParts.push(gfx);
    }

    // ── Level indicator ──────────────────────────────────────────────────
    this.levelText = scene.add.text(0, TOWER_SIZE + 4, this.levelStars(1), {
      fontSize: '10px',
      color: '#ffeaa7',
    }).setOrigin(0.5, 0);

    this.container.add([this.rangeCircle, this.barrelLine, ...bodyParts, this.levelText]);

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
