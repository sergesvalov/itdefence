import Phaser from 'phaser';
import { INBOX_LIMIT, INBOX_RESOLVE_INTERVAL_MS, STARTING_MONEY } from '../config';
import { drawMap } from '../rendering/MapRenderer';
import { preloadTextures, ensureGeneratedTextures } from '../rendering/textures';
import { HUD } from '../ui/HUD';
import { Economy } from '../systems/Economy';
import { TowerPlacer } from '../systems/TowerPlacer';
import { TowerManager } from '../systems/TowerManager';
import { WaveManager } from '../systems/WaveManager';
import { Ultimate } from '../systems/Ultimate';
import { Shield } from '../systems/Shield';
import { TutorialManager } from '../systems/TutorialManager';
import { SoundFX } from '../systems/SoundFX';
import { Inbox } from '../systems/Inbox';
import { EventBus, GameEvents } from '../events/EventBus';
import { MetaProgression } from '../systems/MetaProgression';
import { GameSpeed } from '../systems/GameSpeed';
import { setAllowedBuilds } from '../systems/BuildLocks';
import { ACT1_LEVELS, getLevel, type LevelDef } from '../campaign/act1';
import { showBanner } from '../ui/FloatingText';
import type { StoryData } from './StoryScene';

/**
 * MainScene — thin coordinator. Owns overall game/round state (game-over)
 * and wires together the modules that do the actual work.
 */
export class MainScene extends Phaser.Scene {
  private hud!: HUD;
  private economy!: Economy;
  private towerManager!: TowerManager;
  private towerPlacer!: TowerPlacer;
  private waveManager!: WaveManager;
  private ultimate!: Ultimate;
  private shield!: Shield;
  private inbox!: Inbox;
  private tutorialManager?: TutorialManager;
  public isGameOver = false;
  /** Campaign level being played, or null for the endless mode */
  private level: LevelDef | null = null;
  private levelComplete = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  init(data: { levelId?: string | null }): void {
    this.level = getLevel(data?.levelId ?? undefined);
  }

  preload(): void {
    preloadTextures(this);
  }

  create(): void {
    this.isGameOver = false;
    this.levelComplete = false;
    setAllowedBuilds(this.level?.build ?? null);
    SoundFX.init();
    ensureGeneratedTextures(this);
    
    MetaProgression.load();
    const meta = MetaProgression.get();
    const startMoney = (this.level?.startMoney ?? STARTING_MONEY) + meta.moneyLevel * 50;
    const maxInbox = INBOX_LIMIT + meta.inboxLevel * 2;

    const doorSprites = drawMap(this);

    this.hud = new HUD(this, startMoney, maxInbox);
    this.setGameSpeed(1);
    this.economy = new Economy(this.hud, startMoney);
    
    this.towerManager = new TowerManager(this);
    this.towerManager.sleepyTowers = !!this.level?.sleepyTowers;
    this.towerPlacer = new TowerPlacer(this, this.economy, this.hud, this.towerManager);
    if (this.level) this.towerPlacer.partnerLimitOverride = this.level.partnerLimit ?? 0;
    
    // Spawn initial barricade furniture
    this.towerManager.autoSpawnFurniture(3, 
      (x, y, radius) => this.towerPlacer.isPlacementValid(x, y, radius) && this.towerPlacer.isInOffice(x, y),
      (val) => this.towerPlacer.snap(val)
    );
    this.towerPlacer.refreshHudSelection();

    this.inbox = new Inbox(this, this.hud, maxInbox, INBOX_RESOLVE_INTERVAL_MS);
    
    EventBus.on(GameEvents.GAME_OVER, this.triggerGameOver, this);
    EventBus.on(GameEvents.WAVE_STARTED, this.onWaveStarted, this);
    EventBus.on(GameEvents.LEVEL_COMPLETE, this.onLevelComplete, this);
    this.events.once('shutdown', () => {
      EventBus.off(GameEvents.GAME_OVER, this.triggerGameOver, this);
      EventBus.off(GameEvents.WAVE_STARTED, this.onWaveStarted, this);
      EventBus.off(GameEvents.LEVEL_COMPLETE, this.onLevelComplete, this);
    });

    this.waveManager = new WaveManager(
      this, this.economy, this.hud, doorSprites,
      () => this.shield.isActive,
      () => this.towerManager.furniture,
      () => this.towerManager.towers,
      this.level,
    );
    this.towerPlacer.getWave = () => this.waveManager.getWave();
    this.towerPlacer.isPaused = () => this.waveManager.getIsPaused();
    this.ultimate = new Ultimate(this, this.hud, () => this.waveManager.enemies);
    this.shield = new Shield(this, this.hud, () => this.waveManager.enemies);
    
    this.tutorialManager = this.level ? undefined : new TutorialManager(this);

    this.hud.on('speed-tap', () => {
      if (!this.isGameOver) this.setGameSpeed(GameSpeed.value === 1 ? 2 : 1);
    });

    const leave = () => {
      if (this.isGameOver) this.scene.start(this.level ? 'CampaignScene' : 'MainMenuScene');
    };
    this.hud.on('restart-tap', leave);
    this.input.keyboard?.on('keydown-R', leave);
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.levelComplete) return;
    
