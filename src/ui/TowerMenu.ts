import Phaser from 'phaser';
import { GAME_WIDTH, TOOLBAR_WIDTH, OFFICE_Y_TOP, TOWER_VARIANTS_DATA } from '../config';
import { TOWER_SIZE, type ToolTower } from '../entities/ToolTower';

export type TowerMenuAction = 'upgrade' | 'sell' | 'move';

interface MenuButton {
  action: TowerMenuAction | null;
  rect: Phaser.Geom.Rectangle;
}

const BUTTON_HEIGHT = 32;
const BUTTON_GAP = 6;

/**
 * Small action row that pops up next to a tapped tower: upgrade / sell
 * (/ move, for the partner desk between waves). Purely visual plus
 * hit-testing — TowerPlacer owns the input and decides what each action does.
 */
export class TowerMenu {
  public tower: ToolTower | null = null;
  private container: Phaser.GameObjects.Container | null = null;
  private buttons: MenuButton[] = [];

  constructor(private scene: Phaser.Scene) {}

  get isOpen(): boolean {
    return this.tower !== null;
  }

  public open(tower: ToolTower, opts: { canAfford: boolean; canMove: boolean }): void {
    this.close();
    this.tower = tower;
    tower.view.setRangeVisible(true);

    const defs: { action: TowerMenuAction | null; label: string; color: number }[] = [];
    if (tower.canUpgrade()) {
      defs.push({ action: 'upgrade', label: `⬆ ${tower.getUpgradeCost()} 💰`, color: opts.canAfford ? 0x27ae60 : 0x5d6d7e });
    } else {
      defs.push({ action: null, label: 'MAX', color: 0x5d6d7e });
    }
    defs.push({ action: 'sell', label: `Продать +${tower.getSellValue()}`, color: 0xc0392b });
    if (opts.canMove) defs.push({ action: 'move', label: '✋', color: 0x4a7a9b });

    const texts = defs.map(d => this.scene.add.text(0, 0, d.label, {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    const widths = texts.map(t => Math.ceil(t.width) + 20);
    const total = widths.reduce((a, b) => a + b, 0) + BUTTON_GAP * (defs.length - 1);

    const radius = TOWER_VARIANTS_DATA[tower.variant].radius || TOWER_SIZE;
    let top = tower.y - radius - BUTTON_HEIGHT - 10;
    if (top < OFFICE_Y_TOP + 6) top = tower.y + radius + 20;
    let left = Phaser.Math.Clamp(tower.x - total / 2, TOOLBAR_WIDTH + 6, GAME_WIDTH - 6 - total);

    const gfx = this.scene.add.graphics();
    this.buttons = [];
    defs.forEach((d, i) => {
      const rect = new Phaser.Geom.Rectangle(left, top, widths[i], BUTTON_HEIGHT);
      gfx.fillStyle(0x0e1a26, 0.5);
      gfx.fillRoundedRect(rect.x + 1, rect.y + 3, rect.width, rect.height, 8);
      gfx.fillStyle(d.color, 1);
      gfx.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 8);
      gfx.lineStyle(2, 0xffffff, 0.85);
      gfx.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 8);
      texts[i].setPosition(rect.centerX, rect.centerY);
      this.buttons.push({ action: d.action, rect });
      left += widths[i] + BUTTON_GAP;
    });

    this.container = this.scene.add.container(0, 0, [gfx, ...texts]).setDepth(10002);
  }

  /** Which action (if any) sits under this point. */
  public hit(x: number, y: number): TowerMenuAction | null {
    for (const b of this.buttons) {
      if (b.rect.contains(x, y)) return b.action;
    }
    return null;
  }

  public close(): void {
    if (this.tower?.scene) this.tower.view.setRangeVisible(false);
    this.tower = null;
    this.buttons = [];
    this.container?.destroy();
    this.container = null;
  }
}
