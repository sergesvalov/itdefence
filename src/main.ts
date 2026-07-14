import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1e2a3a',
  parent: 'game-container',
  scene: [UpgradeScene, MainScene],
  render: {
    antialias: true,
    pixelArt: false,
  },
  // Portrait canvas at a fixed logical size — scale it to fit whatever
  // viewport the phone/browser actually gives us, keeping the aspect ratio
  // and centering it, instead of rendering at a fixed pixel size.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
