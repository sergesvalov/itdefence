import Phaser from 'phaser';
import { 
  GAME_WIDTH, GAME_HEIGHT, 
  TOWER_VARIANTS_DATA, TOWER_VARIANT_KEYS, 
  FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS,
  type TowerVariantStats, type FurnitureTypeStats 
} from '../config';
import type { Task } from '../systems/Inbox';

interface AbilityButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
}

interface ToolbarSlot {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  updateState: (selected: boolean, disabled: boolean) => void;
}

/**
 * HUD — the top-left stats panel, the two ability buttons (ultimate +
 * shield), left vertical toolbar dock for selecting towers, and BSOD Game Over overlay.
 */
export class HUD extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private moneyText: Phaser.GameObjects.Text;
  private inboxCountText: Phaser.GameObjects.Text;
  private inboxQueueGraphics: Phaser.GameObjects.Graphics;
  private waveText: Phaser.GameObjects.Text;
  
  // Toolbar state
  private toolbarSlots: ToolbarSlot[] = [];
  private toolbarInfoText!: Phaser.GameObjects.Text;
  private toolbarInfoBg!: Phaser.GameObjects.Graphics;

  private gameOverOverlay: Phaser.GameObjects.Container;
  private ultimateButton: AbilityButton;
  private shieldButton: AbilityButton;
  private startWaveButton: Phaser.GameObjects.Container;
  private startWaveText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, startingMoney: number, inboxLimit: number) {
    super();
    this.scene = scene;
    const pad = 12;

    const fontStyle = 'Inter, system-ui, sans-serif';
    const textStyle = { fontFamily: fontStyle, fontSize: '16px', color: '#ecf0f1' };
    const boldStyle = { ...textStyle, fontStyle: 'bold' };

    // ── Corporate Dashboard (Top Bar) ───────────────────────
    const hudBg = scene.add.graphics();
    hudBg.fillStyle(0x1e2a3a, 0.9);
    hudBg.fillRect(0, 0, GAME_WIDTH, 56);
    hudBg.lineStyle(2, 0x3498db, 0.6);
    hudBg.beginPath();
    hudBg.moveTo(0, 56);
    hudBg.lineTo(GAME_WIDTH, 56);
    hudBg.strokePath();
    hudBg.setDepth(15);

    // Money
    this.moneyText = scene.add.text(12, 10, `💰 0`, {
      ...boldStyle, color: '#f1c40f', fontSize: '18px'
    }).setDepth(16);
    this.setMoney(startingMoney);

    // Inbox counter
    this.inboxCountText = scene.add.text(80, 12, `📥 0 / ${inboxLimit}`, {
      ...boldStyle, fontSize: '13px'
    }).setDepth(16);

    // Inbox queue (graphics)
    this.inboxQueueGraphics = scene.add.graphics().setDepth(16);
    // Draw initial empty circles
    this.setInbox([], inboxLimit);

    // Wave indicator (Top-Center)
    this.waveText = scene.add.text(GAME_WIDTH / 2, 28, '', { ...boldStyle, fontSize: '18px', color: '#3498db' })
      .setOrigin(0.5)
      .setDepth(16);

    // ── Left Vertical Toolbar (Dock) ───────────────────────────────────
    this.buildToolbar();
    
    // Hint text (at the very bottom)
    const hintBg = scene.add.graphics();
    hintBg.fillStyle(0x000000, 0.5);
    hintBg.fillRect(0, GAME_HEIGHT - 28, GAME_WIDTH, 28);
    hintBg.setDepth(14);
    
    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 14, 'Тап: кабинет — строить, предмет — апгрейд/переместить', {
      fontFamily: fontStyle,
      fontSize: '14px',
      color: '#bdc3c7',
    }).setOrigin(0.5).setDepth(16);

    // ── Ability buttons — top-right corner ──────────────────────────────
    this.ultimateButton = this.buildAbilityButton(GAME_WIDTH - 80, 28, '🎫', '', 'ultimate-tap');
    this.shieldButton   = this.buildAbilityButton(GAME_WIDTH - 30, 28, '🛡️', '', 'shield-tap');

    // ── "Start Wave" button ───────────────────────────────────────────
    const swX = GAME_WIDTH - 76;
    const swY = 136;
    const swBg = scene.add.circle(0, 0, 32, 0x27ae60, 0.95);
    swBg.setStrokeStyle(3, 0xffffff, 0.9);
    const swIcon = scene.add.text(0, 0, '▶️', { fontSize: '24px' }).setOrigin(0.5);
    this.startWaveButton = scene.add.container(swX, swY, [swBg, swIcon])
      .setDepth(17)
      .setInteractive(new Phaser.Geom.Circle(0, 0, 36), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit('start-wave-tap'));
    this.startWaveText = scene.add.text(swX, swY + 42, '', {
      fontFamily: fontStyle, fontSize: '14px', color: '#2ecc71', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(17);
    scene.tweens.add({
      targets: this.startWaveButton,
      scaleX: 1.12, scaleY: 1.12,
      duration: 500,
      yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.startWaveButton.setVisible(false);
    this.startWaveText.setVisible(false);

    // ── Game Over overlay (BSOD style) ────────────────────────────────
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.gameOverOverlay.setVisible(false);
    this.gameOverOverlay.setDepth(50);
  }

  private buildToolbar(): void {
    const scene = this.scene;
    const items = [
      ...TOWER_VARIANT_KEYS.map(key => ({ ...TOWER_VARIANTS_DATA[key], type: 'tower' })),
      ...FURNITURE_TYPE_KEYS.map(key => ({ ...FURNITURE_TYPES_DATA[key], type: 'furniture' }))
    ];

    const slotSize = 60;
    const gap = 8;
    // Left edge layout
    const x = 12 + slotSize / 2;
    const startY = 140 + slotSize / 2;

    const totalHeight = items.length * slotSize + (items.length - 1) * gap;

    const dockBg = scene.add.graphics();
    dockBg.fillStyle(0x1e2a3a, 0.9);
    dockBg.fillRoundedRect(x - slotSize / 2 - 8, startY - slotSize / 2 - 8, slotSize + 16, totalHeight + 16, 12);
    dockBg.lineStyle(2, 0x3498db, 0.6);
    dockBg.strokeRoundedRect(x - slotSize / 2 - 8, startY - slotSize / 2 - 8, slotSize + 16, totalHeight + 16, 12);
    dockBg.setDepth(15);

    // Toolbar info text (placed near the bottom of the screen)
    const infoY = GAME_HEIGHT - 65;
    this.toolbarInfoBg = scene.add.graphics().setDepth(15);
    this.toolbarInfoBg.fillStyle(0x1e2a3a, 0.95);
    this.toolbarInfoBg.fillRoundedRect(GAME_WIDTH / 2 - 180, infoY - 14, 360, 28, 6);
    this.toolbarInfoBg.lineStyle(2, 0x3498db, 0.8);
    this.toolbarInfoBg.strokeRoundedRect(GAME_WIDTH / 2 - 180, infoY - 14, 360, 28, 6);
    this.toolbarInfoBg.setVisible(false);

    this.toolbarInfoText = scene.add.text(GAME_WIDTH / 2, infoY, '', {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', color: '#3498db', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(16);

    items.forEach((item, index) => {
      const cy = startY + index * (slotSize + gap);
      
      const bg = scene.add.graphics();
      bg.fillStyle(0x2c3e50, 1);
      bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
      
      const icon = scene.add.text(0, -8, item.icon, { fontSize: '28px' }).setOrigin(0.5);
      const priceText = item.type === 'tower' ? `💰${(item as any).cost}` : '🆓';
      const price = scene.add.text(0, 16, priceText, { 
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', color: '#f1c40f', fontStyle: 'bold' 
      }).setOrigin(0.5);

      const container = scene.add.container(x, cy, [bg, icon, price])
        .setDepth(16)
        .setInteractive(new Phaser.Geom.Rectangle(-slotSize/2, -slotSize/2, slotSize, slotSize), Phaser.Geom.Rectangle.Contains)
        .on('pointerdown', () => this.emit('select-index', index));

      this.toolbarSlots.push({
        container,
        bg,
        updateState: (selected: boolean, disabled: boolean) => {
          bg.clear();
          if (selected) {
            bg.fillStyle(0x34495e, 1);
            bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            bg.lineStyle(3, 0x3498db, 1);
            bg.strokeRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            container.setScale(1.1);
          } else {
            bg.fillStyle(0x2c3e50, disabled ? 0.5 : 1);
            bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            bg.lineStyle(2, 0x7f8c8d, 0.5);
            bg.strokeRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            container.setScale(1.0);
            container.setAlpha(disabled ? 0.5 : 1);
          }
        }
      });
    });
  }

  setMoney(amount: number): void {
    this.moneyText.setText(`💰 ${amount}`);
  }

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

  setInbox(tasks: readonly Task[], limit: number): void {
    this.inboxCountText.setText(`📥 ${tasks.length}/${limit}`);
    
    this.inboxQueueGraphics.clear();
    const startX = 82;
    const startY = 36;
    const spacing = 12;
    
    for (let i = 0; i < limit; i++) {
      const task = tasks[i];
      const cx = startX + i * spacing;
      if (task) {
        this.inboxQueueGraphics.fillStyle(task.urgent ? 0xe74c3c : 0xf1c40f, 1);
        this.inboxQueueGraphics.fillCircle(cx, startY, 4);
      } else {
        this.inboxQueueGraphics.lineStyle(2, 0x7f8c8d, 0.6);
        this.inboxQueueGraphics.strokeCircle(cx, startY, 3.5);
      }
    }

    this.scene.tweens.add({
      targets: this.inboxCountText,
      scaleX: 1.15, scaleY: 1.15,
      duration: 120, yoyo: true,
      onStart: () => this.inboxCountText.setColor('#e74c3c'),
      onComplete: () => this.inboxCountText.setColor('#ecf0f1'),
    });
  }

  setWave(wave: number): void {
    this.waveText.setText(`Спринт ${wave}`);
  }

  showStartWaveButton(nextWave: number): void {
    this.startWaveText.setText(`Готовься!\nСпринт ${nextWave}`);
    this.startWaveButton.setVisible(true);
    this.startWaveText.setVisible(true);
  }

  hideStartWaveButton(): void {
    this.startWaveButton.setVisible(false);
    this.startWaveText.setVisible(false);
  }

  setTowerSelect(index: number, stats: TowerVariantStats): void {
    this.updateToolbarHighlight(index);
    this.toolbarInfoBg.setVisible(true);
    this.toolbarInfoText.setText(`${stats.icon} ${stats.label} — Урон: ${stats.damage || 0}, Дальность: ${stats.range || 0}`);
  }

  setFurnitureSelect(index: number, stats: FurnitureTypeStats, left: number): void {
    this.updateToolbarHighlight(index, left <= 0);
    this.toolbarInfoBg.setVisible(true);
    this.toolbarInfoText.setText(`${stats.icon} ${stats.label} — На складе: ${left} / ${stats.maxCount}`);
  }

  private updateToolbarHighlight(selectedIndex: number, disabled = false): void {
    this.toolbarSlots.forEach((slot, idx) => {
      slot.updateState(idx === selectedIndex, idx === selectedIndex ? disabled : false);
    });
  }

  showGameOver(earnedMeta: number = 0): void {
    this.gameOverOverlay.setVisible(true);
    if ((this as any).earnedMetaText) {
      (this as any).earnedMetaText.setText(`Получено премии: ${earnedMeta} 💰`);
    }
  }

  setUltimateCharge(fraction: number): void {
    this.redrawChargeRing(this.ultimateButton.ring, fraction, 0xe74c3c);
  }

  setUltimateReady(ready: boolean): void {
    this.setButtonReady(this.ultimateButton, ready, 0xe74c3c, 0xff7675);
  }

  setShieldCharge(fraction: number): void {
    this.redrawChargeRing(this.shieldButton.ring, fraction, 0x3498db);
  }

  setShieldReady(ready: boolean): void {
    this.setButtonReady(this.shieldButton, ready, 0x3498db, 0x74b9ff);
  }

  private buildAbilityButton(x: number, y: number, icon: string, buttonLabel: string, tapEvent: string): AbilityButton {
    const scene = this.scene;
    const fontStyle = 'Inter, system-ui, sans-serif';

    const radius = 20;
    const bg = scene.add.circle(0, 0, radius, 0x1e2a3a, 0.9);
    bg.setStrokeStyle(2, 0x3498db, 0.8);

    const ring = scene.add.graphics();
    const t = scene.add.text(0, 0, icon, { fontSize: '18px' }).setOrigin(0.5);
    const container = scene.add.container(x, y, [bg, ring, t])
      .setDepth(16)
      .setInteractive(new Phaser.Geom.Circle(0, 0, radius + 4), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit(tapEvent));
      
    if (buttonLabel) {
      scene.add.text(x, y + radius + 10, buttonLabel, {
        fontFamily: fontStyle, fontSize: '11px', color: '#ecf0f1', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(16);
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
    button.bg.setStrokeStyle(3, ready ? readyStroke : 0x3498db, 1);
    this.scene.tweens.killTweensOf(button.container);
    if (ready) {
      this.scene.tweens.add({
        targets: button.container,
        scaleX: 1.15, scaleY: 1.15,
        duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    } else {
      button.container.setScale(1);
    }
  }

  private buildGameOverOverlay(): Phaser.GameObjects.Container {
    const scene = this.scene;
    const overlay = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    const fontStyle = 'Inter, system-ui, sans-serif';

    const veil = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0984e3, 0.95);

    const text = this.scene.add.text(0, -60, ':(', {
      fontFamily: fontStyle, fontSize: '80px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const subText = this.scene.add.text(0, 20, 'ERR_BURNOUT:\nСотрудник перестал отвечать.', {
      fontFamily: fontStyle, fontSize: '20px', color: '#ffffff', align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5);

    const hint = scene.add.text(0, 140, 'Тапните, чтобы вернуться в меню', {
      fontFamily: fontStyle, fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0.7);

    const earnedText = this.scene.add.text(0, 80, '', {
      fontFamily: fontStyle, fontSize: '24px', color: '#f1c40f', fontStyle: 'bold'
    }).setOrigin(0.5);
    (this as any).earnedMetaText = earnedText;

    scene.tweens.add({ targets: hint, alpha: 1, duration: 800, yoyo: true, repeat: -1 });

    overlay.add([veil, text, subText, hint, earnedText]);
    veil.setInteractive().on('pointerdown', () => this.emit('restart-tap'));

    return overlay;
  }
}
