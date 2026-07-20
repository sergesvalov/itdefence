import Phaser from 'phaser';
import { EventBus } from '../events/EventBus';
import { MetaProgression } from './MetaProgression';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TutorialManager {
  private overlay!: Phaser.GameObjects.Container;
  private currentStep = 0;
  private arrowTween: Phaser.Tweens.Tween | null = null;
  private hintText!: Phaser.GameObjects.Text;
  private textBg!: Phaser.GameObjects.Rectangle;
  private arrow!: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    const meta = MetaProgression.get();
    if (meta.tutorialCompleted) return;

    this.overlay = scene.add.container(0, 0).setDepth(100);
    
    // Dim background slightly for focus
    const bg = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.3).setOrigin(0);
    this.overlay.add(bg);

    // Text background banner for better contrast
    this.textBg = scene.add.rectangle(GAME_WIDTH / 2 + 42, GAME_HEIGHT / 2 - 50, GAME_WIDTH - 84, 130, 0x000000, 0.75).setOrigin(0.5);
    this.overlay.add(this.textBg);

    this.hintText = scene.add.text(GAME_WIDTH / 2 + 42, GAME_HEIGHT / 2 - 50, '', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 320 },
      padding: { x: 15, y: 15 },
      lineSpacing: 10
    }).setOrigin(0.5);

    this.arrow = scene.add.text(0, 0, '👇', { fontSize: '48px' }).setOrigin(0.5);

    this.overlay.add([this.hintText, this.arrow]);

    this.showStep1();

    EventBus.on('furniture_moved', this.onFurnitureMoved, this);
    EventBus.on('tower_built', this.onTowerBuilt, this);
    
    scene.events.once('shutdown', () => {
      EventBus.off('furniture_moved', this.onFurnitureMoved, this);
      EventBus.off('tower_built', this.onTowerBuilt, this);
    });
  }

  private animateArrow(x: number, y: number, offsetX: number, offsetY: number) {
    this.arrow.setPosition(x, y);
    if (this.arrowTween) this.arrowTween.stop();
    this.arrowTween = this.scene.tweens.add({
      targets: this.arrow,
      x: x + offsetX,
      y: y + offsetY,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private showStep1() {
    this.currentStep = 1;
    this.hintText.setText('Перетяни любой шкаф, чтобы освободить место для защиты!');
    this.hintText.setPosition(GAME_WIDTH / 2 + 42, GAME_HEIGHT / 2 - 50);
    this.textBg.setPosition(GAME_WIDTH / 2 + 42, GAME_HEIGHT / 2 - 50);
    this.arrow.setRotation(0);
    this.animateArrow(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 0, 20);
  }

  private onFurnitureMoved() {
    if (this.currentStep === 1) {
      this.showStep2();
    }
  }

  private showStep2() {
    this.currentStep = 2;
    // Remove background dim for gameplay
    (this.overlay.list[0] as Phaser.GameObjects.Rectangle).setFillStyle(0x000000, 0);
    
    this.hintText.setText('Отлично!\nТеперь выбери башню слева и поставь её на карту!');
    // Move text up to avoid overlapping the desk
    this.hintText.setPosition(GAME_WIDTH / 2 + 42, 180);
    this.textBg.setPosition(GAME_WIDTH / 2 + 42, 180);
    
    // Point to the toolbar (left side). +90 degrees rotates 👇 to 👈
    this.arrow.setRotation(Math.PI / 2); 
    // Start slightly right of the first slot (which is around x=42, y=85) and point left
    this.animateArrow(110, 85, -20, 0); 
  }

  private onTowerBuilt() {
    if (this.currentStep === 2) {
      this.completeTutorial();
    }
  }

  private completeTutorial() {
    this.currentStep = 3;
    this.overlay.destroy();
    if (this.arrowTween) this.arrowTween.stop();
    
    const meta = MetaProgression.get();
    meta.tutorialCompleted = true;
    MetaProgression.save();
  }
}
