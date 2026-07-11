import Phaser from 'phaser';
import type { Coworker } from './Coworker';
import {
  PROJECTILE_SPEED,
  TOWER_VARIANTS_DATA, type TowerVariant, type TowerVariantStats,
  TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_BONUS, TOWER_UPGRADE_RANGE_BONUS, TOWER_UPGRADE_FIRE_RATE_MULT,
  SLOW_MULTIPLIER, SLOW_DURATION_MS, AOE_SPLASH_RADIUS, STUN_DURATION_MS,
  CHAIN_DAMAGE_MULT, CHAIN_MAX_BOUNCES,
} from '../config';

export const TOWER_SIZE = 26; // half-width of the square body

type TowerSpecial = TowerVariantStats['special'];

/**
 * ToolTower – a defence tower placed by the player.
 * Scans for the nearest Coworker in range, fires a projectile at it,
 * and waits for the fire-rate cooldown before shooting again.
 * Base range/fire rate/damage/cost come from the variant (see
 * TOWER_VARIANTS_DATA in config.ts); some variants also have a special
 * effect on hit ('slow', 'aoe' splash, 'stun', or 'chain' ricochet), and
 * Router ('aoeSlow') skips the projectile entirely for a self-centred
 * pulse — see tick().
 * Can be upgraded (up to TOWER_MAX_LEVEL) for more damage, range and
 * fire rate — see upgrade().
 */
export class ToolTower extends Phaser.GameObjects.Container {
  public readonly variant: TowerVariant;
  public level = 1;
  public tasksSolved = 0;
  private cooldown = 0;
  private range: number;
  private damage: number;
  private fireRate: number;

  private readonly baseCost: number;
  private readonly baseRange: number;
  private readonly baseFireRate: number;
  private readonly baseDamage: number;
  private readonly special?: TowerSpecial;

  // Child visuals — either a coloured square + emoji icon, or (if the
  // matching sprite-tower-<variant> texture was loaded) a single image.
  private base?: Phaser.GameObjects.Rectangle;
  private icon?: Phaser.GameObjects.Text;
  private sprite?: Phaser.GameObjects.Image;
  private rangeCircle: Phaser.GameObjects.Arc;
  private barrelLine: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: TowerVariant = 'cooler') {
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

    // ── Barrel graphic ───────────────────────────────────────────────────
    this.barrelLine = scene.add.graphics();

    // ── Tower body: sprite if one was loaded, else coloured square + icon ──
    const spriteKey = `sprite-tower-${variant}`;
    const radius = stats.radius || TOWER_SIZE;
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.image(0, 0, spriteKey).setDisplaySize(radius * 2, radius * 2);
    } else {
      this.base = scene.add.rectangle(0, 0, radius * 2, radius * 2, color);
      this.base.setStrokeStyle(2, 0xffffff, 0.4);
      this.icon = scene.add.text(0, 0, stats.icon, { fontSize: '18px' }).setOrigin(0.5, 0.5);
    }

    // ── Level indicator ──────────────────────────────────────────────────
    this.levelText = scene.add.text(0, TOWER_SIZE + 4, this.levelStars(), {
      fontSize: '10px',
      color: '#ffeaa7',
    }).setOrigin(0.5, 0);

    const body = this.sprite ? [this.sprite] : [this.base!, this.icon!];
    this.add([this.rangeCircle, this.barrelLine, ...body, this.levelText]);
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
    if (this.special === 'partner') {
      if (this.tasksSolved >= 10) {
        this.setAlpha(0.5);
        return;
      }
      for (const e of enemies) {
        if (e.partnerTarget === this && Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) < 24) {
          e.partnerTarget = null;
          e.sendToHelpdesk();
          this.tasksSolved++;
          this.scene.tweens.add({
            targets: this, scaleX: 1.1, scaleY: 1.1, duration: 80, yoyo: true
          });
        }
      }
      return; // Partners don't shoot or lure
    }

    if (this.special === 'lureChain') {
      for (const e of enemies) {
        if (!e.isDead && !e.hasReachedDesk && !e.visitedCoolers.has(this)) {
          if (!e.getLure()) {
             const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
             if (dist <= this.range) {
               e.setLure(this);
             }
          }
        }
      }

      for (const e of enemies) {
        if (e.getLure() === this) {
          const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          if (dist < 18) {
            e.clearLure();
            e.visitedCoolers.add(this);
            e.takeDamage(this.damage);
            if (e.isDead) {
              this.fireChainRicochet(
                e.x, e.y, enemies,
                this.damage * CHAIN_DAMAGE_MULT,
                CHAIN_MAX_BOUNCES,
                new Set([e]),
              );
            }
          }
        }
      }
      return;
    }

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
        // Router is pure crowd control at base level — the slow is the
        // point, damage (if any, from upgrades) is just a side effect.
        if (this.damage > 0) e.takeDamage(this.damage);
        e.applySlow(SLOW_MULTIPLIER, SLOW_DURATION_MS);
      }
    }
  }

  /**
   * Cooler: deals damage, and if it kills, ricochets to the nearest other enemy in range for
   * `damage` (already the reduced ricochet amount — see CHAIN_DAMAGE_MULT),
   * chaining again on every further kill, up to `bouncesLeft` hops.
   */
  private fireChainRicochet(
    fromX: number, fromY: number, enemies: Coworker[],
    damage: number, bouncesLeft: number, alreadyHit: Set<Coworker>,
  ): void {
    if (bouncesLeft <= 0) return;

    let next: Coworker | null = null;
    let minDist = this.range;
    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk || alreadyHit.has(e)) continue;
      const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y);
      if (d < minDist) { minDist = d; next = e; }
    }
    if (!next) return;
    alreadyHit.add(next);

    const scene = this.scene;
    const bolt = scene.add.graphics();
    bolt.lineStyle(2, 0x00ff9d, 0.9);
    bolt.lineBetween(fromX, fromY, next.x, next.y);
    scene.tweens.add({ targets: bolt, alpha: 0, duration: 150, onComplete: () => bolt.destroy() });

    next.takeDamage(damage);
    if (next.isDead) {
      this.fireChainRicochet(next.x, next.y, enemies, damage, bouncesLeft - 1, alreadyHit);
    }
  }

  /** Docs hurls a tome, everyone else a plain bolt. */
  private createProjectileVisual(): Phaser.GameObjects.Text | Phaser.GameObjects.Arc {
    const scene = this.scene;

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
