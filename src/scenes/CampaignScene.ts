import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { ACT1_LEVELS, ACT1_TITLE, type LevelDef } from '../campaign/act1';
import { MetaProgression } from '../systems/MetaProgression';
import type { StoryData } from './StoryScene';

const FONT = 'Inter, system-ui, sans-serif';
const ROW_HEIGHT = 58;
const ROW_GAP = 6;

/** Chapter list for the act: cleared chapters, the next one, and locked ones. */
export class CampaignScene extends Phaser.Scene {
  constructor() {
    super('CampaignScene');
  }

  create(): void {
    MetaProgression.load();
    const cleared = MetaProgression.get().campaignCleared;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, 44, ACT1_TITLE, {
      fontFamily: FONT, fontSize: '22px', color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 74, `Пройдено глав: ${Math.min(cleared, ACT1_LEVELS.length)} из ${ACT1_LEVELS.length}`, {
      fontFamily: FONT, fontSize: '14px', color: '#bdc3c7',
    }).setOrigin(0.5);

    ACT1_LEVELS.forEach((level, i) => {
      this.addRow(level, i, 104 + i * (ROW_HEIGHT + ROW_GAP), cleared);
    });

    const backY = GAME_HEIGHT - 44;
    const back = this.add.rectangle(GAME_WIDTH / 2, backY, 200, 48, 0x4a7a9b).setInteractive({ useHandCursor: true });
    back.setStrokeStyle(3, 0xffffff, 0.25);
    this.add.text(GAME_WIDTH / 2, backY, 'В МЕНЮ', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  private addRow(level: LevelDef, index: number, top: number, cleared: number): void {
    const done = index < cleared;
    const open = index <= cleared;
    const width = GAME_WIDTH - 32;
    const midY = top + ROW_HEIGHT / 2;

    const bg = this.add.graphics();
    bg.fillStyle(open ? 0x2c3e50 : 0x243140, 1);
    bg.fillRoundedRect(16, top, width, ROW_HEIGHT, 10);
    bg.lineStyle(2, done ? 0x2ecc71 : open ? 0xfbbf24 : 0x3b4a5c, open ? 0.9 : 0.6);
    bg.strokeRoundedRect(16, top, width, ROW_HEIGHT, 10);

    const badge = this.add.circle(48, midY, 18, done ? 0x2ecc71 : open ? 0xfbbf24 : 0x3b4a5c);
    badge.setStrokeStyle(2, 0x1a2330);
    this.add.text(48, midY, done ? '✓' : `${index + 1}`, {
      fontFamily: FONT, fontSize: '18px', color: '#1a2330', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(78, midY - 12, level.title, {
      fontFamily: FONT, fontSize: '17px', color: open ? '#ffffff' : '#7f8c8d', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(78, midY + 12, open ? level.teaser : 'Сначала пройди предыдущую главу', {
      fontFamily: FONT, fontSize: '12px', color: open ? '#bdc3c7' : '#5d6d7e',
    }).setOrigin(0, 0.5);

    if (!open) return;
    this.add.zone(16, top, width, ROW_HEIGHT).setOrigin(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.startLevel(level));
  }

  private startLevel(level: LevelDef): void {
    const story: StoryData = {
      title: level.title,
      avatar: level.avatar && `sprite-avatar-${level.avatar}`,
      pages: level.intro,
      finalLabel: 'НАЧАТЬ',
      nextScene: 'MainScene',
      nextData: { levelId: level.id },
    };
    this.scene.start('StoryScene', story);
  }
}
