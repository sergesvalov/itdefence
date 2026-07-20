import Phaser from 'phaser';
import type { ITowerBehavior } from './ITowerBehavior';
import type { ToolTower } from '../ToolTower';
import type { Coworker } from '../Coworker';
import { SoundFX } from '../../systems/SoundFX';
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
    let bestTarget: Coworker | null = null;
    let bestValue = -Infinity;

    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk) continue;
      
      const d = Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y);
      if (d > this.tower.range) continue;

      let value = 0;
      if (this.tower.priority === 'closest') {
        value = -d; // smaller distance = higher value
      } else if (this.tower.priority === 'strongest') {
        value = e.hp; // higher hp = higher value
      } else if (this.tower.priority === 'first') {
        value = e.y; // further down the screen (larger y) = closer to desk = higher value
      }

      if (value > bestValue) {
        bestValue = value;
        bestTarget = e;
      }
    }
    return bestTarget;
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
    
    SoundFX.playShoot();
    
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
      if (trail) trail.stop();
      scene.tweens.add({
        targets: proj,
        alpha: 0,
        scaleX: special === 'aoe' ? AOE_SPLASH_RADIUS / 5 : 2.5,
        scaleY: special === 'aoe' ? AOE_SPLASH_RADIUS / 5 : 2.5,
        duration: 100,
        onComplete: () => proj.destroy(),
      });
    };

    let trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    if (special !== 'aoe' && this.tower.variant !== 'docs') {
      trail = scene.add.particles(0, 0, 'sprite-tower-cooler', { // Use a basic texture, it will be tinted. Wait, Phaser 3.60+ allows textureless particles with just a shape or a 1x1 white pixel, but we can just use a graphics generated texture or fallback.
        color: [0xfdcb6e, 0xe17055],
        colorEase: 'quad.out',
        lifespan: 150,
        scale: { start: 0.3, end: 0 },
        blendMode: 'ADD',
        follow: proj
      }).setDepth(15);
      
      // Since 'sprite-tower-cooler' is large, we can just use it very small as a particle.
      // Alternatively, we could create a 1x1 white texture, but we'll stick to a loaded asset for safety.
    }

    scene.events.on('update', update);
  }
}
