import Phaser from 'phaser';
import { GAME_WIDTH, TOOLBAR_WIDTH } from '../config';
import type { Task } from '../systems/Inbox';

export class TopBar {
  private moneyText: Phaser.GameObjects.Text;
  private inboxCountText: Phaser.GameObjects.Text;
  private inboxQueueGraphics: Phaser.GameObjects.Graphics;
  private waveText: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, startingMoney: number, private inboxLimit: number) {
    const fontStyle = 'Inter, system-ui, sans-serif';
    const textStyle = { fontFamily: fontStyle, fontSize: '16px', color: '#ecf0f1' };
    const boldStyle = { ...textStyle, fontStyle: 'bold' };

    const hudBg = scene.add.graphics();
    hudBg.fillStyle(0x1e2a3a, 0.9);
    hudBg.fillRect(TOOLBAR_WIDTH, 0, GAME_WIDTH - TOOLBAR_WIDTH, 56);
    hudBg.lineStyle(2, 0x3498db, 0.6);
    hudBg.beginPath();
    hudBg.moveTo(TOOLBAR_WIDTH, 56);
    hudBg.lineTo(GAME_WIDTH, 56);
    hudBg.strokePath();
    hudBg.setDepth(10000);

    this.moneyText = scene.add.text(TOOLBAR_WIDTH + 24, 28, `💰 0`, {
      ...boldStyle, color: '#f1c40f', fontSize: '20px'
    }).setOrigin(0, 0.5).setDepth(10001);
    this.setMoney(startingMoney);

    const centerX = TOOLBAR_WIDTH + (GAME_WIDTH - TOOLBAR_WIDTH) / 2;
    this.waveText = scene.add.text(centerX, 28, '', { ...boldStyle, fontSize: '20px', color: '#3498db' })
      .setOrigin(0.5, 0.5)
      .setDepth(10001);

    this.inboxCountText = scene.add.text(GAME_WIDTH - 150, 18, `📥 0 / ${inboxLimit}`, {
      ...boldStyle, fontSize: '14px'
    }).setOrigin(0, 0.5).setDepth(10001);

    this.inboxQueueGraphics = scene.add.graphics().setDepth(10001);
  }

  public setMoney(amount: number): void {
    this.moneyText.setText(`💰 ${amount}`);
  }

  public pulseMoney(color: string): void {
    this.scene.tweens.add({
      targets: this.moneyText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 150,
      yoyo: true,
      onStart: () => this.moneyText.setColor(color),
      onComplete: () => this.moneyText.setColor('#f1c40f'),
    });
  }

  public setInbox(tasks: readonly Task[]): void {
    const limit = this.inboxLimit;
    this.inboxCountText.setText(`📥 ${tasks.length}/${limit}`);
    
    this.inboxQueueGraphics.clear();
    const baseX = GAME_WIDTH - 150;
    const baseY = 38;
    const spacing = 12;
    
    for (let i = 0; i < limit; i++) {
      const task = tasks[i];
      const cx = baseX + i * spacing;
      if (task) {
        this.inboxQueueGraphics.fillStyle(task.urgent ? 0xe74c3c : 0xf1c40f, 1);
        this.inboxQueueGraphics.fillCircle(cx, baseY, 4);
      } else {
        this.inboxQueueGraphics.lineStyle(2, 0x7f8c8d, 0.6);
        this.inboxQueueGraphics.strokeCircle(cx, baseY, 3.5);
      }
    }

    this.scene.tweens.add({
      targets: this.inboxCountText,
      scaleX: 1.15, scaleY: 1.15,
      duration: 120, yoyo: true,
      onStart: () => this.inboxCountText.setColor('#e74c3c'),
      onComplete: () => this.inboxCountText.setColor('#ecf0f1'),
    });
  }

  public setWave(wave: number): void {
    this.waveText.setText(`Спринт ${wave}`);
  }
}