    if (this.tutorialManager) {
      this.tutorialManager.update(this.waveManager.enemies);
      if (this.tutorialManager.isPaused) return;
    }

    delta *= GameSpeed.value;

    this.shield.update(delta);
    this.waveManager.update(delta);
    this.towerManager.tick(delta, this.waveManager.enemies, this.towerPlacer.carrying);
    this.ultimate.update(delta);
    this.inbox.update(delta);
  }

  // ──────────────────────────────────────────────────────────────────────
  // GAME LOGIC
  // ──────────────────────────────────────────────────────────────────────

  private setGameSpeed(speed: number): void {
    GameSpeed.value = speed;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
    this.hud.setSpeed(speed);
  }

  /** Story events: on some waves the priciest tower is taken away. */
  private onWaveStarted(wave: number): void {
    const loss = this.level?.towerLoss?.find(l => l.wave === wave);
    if (!loss) return;

    const victim = this.towerManager.towers
      .filter(t => t !== this.towerPlacer.carrying)
      .sort((a, b) => b.getSellValue() - a.getSellValue())[0];
    if (!victim) return;

    this.towerPlacer.closeMenu();
    this.towerManager.removeTower(victim);
    showBanner(this, loss.message, '#ff7675');
    this.cameras.main.shake(300, 0.01);
    this.tweens.add({
      targets: victim,
      alpha: 0, scale: 0.3, angle: 25,
      duration: 500,
      ease: 'Quad.In',
      onComplete: () => victim.destroy(),
    });
  }

  private onLevelComplete(): void {
    if (!this.level || this.levelComplete || this.isGameOver) return;
    this.levelComplete = true;
    const level = this.level;

    this.setGameSpeed(1);
    this.towerPlacer.enabled = false;
    this.towerPlacer.closeMenu();
    this.ultimate.enabled = false;
    this.shield.enabled = false;

    MetaProgression.completeLevel(ACT1_LEVELS.indexOf(level));
    MetaProgression.earnMoney(level.reward);
    showBanner(this, 'Глава пройдена!', '#55efc4');

    const story: StoryData = {
      title: level.title,
      pages: level.outro,
      finalLabel: 'ДАЛЬШЕ',
      footer: `Премия: +${level.reward} 💰`,
      nextScene: 'CampaignScene',
    };
    this.time.delayedCall(1800, () => this.scene.start('StoryScene', story));
  }

  private triggerGameOver(): void {
    if (this.isGameOver || this.levelComplete) return;
    this.isGameOver = true;

    const wave = this.waveManager.getWave();
    const earnedMeta = this.level ? 0 : wave * 10;
    MetaProgression.earnMoney(earnedMeta);

    this.setGameSpeed(1);
    this.towerPlacer.enabled = false;
    this.towerPlacer.closeMenu();
    this.ultimate.enabled = false;
    this.shield.enabled = false;
    this.hud.showGameOver(earnedMeta);
    this.cameras.main.shake(600, 0.012);
    
    // Fade to black behind HUD
    const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000)
      .setOrigin(0)
      .setDepth(9000)
      .setAlpha(0);
    this.tweens.add({
      targets: bg,
      alpha: 0.8,
      duration: 1500,
      ease: 'Quad.Out'
    });
  }
}
