import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GAME_WIDTH, GAME_HEIGHT, initLayout } from './config';

initLayout();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1e2a3a',
  parent: 'game-container',
  scene: [MainMenuScene, UpgradeScene, MainScene],
  render: {
    antialias: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
