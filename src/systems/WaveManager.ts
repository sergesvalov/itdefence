import Phaser from 'phaser';
import { Coworker, type Waypoint } from '../entities/Coworker';
import type { Furniture } from '../entities/Furniture';
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

// Coworkers step down into the office, converge on the desk's column, then
// walk straight down that column to the desk.
function buildPath(door: DoorDef): Waypoint[] {
  return [
    { x: door.x, y: door.y },
    { x: door.x, y: OFFICE_Y_TOP },  // step down into the office
    { x: DESK_X, y: OFFICE_Y_TOP },  // converge on the desk's column
    { x: DESK_X, y: DESK_Y },        // walk down to the desk
  ];
}

/**
 * WaveManager — spawns coworkers, ticks them, and runs the wave loop: each
 * wave spawns a fixed batch of coworkers; once every one of them is dealt
 * with (killed or reached the desk), the wave pays out money and pauses,
 * waiting for the player to tap "Start Wave" (HUD) before the next batch
 * starts. Wave 1 starts immediately — the pause only happens *between*
 * waves, from wave 2 onward. Owns the `enemies` list that ToolTower.tick()
 * targets. Coworkers who reach the desk no longer hit Petya directly —
 * `onTaskArrived` hands their ticket off to MainScene's Inbox instead.
 */
export class WaveManager {
  public readonly enemies: Coworker[] = [];

  private wave = 1;
  private spawnedThisWave = 0;
  /** True between "wave cleared" and the player tapping Start Wave. */
  private isPaused = false;
  private spawnTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    private economy: Economy,
    private hud: HUD,
    private onTaskArrived: (urgent: boolean) => void,
    private isDoorShielded: () => boolean,
    private getFurniture: () => Furniture[],
  ) {
    this.scheduleNextSpawn();
    this.hud.setWave(this.wave);
    this.hud.on('start-wave-tap', () => this.startNextWave());
  }

  update(delta: number): void {
    const furniture = this.getFurniture();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const cw = this.enemies[i];
      cw.tick(delta, furniture);

      if (cw.hasReachedDesk && !cw.isDead) {
        if (this.isDoorShielded()) {
          // "Я на митинге" is up — stuck at the door instead of hitting
          // Petya. Coworker suppresses hasReachedDesk internally until
          // Shield releases it (on expiry) or it dies from waiting.
          cw.blockAtDoor();
          continue;
        }
        const { urgent } = cw;
        cw.isDead = true;
        cw.setVisible(false);
        cw.destroy();
        this.enemies.splice(i, 1);
        this.onTaskArrived(urgent);
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
    const cw = new Coworker(this.scene, buildPath(door), urgent);
    this.enemies.push(cw);
    this.spawnedThisWave++;
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
