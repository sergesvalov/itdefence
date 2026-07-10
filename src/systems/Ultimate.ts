import Phaser from 'phaser';
import type { Coworker } from '../entities/Coworker';
import type { HUD } from '../ui/HUD';
import { GAME_WIDTH, GAME_HEIGHT, ULTIMATE_COOLDOWN_MS, ULTIMATE_KILL_FRACTION } from '../config';
import { showFloatingText } from '../ui/FloatingText';

/**
 * Ultimate — "Создай тикет" / "Переслать в Helpdesk": a long-cooldown
 * global strike. Charges passively over time; once full, tapping the HUD
 * button removes a fraction of the coworkers currently on screen (they're
 * too lazy to file an official ticket, so they just leave).
 */
export class Ultimate {
  /** Set to false on game over to stop accepting taps. */
  public enabled = true;

  private chargeMs = 0;
  private ready = false;

  constructor(
    private scene: Phaser.Scene,
    private hud: HUD,
    private getEnemies: () => Coworker[],
  ) {
    hud.on('ultimate-tap', () => this.tryActivate());
  }

  update(delta: number): void {
    if (this.ready) return;
    this.chargeMs = Math.min(ULTIMATE_COOLDOWN_MS, this.chargeMs + delta);
    this.hud.setUltimateCharge(this.chargeMs / ULTIMATE_COOLDOWN_MS);

    if (this.chargeMs >= ULTIMATE_COOLDOWN_MS) {
      this.ready = true;
      this.hud.setUltimateReady(true);
    }
  }

  private tryActivate(): void {
    if (!this.enabled) return;
    if (!this.ready) {
      showFloatingText(this.scene, GAME_WIDTH / 2, 100, 'Не заряжено', '#ff6b6b');
      return;
    }

    const alive = this.getEnemies().filter(e => !e.isDead && !e.hasReachedDesk);
    if (alive.length === 0) {
      showFloatingText(this.scene, GAME_WIDTH / 2, 100, 'Некого увольнять', '#a29bfe');
      return;
    }

    const count = Math.ceil(alive.length * ULTIMATE_KILL_FRACTION);
    const targets = Phaser.Utils.Array.Shuffle(alive.slice()).slice(0, count);
    for (const target of targets) target.sendToHelpdesk();

    this.announce();
    this.scene.cameras.main.shake(150, 0.006);

    this.chargeMs = 0;
    this.ready = false;
    this.hud.setUltimateCharge(0);
    this.hud.setUltimateReady(false);
  }

  private announce(): void {
    const txt = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '🎫 ТИКЕТ СОЗДАН!', {
      fontSize: '28px', fontStyle: 'bold', color: '#ff7675',
      stroke: '#2d3436', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    this.scene.tweens.add({
      targets: txt,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 100,
      duration: 1400,
      ease: 'Quad.Out',
      onComplete: () => txt.destroy(),
    });
  }
}
