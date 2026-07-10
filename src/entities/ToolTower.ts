import Phaser from 'phaser';
import type { Coworker } from './Coworker';
import {
  PROJECTILE_SPEED,
  TOWER_VARIANTS_DATA, type TowerVariant, type TowerVariantStats,
  TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_BONUS, TOWER_UPGRADE_RANGE_BONUS, TOWER_UPGRADE_FIRE_RATE_MULT,
  SLOW_MULTIPLIER, SLOW_DURATION_MS, AOE_SPLASH_RADIUS, STUN_DURATION_MS,
} from '../config';

export const TOWER_SIZE = 26; // half-width of the square body

type TowerSpecial = TowerVariantStats['special'];

/**
 * ToolTower – a defence tower placed by the player.
 * Scans for the nearest Coworker in range, fires a projectile at it,
 * and waits for the fire-rate cooldown before shooting again.
 * Base range/fire rate/damage/cost come from the variant (see
 * TOWER_VARIANTS_DATA in config.ts); some variants also have a special
 * effect on hit ('slow', 'aoe' splash, or 'stun'), and Router ('aoeSlow')
 * skips the projectile entirely for a self-centred pulse — see tick().
 * Can be upgraded (up to TOWER_MAX_LEVEL) for more damage, range and
 * fire rate — see upgrade().
 */
export class ToolTower extends Phaser.GameObjects.Container {
  public readonly variant: TowerVariant;
  public level = 1;
  private cooldown = 0;
  private range: number;
  private damage: number;
  private fireRate: number;

  private readonly baseCost: number;
  private readonly baseRange: number;
  private readonly baseFireRate: number;
  private readonly baseDamage: number;
  private readonly special?: TowerSpecial;

