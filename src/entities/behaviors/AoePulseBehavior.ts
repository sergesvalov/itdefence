import Phaser from 'phaser';
import type { ITowerBehavior } from './ITowerBehavior';
import type { ToolTower } from '../ToolTower';
import type { Coworker } from '../Coworker';
import { SLOW_MULTIPLIER, SLOW_DURATION_MS } from '../../config';

export class AoePulseBehavior implements ITowerBehavior {
  constructor(private tower: ToolTower) {}

  tick(delta: number, enemies: Coworker[]): void {
    this.tower.cooldown -= delta;
    if (this.tower.cooldown > 0) return;

    const anyoneInRange = enemies.some(
      e => !e.isDead && !e.hasReachedDesk &&
           Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y) <= this.tower.range
    );
    if (!anyoneInRange) return;
    this.tower.cooldown = this.tower.fireRate;
    this.firePulse(enemies);
  }

  private firePulse(enemies: Coworker[]): void {
    this.tower.view.createPulseRing(this.tower.range);

    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk) continue;
      if (Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y) <= this.tower.range) {
        if (this.tower.damage > 0) e.takeDamage(this.tower.damage);
        e.applySlow(SLOW_MULTIPLIER, SLOW_DURATION_MS);
      }
    }
  }
}
