import Phaser from 'phaser';
import {
  TOWER_VARIANTS_DATA, OFFICE_Y_TOP, OFFICE_Y_BOTTOM, GAME_WIDTH,
  DESK_X, DESK_Y, SPAWN_DOORS, TOOLBAR_WIDTH
} from '../config';
import { Pathfinder } from './Pathfinder';
import type { TowerManager } from './TowerManager';
import { TOWER_SIZE } from '../entities/ToolTower';
import type { ToolTower } from '../entities/ToolTower';
import type { Furniture } from '../entities/Furniture';

export function isInOffice(x: number, y: number): boolean {
  const margin = 24;
  return (
    y > OFFICE_Y_TOP + margin &&
    y < OFFICE_Y_BOTTOM - margin &&
    x > TOOLBAR_WIDTH + margin &&
    x < GAME_WIDTH - margin &&
    Phaser.Math.Distance.Between(x, y, DESK_X, DESK_Y) > 84
  );
}

export function isPlacementValid(
  x: number,
  y: number,
  ownRadius: number,
  manager: TowerManager,
  carrying: Furniture | ToolTower | null,
  isTower: boolean = false
): boolean {
  for (const t of manager.towers) {
    if (t === carrying) continue;
    const tRadius = TOWER_VARIANTS_DATA[t.variant].radius || TOWER_SIZE;
    if (Phaser.Math.Distance.Between(t.x, t.y, x, y) < tRadius + ownRadius + 6) return false;
  }
  for (const f of manager.furniture) {
    if (f === carrying) continue;
    if (Phaser.Math.Distance.Between(f.x, f.y, x, y) < f.radius + ownRadius + 6) return false;
  }

  // Towers don't block pathfinding, only furniture does!
  if (!isTower) {
    // Ensure path to desk is not completely blocked
    const tempFurniture = { x, y, radius: ownRadius };
    const furnitureArr = manager.furniture.filter(f => f !== carrying);
    const pathfinder = new Pathfinder(furnitureArr, tempFurniture);
    
    for (const door of SPAWN_DOORS) {
      if (!pathfinder.findPath(door.x, door.y, DESK_X, DESK_Y)) {
        return false;
      }
    }
  }

  return true;
}
