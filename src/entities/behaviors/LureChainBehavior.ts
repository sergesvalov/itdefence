import Phaser from 'phaser';
import type { ITowerBehavior } from './ITowerBehavior';
import type { ToolTower } from '../ToolTower';
import type { Coworker } from '../Coworker';
import { CHAIN_DAMAGE_MULT, CHAIN_MAX_BOUNCES } from '../../config';

export class LureChainBehavior implements ITowerBehavior {
  constructor(private tower: ToolTower) {}

  tick(delta: number, enemies: Coworker[]): void {
    for (const e of enemies) {
      if (!e.isDead && !e.hasReachedDesk && !e.visitedCoolers.has(this.tower)) {
        if (!e.getLure()) {
           const dist = Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y);
           if (dist <= this.tower.range) {
             e.setLure(this.tower);
           }
        }
      }
    }

    for (const e of enemies) {
      if (e.getLure() === this.tower) {
        const dist = Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y);
        if (dist < 18) {
          e.clearLure();
          e.visitedCoolers.add(this.tower);
          e.takeDamage(this.tower.damage);
          if (e.isDead) {
            this.fireChainRicochet(
              e.x, e.y, enemies,
              this.tower.damage * CHAIN_DAMAGE_MULT,
              CHAIN_MAX_BOUNCES,
              new Set([e]),
            );
          }
        }
      }
    }
  }

  private fireChainRicochet(
    fromX: number, fromY: number, enemies: Coworker[],
    damage: number, bouncesLeft: number, alreadyHit: Set<Coworker>,
  ): void {
    if (bouncesLeft <= 0) return;

    let next: Coworker | null = null;
    let minDist = this.tower.range;
    for (const e of enemies) {
      if (e.isDead || e.hasReachedDesk || alreadyHit.has(e)) continue;
      const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y);
      if (d < minDist) { minDist = d; next = e; }
    }
    if (!next) return;
    alreadyHit.add(next);

    this.tower.view.createRicochetBolt(fromX, fromY, next.x, next.y);

    next.takeDamage(damage);
    if (next.isDead) {
      this.fireChainRicochet(next.x, next.y, enemies, damage, bouncesLeft - 1, alreadyHit);
    }
  }
}
