import Phaser from 'phaser';
import { Coworker, type Waypoint } from '../entities/Coworker';
import type { CoworkerVariant } from '../config';
import type { Furniture } from '../entities/Furniture';
import type { ToolTower } from '../entities/ToolTower';
import {
  SPAWN_DOORS, type DoorDef,
  SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX,
  OFFICE_Y_TOP, DESK_X, DESK_Y,
  WAVE_MONEY_AMOUNT, ENEMIES_PER_WAVE_BASE, ENEMIES_PER_WAVE_GROWTH,
  URGENT_TASK_CHANCE, WAVE_HP_GROWTH, WAVE_HP_GROWTH_SQ, COWORKER_VARIANTS,
  DUPLICATE_HP_FRACTION, DUPLICATE_BOUNTY,

} from '../config';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import { showFloatingText, showBanner } from '../ui/FloatingText';
import { EventBus, GameEvents } from '../events/EventBus';

import { Pathfinder } from './Pathfinder';
import type { LevelDef } from '../campaign/act1';

export class WaveManager {
  public readonly enemies: Coworker[] = [];

  private wave = 1;
  private spawnedThisWave = 0;
  private isPaused = false;
  private spawnTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    private economy: Economy,
    private hud: HUD,
    private doorSprites: Map<DoorDef, Phaser.GameObjects.Image | null>,
    private isDoorShielded: () => boolean,
    private getFurniture: () => Furniture[],
    private getTowers: () => ToolTower[],
    /** Campaign level being played, or null for the endless mode */
    private level: LevelDef | null = null,
  ) {
    this.scheduleNextSpawn();
    this.hud.setWave(this.wave, this.level?.waves);
    this.hud.on('start-wave-tap', () => this.startNextWave());
    
    EventBus.on('furniture_changed', this.recalculatePaths, this);
    EventBus.on(GameEvents.COWORKER_KILLED, this.onCoworkerKilled, this);
    this.scene.events.once('shutdown', () => {
      EventBus.off('furniture_changed', this.recalculatePaths, this);
      EventBus.off(GameEvents.COWORKER_KILLED, this.onCoworkerKilled, this);
    });
  }

  public recalculatePaths(): void {
    const furniture = this.getFurniture();
    const pf = new Pathfinder(furniture);
    for (const cw of this.enemies) {
      if (cw.isDead || cw.hasReachedDesk) continue;
      if (cw.variant === 'remote') continue; // remote ignores furniture
      const path = pf.findPath(cw.x, cw.y, DESK_X, DESK_Y - 70);
      if (path) {
        cw.setWaypoints(path);
      }
    }
  }

  private buildPath(startX: number, startY: number, variant: CoworkerVariant): Waypoint[] {
    if (variant === 'remote') {
      return [
        { x: startX, y: startY },
        { x: DESK_X, y: DESK_Y - 70 },
      ];
    }
    
    const pf = new Pathfinder(this.getFurniture());
    return pf.findPath(startX, startY, DESK_X, DESK_Y - 70) || [
      { x: startX, y: startY },
      { x: startX, y: OFFICE_Y_TOP },
      { x: DESK_X, y: OFFICE_Y_TOP },
      { x: DESK_X, y: DESK_Y - 70 },
    ];
  }

  public getWave(): number { return this.wave; }
  public getIsPaused(): boolean { return this.isPaused; }

  update(delta: number): void {
    const furniture = this.getFurniture();
    const towers = this.getTowers();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const cw = this.enemies[i];
      cw.tick(delta, furniture, towers);

      if (cw.hasReachedDesk && !cw.isDead) {
        if (this.isDoorShielded()) {
          cw.blockAtDoor();
          continue;
        }
        const { urgent } = cw;
        cw.isDead = true;
        cw.setVisible(false);
        cw.destroy();
        this.enemies.splice(i, 1);
        EventBus.emit(GameEvents.TASK_ARRIVED, urgent);
      } else if (cw.isDead) {
        this.enemies.splice(i, 1);
      }
    }

    if (this.isPaused) return;

    if (this.spawnedThisWave >= this.enemiesPerWave() ) {
      // Whole batch is out — wait for the field to clear, then end the wave.
      if (this.enemies.length === 0) this.completeWave();
      return;
    }

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnCoworker();
      this.scheduleNextSpawn();
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────

  /** Wave number as far as difficulty goes: later chapters start further along the curve */
  private get tier(): number {
    return this.wave + (this.level?.difficulty ?? 0);
  }

  private enemiesPerWave(): number {
    return ENEMIES_PER_WAVE_BASE + this.tier * ENEMIES_PER_WAVE_GROWTH;
  }

  private scheduleNextSpawn(): void {
    this.spawnTimer = Phaser.Math.Between(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
    // Faster in later waves
    const waveSpeed = Math.max(0.45, 1 - (this.tier - 1) * 0.08);
    this.spawnTimer *= waveSpeed;
  }

  private spawnCoworker(): void {
    const door = SPAWN_DOORS[Phaser.Math.Between(0, SPAWN_DOORS.length - 1)];
    const urgent = Math.random() < URGENT_TASK_CHANCE;
    
    let variant: CoworkerVariant = 'normal';
    // Boss waves open with the boss: every 5th wave, or the level's own list
    const bossWave = this.level ? !!this.level.bossWaves?.includes(this.wave) : this.wave % 5 === 0;
    if (this.spawnedThisWave === 0 && bossWave) {
      variant = this.level?.bossVariant ?? 'boss';
    } else {
      const roll = Math.random();
      const tier = this.tier;
      if (tier >= 6 && roll < 0.2) variant = 'remote';
      else if (tier >= 4 && roll < 0.3) variant = 'tank';
      else if (tier >= 3 && roll < 0.5) variant = 'fast';
      else if (tier >= 2 && roll < 0.65) variant = 'swarm';
      if (this.level && !this.level.variants.includes(variant)) variant = 'normal';
    }

    let problem: string | undefined;
    if (this.level) {
      problem = COWORKER_VARIANTS[variant].boss && this.level.bossProblem
        ? this.level.bossProblem
        : Phaser.Utils.Array.GetRandom(this.level.problems);
    }

    const n = this.tier - 1;
    const hpScale = 1 + n * WAVE_HP_GROWTH + n * n * WAVE_HP_GROWTH_SQ;
    // Some records are spelled with «ё» and will fall apart into duplicates
    const dup = this.level?.duplicates;
    let duplicateNames: [string, string] | null = null;
    if (dup && !COWORKER_VARIANTS[variant].boss && Math.random() < dup.chance) {
      const [original, a, b] = Phaser.Utils.Array.GetRandom(dup.names);
      problem = original;
      duplicateNames = [a, b];
    }

    const cw = new Coworker(this.scene, this.buildPath(door.x, door.y, variant), urgent, variant, hpScale, problem, !!duplicateNames);
    cw.duplicateNames = duplicateNames;
    this.enemies.push(cw);
    this.spawnedThisWave++;

    // Animate the door opening
    const doorSprite = this.doorSprites.get(door);
    if (doorSprite && this.scene.textures.exists('sprite-door-open')) {
      doorSprite.setTexture('sprite-door-open');
      this.scene.time.delayedCall(400, () => {
        if (doorSprite.active) doorSprite.setTexture('sprite-door');
      });
    }
  }

  // ── Wave loop & money ─────────────────────────────────────────────────

  private onCoworkerKilled(cw: Coworker): void {
    this.economy.earn(cw.bounty);
    showFloatingText(this.scene, cw.x, cw.y - 30, `+${cw.bounty} 💰`, '#f1c40f');
    if (cw.duplicateNames) this.resolveDuplicates(cw, cw.duplicateNames);
  }

  /**
   * A «ё» record was closed. Docs (the script) merges it cleanly; anything
   * else leaves two duplicate records walking on from the same spot.
   */
  private resolveDuplicates(cw: Coworker, names: [string, string]): void {
    if (cw.killedByPiercing) {
      showFloatingText(this.scene, cw.x, cw.y - 48, 'Дубли слиты', '#a29bfe');
      return;
    }
    showFloatingText(this.scene, cw.x, cw.y - 48, 'Дубль!', '#a29bfe');
    names.forEach((name, i) => {
      const x = cw.x + (i === 0 ? -14 : 14);
      const copy = new Coworker(
        this.scene, this.buildPath(x, cw.y, cw.variant), false, cw.variant,
        cw.hpScale * DUPLICATE_HP_FRACTION, name,
      );
      copy.bounty = DUPLICATE_BOUNTY;
      this.enemies.push(copy);
    });
  }

  private completeWave(): void {
    this.economy.earn(WAVE_MONEY_AMOUNT);
    showFloatingText(this.scene, DESK_X, DESK_Y - 40, `+${WAVE_MONEY_AMOUNT} 💰`, '#2ecc71');

    this.isPaused = true;
    if (this.level && this.wave >= this.level.waves) {
      EventBus.emit(GameEvents.LEVEL_COMPLETE);
      return;
    }
    this.hud.showStartWaveButton(this.wave + 1);
  }

  private startNextWave(): void {
    if (!this.isPaused) return;
    this.wave++;
    this.spawnedThisWave = 0;
    this.isPaused = false;
    for (const t of this.getTowers()) {
      if (t.variant === 'partner') t.rest();
    }
    this.hud.hideStartWaveButton();
    this.hud.setWave(this.wave, this.level?.waves);
    showBanner(this.scene, `Спринт ${this.wave}`);
    this.scheduleNextSpawn();
    EventBus.emit(GameEvents.WAVE_STARTED, this.wave);
  }
}
