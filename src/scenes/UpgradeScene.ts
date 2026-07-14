import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { MetaProgression } from '../systems/MetaProgression';

export class UpgradeScene extends Phaser.Scene {
  private moneyText!: Phaser.GameObjects.Text;

  constructor() {
    super('UpgradeScene');
  }

  create() {
    MetaProgression.load();
    
    // Background
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);

    // Title
    this.add.text(GAME_WIDTH / 2, 80, 'МАГАЗИН', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '32px',
      color: '#f1c40f',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.moneyText = this.add.text(GAME_WIDTH / 2, 130, `Премия: ${MetaProgression.get().money} 💰`, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: '#2ecc71',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const startY = 220;
    const spacing = 120;

    this.createUpgradeRow('inboxLevel', 'Расширение Инбокса (+2 таски)', 150, startY);
    this.createUpgradeRow('moneyLevel', 'Финансовая Подушка (+50$ старт)', 150, startY + spacing);
    this.createUpgradeRow('damageLevel', 'Крепкие Нервы (+10% урон)', 150, startY + spacing * 2);

    // Back Button
    const playBtn = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 100);
    const playBg = this.add.rectangle(0, 0, 200, 60, 0x3498db).setInteractive({ useHandCursor: true });
    const playText = this.add.text(0, 0, 'НАЗАД В МЕНЮ', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    playBtn.add([playBg, playText]);
    
    playBg.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }

  private createUpgradeRow(key: 'inboxLevel' | 'moneyLevel' | 'damageLevel', label: string, price: number, y: number) {
    const data = MetaProgression.get();
    
    this.add.text(GAME_WIDTH / 2, y, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#ecf0f1'
    }).setOrigin(0.5);

    const levelText = this.add.text(GAME_WIDTH / 2, y + 30, `Уровень: ${data[key]} / 5`, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: '#bdc3c7'
    }).setOrigin(0.5);

    const btn = this.add.container(GAME_WIDTH / 2, y + 70);
    const bg = this.add.rectangle(0, 0, 140, 40, data[key] < 5 ? 0x9b59b6 : 0x7f8c8d).setInteractive({ useHandCursor: data[key] < 5 });
    const txt = this.add.text(0, 0, data[key] < 5 ? `Купить (${price} 💰)` : 'MAX', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    btn.add([bg, txt]);

    bg.on('pointerdown', () => {
      if (data[key] >= 5) return;
      if (MetaProgression.spendMoney(price)) {
        data[key]++;
        MetaProgression.save();
        levelText.setText(`Уровень: ${data[key]} / 5`);
        this.moneyText.setText(`Премия: ${MetaProgression.get().money} 💰`);
        if (data[key] >= 5) {
          bg.setFillStyle(0x7f8c8d);
          txt.setText('MAX');
        }
      } else {
        // Flash red
        this.tweens.add({
          targets: this.moneyText,
          scale: 1.2,
          duration: 100,
          yoyo: true,
          onStart: () => this.moneyText.setColor('#e74c3c'),
          onComplete: () => this.moneyText.setColor('#2ecc71')
        });
      }
    });
  }
}
