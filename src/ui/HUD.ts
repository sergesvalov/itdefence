import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, type TowerVariantStats } from '../config';

interface AbilityButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
}

/**
 * HUD — the top-left stats panel, the two ability buttons (ultimate +
 * shield), and the Game Over overlay. Emits 'variant-tap' when the player
 * taps the tower-type row (TowerPlacer listens and cycles the selected
 * variant), 'ultimate-tap' and 'shield-tap' when the corresponding ability
 * button is tapped (the Ultimate/Shield systems listen and decide whether
 * they're actually charged).
 */
export class HUD extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private moneyText: Phaser.GameObjects.Text;
  private taskCounterText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private towerSelectText: Phaser.GameObjects.Text;
  private gameOverOverlay: Phaser.GameObjects.Container;

  private ultimateButton: AbilityButton;
  private shieldButton: AbilityButton;

  constructor(scene: Phaser.Scene, startingMoney: number, maxTasks: number) {
    super();
    this.scene = scene;
    const pad = 12;

    // ── Top-left HUD panel ────────────────────────────────────────────
    const hudBg = scene.add.graphics();
    hudBg.fillStyle(0x000000, 0.55);
    hudBg.fillRoundedRect(pad, pad, 280, 134, 10);
    hudBg.setDepth(15);

    // Money
    this.moneyText = scene.add.text(pad + 14, pad + 10, `💰 ${startingMoney}`, {
      fontSize: '16px',
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setDepth(16);

    // Task counter
    this.taskCounterText = scene.add.text(pad + 14, pad + 36, `📋 Tasks on Desk: 0 / ${maxTasks}`, {
      fontSize: '16px',
      color: '#ffeaa7',
      fontStyle: 'bold',
    }).setDepth(16);

    // Wave indicator
    this.waveText = scene.add.text(pad + 14, pad + 64, '', { fontSize: '13px', color: '#a29bfe' })
      .setDepth(16);

    // Tower selector — tap to cycle type (right-click / 1-6 don't exist on touch)
    this.towerSelectText = scene.add.text(pad + 14, pad + 86, '', { fontSize: '13px', color: '#74b9ff' })
      .setDepth(16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.emit('variant-tap'));

    // Hint text
    scene.add.text(pad + 14, pad + 110, 'Тап: кабинет — башня, башня — апгрейд, тип — смена', {
      fontSize: '9px',
      color: '#636e72',
    }).setDepth(16);

    // ── Ability buttons — top-right corner ──────────────────────────────
    this.ultimateButton = this.buildAbilityButton(GAME_WIDTH - 96, 48, '🎫', 'Тикет', 'ultimate-tap');
    this.shieldButton   = this.buildAbilityButton(GAME_WIDTH - 40, 48, '🛡️', 'Митинг', 'shield-tap');

    // ── Game Over overlay ─────────────────────────────────────────────
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.gameOverOverlay.setVisible(false);
    this.gameOverOverlay.setDepth(50);
  }

  setMoney(amount: number): void {
    this.moneyText.setText(`💰 ${amount}`);
  }

  /** Brief colour pulse on the money text — used when the salary comes in. */
  pulseMoney(color: string): void {
    this.scene.tweens.add({
      targets: this.moneyText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 150,
      yoyo: true,
      onStart: () => this.moneyText.setColor(color),
      onComplete: () => this.moneyText.setColor('#f1c40f'),
    });
  }

  setTasks(count: number, max: number): void {
    this.taskCounterText.setText(`📋 Tasks on Desk: ${count} / ${max}`);

    this.scene.tweens.add({
      targets: this.taskCounterText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 120,
      yoyo: true,
      onStart: () => this.taskCounterText.setColor('#ff6b6b'),
      onComplete: () => this.taskCounterText.setColor('#ffeaa7'),
    });
  }

  setWave(wave: number, wavesToSalary: number): void {
    this.waveText.setText(`🌊 Волна ${wave}  (зарплата через ${wavesToSalary})`);
  }

  setTowerSelect(stats: TowerVariantStats): void {
    this.towerSelectText.setText(`🔧 Building: ${stats.icon} ${stats.label} (💰${stats.cost})`);
  }

  showGameOver(): void {
    this.gameOverOverlay.setVisible(true);
  }

  /** Redraws the charge ring around the ultimate button. `fraction` is 0-1. */
  setUltimateCharge(fraction: number): void {
    this.redrawChargeRing(this.ultimateButton.ring, fraction, 0xe74c3c);
  }

  /** Toggles the button between "charging" (grey) and "ready" (pulsing red). */
  setUltimateReady(ready: boolean): void {
    this.setButtonReady(this.ultimateButton, ready, 0xe74c3c, 0xff7675);
  }

  /** Redraws the charge ring around the shield button. `fraction` is 0-1. */
  setShieldCharge(fraction: number): void {
    this.redrawChargeRing(this.shieldButton.ring, fraction, 0x3498db);
  }

  /** Toggles the button between "charging" (grey) and "ready" (pulsing blue). */
  setShieldReady(ready: boolean): void {
    this.setButtonReady(this.shieldButton, ready, 0x3498db, 0x74b9ff);
  }

  // ── Ability button helpers ───────────────────────────────────────────

  private buildAbilityButton(x: number, y: number, icon: string, label: string, tapEvent: string): AbilityButton {
    const scene = this.scene;

    const bg = scene.add.circle(0, 0, 22, 0x2d3436, 0.9);
    bg.setStrokeStyle(2, 0x636e72, 0.8);

    const ring = scene.add.graphics();

    const iconText = scene.add.text(0, 0, icon, { fontSize: '18px' }).setOrigin(0.5);

    const container = scene.add.container(x, y, [bg, ring, iconText])
      .setDepth(16)
      .setInteractive(new Phaser.Geom.Circle(0, 0, 26), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit(tapEvent));

    scene.add.text(x, y + 30, label, {
      fontSize: '9px',
      color: '#dfe6e9',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);

    return { container, bg, ring };
  }

  private redrawChargeRing(ring: Phaser.GameObjects.Graphics, fraction: number, color: number): void {
    ring.clear();
    if (fraction <= 0) return;
    ring.lineStyle(4, color, 1);
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * Math.min(1, fraction);
    ring.beginPath();
    ring.arc(0, 0, 24, start, end, false);
    ring.strokePath();
  }

  private setButtonReady(button: AbilityButton, ready: boolean, readyFill: number, readyStroke: number): void {
    button.bg.setFillStyle(ready ? readyFill : 0x2d3436, 0.9);
    button.bg.setStrokeStyle(2, ready ? readyStroke : 0x636e72, 1);

    this.scene.tweens.killTweensOf(button.container);
    if (ready) {
      this.scene.tweens.add({
        targets: button.container,
        scaleX: 1.12, scaleY: 1.12,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else {
      button.container.setScale(1);
    }
  }

  private buildGameOverOverlay(): Phaser.GameObjects.Container {
    const scene = this.scene;
    const overlay = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Dark veil
    const veil = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);

    // Panel
    const panel = scene.add.graphics();
    panel.fillStyle(0x1e2a3a, 1);
    panel.fillRoundedRect(-190, -170, 380, 340, 18);
    panel.lineStyle(3, 0xe74c3c, 0.9);
    panel.strokeRoundedRect(-190, -170, 380, 340, 18);

    const title = scene.add.text(0, -110, '💀 GAME OVER', {
      fontSize: '34px', fontStyle: 'bold', color: '#e74c3c',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    const sub = scene.add.text(0, -40, "Petya's desk is buried in tasks!", {
      fontSize: '15px', color: '#dfe6e9', align: 'center', wordWrap: { width: 320 },
    }).setOrigin(0.5);

    const hint = scene.add.text(0, 30, 'Press  R  to try again', {
      fontSize: '20px', color: '#74b9ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Pulsing hint
    scene.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    overlay.add([veil, panel, title, sub, hint]);
    return overlay;
  }
}
