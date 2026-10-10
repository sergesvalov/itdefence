import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { ACTS, getAct, type ActDef, type LevelDef } from '../campaign';
import { MetaProgression } from '../systems/MetaProgression';
import type { StoryData } from './StoryScene';

const FONT = 'Inter, system-ui, sans-serif';
const ROW_HEIGHT = 58;
const ROW_GAP = 6;
const LIST_TOP = 122;

/** Chapter list: a tab per act, then its cleared chapters, the next one, and locked ones. */
export class CampaignScene extends Phaser.Scene {
  private act!: ActDef;

  constructor() {
    super('CampaignScene');
  }

  init(data: { actId?: string }): void {
    this.act = getAct(data?.actId);
  }

  create(): void {
    MetaProgression.load();
    const cleared = MetaProgression.getCleared(this.act.id);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1e2a3a).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, 36, this.act.title, {
      fontFamily: FONT, fontSize: '22px', color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.addTabs();

    this.act.levels.forEach((level, i) => {
      this.addRow(level, i, LIST_TOP + i * (ROW_HEIGHT + ROW_GAP), cleared);
    });

    const backY = GAME_HEIGHT - 40;
    const back = this.add.rectangle(GAME_WIDTH / 2, backY, 200, 44, 0x4a7a9b).setInteractive({ useHandCursor: true });
    back.setStrokeStyle(3, 0xffffff, 0.25);
    this.add.text(GAME_WIDTH / 2, backY, 'В МЕНЮ', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  /** One tab per act — each is a separate attempt at the same life, so all are open. */
  private addTabs(): void {
    const gap = 8;
    const width = (GAME_WIDTH - 32 - gap * (ACTS.length - 1)) / ACTS.length;
    ACTS.forEach((act, i) => {
      const active = act === this.act;
      const x = 16 + i * (width + gap);
      const done = Math.min(MetaProgression.getCleared(act.id), act.levels.length);

      const bg = this.add.graphics();
      bg.fillStyle(active ? 0x4a7a9b : 0x2c3e50, 1);
      bg.fillRoundedRect(x, 64, width, 40, 8);
      if (active) {
        bg.lineStyle(2, 0xfbbf24, 0.9);
        bg.strokeRoundedRect(x, 64, width, 40, 8);
      }
      this.add.text(x + width / 2, 84, `${act.short} · ${done}/${act.levels.length}`, {
        fontFamily: FONT, fontSize: '16px', color: active ? '#ffffff' : '#bdc3c7', fontStyle: 'bold',
      }).setOrigin(0.5);

      if (active) return;
      this.add.zone(x, 64, width, 40).setOrigin(0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('CampaignScene', { actId: act.id }));
    });
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
