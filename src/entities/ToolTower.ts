import Phaser from 'phaser';
import type { Coworker } from './Coworker';
import { TOWER_RANGE, TOWER_FIRE_RATE, PROJECTILE_SPEED } from '../config';

const TOWER_SIZE = 26; // half-width of the square body

type TowerVariant = 'script' | 'router' | 'docs';

const VARIANT_COLORS: Record<TowerVariant, number> = {
  script: 0x0984e3,
  router: 0x6c5ce7,
  docs:   0x00b894,
};
const VARIANT_ICONS: Record<TowerVariant, string> = {
  script: '📜',
  router: '📡',
  docs:   '📖',
};

/**
 * ToolTower – a defence tower placed by the player.
 * Scans for the nearest Coworker in range, fires a projectile at it,
 * and waits for the fire-rate cooldown before shooting again.
 */
export class ToolTower extends Phaser.GameObjects.Container {
  public readonly variant: TowerVariant;
  private cooldown = 0;

  // Child visuals
  private base: Phaser.GameObjects.Rectangle;
  private icon: Phaser.GameObjects.Text;
  private rangeCircle: Phaser.GameObjects.Arc;
  private barrelLine: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: TowerVariant = 'script') {
    super(scene, x, y);
    this.variant = variant;
    const color = VARIANT_COLORS[variant];

    // ── Range indicator (initially hidden) ───────────────────────────────
    this.rangeCircle = scene.add.arc(0, 0, TOWER_RANGE, 0, 360, false, color, 0.07);
    this.rangeCircle.setStrokeStyle(1, color, 0.35);
    this.rangeCircle.setVisible(false);

    // ── Tower base (coloured square) ─────────────────────────────────────
    this.base = scene.add.rectangle(0, 0, TOWER_SIZE * 2, TOWER_SIZE * 2, color);
    this.base.setStrokeStyle(2, 0xffffff, 0.4);

    // ── Barrel graphic ───────────────────────────────────────────────────
    this.barrelLine = scene.add.graphics();

    // ── Icon ─────────────────────────────────────────────────────────────
    this.icon = scene.add.text(0, 0, VARIANT_ICONS[variant], { fontSize: '18px' })
      .setOrigin(0.5, 0.5);

    this.add([this.rangeCircle, this.base, this.barrelLine, this.icon]);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Show range on hover
    this.setInteractive(new Phaser.Geom.Rectangle(-TOWER_SIZE, -TOWER_SIZE, TOWER_SIZE * 2, TOWER_SIZE * 2), Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', () => this.rangeCircle.setVisible(true));
    this.on('pointerout',  () => this.rangeCircle.setVisible(false));

    // Placement pop animation
    this.setScale(0.1);
    scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.Out' });
  }

  // ── Per-frame ─────────────────────────────────────────────────────────

  public tick(delta: number, enemies: Coworker[]): void {
    this.cooldown -= delta;
    if (this.cooldown > 0) return;

    const target = this.findTarget(enemies);
    if (!target) {
      this.barrelLine.clear();
      return;
    }

    this.cooldown = TOWER_FIRE_RATE;
    this.aimAt(target);
    this.fireAt(target);
  }

  private findTarget(enemies: Coworker[]): Coworker | null {
    let closest: Coworker | null = null;
    let minDist = TOWER_RANGE;
    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d < minDist) { minDist = d; closest = e; }
    }
    return closest;
  }

  private aimAt(target: Coworker): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.barrelLine.clear();
    this.barrelLine.lineStyle(3, 0xffffff, 0.5);
    const barrelLen = TOWER_SIZE + 6;
    this.barrelLine.lineBetween(0, 0, Math.cos(angle) * barrelLen, Math.sin(angle) * barrelLen);
  }

  private fireAt(target: Coworker): void {
    // ── Create a simple projectile as a scene-level graphics object ──────
    const scene = this.scene;
    const proj = scene.add.arc(this.x, this.y, 5, 0, 360, false, 0xfdcb6e);
    proj.setStrokeStyle(1.5, 0xe17055);

    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const vx = Math.cos(angle) * PROJECTILE_SPEED;
    const vy = Math.sin(angle) * PROJECTILE_SPEED;

    // Trail tween: move until it hits target or travels max range
    let travelled = 0;
    const maxTravel = TOWER_RANGE;

    const update = (_: unknown, time: number, delta: number) => {
      if (!proj.active) return;
      const dt = delta / 1000;
      proj.x += vx * dt;
      proj.y += vy * dt;
      travelled += PROJECTILE_SPEED * dt;

      // Hit test
      if (!target.isDead && !target.hasReachedDesk) {
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, target.x, target.y);
        if (dist < 18) {
          target.takeDamage(1);
          destroyProj();
          return;
        }
      }
      if (travelled >= maxTravel) destroyProj();
    };

    const destroyProj = () => {
      scene.events.off('update', update);
      // Tiny explosion flash
      scene.tweens.add({
        targets: proj,
        alpha: 0,
        scaleX: 2.5,
        scaleY: 2.5,
        duration: 100,
        onComplete: () => proj.destroy(),
      });
    };

    scene.events.on('update', update);
  }
}
