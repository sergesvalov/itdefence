import Phaser from 'phaser';
import { ToolTower } from '../entities/ToolTower';
import { Furniture } from '../entities/Furniture';
import { EventBus } from '../events/EventBus';
import { TOWER_VARIANTS_DATA, FURNITURE_TYPES_DATA, type TowerVariant, type FurnitureType } from '../config';
import type { Economy } from './Economy';
import type { TowerManager } from './TowerManager';
import { showFloatingText } from '../ui/FloatingText';

export class Builder {
  constructor(
    private scene: Phaser.Scene,
    private economy: Economy,
    private manager: TowerManager,
    private getWave: () => number
  ) {}

  private getPartnerLimit(): number {
    const w = this.getWave();
    if (w > 6) return 2;
    if (w > 3) return 1;
    return 0;
  }

  public tryPlaceTower(x: number, y: number, variant: TowerVariant): boolean {
    if (variant === 'partner') {
      const count = this.manager.towers.filter(t => t.variant === 'partner').length;
      if (count >= this.getPartnerLimit()) {
        showFloatingText(this.scene, x, y, 'Лимит напарников', '#a29bfe');
        return false;
      }
    }

    const cost = TOWER_VARIANTS_DATA[variant].cost;

    if (!this.economy.canAfford(cost)) {
      showFloatingText(this.scene, x, y, 'Недостаточно 💰', '#ff6b6b');
      return false;
    }
    this.economy.spend(cost);

    const tower = new ToolTower(this.scene, x, y, variant);
    this.manager.addTower(tower);

    showFloatingText(this.scene, x, y, `-${cost} 💰`, '#ff7675');
    this.scene.cameras.main.shake(80, 0.003);
    EventBus.emit('tower_built');
    return true;
  }

  public tryUpgrade(tower: ToolTower): boolean {
    if (!tower.canUpgrade()) {
      showFloatingText(this.scene, tower.x, tower.y, 'Макс. уровень', '#a29bfe');
      return false;
    }
    const cost = tower.getUpgradeCost();
    if (!this.economy.canAfford(cost)) {
      showFloatingText(this.scene, tower.x, tower.y, 'Недостаточно 💰', '#ff6b6b');
      return false;
    }
    this.economy.spend(cost);
    tower.upgrade();
    showFloatingText(this.scene, tower.x, tower.y, `Ур. ${tower.level}!`, '#55efc4');
    return true;
  }

  public tryPlaceFurniture(x: number, y: number, type: FurnitureType): boolean {
    const stats = FURNITURE_TYPES_DATA[type];
    if (this.manager.countFurniture(type) >= stats.maxCount) {
      showFloatingText(this.scene, x, y, 'Нет в наличии', '#a29bfe');
      return false;
    }
    const piece = new Furniture(this.scene, x, y, type);
    this.manager.addFurniture(piece);
    return true;
  }
}
