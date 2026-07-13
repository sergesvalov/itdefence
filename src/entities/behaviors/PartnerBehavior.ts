import Phaser from 'phaser';
import type { ITowerBehavior } from './ITowerBehavior';
import type { ToolTower } from '../ToolTower';
import type { Coworker } from '../Coworker';

export class PartnerBehavior implements ITowerBehavior {
  constructor(private tower: ToolTower) {}

  tick(delta: number, enemies: Coworker[]): void {
    if (this.tower.tasksSolved >= 10) {
      this.tower.setAlpha(0.5);
      return;
    }
    for (const e of enemies) {
      if (e.partnerTarget === this.tower && Phaser.Math.Distance.Between(this.tower.x, this.tower.y, e.x, e.y) < 24) {
        e.partnerTarget = null;
        e.sendToHelpdesk();
        this.tower.tasksSolved++;
        this.tower.view.playPartnerSolveAnimation();
      }
    }
  }
}
