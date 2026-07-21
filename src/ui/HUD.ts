import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TOOLBAR_WIDTH } from '../config';
import type { Task } from '../systems/Inbox';
import type { TowerVariantStats, FurnitureTypeStats } from '../config';
import { TopBar } from './TopBar';
import { Toolbar } from './Toolbar';
import { GameOverOverlay } from './GameOverOverlay';

interface AbilityButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
}

export class HUD extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  
  private topBar: TopBar;
  private toolbar: Toolbar;
  private gameOverOverlay: GameOverOverlay;

  private ultimateButton: AbilityButton;
  private shieldButton: AbilityButton;
  private startWaveButton: Phaser.GameObjects.Container;
  private startWaveText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, startingMoney: number, inboxLimit: number) {
    super();
    this.scene = scene;

    this.topBar = new TopBar(scene, startingMoney, inboxLimit);
    this.toolbar = new Toolbar(scene, this);
    this.gameOverOverlay = new GameOverOverlay(scene, this);

    const fontStyle = 'Inter, system-ui, sans-serif';

    // Hint text (at the very bottom)
    const hintBg = scene.add.graphics();
    hintBg.fillStyle(0x000000, 0.7);
    hintBg.fillRect(0, GAME_HEIGHT - 32, GAME_WIDTH, 32);
    hintBg.setDepth(10000);
    
    scene.add.text(TOOLBAR_WIDTH + (GAME_WIDTH - TOOLBAR_WIDTH) / 2, GAME_HEIGHT - 16, 'Тап: кабинет - строить, предмет - апгрейд/перенос', {
      fontFamily: fontStyle,
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(10001);

    // ── Ability buttons — right edge, below top bar ─────────────────────────
    this.ultimateButton = this.buildAbilityButton(GAME_WIDTH - 40, 96, '🎫', '', 'ultimate-tap');
    this.shieldButton   = this.buildAbilityButton(GAME_WIDTH - 40, 160, '🛡️', '', 'shield-tap');

    // ── "Start Wave" button ───────────────────────────────────────────
    const swX = TOOLBAR_WIDTH + (GAME_WIDTH - TOOLBAR_WIDTH) / 2; // center of play area
    const swY = 120;
    const swBg = scene.add.circle(0, 0, 32, 0x27ae60, 0.95);
    swBg.setStrokeStyle(3, 0xffffff, 0.9);
    const swIcon = scene.add.text(0, 0, '▶️', { fontSize: '24px' }).setOrigin(0.5);
    this.startWaveButton = scene.add.container(swX, swY, [swBg, swIcon])
      .setDepth(10001)
      .setInteractive(new Phaser.Geom.Circle(0, 0, 36), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit('start-wave-tap'));
    this.startWaveText = scene.add.text(swX, swY + 46, '', {
      fontFamily: fontStyle, fontSize: '15px', color: '#ffffff', fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(10001);
    scene.tweens.add({
      targets: this.startWaveButton,
      scaleX: 1.12, scaleY: 1.12,
      duration: 500,
      yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.startWaveButton.setVisible(false);
    this.startWaveText.setVisible(false);
  }

  // ── Public API ────────────────────────────────────────────────────────
  
  public setMoney(amount: number): void {
    this.topBar.setMoney(amount);
  }

  public pulseMoney(color: string): void {
    this.topBar.pulseMoney(color);
  }

  public setInbox(tasks: readonly Task[], limit: number): void {
    this.topBar.setInbox(tasks);
  }

  public setWave(wave: number): void {
    this.topBar.setWave(wave);
  }

  public showStartWaveButton(nextWave: number): void {
    this.startWaveText.setText(`Готовься!\nСпринт ${nextWave}`);
    this.startWaveButton.setVisible(true);
    this.startWaveText.setVisible(true);
  }

  public hideStartWaveButton(): void {
    this.startWaveButton.setVisible(false);
    this.startWaveText.setVisible(false);
  }

  // ── Ultimate & Shield ───────────────────────────────────────────────

  public setUltimateCharge(fraction: number): void {
    this.redrawChargeRing(this.ultimateButton.ring, fraction, 0xe74c3c);
  }

  public setUltimateReady(ready: boolean): void {
    this.setButtonReady(this.ultimateButton, ready, 0xe74c3c, 0xff7675);
  }

  public setShieldCharge(fraction: number): void {
    this.redrawChargeRing(this.shieldButton.ring, fraction, 0x4a7a9b);
  }

  public setShieldReady(ready: boolean): void {
    this.setButtonReady(this.shieldButton, ready, 0x4a7a9b, 0x7ab8d4);
  }

  // ── Toolbar ─────────────────────────────────────────────────────────

  public updateSlot(index: number, selected: boolean, disabled: boolean): void {
    this.toolbar.updateSlot(index, selected, disabled);
  }

  public setTowerSelect(index: number, stats: TowerVariantStats): void {
    // Toolbar handles info bg and text
    this.toolbar.setTowerSelect(index, stats);
    // Also we need to highlight the slot in toolbar
    // Let's implement updateToolbarHighlight in toolbar
    for (let i = 0; i < 9; i++) {
      this.toolbar.updateSlot(i, i === index, false);
    }
  }

  public setFurnitureSelect(index: number, stats: FurnitureTypeStats, left: number): void {
    this.toolbar.setFurnitureSelect(index, stats, left);
    for (let i = 0; i < 9; i++) {
      this.toolbar.updateSlot(i, i === index, left <= 0);
    }
  }

  public hideSelect(): void {
    this.toolbar.hideSelect();
    for (let i = 0; i < 9; i++) {
      this.toolbar.updateSlot(i, false, false);
    }
  }

  // ── Game Over ───────────────────────────────────────────────────────

  public showGameOver(earnedMetaCurrency: number = 0): void {
    this.gameOverOverlay.show(earnedMetaCurrency);
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private buildAbilityButton(x: number, y: number, icon: string, buttonLabel: string, tapEvent: string): AbilityButton {
    const scene = this.scene;
    const fontStyle = 'Inter, system-ui, sans-serif';

    const radius = 20;
    const bg = scene.add.circle(0, 0, radius, 0x1e2a3a, 0.9);
    bg.setStrokeStyle(2, 0x4a7a9b, 0.6);

    const ring = scene.add.graphics();
    const t = scene.add.text(0, 0, icon, { fontSize: '18px' }).setOrigin(0.5);
    const container = this.scene.add.container(x, y, [bg, ring, t])
      .setDepth(10001)
      .setInteractive(new Phaser.Geom.Circle(0, 0, radius + 4), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit(tapEvent));
      
    if (buttonLabel) {
      this.scene.add.text(x, y + radius + 10, buttonLabel, {
        fontFamily: fontStyle, fontSize: '11px', color: '#ecf0f1', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10001);
    }
    
    return { container, bg, ring };
  }

  private redrawChargeRing(ring: Phaser.GameObjects.Graphics, fraction: number, color: number): void {
    ring.clear();
    if (fraction <= 0) return;
    ring.lineStyle(3, color, 1);
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * Math.min(1, fraction);
    ring.beginPath();
    ring.arc(0, 0, 22, start, end, false);
    ring.strokePath();
  }

  private setButtonReady(button: AbilityButton, ready: boolean, readyFill: number, readyStroke: number): void {
    button.bg.setFillStyle(ready ? readyFill : 0x1e2a3a, 0.9);
    button.bg.setStrokeStyle(3, ready ? readyStroke : 0x4a7a9b, 1);
    this.scene.tweens.killTweensOf(button.container);
    if (ready) {
      this.scene.tweens.add({
        targets: button.container, scaleX: 1.15, scaleY: 1.15,
        duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else {
      button.container.setScale(1);
    }
  }
}
