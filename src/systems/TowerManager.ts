import { ToolTower } from '../entities/ToolTower';
import { Furniture } from '../entities/Furniture';
import { EventBus } from '../events/EventBus';
import type { Coworker } from '../entities/Coworker';
import { showFloatingText } from '../ui/FloatingText';
import { FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS, GAME_WIDTH, OFFICE_Y_BOTTOM, OFFICE_Y_TOP, TOWER_WAKE_DELAY_MS, TOWER_WAKE_DELAY_WITH_PARTNER_MS, type FurnitureType } from '../config';

export class TowerManager {
  public readonly towers: ToolTower[] = [];
  public readonly furniture: Furniture[] = [];
  /** Campaign modifier: idle towers fall asleep (see ToolTower.tick) */
  public sleepyTowers = false;
  /** Campaign modifier: a random tower hangs every [min, max] ms while a wave is on */
  public zombieInterval: { minMs: number; maxMs: number } | null = null;
  private zombieTimer = 0;

  constructor(private scene: Phaser.Scene) {}

  public tick(delta: number, enemies: Coworker[], carrying: Furniture | ToolTower | null): void {
    // "Вася пошёл будить диски": with a partner desk around, towers wake faster
    let wakeDelay: number | null = null;
    if (this.sleepyTowers) {
      wakeDelay = this.towers.some(t => t.variant === 'partner')
        ? TOWER_WAKE_DELAY_WITH_PARTNER_MS : TOWER_WAKE_DELAY_MS;
    }
    for (const tower of this.towers) {
      tower.setDepth(tower.y);
      tower.tick(delta, enemies, wakeDelay);
    }
    for (const f of this.furniture) {
      f.setDepth(f.y);
    }
    if (this.zombieInterval && enemies.length > 0) this.tickZombies(delta, this.zombieInterval);
    if (carrying) {
      carrying.setDepth(9999);
    }
  }

  private tickZombies(delta: number, interval: { minMs: number; maxMs: number }): void {
    if (this.zombieTimer <= 0) this.zombieTimer = Phaser.Math.Between(interval.minMs, interval.maxMs);
    this.zombieTimer -= delta;
    if (this.zombieTimer > 0) return;

    const candidates = this.towers.filter(t => t.variant !== 'partner' && !t.hung);
    if (candidates.length === 0) return;
    const victim = Phaser.Utils.Array.GetRandom(candidates);
    victim.hang();
    showFloatingText(this.scene, victim.x, victim.y, 'Контейнер завис', '#ff7675');
  }

  public countFurniture(type: FurnitureType): number {
    return this.furniture.filter(f => f.type === type).length;
  }

  public addTower(tower: ToolTower): void {
    this.towers.push(tower);
  }

  public removeTower(tower: ToolTower): void {
    const i = this.towers.indexOf(tower);
    if (i >= 0) this.towers.splice(i, 1);
  }

  public addFurniture(f: Furniture): void {
    this.furniture.push(f);
    EventBus.emit('furniture_changed');
  }

  public autoSpawnFurniture(count: number, isValidPlacement: (x: number, y: number, radius: number) => boolean, snap: (val: number) => number): void {
    let attempts = 0;
    let spawned = 0;
    while (spawned < count && attempts < 200) {
      attempts++;
      const type = Phaser.Utils.Array.GetRandom([...FURNITURE_TYPE_KEYS]) as FurnitureType;
      
      const stats = FURNITURE_TYPES_DATA[type];
      if (this.countFurniture(type) >= stats.maxCount) continue;

      const x = snap(Phaser.Math.Between(40, GAME_WIDTH - 40));
      const y = snap(Phaser.Math.Between(OFFICE_Y_TOP + 40, OFFICE_Y_BOTTOM - 40));

      if (isValidPlacement(x, y, stats.radius)) {
        const piece = new Furniture(this.scene, x, y, type);
        this.addFurniture(piece);
        spawned++;
      }
    }
    EventBus.emit('furniture_changed');
  }
}
