import Phaser from 'phaser';
import { MAX_TASKS, STARTING_MONEY, TEXTURE_ASSETS } from '../config';
import { drawMap } from '../rendering/MapRenderer';
import { HUD } from '../ui/HUD';
import { Economy } from '../systems/Economy';
import { TowerPlacer } from '../systems/TowerPlacer';
import { WaveManager } from '../systems/WaveManager';
import { Ultimate } from '../systems/Ultimate';
import { Shield } from '../systems/Shield';

/**
 * MainScene — thin coordinator. Owns overall game/round state (game-over,
 * task counter) and wires together the modules that do the actual work:
 *  - MapRenderer: draws the static map once
 *  - HUD: on-screen stats panel + Game Over overlay
 *  - Economy: money
 *  - TowerPlacer: placement/upgrade input and the towers list
 *  - WaveManager: spawning, enemy list, wave/kill progress, salary
 *  - Ultimate: "Создай тикет" — the charged global strike
 *  - Shield: "Я на митинге" — temporary door invulnerability
 */
export class MainScene extends Phaser.Scene {
  private hud!: HUD;
  private economy!: Economy;
  private towerPlacer!: TowerPlacer;
  private waveManager!: WaveManager;
  private ultimate!: Ultimate;
  private shield!: Shield;

  private tasksOnDesk = 0;
  private isGameOver = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  preload(): void {
    // Textures are optional — see TEXTURE_ASSETS in config.ts and the
    // README files under public/assets/. Files that don't exist yet just
    // 404 quietly; MapRenderer falls back to programmatic graphics for
    // whichever slots aren't loaded.
    for (const asset of TEXTURE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    // scene.restart() re-runs create() on the same Scene instance, so
    // resetting state here (rather than in a separate "reset" method) is
    // what keeps a new round from inheriting the previous one's — every
    // module below is freshly constructed too.
    this.tasksOnDesk = 0;
    this.isGameOver = false;

    drawMap(this);

    this.hud = new HUD(this, STARTING_MONEY, MAX_TASKS);
    this.economy = new Economy(this.hud, STARTING_MONEY);
    this.towerPlacer = new TowerPlacer(this, this.economy, this.hud);
    this.waveManager = new WaveManager(
      this, this.economy, this.hud,
      () => this.onTaskReachedDesk(),
      () => this.shield.isActive,
    );
    this.ultimate = new Ultimate(this, this.hud, () => this.waveManager.enemies);
    this.shield = new Shield(this, this.hud, () => this.waveManager.enemies);

    this.input.keyboard?.on('keydown-R', () => { if (this.isGameOver) this.restartGame(); });
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    this.shield.update(delta);
    this.waveManager.update(delta);
    this.towerPlacer.tick(delta, this.waveManager.enemies);
    this.ultimate.update(delta);
  }

  // ──────────────────────────────────────────────────────────────────────
  // GAME LOGIC
  // ──────────────────────────────────────────────────────────────────────

  private onTaskReachedDesk(): void {
    this.tasksOnDesk++;
    this.hud.setTasks(this.tasksOnDesk, MAX_TASKS);
    if (this.tasksOnDesk >= MAX_TASKS) this.triggerGameOver();
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.towerPlacer.enabled = false;
    this.ultimate.enabled = false;
    this.shield.enabled = false;
    console.log('Game Over – Petya is overwhelmed by tasks!');
    this.hud.showGameOver();
    this.cameras.main.shake(600, 0.012);
  }

  private restartGame(): void {
    // Destroy this run's Phaser objects — create() (re-run by scene.restart())
    // rebuilds everything else fresh.
    for (const cw of this.waveManager.enemies) cw.destroy();
    for (const t  of this.towerPlacer.towers) t.destroy();
    this.scene.restart();
  }
}
