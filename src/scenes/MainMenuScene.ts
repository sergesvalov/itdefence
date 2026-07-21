import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TEXTURE_ASSETS } from '../config';

import { MetaProgression } from '../systems/MetaProgression';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  preload(): void {
    for (const asset of TEXTURE_ASSETS) {
      this.load.image(asset.key, `${asset.path}?v=${Date.now()}`);
    }
  }

  create() {
    // Background
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);

    // Title
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 4 - 30, 'IT DEFENCE', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 4 + 20, 'Защити свой стол от горящих дедлайнов!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#ecf0f1',
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: GAME_WIDTH - 40 }
    }).setOrigin(0.5);

    // Background decoration
    this.add.image(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 4 + 90, 'sprite-coworker-fast').setScale(1.5).setTint(0xf39c12);
    this.add.image(GAME_WIDTH / 2 + 100, GAME_HEIGHT / 4 + 80, 'sprite-coworker-boss').setScale(1.8).setTint(0xe74c3c);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 4 + 110, 'sprite-desk').setScale(1.2);

    const startY = GAME_HEIGHT / 2 + 30;
    const spacing = 75;

    this.createButton(GAME_WIDTH / 2, startY, 'СТАРТ', 0x27ae60, () => {
      this.scene.start('MainScene');
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing, 'ОБУЧЕНИЕ', 0xf39c12, () => {
      const meta = MetaProgression.get();
      meta.tutorialCompleted = false;
      MetaProgression.save();
      this.scene.start('MainScene');
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing * 2, 'МАГАЗИН', 0x4a7a9b, () => {
      this.scene.start('UpgradeScene');
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing * 3, 'ВЫХОД', 0xe74c3c, () => {
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
