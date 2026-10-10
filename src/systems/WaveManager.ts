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
  DUPLICATE_HP_FRACTION, DUPLICATE_BOUNTY, LAKE_REAL_BOUNTY,

} from '../config';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import { showFloatingText, showBanner } from '../ui/FloatingText';
import { EventBus, GameEvents } from '../events/EventBus';

import { Pathfinder } from './Pathfinder';
import type { LevelDef } from '../campaign';

// Label colours for coworkers that follow a chapter's special rule
const LABEL_DUPLICATE = '#7c5ce7';
const LABEL_VERBAL = '#0984e3';
const LABEL_SMALL_ISSUE = '#00a383';
const LABEL_REAL = '#d63031';

/** Money for a coworker that only exists because of a mistake (a comeback, an escalation) */
const FOLLOW_UP_BOUNTY = 2;
/** An escalated issue is this many times tougher than the small one it grew from */
const ESCALATION_HP_FACTOR = 1.6;

export class WaveManager {
  public readonly enemies: Coworker[] = [];

  private wave = 1;
  private spawnedThisWave = 0;
  private isPaused = false;
  private spawnTimer = 0;
  /** Game time spent on the current wave (for deadlines) */
  private waveElapsedMs = 0;
  /** Tasks that reached the desk this wave (for the Friday report) */
  private leakedThisWave = 0;
  /** Countdown to the next wave starting by itself (levels with autoStartMs) */
  private autoStartMs = 0;

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
        const { urgent, harmless } = cw;
        cw.isDead = true;
        cw.setVisible(false);
        cw.destroy();
        this.enemies.splice(i, 1);
        if (harmless) {
          showFloatingText(this.scene, DESK_X, DESK_Y - 70, 'Не стоит того', '#bdc3c7');
          continue;
        }
        this.leakedThisWave++;
        EventBus.emit(GameEvents.TASK_ARRIVED, urgent);
      } else if (cw.isDead) {
        this.enemies.splice(i, 1);
      }
    }

    if (this.isPaused) {
      if (this.autoStartMs > 0) {
        this.autoStartMs -= delta;
        if (this.autoStartMs <= 0) this.startNextWave();
      }
      return;
    }

    this.waveElapsedMs += delta;
    const deadline = this.level?.deadline;
    if (deadline) this.hud.setDeadline(deadline.seconds * 1000 - this.waveElapsedMs);

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
    // (no urgent tickets at the lake: red there marks the real problems)
    const urgent = !this.level?.lake && Math.random() < URGENT_TASK_CHANCE;
    
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

    // ...or come as a verbal agreement / a small issue (each level uses one rule at most)
    const regular = !COWORKER_VARIANTS[variant].boss && !duplicateNames;
    const verbal = this.level?.verbal;
    const isVerbal = !!verbal && regular && Math.random() < verbal.chance;
    if (verbal && isVerbal) problem = verbal.label;

    const escalation = this.level?.escalation;
    let escalatesTo: string | null = null;
    if (escalation && regular && Math.random() < escalation.chance) {
      [problem, escalatesTo] = Phaser.Utils.Array.GetRandom(escalation.names);
    }

    // "Озеро": a few real problems among a stream of things that aren't worth it
    const lake = this.level?.lake;
    const realProblem = !!lake && Math.random() < lake.realChance;
    if (lake && realProblem) {
      variant = 'tank';
      problem = Phaser.Utils.Array.GetRandom(lake.realProblems);
    }

    const labelColor = realProblem ? LABEL_REAL : duplicateNames ? LABEL_DUPLICATE : isVerbal ? LABEL_VERBAL : escalatesTo ? LABEL_SMALL_ISSUE : undefined;
    const cw = new Coworker(this.scene, this.buildPath(door.x, door.y, variant), urgent, variant, hpScale, problem, labelColor);
    cw.duplicateNames = duplicateNames;
    cw.verbal = isVerbal;
    cw.escalatesTo = escalatesTo;
    if (lake) {
      cw.harmless = !realProblem;
      cw.bounty = realProblem ? LAKE_REAL_BOUNTY : 0;
    }
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
    if (cw.bounty > 0) {
      this.economy.earn(cw.bounty);
      showFloatingText(this.scene, cw.x, cw.y - 30, `+${cw.bounty} 💰`, '#f1c40f');
    }
    if (cw.duplicateNames) this.resolveDuplicates(cw, cw.duplicateNames);
    if (cw.verbal) this.resolveVerbal(cw);
    if (cw.escalatesTo) this.resolveEscalation(cw, cw.escalatesTo);
  }

  /**
   * A verbal agreement was closed. With a letter on file (any Docs hit) it
   * stays closed; without one the same person walks back in from the door.
   */
  private resolveVerbal(cw: Coworker): void {
    if (cw.documented) {
      showFloatingText(this.scene, cw.x, cw.y - 48, 'Есть письмо', LABEL_VERBAL);
      return;
    }
    showFloatingText(this.scene, cw.x, cw.y - 48, this.level?.verbal?.comeback ?? '', LABEL_VERBAL);
    const door = SPAWN_DOORS[0];
    const again = new Coworker(
      this.scene, this.buildPath(door.x, door.y, cw.variant), false, cw.variant,
      cw.hpScale, this.level?.verbal?.comeback, LABEL_VERBAL,
    );
    again.bounty = FOLLOW_UP_BOUNTY;
    this.enemies.push(again);
  }

  /**
   * A small issue was closed. Handled informally it just goes away; finished
   * off by Docs (a formal letter) it comes back as something much bigger.
   */
  private resolveEscalation(cw: Coworker, into: string): void {
    if (!cw.killedByPiercing) {
      showFloatingText(this.scene, cw.x, cw.y - 48, 'Договорились', LABEL_SMALL_ISSUE);
      return;
    }
    showBanner(this.scene, 'Эскалация!', '#ff7675');
    const big = new Coworker(
      this.scene, this.buildPath(cw.x, cw.y, 'tank'), true, 'tank',
      cw.hpScale * ESCALATION_HP_FACTOR, into,
    );
    big.bounty = FOLLOW_UP_BOUNTY;
    this.enemies.push(big);
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
    this.payWaveBonus();
    this.settleDeadline();

    this.isPaused = true;
    if (this.level && this.wave >= this.level.waves) {
      EventBus.emit(GameEvents.LEVEL_COMPLETE);
      return;
    }
    this.hud.showStartWaveButton(this.wave + 1);
    this.autoStartMs = this.level?.autoStartMs ?? 0;
  }

  /** Flat money per wave — or, with a Friday report, money for what was actually stopped. */
  private payWaveBonus(): void {
    const report = this.level?.fridayReport;
    if (!report) {
      const bonus = this.level?.waveBonus ?? WAVE_MONEY_AMOUNT;
      if (bonus > 0) {
        this.economy.earn(bonus);
        showFloatingText(this.scene, DESK_X, DESK_Y - 40, `+${bonus} 💰`, '#2ecc71');
      }
      return;
    }
    const total = this.enemiesPerWave();
    const stopped = Math.max(0, total - this.leakedThisWave);
    const share = stopped / total;
    const bonus = share >= 0.9 ? report.fullBonus : share >= 0.6 ? Math.round(report.fullBonus / 2) : 0;
    if (bonus > 0) this.economy.earn(bonus);
    showBanner(
      this.scene,
      bonus > 0 ? `Отчёт принят: ${stopped} из ${total}\n+${bonus} 💰` : `Не принято. Переделай\n${stopped} из ${total}`,
      bonus > 0 ? '#55efc4' : '#ff7675',
    );
  }

  /** Deadline levels: a bonus for finishing the wave in time, a fine for running over. */
  private settleDeadline(): void {
    const deadline = this.level?.deadline;
    if (!deadline) return;
    this.hud.setDeadline(null);
    if (this.waveElapsedMs <= deadline.seconds * 1000) {
      this.economy.earn(deadline.bonus);
      showFloatingText(this.scene, DESK_X, DESK_Y - 64, `В срок! Премия +${deadline.bonus} 💰`, '#55efc4');
    } else {
      const fine = Math.min(deadline.fine, this.economy.balance);
      this.economy.spend(fine);
      showFloatingText(this.scene, DESK_X, DESK_Y - 64, `Просрочка! Штраф −${fine} 💰`, '#ff7675');
    }
  }

  private startNextWave(): void {
    if (!this.isPaused) return;
    this.wave++;
    this.spawnedThisWave = 0;
    this.waveElapsedMs = 0;
    this.leakedThisWave = 0;
    this.autoStartMs = 0;
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
