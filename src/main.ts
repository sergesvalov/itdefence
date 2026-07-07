import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1e2a3a',
  parent: 'game-container',
  scene: [MainScene],
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);
