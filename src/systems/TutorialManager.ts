import Phaser from 'phaser';
import { EventBus } from '../events/EventBus';
import { MetaProgression } from './MetaProgression';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TutorialManager {
  private overlay!: Phaser.GameObjects.Container;
  private currentStep: 'init' | 'step_furniture' | 'step_tower' | 'completed' = 'init';
  private arrowTween: Phaser.Tweens.Tween | null = null;
  private hintText!: Phaser.GameObjects.Text;
  private textBg!: Phaser.GameObjects.Graphics;
  private arrow!: Phaser.GameObjects.Graphics;
  private dimBg!: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    const meta = MetaProgression.get();
    if (meta.tutorialCompleted) return;

    this.overlay = scene.add.container(0, 0).setDepth(10000);
    
    // Dim background slightly for focus
    this.dimBg = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.4).setOrigin(0);
    this.overlay.add(this.dimBg);

    // Dynamic Text background
    this.textBg = scene.add.graphics();
    this.overlay.add(this.textBg);

    this.hintText = scene.add.text(0, 0, '', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 340 },
      padding: { x: 20, y: 20 },
      lineSpacing: 8
    }).setOrigin(0.5);

    // Custom drawn arrow (chevron)
    this.arrow = scene.add.graphics();
    this.drawArrow();

    this.overlay.add([this.hintText, this.arrow]);

    this.showStep1();

    EventBus.on('furniture_moved', this.onFurnitureMoved, this);
    EventBus.on('tower_built', this.onTowerBuilt, this);
    
    scene.events.once('shutdown', this.cleanup, this);
  }

  private drawArrow(): void {
    this.arrow.clear();
    this.arrow.fillStyle(0xf1c40f, 1);
    this.arrow.lineStyle(4, 0xd35400, 1);
    
    this.arrow.beginPath();
    this.arrow.moveTo(-20, -30);
    this.arrow.lineTo(20, -30);
    this.arrow.lineTo(0, 10);
    this.arrow.closePath();
    this.arrow.fillPath();
    this.arrow.strokePath();
  }

  private updateText(text: string, x: number, y: number): void {
    this.hintText.setText(text);
    this.hintText.setPosition(x, y);

    // Update dynamic background
    const bounds = this.hintText.getBounds();
    this.textBg.clear();
    this.textBg.fillStyle(0x000000, 0.85);
    this.textBg.lineStyle(2, 0x3498db, 1);
    this.textBg.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 12);
    this.textBg.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 12);
  }

  private animateArrow(x: number, y: number, angle: number, offsetX: number, offsetY: number): void {
    this.arrow.setPosition(x, y);
    this.arrow.setRotation(angle);
    if (this.arrowTween) this.arrowTween.stop();
    this.arrowTween = this.scene.tweens.add({
      targets: this.arrow,
      x: x + offsetX,
      y: y + offsetY,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private showStep1(): void {
    this.currentStep = 'step_furniture';
    const centerX = GAME_WIDTH / 2 + 42;
    const centerY = GAME_HEIGHT / 2 - 50;
    
    this.updateText('Смотри, идут задачи!\nПеретяни любой шкаф, чтобы освободить место для защиты!', centerX, centerY);
    this.animateArrow(centerX, centerY + 100, 0, 0, 25);
  }

  private onFurnitureMoved(): void {
    if (this.currentStep === 'step_furniture') {
      this.showStep2();
    }
  }

  private showStep2(): void {
    this.currentStep = 'step_tower';
    
    // Fade out dim background
    this.scene.tweens.add({
      targets: this.dimBg,
      alpha: 0,
      duration: 400
    });
    
    const textX = GAME_WIDTH / 2 + 42;
    const textY = 180;
    this.updateText('Отлично!\nТеперь выбери башню слева\nи поставь её на карту!', textX, textY);
    
    // Point left towards the toolbar
    this.animateArrow(130, 170, Math.PI / 2, -25, 0); 
  }

  private onTowerBuilt(): void {
    if (this.currentStep === 'step_tower') {
      this.completeTutorial();
    }
  }

  private completeTutorial(): void {
    if (this.currentStep === 'completed') return;
    this.currentStep = 'completed';
    
    const meta = MetaProgression.get();
    meta.tutorialCompleted = true;
    MetaProgression.save();

    this.cleanup();
  }

  private cleanup(): void {
    EventBus.off('furniture_moved', this.onFurnitureMoved, this);
    EventBus.off('tower_built', this.onTowerBuilt, this);
    
    if (this.arrowTween) {
      this.arrowTween.stop();
      this.arrowTween = null;
    }

    if (this.overlay && this.overlay.scene) {
      this.overlay.destroy();
    }
  }
}
