import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, type TowerVariantStats, type FurnitureTypeStats } from '../config';
import type { Task } from '../systems/Inbox';

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
  private inboxCountText: Phaser.GameObjects.Text;
  private inboxQueueText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private towerSelectText: Phaser.GameObjects.Text;
  private gameOverOverlay: Phaser.GameObjects.Container;

  private ultimateButton: AbilityButton;
  private shieldButton: AbilityButton;

  private startWaveButton: Phaser.GameObjects.Container;
  private startWaveText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, startingMoney: number, inboxLimit: number) {
    super();
    this.scene = scene;
    const pad = 12;

    // ── Top-left HUD panel ────────────────────────────────────────────
    const hudBg = scene.add.graphics();
    hudBg.fillStyle(0x000000, 0.75);
    hudBg.fillRoundedRect(pad, pad, 240, 120, 12);
    hudBg.setDepth(15);

    const textStyle = { fontFamily: 'Courier, monospace', fontSize: '14px', color: '#FFFFFF' };
    const boldStyle = { ...textStyle, fontStyle: 'bold' };

    // Money
    this.moneyText = scene.add.text(pad + 16, pad + 16, `💰 0`, {
      ...boldStyle, color: '#FBBF24', fontSize: '16px'
    }).setDepth(16);
    this.setMoney(startingMoney);

    // Inbox counter
    this.inboxCountText = scene.add.text(pad + 16, pad + 40, `📥 Inbox: 0 / ${inboxLimit}`, boldStyle).setDepth(16);

    // Inbox queue
    this.inboxQueueText = scene.add.text(pad + 16, pad + 60, '', textStyle).setDepth(16);

    // Wave indicator
    this.waveText = scene.add.text(pad + 16, pad + 80, '', boldStyle).setDepth(16);

    // Tower selector
    this.towerSelectText = scene.add.text(pad + 16, pad + 100, '', { ...boldStyle, color: '#93C5FD' })
      .setDepth(16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.emit('variant-tap'));

    // Hint text (bottom center)
    const hintText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Тап: кабинет — постройка, постройка — апгрейд/перестановка', {
      fontFamily: 'Courier, monospace',
      fontSize: '11px',
      color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(16).setAlpha(0.6);

    // ── Ability buttons — top-right corner ──────────────────────────────
    this.ultimateButton = this.buildAbilityButton(GAME_WIDTH - 96, 48, '🎫', 'Тикет', 'ultimate-tap');
    this.shieldButton   = this.buildAbilityButton(GAME_WIDTH - 40, 48, '🛡️', 'Митинг', 'shield-tap');

    // ── "Start Wave" button — shown only during the between-waves pause.
    // Parked under the ability buttons (top-right) so it doesn't collide
    // with the (now taller) stats panel or the spawn-door row below it.
    const swX = GAME_WIDTH - 68;
    const swY = 112;
    const swBg = scene.add.circle(0, 0, 26, 0x27ae60, 0.95);
    swBg.setStrokeStyle(3, 0xffffff, 0.9);
    const swIcon = scene.add.text(0, 0, '▶️', { fontSize: '18px' }).setOrigin(0.5);
    this.startWaveButton = scene.add.container(swX, swY, [swBg, swIcon])
      .setDepth(17)
      .setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit('start-wave-tap'));
    this.startWaveText = scene.add.text(swX, swY + 34, '', {
      fontSize: '10px',
      color: '#2ecc71',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(17);
    scene.tweens.add({
      targets: this.startWaveButton,
      scaleX: 1.12, scaleY: 1.12,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.startWaveButton.setVisible(false);
    this.startWaveText.setVisible(false);

    // ── Game Over overlay ─────────────────────────────────────────────
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.gameOverOverlay.setVisible(false);
    this.gameOverOverlay.setDepth(50);
  }

  setMoney(amount: number): void {
    this.moneyText.setText(`💰 ${amount}`);
  }

  /** Brief colour pulse on the money text — used when wave money comes in. */
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

  /**
   * Redraws the Inbox counter + the per-slot queue row (leftmost glyph is
   * the next task Petya resolves). Called by Inbox on every enqueue/resolve.
   */
  setInbox(tasks: readonly Task[], limit: number): void {
    this.inboxCountText.setText(`📥 Inbox: ${tasks.length} / ${limit}`);

    const glyphs: string[] = [];
    for (let i = 0; i < limit; i++) {
      const task = tasks[i];
      glyphs.push(!task ? '▫️' : task.urgent ? '🔴' : '🟡');
    }
    this.inboxQueueText.setText(glyphs.join(''));

    this.scene.tweens.add({
      targets: this.inboxCountText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 120,
      yoyo: true,
      onStart: () => this.inboxCountText.setColor('#ff6b6b'),
      onComplete: () => this.inboxCountText.setColor('#ffeaa7'),
    });
  }

  setWave(wave: number): void {
    this.waveText.setText(`🌊 Волна ${wave}`);
  }

  /** Between-waves pause: shows the pulsing "Start Wave" button. */
  showStartWaveButton(nextWave: number): void {
    this.startWaveText.setText(`Готовься!\nВолна ${nextWave}`);
    this.startWaveButton.setVisible(true);
    this.startWaveText.setVisible(true);
  }

  hideStartWaveButton(): void {
    this.startWaveButton.setVisible(false);
    this.startWaveText.setVisible(false);
  }

  setTowerSelect(stats: TowerVariantStats): void {
    this.towerSelectText.setText(`🔧 Building: ${stats.icon} ${stats.label} (💰${stats.cost})`);
  }

  /** Same row as setTowerSelect — the tower/furniture build cycle shares one selector. */
  setFurnitureSelect(stats: FurnitureTypeStats, left: number): void {
    this.towerSelectText.setText(`🪑 Building: ${stats.icon} ${stats.label} (${left}/${stats.maxCount} left)`);
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

  private buildAbilityButton(x: number, y: number, icon: string, buttonLabel: string, tapEvent: string): AbilityButton {
    const scene = this.scene;

    const bg = scene.add.circle(0, 0, 22, 0x2d3436, 0.9);
    bg.setStrokeStyle(2, 0x636e72, 0.8);

    const ring = scene.add.graphics();
    const t = scene.add.text(0, 0, icon, { fontSize: '20px' }).setOrigin(0.5);
    const container = scene.add.container(x, y, [bg, ring, t])
      .setDepth(16)
      .setInteractive(new Phaser.Geom.Circle(0, 0, 26), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit(tapEvent));
      
    scene.add.text(x, y + 32, buttonLabel, {
      fontFamily: 'Courier, monospace',
      fontSize: '11px',
      color: '#FFFFFF',
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

    const text = this.scene.add.text(0, -20, 'GAME OVER', {
      fontFamily: 'Courier, monospace',
      fontSize: '48px',
      color: '#e74c3c',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    const subText = this.scene.add.text(0, 30, 'Петя сгорел на работе 🔥', {
      fontFamily: 'Courier, monospace',
      fontSize: '18px',
      color: '#FFFFFF',
      align: 'center', 
      wordWrap: { width: 320 },
    }).setOrigin(0.5);

    const hint = scene.add.text(0, 100, 'Press R to try again', {
      fontFamily: 'Courier, monospace',
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

    overlay.add([veil, panel, text, subText, hint]);
    return overlay;
  }
}
