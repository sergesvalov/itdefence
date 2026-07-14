import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    // Background
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);

    // Title
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 4, 'IT DEFENCE', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      color: '#3498db',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const startY = GAME_HEIGHT / 2;
    const spacing = 80;

    this.createButton(GAME_WIDTH / 2, startY, 'СТАРТ', 0x2ecc71, () => {
      this.scene.start('MainScene');
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing, 'МАГАЗИН', 0x9b59b6, () => {
      this.scene.start('UpgradeScene');
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing * 2, 'ВЫХОД', 0xe74c3c, () => {
      // In a browser, window.close() might not work if it wasn't opened by a script.
      // We'll just show an alert or attempt to close.
      if (window.confirm("Вы точно хотите выйти?")) {
        window.close();
      }
    });
  }

  private createButton(x: number, y: number, text: string, color: number, onClick: () => void) {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 240, 60, color).setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, text, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    btn.add([bg, txt]);

    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
    bg.on('pointerdown', onClick);
  }
}
