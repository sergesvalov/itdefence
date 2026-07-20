import Phaser from 'phaser';
import { 
  GAME_WIDTH, GAME_HEIGHT, TOOLBAR_WIDTH,
  TOWER_VARIANTS_DATA, TOWER_VARIANT_KEYS,
  FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS
} from '../config';
import { IconRenderer } from '../rendering/IconRenderer';

export interface ToolbarSlot {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  updateState: (selected: boolean, disabled: boolean) => void;
}

export class Toolbar {
  private toolbarSlots: ToolbarSlot[] = [];
  private toolbarInfoText: Phaser.GameObjects.Text;
  private toolbarInfoBg: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private events: Phaser.Events.EventEmitter) {
    const items = [
      ...TOWER_VARIANT_KEYS.map(key => ({ ...TOWER_VARIANTS_DATA[key], type: 'tower' })),
      ...FURNITURE_TYPE_KEYS.map(key => ({ ...FURNITURE_TYPES_DATA[key], type: 'furniture' }))
    ];

    const slotSize = 60;
    const gap = 8;
    const x = TOOLBAR_WIDTH / 2;
    const startY = 140 + slotSize / 2;

    const dockBg = scene.add.graphics();
    dockBg.fillStyle(0x1a2430, 1);
    dockBg.fillRect(0, 0, TOOLBAR_WIDTH, GAME_HEIGHT);
    dockBg.lineStyle(2, 0x4a7a9b, 0.5);
    dockBg.beginPath();
    dockBg.moveTo(TOOLBAR_WIDTH, 0);
    dockBg.lineTo(TOOLBAR_WIDTH, GAME_HEIGHT);
    dockBg.strokePath();
    dockBg.setDepth(10000);

    const infoY = GAME_HEIGHT - 65;
    this.toolbarInfoBg = scene.add.graphics().setDepth(10000);
    this.toolbarInfoBg.fillStyle(0x1e2a3a, 0.95);
    
    // Position it correctly to the right of the toolbar
    const bgWidth = GAME_WIDTH - TOOLBAR_WIDTH - 24;
    const bgX = TOOLBAR_WIDTH + 12;
    this.toolbarInfoBg.fillRoundedRect(bgX, infoY - 18, bgWidth, 36, 8);
    this.toolbarInfoBg.lineStyle(2, 0x4a7a9b, 0.6);
    this.toolbarInfoBg.strokeRoundedRect(bgX, infoY - 18, bgWidth, 36, 8);
    this.toolbarInfoBg.setVisible(false);

    const centerX = TOOLBAR_WIDTH + (GAME_WIDTH - TOOLBAR_WIDTH) / 2;
    this.toolbarInfoText = scene.add.text(centerX, infoY, '', {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px', color: '#7ab8d4', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10001);

    items.forEach((item, index) => {
      const cy = startY + index * (slotSize + gap);
      
      const bg = scene.add.graphics();
      bg.fillStyle(0x2c3e50, 1);
      bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
      
      const variantOrType = item.type === 'tower' ? (item as any).variant : (item as any).type;
      const icon = IconRenderer.drawIcon(scene, 0, -8, item.type as 'tower' | 'furniture', variantOrType, 20);
      
      const priceText = item.type === 'tower' ? `${(item as any).cost} 💰` : 'FREE';
      const priceColor = item.type === 'tower' ? '#f1c40f' : '#2ecc71';
      const price = scene.add.text(0, 18, priceText, { 
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', color: priceColor, fontStyle: 'bold' 
      }).setOrigin(0.5);

      const container = scene.add.container(x, cy, [bg, icon, price])
        .setDepth(10001)
        .setInteractive(new Phaser.Geom.Rectangle(-slotSize/2, -slotSize/2, slotSize, slotSize), Phaser.Geom.Rectangle.Contains)
        .on('pointerdown', () => this.events.emit('select-index', index));

      this.toolbarSlots.push({
        container,
        bg,
        updateState: (selected: boolean, disabled: boolean) => {
          bg.clear();
          if (selected) {
            bg.fillStyle(0x2a3a4a, 1);
            bg.fillRoundedRect(-slotSize/2, -slotSize/2, slotSize, slotSize, 8);
            bg.lineStyle(3, 0xfbbf24, 0.9);
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

  public updateSlot(index: number, selected: boolean, disabled: boolean): void {
    if (this.toolbarSlots[index]) {
      this.toolbarSlots[index].updateState(selected, disabled);
    }
  }

  public setTowerSelect(index: number, stats: any): void {
    const text = `Выбрано: ${stats.label} (Урон: ${stats.damage || 0}, ${stats.cost} 💰)`;
    this.toolbarInfoText.setText(text);
    this.toolbarInfoBg.setVisible(true);
  }

  public setFurnitureSelect(index: number, stats: any, left: number): void {
    const text = `Выбрано: ${stats.label} (Осталось: ${left} из ${stats.maxCount})`;
    this.toolbarInfoText.setText(text);
    this.toolbarInfoBg.setVisible(true);
  }

  public hideSelect(): void {
    this.toolbarInfoText.setText('');
    this.toolbarInfoBg.setVisible(false);
  }
}
