import type Phaser from 'phaser';
import type { Coworker } from '../entities/Coworker';
import type { HUD } from '../ui/HUD';
import { DESK_X, DESK_Y, SHIELD_COOLDOWN_MS, SHIELD_DURATION_MS } from '../config';
import { showFloatingText } from '../ui/FloatingText';
import { MetaProgression } from './MetaProgression';

/**
 * Shield — "Я на митинге": temporary invulnerability for Petya's office
 * door. While active (see isActive), WaveManager redirects anyone who
 * reaches the desk into Coworker.blockAtDoor() instead of letting them
 * hit Petya. If they're still stuck there when the shield drops, they
 * barge in (see releaseFromDoor(), called from deactivate() below).
 */
export class Shield {
  /** Set to false on game over to stop accepting taps. */
  public enabled = true;

  private chargeMs = 0;
  private ready = false;
  private active = false;
  private activeMs = 0;
  private signText?: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private hud: HUD,
    private getEnemies: () => Coworker[],
  ) {
    hud.on('shield-tap', () => this.tryActivate());
  }

  get isActive(): boolean {
    return this.active;
  }

  update(delta: number): void {
    if (this.active) {
      this.activeMs -= delta;
      if (this.activeMs <= 0) this.deactivate();
      return;
    }

    if (this.ready) return;
    this.chargeMs = Math.min(SHIELD_COOLDOWN_MS, this.chargeMs + delta);
    this.hud.setShieldCharge(this.chargeMs / SHIELD_COOLDOWN_MS);

    if (this.chargeMs >= SHIELD_COOLDOWN_MS) {
      this.ready = true;
      this.hud.setShieldReady(true);
    }
  }

  private tryActivate(): void {
    if (!this.enabled) return;
    if (!this.ready) {
      showFloatingText(this.scene, DESK_X, DESK_Y - 40, 'Не заряжено', '#ff6b6b');
      return;
    }

    this.active = true;
    this.ready = false;
    
    const meta = MetaProgression.get();
    this.activeMs = SHIELD_DURATION_MS + (meta.shieldDurationLevel * 2000); // +2s per level
    
    this.chargeMs = 0;
    this.hud.setShieldReady(false);
    this.hud.setShieldCharge(0);

    this.signText = this.scene.add.text(DESK_X, DESK_Y - 60, '🚫 НЕ БЕСПОКОИТЬ', {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#c0392b',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(18);

    showFloatingText(this.scene, DESK_X, DESK_Y - 40, 'Я на митинге!', '#3498db');
  }

  private deactivate(): void {
    this.active = false;
    this.activeMs = 0;

    this.signText?.destroy();
    this.signText = undefined;

    // Anyone still stuck at the door barges in now that the shield is down.
    for (const cw of this.getEnemies()) {
      cw.releaseFromDoor();
    }
  }
}
