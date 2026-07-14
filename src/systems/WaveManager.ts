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
  URGENT_TASK_CHANCE,
  GAME_WIDTH, GAME_HEIGHT,
} from '../config';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import { showFloatingText } from '../ui/FloatingText';
import { EventBus, GameEvents } from '../events/EventBus';

import { Pathfinder } from './Pathfinder';

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
  ) {
    this.scheduleNextSpawn();
    this.hud.setWave(this.wave);
    this.hud.on('start-wave-tap', () => this.startNextWave());
    
    EventBus.on('furniture_changed', () => this.recalculatePaths());
  }

  public recalculatePaths(): void {
    const furniture = this.getFurniture();
    const pf = new Pathfinder(furniture);
    for (const cw of this.enemies) {
      if (cw.isDead || cw.hasReachedDesk) continue;
      const path = pf.findPath(cw.x, cw.y, DESK_X, DESK_Y);
      if (path) {
        cw.setWaypoints(path);
      }
    }
  }

  private buildPath(startX: number, startY: number): Waypoint[] {
    const pf = new Pathfinder(this.getFurniture());
    return pf.findPath(startX, startY, DESK_X, DESK_Y) || [
      { x: startX, y: startY },
      { x: startX, y: OFFICE_Y_TOP },
      { x: DESK_X, y: OFFICE_Y_TOP },
      { x: DESK_X, y: DESK_Y },
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

  private enemiesPerWave(): number {
    return ENEMIES_PER_WAVE_BASE + this.wave * ENEMIES_PER_WAVE_GROWTH;
  }

  private scheduleNextSpawn(): void {
    this.spawnTimer = Phaser.Math.Between(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
    // Faster in later waves
    const waveSpeed = Math.max(0.45, 1 - (this.wave - 1) * 0.08);
    this.spawnTimer *= waveSpeed;
  }

  private spawnCoworker(): void {
    const door = SPAWN_DOORS[Phaser.Math.Between(0, SPAWN_DOORS.length - 1)];
    const urgent = Math.random() < URGENT_TASK_CHANCE;
    
    let variant: CoworkerVariant = 'normal';
    // Every 5th wave starts with a Boss!
    if (this.spawnedThisWave === 0 && this.wave % 5 === 0) {
      variant = 'boss';
    } else {
      const roll = Math.random();
      if (this.wave >= 4 && roll < 0.15) variant = 'tank';
      else if (this.wave >= 3 && roll < 0.35) variant = 'fast';
      else if (this.wave >= 2 && roll < 0.5) variant = 'swarm';
    }

    const cw = new Coworker(this.scene, this.buildPath(door.x, door.y), urgent, variant);
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

  private completeWave(): void {
    this.economy.earn(WAVE_MONEY_AMOUNT);
    showFloatingText(this.scene, DESK_X, DESK_Y - 40, `+${WAVE_MONEY_AMOUNT} 💰`, '#2ecc71');

    this.isPaused = true;
    this.hud.showStartWaveButton(this.wave + 1);
  }

  private startNextWave(): void {
    if (!this.isPaused) return;
    this.wave++;
    this.spawnedThisWave = 0;
    this.isPaused = false;
    this.hud.hideStartWaveButton();
    this.hud.setWave(this.wave);
    this.showWaveAnnouncement();
    this.scheduleNextSpawn();
  }

  private showWaveAnnouncement(): void {
    const txt = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, `⚠️ WAVE ${this.wave}`, {
      fontSize: '34px', fontStyle: 'bold', color: '#ffeaa7',
      stroke: '#2d3436', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    this.scene.tweens.add({
      targets: txt,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 110,
      duration: 1800,
      ease: 'Quad.Out',
      onComplete: () => txt.destroy(),
    });
  }
}
