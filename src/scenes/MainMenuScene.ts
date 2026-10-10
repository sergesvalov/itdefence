import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { preloadTextures } from '../rendering/textures';

import { MetaProgression } from '../systems/MetaProgression';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  preload(): void {
    preloadTextures(this);
  }

  create() {
    // Background
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);

    // Title
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.1, 'IT DEFENCE', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      color: '#fbbf24',
      fontStyle: 'bold',
      stroke: '#0e1a26',
      strokeThickness: 6
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.1 + 48, 'Защити свой стол от горящих дедлайнов!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#ecf0f1',
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: GAME_WIDTH - 40 }
    }).setOrigin(0.5);

    // Scene: Petya at his desk, coworkers closing in from both sides
    const artY = GAME_HEIGHT * 0.36;
    this.add.ellipse(GAME_WIDTH / 2, artY + 70, 380, 60, 0x0e1a26, 0.5);
    this.addArt(GAME_WIDTH / 2 - 150, artY - 10, 'sprite-coworker-fast', 120);
    this.addArt(GAME_WIDTH / 2 + 150, artY - 20, 'sprite-coworker-boss', 140);
    this.addArt(GAME_WIDTH / 2, artY, 'sprite-desk', 190);

    const startY = GAME_HEIGHT / 2 + 30;
    const spacing = 75;

    this.createButton(GAME_WIDTH / 2, startY, 'КАМПАНИЯ', 0x27ae60, () => {
      this.scene.start('CampaignScene');
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing, 'ОБУЧЕНИЕ', 0xf39c12, () => {
      const meta = MetaProgression.get();
      meta.tutorialCompleted = false;
      MetaProgression.save();
      this.scene.start('MainScene', { levelId: null });
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing * 2, 'СВОБОДНАЯ ИГРА', 0x8e6bbf, () => {
      this.scene.start('MainScene', { levelId: null });
    });

    this.createButton(GAME_WIDTH / 2, startY + spacing * 3, 'МАГАЗИН', 0x4a7a9b, () => {
      this.scene.start('UpgradeScene');
    });

    // In a browser window.close() only works for script-opened windows; it matters for the desktop build.
    this.add.text(GAME_WIDTH - 20, 24, 'Выход', {
      fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#95a5a6',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (window.confirm('Вы точно хотите выйти?')) window.close();
    });
  }

  /** Adds a sprite scaled to `height` px, keeping its proportions. */
  private addArt(x: number, y: number, key: string, height: number): void {
    if (!this.textures.exists(key)) return;
    const img = this.add.image(x, y, key);
    img.setScale(height / img.height);
  }

  private createButton(x: number, y: number, text: string, color: number, onClick: () => void) {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 240, 60, color).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(3, 0xffffff, 0.25);
    const txt = this.add.text(0, 0, text, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    btn.add([bg, txt]);

    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
    bg.on('pointerdown', onClick);
  }
}
