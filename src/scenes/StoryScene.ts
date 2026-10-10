import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export interface StoryData {
  title: string;
  pages: string[];
  /** Label of the button on the last page */
  finalLabel: string;
  /** Small line under the text on the last page (e.g. the reward) */
  footer?: string;
  nextScene: string;
  nextData?: object;
}

const FONT = 'Inter, system-ui, sans-serif';

/** Paged story text between levels: the book's chapter, a few lines at a time. */
export class StoryScene extends Phaser.Scene {
  private story!: StoryData;
  private page = 0;
  private body!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private dots!: Phaser.GameObjects.Graphics;
  private buttonLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('StoryScene');
  }

  init(data: StoryData): void {
    this.story = data;
    this.page = 0;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);

    if (this.textures.exists('sprite-avatar-petya')) {
      this.add.image(52, 70, 'sprite-avatar-petya').setDisplaySize(64, 64);
    }
    this.add.text(96, 70, this.story.title, {
      fontFamily: FONT, fontSize: '24px', color: '#fbbf24', fontStyle: 'bold',
      wordWrap: { width: GAME_WIDTH - 120 },
    }).setOrigin(0, 0.5);

    const rule = this.add.graphics();
    rule.lineStyle(2, 0x4a7a9b, 0.5);
    rule.lineBetween(28, 118, GAME_WIDTH - 28, 118);

    this.body = this.add.text(28, 146, '', {
      fontFamily: FONT, fontSize: '19px', color: '#ecf0f1',
      wordWrap: { width: GAME_WIDTH - 56 }, lineSpacing: 9,
    });

    this.footer = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 168, '', {
      fontFamily: FONT, fontSize: '17px', color: '#2ecc71', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.dots = this.add.graphics();

    const buttonY = GAME_HEIGHT - 84;
    const bg = this.add.rectangle(GAME_WIDTH / 2, buttonY, 240, 60, 0x27ae60).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(3, 0xffffff, 0.25);
    this.buttonLabel = this.add.text(GAME_WIDTH / 2, buttonY, '', {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    bg.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());

    if (this.story.pages.length > 1) {
      this.add.text(GAME_WIDTH - 24, 24, 'Пропустить', {
        fontFamily: FONT, fontSize: '14px', color: '#7f8c8d',
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.finish());
    }

    this.showPage();
  }

  private showPage(): void {
    const { pages, finalLabel, footer } = this.story;
    const last = this.page === pages.length - 1;

    this.body.setText(pages[this.page]).setAlpha(0);
    this.tweens.add({ targets: this.body, alpha: 1, duration: 250 });
    this.footer.setText(last && footer ? footer : '');
    this.buttonLabel.setText(last ? finalLabel : 'ДАЛЬШЕ');

    this.dots.clear();
    const gap = 16;
    const startX = GAME_WIDTH / 2 - ((pages.length - 1) * gap) / 2;
    pages.forEach((_, i) => {
      this.dots.fillStyle(i === this.page ? 0xfbbf24 : 0x4a5a70, 1);
      this.dots.fillCircle(startX + i * gap, GAME_HEIGHT - 134, i === this.page ? 5 : 4);
    });
  }

  private advance(): void {
    if (this.page < this.story.pages.length - 1) {
      this.page++;
      this.showPage();
    } else {
      this.finish();
    }
  }

  private finish(): void {
    this.scene.start(this.story.nextScene, this.story.nextData);
  }
}
