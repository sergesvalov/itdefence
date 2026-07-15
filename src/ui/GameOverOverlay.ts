import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class GameOverOverlay {
  private overlay: Phaser.GameObjects.Container;
  private earnedMetaText: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private events: Phaser.Events.EventEmitter) {
    this.overlay = scene.add.container(0, 0);

    const veil = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0000aa).setAlpha(0.85);

    const fontStyle = 'Courier, monospace';
    const text = scene.add.text(0, -80, 'A fatal exception 0E has occurred at IT:DEFENCE.', {
      fontFamily: fontStyle, fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5);

    const subText = scene.add.text(0, -20, '* Петя выгорел\n* Очередь задач переполнена\n* Проект не сдан в срок', {
      fontFamily: fontStyle, fontSize: '14px', color: '#ffffff', align: 'left',
    }).setOrigin(0.5);

    const hint = scene.add.text(0, 140, 'Тапните, чтобы вернуться в меню', {
      fontFamily: fontStyle, fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0.7);

    this.earnedMetaText = scene.add.text(0, 80, '', {
      fontFamily: fontStyle, fontSize: '24px', color: '#f1c40f', fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.tweens.add({ targets: hint, alpha: 1, duration: 800, yoyo: true, repeat: -1 });

    this.overlay.add([veil, text, subText, hint, this.earnedMetaText]);
    this.overlay.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.overlay.setVisible(false);
    this.overlay.setDepth(50);

    veil.setInteractive().on('pointerdown', () => events.emit('restart-tap'));
  }

  public show(earnedMoney: number): void {
    this.earnedMetaText.setText(`Премия: +${earnedMoney} 💰`);
    this.overlay.setVisible(true);
  }
}
