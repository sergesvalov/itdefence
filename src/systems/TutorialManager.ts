import Phaser from 'phaser';
import { EventBus } from '../events/EventBus';
import { MetaProgression } from './MetaProgression';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TutorialManager {
  private overlay!: Phaser.GameObjects.Container;
  private currentStep: 'init' | 'step_intro' | 'wait_for_enemy' | 'step_furniture' | 'step_tower' | 'completed' = 'init';
  private arrowTween: Phaser.Tweens.Tween | null = null;
  private hintText!: Phaser.GameObjects.Text;
  private textBg!: Phaser.GameObjects.Graphics;
  private arrow!: Phaser.GameObjects.Graphics;
  private dimBg!: Phaser.GameObjects.Rectangle;
  private avatar!: Phaser.GameObjects.Image;
  private okBtn!: Phaser.GameObjects.Container;

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
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'left',
      wordWrap: { width: 280 },
      padding: { x: 20, y: 20 },
      lineSpacing: 8
    }).setOrigin(0, 0.5);

    // Avatar
    this.avatar = scene.add.image(0, 0, 'sprite-avatar-petya').setDisplaySize(80, 80).setOrigin(0, 0.5);
    this.overlay.add(this.avatar);

    // Custom drawn arrow (chevron)
    this.arrow = scene.add.graphics();
    this.drawArrow();
    this.arrow.setVisible(false);

    // OK Button
    const okBg = scene.add.rectangle(0, 0, 140, 40, 0x27ae60).setInteractive({ useHandCursor: true });
    okBg.setStrokeStyle(2, 0xffffff);
    const okTxt = scene.add.text(0, 0, 'ПОНЯТНО', { fontFamily: 'Inter, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.okBtn = scene.add.container(0, 0, [okBg, okTxt]);
    this.okBtn.setVisible(false);
    
    okBg.on('pointerdown', () => {
      if (this.currentStep === 'step_intro') {
        this.currentStep = 'wait_for_enemy';
        this.okBtn.setVisible(false);
        this.hintText.setVisible(false);
        this.avatar.setVisible(false);
        this.textBg.setVisible(false);
        this.dimBg.setVisible(false);
      }
    });

    this.overlay.add([this.hintText, this.arrow, this.okBtn]);

    this.showIntro();

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

  private updateText(text: string, x: number, y: number, showAvatar = false): void {
    this.hintText.setText(text);

    if (showAvatar) {
      this.avatar.setVisible(true);
      this.avatar.setPosition(x, y);
      this.hintText.setPosition(x + 100, y);
    } else {
      this.avatar.setVisible(false);
      this.hintText.setPosition(x, y);
    }

    // Update dynamic background
    const bounds = this.hintText.getBounds();
    this.textBg.clear();
    this.textBg.fillStyle(0x000000, 0.85);
    this.textBg.lineStyle(2, 0x3498db, 1);
    
    if (showAvatar) {
      const avBounds = this.avatar.getBounds();
      const bgX = avBounds.x - 10;
      const bgY = Math.min(avBounds.y, bounds.y) - 10;
      const bgW = avBounds.width + bounds.width + 30;
      const bgH = Math.max(avBounds.height, bounds.height) + 20;
      this.textBg.fillRoundedRect(bgX, bgY, bgW, bgH, 12);
      this.textBg.strokeRoundedRect(bgX, bgY, bgW, bgH, 12);
    } else {
      this.textBg.fillRoundedRect(bounds.x - 10, bounds.y - 10, bounds.width + 20, bounds.height + 20, 12);
      this.textBg.strokeRoundedRect(bounds.x - 10, bounds.y - 10, bounds.width + 20, bounds.height + 20, 12);
    }
  }

  private animateArrow(x: number, y: number, angle: number, offsetX: number, offsetY: number): void {
    this.arrow.setVisible(true);
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

  private showIntro(): void {
    this.currentStep = 'step_intro';
    const centerX = 50;
    const centerY = GAME_HEIGHT / 2 - 80;
    
    this.updateText('Я — Петя, сисадмин.\nКонец спринта, и коллеги несут горящие таски!\nЕсли они дойдут до моего стола — я сгорю на работе.\nНужно срочно строить защиту!', centerX, centerY, true);
    
    this.okBtn.setVisible(true);
    this.okBtn.setPosition(GAME_WIDTH / 2, centerY + 120);
  }

  public get isPaused(): boolean {
    return this.currentStep === 'step_intro' || this.currentStep === 'step_furniture' || this.currentStep === 'step_tower';
  }

  public update(enemies: import('../entities/Coworker').Coworker[]): void {
    if (this.currentStep === 'wait_for_enemy') {
      if (enemies.length > 0 && enemies[0].y > 200) {
        this.showStep1();
      }
    }
  }

  private showStep1(): void {
    this.currentStep = 'step_furniture';
    this.dimBg.setVisible(true);
    this.textBg.setVisible(true);
    this.hintText.setVisible(true);
    this.okBtn.setVisible(false);
    this.hintText.setAlign('center'); // switch to center alignment for the rest
    this.hintText.setOrigin(0.5);

    const centerX = GAME_WIDTH / 2 + 42;
    const centerY = GAME_HEIGHT / 2 - 50;
    
    this.updateText('Смотри, идут задачи!\nВыбери шкаф слева и кликни на поле,\nчтобы преградить им путь!', centerX, centerY, false);
    
    // Cabinet is index 6 in the toolbar. y = 170 + 6 * 68 = 578
    this.animateArrow(130, 578, Math.PI / 2, -25, 0);
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
