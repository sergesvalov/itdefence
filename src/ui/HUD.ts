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
 * shield), bottom toolbar dock for selecting towers, and BSOD Game Over overlay.
 */
export class HUD extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private moneyText: Phaser.GameObjects.Text;
  private inboxCountText: Phaser.GameObjects.Text;
  private inboxQueueText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  
  // Toolbar state
  private toolbarSlots: ToolbarSlot[] = [];
  private toolbarInfoText!: Phaser.GameObjects.Text;

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
    const textStyle = { fontFamily: fontStyle, fontSize: '14px', color: '#ecf0f1' };
    const boldStyle = { ...textStyle, fontStyle: 'bold' };

    // ── Corporate Dashboard (Top-Left HUD panel) ───────────────────────
    const hudBg = scene.add.graphics();
    hudBg.fillStyle(0x1e2a3a, 0.85);
    hudBg.fillRoundedRect(pad, pad, 250, 100, 12);
    hudBg.lineStyle(1, 0x3498db, 0.4);
    hudBg.strokeRoundedRect(pad, pad, 250, 100, 12);
    hudBg.setDepth(15);

    // Money
    this.moneyText = scene.add.text(pad + 16, pad + 16, `💰 0`, {
      ...boldStyle, color: '#f1c40f', fontSize: '18px'
    }).setDepth(16);
    this.setMoney(startingMoney);

    // Inbox counter
    this.inboxCountText = scene.add.text(pad + 16, pad + 44, `📥 Inbox: 0 / ${inboxLimit}`, boldStyle).setDepth(16);

    // Inbox queue
    this.inboxQueueText = scene.add.text(pad + 16, pad + 66, '', { ...textStyle, fontSize: '12px', letterSpacing: 2 }).setDepth(16);

    // Wave indicator (Top-Center)
    const waveBg = scene.add.graphics();
    waveBg.fillStyle(0x1e2a3a, 0.85);
    waveBg.fillRoundedRect(GAME_WIDTH / 2 - 60, pad, 120, 32, 8);
    waveBg.lineStyle(1, 0x3498db, 0.4);
    waveBg.strokeRoundedRect(GAME_WIDTH / 2 - 60, pad, 120, 32, 8);
    waveBg.setDepth(15);

    this.waveText = scene.add.text(GAME_WIDTH / 2, pad + 16, '', { ...boldStyle, fontSize: '14px', color: '#3498db' })
      .setOrigin(0.5)
      .setDepth(16);

    // ── Bottom Toolbar (Dock) ──────────────────────────────────────────
    this.buildToolbar();
    
    // Hint text (just above toolbar)
    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 74, 'Тап: кабинет — постройка, постройка — апгрейд/перестановка', {
      fontFamily: fontStyle,
      fontSize: '11px',
      color: '#bdc3c7',
    }).setOrigin(0.5).setDepth(16).setAlpha(0.8);

    // ── Ability buttons — top-right corner ──────────────────────────────
    this.ultimateButton = this.buildAbilityButton(GAME_WIDTH - 96, 48, '🎫', 'Тикет', 'ultimate-tap');
    this.shieldButton   = this.buildAbilityButton(GAME_WIDTH - 40, 48, '🛡️', 'Митинг', 'shield-tap');

    // ── "Start Wave" button ───────────────────────────────────────────
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
      fontFamily: fontStyle, fontSize: '11px', color: '#2ecc71', fontStyle: 'bold', align: 'center',
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

    const slotSize = 44;
    const gap = 6;
    const totalWidth = items.length * slotSize + (items.length - 1) * gap;
    const startX = (GAME_WIDTH - totalWidth) / 2 + slotSize / 2;
    const y = GAME_HEIGHT - slotSize / 2 - 12;

    const dockBg = scene.add.graphics();
    dockBg.fillStyle(0x1e2a3a, 0.85);
    dockBg.fillRoundedRect((GAME_WIDTH - totalWidth) / 2 - 12, y - slotSize / 2 - 8, totalWidth + 24, slotSize + 16, 12);
    dockBg.lineStyle(1, 0x3498db, 0.4);
    dockBg.strokeRoundedRect((GAME_WIDTH - totalWidth) / 2 - 12, y - slotSize / 2 - 8, totalWidth + 24, slotSize + 16, 12);
    dockBg.setDepth(15);

    this.toolbarInfoText = scene.add.text(GAME_WIDTH / 2, y - slotSize / 2 - 20, '', {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', color: '#3498db', fontStyle: 'bold'
    }).setOrigin(0.5, 1).setDepth(16);

    items.forEach((item, index) => {
      const cx = startX + index * (slotSize + gap);
      
      const bg = scene.add.graphics();
      bg.fillStyle(0x2c3e50, 1);
      bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
      
      const icon = scene.add.text(0, -6, item.icon, { fontSize: '22px' }).setOrigin(0.5);
      const priceText = item.type === 'tower' ? `💰${(item as any).cost}` : '🆓';
      const price = scene.add.text(0, 12, priceText, { 
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', color: '#f1c40f', fontStyle: 'bold' 
      }).setOrigin(0.5);

      const container = scene.add.container(cx, y, [bg, icon, price])
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
            bg.lineStyle(2, 0x3498db, 1);
            bg.strokeRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            container.setScale(1.1);
          } else {
            bg.fillStyle(0x2c3e50, disabled ? 0.5 : 1);
            bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            bg.lineStyle(1, 0x7f8c8d, 0.5);
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
    this.inboxCountText.setText(`📥 Inbox: ${tasks.length} / ${limit}`);
    const glyphs = tasks.map(t => t ? (t.urgent ? '🔴' : '🟡') : '▫️');
    while (glyphs.length < limit) glyphs.push('▫️');
    this.inboxQueueText.setText(glyphs.join(' '));

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
    this.toolbarInfoText.setText(`${stats.icon} ${stats.label} — Урон: ${stats.damage || 0}, Радиус: ${stats.radius}`);
  }

  setFurnitureSelect(index: number, stats: FurnitureTypeStats, left: number): void {
    this.updateToolbarHighlight(index, left <= 0);
    this.toolbarInfoText.setText(`${stats.icon} ${stats.label} — Осталось: ${left}`);
  }

  private updateToolbarHighlight(selectedIndex: number, disabled = false): void {
    this.toolbarSlots.forEach((slot, idx) => {
      slot.updateState(idx === selectedIndex, idx === selectedIndex ? disabled : false);
    });
  }

  showGameOver(): void {
    this.gameOverOverlay.setVisible(true);
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

    const bg = scene.add.circle(0, 0, 22, 0x1e2a3a, 0.9);
    bg.setStrokeStyle(2, 0x3498db, 0.8);

    const ring = scene.add.graphics();
    const t = scene.add.text(0, 0, icon, { fontSize: '20px' }).setOrigin(0.5);
    const container = scene.add.container(x, y, [bg, ring, t])
      .setDepth(16)
      .setInteractive(new Phaser.Geom.Circle(0, 0, 26), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => this.emit(tapEvent));
      
    scene.add.text(x, y + 32, buttonLabel, {
      fontFamily: fontStyle, fontSize: '11px', color: '#ecf0f1', fontStyle: 'bold',
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
    button.bg.setFillStyle(ready ? readyFill : 0x1e2a3a, 0.9);
    button.bg.setStrokeStyle(2, ready ? readyStroke : 0x3498db, 1);
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

    const hint = scene.add.text(0, 100, 'Press R or Tap to reboot', {
      fontFamily: fontStyle, fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0.7);

    scene.tweens.add({ targets: hint, alpha: 1, duration: 800, yoyo: true, repeat: -1 });

    overlay.add([veil, text, subText, hint]);
    veil.setInteractive().on('pointerdown', () => this.emit('restart-tap'));

    return overlay;
  }
}