  // Child visuals
  private base: Phaser.GameObjects.Rectangle;
  private icon: Phaser.GameObjects.Text;
  private rangeCircle: Phaser.GameObjects.Arc;
  private barrelLine: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: TowerVariant = 'script') {
    super(scene, x, y);
    this.variant = variant;

    const stats = TOWER_VARIANTS_DATA[variant];
    this.baseRange    = stats.range;
    this.baseFireRate = stats.fireRate;
    this.baseDamage   = stats.damage;
    this.baseCost     = stats.cost;
    this.special      = stats.special;
    this.range    = this.baseRange;
    this.damage   = this.baseDamage;
    this.fireRate = this.baseFireRate;
    const color = stats.color;

    // ── Range indicator (initially hidden) ───────────────────────────────
    this.rangeCircle = scene.add.arc(0, 0, this.range, 0, 360, false, color, 0.07);
    this.rangeCircle.setStrokeStyle(1, color, 0.35);
    this.rangeCircle.setVisible(false);

    // ── Tower base (coloured square) ─────────────────────────────────────
    this.base = scene.add.rectangle(0, 0, TOWER_SIZE * 2, TOWER_SIZE * 2, color);
    this.base.setStrokeStyle(2, 0xffffff, 0.4);

    // ── Barrel graphic ───────────────────────────────────────────────────
    this.barrelLine = scene.add.graphics();

    // ── Icon ─────────────────────────────────────────────────────────────
    this.icon = scene.add.text(0, 0, stats.icon, { fontSize: '18px' })
      .setOrigin(0.5, 0.5);

    // ── Level indicator ──────────────────────────────────────────────────
    this.levelText = scene.add.text(0, TOWER_SIZE + 4, this.levelStars(), {
      fontSize: '10px',
      color: '#ffeaa7',
    }).setOrigin(0.5, 0);

    this.add([this.rangeCircle, this.base, this.barrelLine, this.icon, this.levelText]);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Show range on hover
    this.setInteractive(new Phaser.Geom.Rectangle(-TOWER_SIZE, -TOWER_SIZE, TOWER_SIZE * 2, TOWER_SIZE * 2), Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', () => this.rangeCircle.setVisible(true));
    this.on('pointerout',  () => this.rangeCircle.setVisible(false));

    // Placement pop animation
    this.setScale(0.1);
    scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.Out' });
  }

  // ── Upgrades ─────────────────────────────────────────────────────────

  public canUpgrade(): boolean {
    return this.level < TOWER_MAX_LEVEL;
  }

  /** Money cost to go from the current level to the next one. */
  public getUpgradeCost(): number {
    return this.baseCost * this.level;
  }

  public upgrade(): void {
    if (!this.canUpgrade()) return;
    this.level++;
    this.damage   = this.baseDamage + TOWER_UPGRADE_DAMAGE_BONUS * (this.level - 1);
    this.range    = this.baseRange  + TOWER_UPGRADE_RANGE_BONUS  * (this.level - 1);
    this.fireRate = this.baseFireRate * Math.pow(TOWER_UPGRADE_FIRE_RATE_MULT, this.level - 1);
    this.rangeCircle.radius = this.range;
    this.levelText.setText(this.levelStars());

    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2, scaleY: 1.2,
      duration: 140,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  private levelStars(): string {
    return '★'.repeat(this.level) + '☆'.repeat(TOWER_MAX_LEVEL - this.level);
  }

  // ── Per-frame ─────────────────────────────────────────────────────────

  public tick(delta: number, enemies: Coworker[]): void {
    this.cooldown -= delta;
    if (this.cooldown > 0) return;

    if (this.special === 'aoeSlow') {
      // Router: no single target — pulses if anyone is in range at all.
      const anyoneInRange = enemies.some(
        e => !e.isDead && !e.hasReachedDesk &&
             Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) <= this.range
      );
      if (!anyoneInRange) return;
      this.cooldown = this.fireRate;
      this.firePulse(enemies);
      return;
    }

    const target = this.findTarget(enemies);
    if (!target) {
      this.barrelLine.clear();
      return;
    }

    this.cooldown = this.fireRate;
    this.aimAt(target);
    this.fireAt(target, enemies);
  }

  private findTarget(enemies: Coworker[]): Coworker | null {
    let closest: Coworker | null = null;
    let minDist = this.range;
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

  /** Router: an expanding ring wave centred on the tower, hitting everyone in range. */
  private firePulse(enemies: Coworker[]): void {
    const scene = this.scene;
    const ring = scene.add.arc(this.x, this.y, 6, 0, 360, false, 0x6c5ce7, 0);
    ring.setStrokeStyle(3, 0xa29bfe, 0.9);

    scene.tweens.add({
      targets: ring,
      radius: this.range,
      alpha: 0,
      duration: 350,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });

    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk) continue;
      if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) <= this.range) {
        e.takeDamage(this.damage);
        e.applySlow(SLOW_MULTIPLIER, SLOW_DURATION_MS);
      }
    }
  }

  /** Script fires code glyphs, Docs hurls a tome, everyone else a plain bolt. */
  private createProjectileVisual(): Phaser.GameObjects.Text | Phaser.GameObjects.Arc {
    const scene = this.scene;

    if (this.variant === 'script') {
      const glyph = Phaser.Math.Between(0, 1) ? '0' : '1';
      return scene.add.text(this.x, this.y, glyph, {
        fontSize: '14px',
        fontStyle: 'bold',
        fontFamily: 'monospace',
        color: '#00ff9d',
      }).setOrigin(0.5);
    }

    if (this.variant === 'docs') {
      return scene.add.text(this.x, this.y, '📖', { fontSize: '18px' }).setOrigin(0.5);
    }

    const proj = scene.add.arc(this.x, this.y, 5, 0, 360, false, 0xfdcb6e);
    proj.setStrokeStyle(1.5, 0xe17055);
    return proj;
  }

  private fireAt(target: Coworker, enemies: Coworker[]): void {
    const scene = this.scene;
    const proj = this.createProjectileVisual();

    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const vx = Math.cos(angle) * PROJECTILE_SPEED;
    const vy = Math.sin(angle) * PROJECTILE_SPEED;

    // Trail tween: move until it hits target or travels max range
    let travelled = 0;
    const maxTravel = this.range;
    const damage = this.damage;
    const special = this.special;

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
          target.takeDamage(damage);
          if (special === 'slow') target.applySlow(SLOW_MULTIPLIER, SLOW_DURATION_MS);
          if (special === 'stun') target.applySlow(0, STUN_DURATION_MS);
          if (special === 'aoe') {
            for (const e of enemies) {
              if (e === target || e.isDead || e.hasReachedDesk) continue;
              if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) <= AOE_SPLASH_RADIUS) {
                e.takeDamage(damage);
              }
            }
          }
          destroyProj();
          return;
        }
      }
      if (travelled >= maxTravel) destroyProj();
    };

    const destroyProj = () => {
      scene.events.off('update', update);
      // Tiny explosion flash (bigger for AoE, to hint at the splash radius)
      scene.tweens.add({
        targets: proj,
        alpha: 0,
        scaleX: special === 'aoe' ? AOE_SPLASH_RADIUS / 5 : 2.5,
        scaleY: special === 'aoe' ? AOE_SPLASH_RADIUS / 5 : 2.5,
        duration: 100,
        onComplete: () => proj.destroy(),
      });
    };

    scene.events.on('update', update);
  }
}
