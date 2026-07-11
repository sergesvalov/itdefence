import Phaser from 'phaser';
import type { Coworker } from './Coworker';
import {
  PROJECTILE_SPEED,
  TOWER_VARIANTS_DATA, type TowerVariant, type TowerVariantStats,
  TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_BONUS, TOWER_UPGRADE_RANGE_BONUS, TOWER_UPGRADE_FIRE_RATE_MULT,
  SLOW_MULTIPLIER, SLOW_DURATION_MS, AOE_SPLASH_RADIUS, STUN_DURATION_MS,
  CHAIN_DAMAGE_MULT, CHAIN_MAX_BOUNCES,
} from '../config';
import { TowerView, TOWER_SIZE } from './TowerView';

export { TOWER_SIZE };

type TowerSpecial = TowerVariantStats['special'];

/**
 * ToolTower – a defence tower placed by the player.
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

  private view: TowerView;

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

    this.view = new TowerView(scene, this, variant, this.range, TOWER_MAX_LEVEL);

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  // ── Upgrades ─────────────────────────────────────────────────────────

  public canUpgrade(): boolean {
    return this.level < TOWER_MAX_LEVEL;
  }

  public getUpgradeCost(): number {
    return this.baseCost * this.level;
  }

  public upgrade(): void {
    if (!this.canUpgrade()) return;
    this.level++;
    this.damage   = this.baseDamage + TOWER_UPGRADE_DAMAGE_BONUS * (this.level - 1);
    this.range    = this.baseRange  + TOWER_UPGRADE_RANGE_BONUS  * (this.level - 1);
    this.fireRate = this.baseFireRate * Math.pow(TOWER_UPGRADE_FIRE_RATE_MULT, this.level - 1);
    
    this.view.playUpgradeAnimation(this.level, this.range);
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
          this.view.playPartnerSolveAnimation();
        }
      }
      return;
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
      this.view.clearAim();
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
    this.view.aimAt(angle);
  }

  private firePulse(enemies: Coworker[]): void {
    this.view.createPulseRing(this.range);

    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk) continue;
      if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) <= this.range) {
        if (this.damage > 0) e.takeDamage(this.damage);
        e.applySlow(SLOW_MULTIPLIER, SLOW_DURATION_MS);
      }
    }
  }

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

    this.view.createRicochetBolt(fromX, fromY, next.x, next.y);

    next.takeDamage(damage);
    if (next.isDead) {
      this.fireChainRicochet(next.x, next.y, enemies, damage, bouncesLeft - 1, alreadyHit);
    }
  }

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
