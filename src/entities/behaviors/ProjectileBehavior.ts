import Phaser from 'phaser';
import type { ITowerBehavior } from './ITowerBehavior';
import type { ToolTower } from '../ToolTower';
import type { Coworker } from '../Coworker';
import { PROJECTILE_SPEED, SLOW_MULTIPLIER, SLOW_DURATION_MS, STUN_DURATION_MS, AOE_SPLASH_RADIUS } from '../../config';

export class ProjectileBehavior implements ITowerBehavior {
  constructor(private tower: ToolTower) {}

  tick(delta: number, enemies: Coworker[]): void {
    this.tower.cooldown -= delta;
    if (this.tower.cooldown > 0) return;

    const target = this.findTarget(enemies);
    if (!target) {
      this.tower.view.clearAim();
      return;
    }

    this.tower.cooldown = this.tower.fireRate;
    this.aimAt(target);
    this.fireAt(target, enemies);
  }

  private findTarget(enemies: Coworker[]): Coworker | null {
    let closest: Coworker | null = null;
    let minDist = this.tower.range;
    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk) continue;
      const d = Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y);
      if (d < minDist) { minDist = d; closest = e; }
    }
    return closest;
  }

  private aimAt(target: Coworker): void {
    const angle = Phaser.Math.Angle.Between(this.tower.x, this.tower.y, target.x, target.y);
    this.tower.view.aimAt(angle);
  }

  private createProjectileVisual(): Phaser.GameObjects.Text | Phaser.GameObjects.Arc {
    const scene = this.tower.scene;
    if (this.tower.variant === 'docs') {
      return scene.add.text(this.tower.x, this.tower.y, '📖', { fontSize: '18px' }).setOrigin(0.5);
    }
    const proj = scene.add.arc(this.tower.x, this.tower.y, 5, 0, 360, false, 0xfdcb6e);
    proj.setStrokeStyle(1.5, 0xe17055);
    return proj;
  }

  private fireAt(target: Coworker, enemies: Coworker[]): void {
    const scene = this.tower.scene;
    
    // Docs screen shake
    if (this.tower.variant === 'docs') {
      scene.cameras.main.shake(150, 0.008);
    }
    
    const proj = this.createProjectileVisual();

    const angle = Phaser.Math.Angle.Between(this.tower.x, this.tower.y, target.x, target.y);
    const vx = Math.cos(angle) * PROJECTILE_SPEED;
    const vy = Math.sin(angle) * PROJECTILE_SPEED;

    let travelled = 0;
    const maxTravel = this.tower.range;
    const damage = this.tower.damage;
    const special = this.tower.special;

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
