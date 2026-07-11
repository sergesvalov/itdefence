import Phaser from 'phaser';
import { INBOX_LIMIT, INBOX_RESOLVE_INTERVAL_MS, STARTING_MONEY, TEXTURE_ASSETS } from '../config';
import { drawMap } from '../rendering/MapRenderer';
import { HUD } from '../ui/HUD';
import { Economy } from '../systems/Economy';
import { TowerPlacer } from '../systems/TowerPlacer';
import { TowerManager } from '../systems/TowerManager';
import { WaveManager } from '../systems/WaveManager';
import { Ultimate } from '../systems/Ultimate';
import { Shield } from '../systems/Shield';
import { Inbox } from '../systems/Inbox';
import { EventBus, GameEvents } from '../events/EventBus';

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

  private isGameOver = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  preload(): void {
    for (const asset of TEXTURE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    this.isGameOver = false;

    const doorSprites = drawMap(this);

    this.hud = new HUD(this, STARTING_MONEY, INBOX_LIMIT);
    this.economy = new Economy(this.hud, STARTING_MONEY);
    
    this.towerManager = new TowerManager(this);
    this.towerPlacer = new TowerPlacer(this, this.economy, this.hud, this.towerManager);
    
    // Spawn initial barricade furniture
    this.towerManager.autoSpawnFurniture(10, 
      (x, y, radius) => this.towerPlacer.isPlacementValid(x, y, radius) && this.towerPlacer.isInOffice(x, y),
      (val) => this.towerPlacer.snap(val)
    );
    this.towerPlacer.refreshHudSelection();

    this.inbox = new Inbox(this, this.hud, INBOX_LIMIT, INBOX_RESOLVE_INTERVAL_MS);
    
    EventBus.on(GameEvents.GAME_OVER, this.triggerGameOver, this);
    this.events.once('shutdown', () => {
      EventBus.off(GameEvents.GAME_OVER, this.triggerGameOver, this);
    });

    this.waveManager = new WaveManager(
      this, this.economy, this.hud, doorSprites,
      () => this.shield.isActive,
      () => this.towerManager.furniture,
      () => this.towerManager.towers,
    );
    this.towerPlacer.getWave = () => this.waveManager.getWave();
    this.towerPlacer.isPaused = () => this.waveManager.getIsPaused();
    this.ultimate = new Ultimate(this, this.hud, () => this.waveManager.enemies);
    this.shield = new Shield(this, this.hud, () => this.waveManager.enemies);

    this.hud.on('restart-tap', () => { if (this.isGameOver) this.restartGame(); });
    this.input.keyboard?.on('keydown-R', () => { if (this.isGameOver) this.restartGame(); });
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    this.shield.update(delta);
    this.waveManager.update(delta);
    this.towerManager.tick(delta, this.waveManager.enemies, this.towerPlacer.carrying);
    this.ultimate.update(delta);
    this.inbox.update(delta);
  }

  // ──────────────────────────────────────────────────────────────────────
  // GAME LOGIC
  // ──────────────────────────────────────────────────────────────────────

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.towerPlacer.enabled = false;
    this.ultimate.enabled = false;
    this.shield.enabled = false;
    console.log('Game Over – the Inbox overflowed!');
    this.hud.showGameOver();
    this.cameras.main.shake(600, 0.012);
  }

  private restartGame(): void {
    for (const cw of this.waveManager.enemies) cw.destroy();
    for (const t  of this.towerManager.towers) t.destroy();
    for (const f  of this.towerManager.furniture) f.destroy();
    this.scene.restart();
  }
}
