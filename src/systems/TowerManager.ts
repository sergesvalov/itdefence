import { ToolTower } from '../entities/ToolTower';
import { Furniture } from '../entities/Furniture';
import { EventBus } from '../events/EventBus';
import type { Coworker } from '../entities/Coworker';
import { FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS, GAME_WIDTH, OFFICE_Y_BOTTOM, OFFICE_Y_TOP, type FurnitureType } from '../config';

export class TowerManager {
  public readonly towers: ToolTower[] = [];
  public readonly furniture: Furniture[] = [];

  constructor(private scene: Phaser.Scene) {}

  public tick(delta: number, enemies: Coworker[], carrying: Furniture | ToolTower | null): void {
    for (const tower of this.towers) {
      tower.setDepth(tower.y);
      tower.tick(delta, enemies);
    }
    for (const f of this.furniture) {
      f.setDepth(f.y);
    }
    if (carrying) {
      carrying.setDepth(9999);
    }
  }

  public countFurniture(type: FurnitureType): number {
    return this.furniture.filter(f => f.type === type).length;
  }

  public addTower(tower: ToolTower): void {
    this.towers.push(tower);
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
