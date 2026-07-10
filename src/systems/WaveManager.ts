import Phaser from 'phaser';
import { Coworker, type Waypoint } from '../entities/Coworker';
import {
  SPAWN_DOORS, type DoorDef,
  SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX,
  OFFICE_Y_TOP, DESK_X, DESK_Y,
  SALARY_AMOUNT, SALARY_INTERVAL_WAVES,
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
 * WaveManager — spawns coworkers, ticks them, counts kills/waves, and
 * pays the salary every SALARY_INTERVAL_WAVES waves. Owns the `enemies`
 * list that ToolTower.tick() targets.
 */
export class WaveManager {
  public readonly enemies: Coworker[] = [];

  private wave = 1;
  private waveKills = 0;
  private readonly killsPerWave = 8;
  private spawnTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    private economy: Economy,
    private hud: HUD,
    private onTaskReachedDesk: () => void,
    private isDoorShielded: () => boolean,
  ) {
    this.scheduleNextSpawn();
    this.hud.setWave(this.wave, this.wavesToSalary());
  }

  update(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const cw = this.enemies[i];
      cw.tick(delta);

      if (cw.hasReachedDesk && !cw.isDead) {
        if (this.isDoorShielded()) {
          // "Я на митинге" is up — stuck at the door instead of hitting
          // Petya. Coworker suppresses hasReachedDesk internally until
          // Shield releases it (on expiry) or it dies from waiting.
          cw.blockAtDoor();
          continue;
        }
        cw.isDead = true;
        cw.setVisible(false);
        cw.destroy();
        this.enemies.splice(i, 1);
        this.onTaskReachedDesk();
      } else if (cw.isDead) {
        this.enemies.splice(i, 1);
        this.waveKills++;
        this.checkWaveProgress();
      }
    }

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnCoworker();
      this.scheduleNextSpawn();
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────

  private scheduleNextSpawn(): void {
    this.spawnTimer = Phaser.Math.Between(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
    // Faster in later waves
    const waveSpeed = Math.max(0.45, 1 - (this.wave - 1) * 0.08);
    this.spawnTimer *= waveSpeed;
  }

  private spawnCoworker(): void {
    const door = SPAWN_DOORS[Phaser.Math.Between(0, SPAWN_DOORS.length - 1)];
    const cw = new Coworker(this.scene, buildPath(door));
    this.enemies.push(cw);
  }

  // ── Waves & salary ───────────────────────────────────────────────────

  private checkWaveProgress(): void {
    if (this.waveKills >= this.killsPerWave * this.wave) {
      this.wave++;
      this.waveKills = 0;
      this.showWaveAnnouncement();
      this.hud.setWave(this.wave, this.wavesToSalary());

      if (this.wave % SALARY_INTERVAL_WAVES === 0) this.paySalary();
    }
  }

  private wavesToSalary(): number {
    return SALARY_INTERVAL_WAVES - (this.wave % SALARY_INTERVAL_WAVES);
  }

  private paySalary(): void {
    this.economy.earn(SALARY_AMOUNT);
    showFloatingText(this.scene, DESK_X, DESK_Y - 40, `+${SALARY_AMOUNT} 💰 Зарплата!`, '#2ecc71');
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
