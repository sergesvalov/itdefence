import Phaser from 'phaser';
import { ToolTower, TOWER_SIZE } from '../entities/ToolTower';
import { Furniture } from '../entities/Furniture';
import {
  TOWER_VARIANTS_DATA, TOWER_VARIANT_KEYS, type TowerVariant,
  FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS, type FurnitureType,
  OFFICE_Y_TOP, OFFICE_Y_BOTTOM, GAME_WIDTH, DESK_X, DESK_Y, SPAWN_DOORS,
} from '../config';
import { Pathfinder } from './Pathfinder';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import { showFloatingText } from '../ui/FloatingText';
import type { TowerManager } from './TowerManager';

const KEYBOARD_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

type BuildItem =
  | { kind: 'tower'; variant: TowerVariant }
  | { kind: 'furniture'; type: FurnitureType };

export class TowerPlacer {
  public enabled = true;
  public getWave: () => number = () => 1;
  public isPaused: () => boolean = () => false;

  private readonly buildItems: BuildItem[];
  private selectedIndex = 0;
  private placementPreview: Phaser.GameObjects.Arc;

  public carrying: Furniture | ToolTower | null = null;
  private carryOrigin = { x: 0, y: 0 };

  constructor(
    private scene: Phaser.Scene,
    private economy: Economy,
    private hud: HUD,
    private manager: TowerManager
  ) {
    this.buildItems = [
      ...TOWER_VARIANT_KEYS.map((variant): BuildItem => ({ kind: 'tower', variant })),
      ...FURNITURE_TYPE_KEYS.map((type): BuildItem => ({ kind: 'furniture', type })),
    ];

    this.placementPreview = scene.add.arc(0, 0, TOWER_SIZE, 0, 360, false, 0x0984e3, 0.45);
    this.placementPreview.setStrokeStyle(2, 0x74b9ff, 0.8);
    this.placementPreview.setVisible(false);
    this.placementPreview.setDepth(10);

    hud.on('select-index', (index: number) => this.selectIndex(index));
    this.refreshHudSelection();
    this.updatePreviewStyle();

    this.setupInput();
  }

  get currentItem(): BuildItem {
    return this.buildItems[this.selectedIndex];
  }

  public snap(val: number): number {
    return Math.round(val / 62) * 62;
  }

  private setupInput(): void {
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const sx = this.snap(ptr.x);
      const sy = this.snap(ptr.y);

      if (this.carrying) {
        this.carrying.setPosition(sx, sy);
        return;
      }
      const inOffice = this.isInOffice(sx, sy);
      this.placementPreview.setPosition(sx, sy);
      this.placementPreview.setVisible(inOffice);
    });

    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.enabled) return;

      if (ptr.rightButtonDown()) {
        this.cycleSelection();
        return;
      }

      if (this.carrying) {
        this.tryDrop(this.snap(ptr.x), this.snap(ptr.y));
        return;
      }

      const clickedTower = this.manager.towers.find(
        t => Phaser.Math.Distance.Between(t.x, t.y, ptr.x, ptr.y) < (TOWER_VARIANTS_DATA[t.variant].radius || TOWER_SIZE)
      );
      if (clickedTower) {
        if (clickedTower.variant === 'partner' && this.isPaused()) {
          this.pickUpTower(clickedTower);
        } else {
          this.tryUpgrade(clickedTower);
        }
        return;
      }

      const clickedFurniture = this.manager.furniture.find(
        f => Phaser.Math.Distance.Between(f.x, f.y, ptr.x, ptr.y) < f.radius + 4
      );
      if (clickedFurniture) {
        this.pickUp(clickedFurniture);
        return;
      }

      const sx = this.snap(ptr.x);
      const sy = this.snap(ptr.y);
      if (!this.isInOffice(sx, sy)) return;

      const item = this.currentItem;
      if (item.kind === 'tower') {
        const stats = TOWER_VARIANTS_DATA[item.variant];
        const radius = stats.radius || TOWER_SIZE;
        if (!this.isPlacementValid(sx, sy, radius)) return;
        this.tryPlaceTower(sx, sy, item.variant);
      } else {
        const stats = FURNITURE_TYPES_DATA[item.type];
        if (!this.isPlacementValid(sx, sy, stats.radius)) return;
        this.tryPlaceFurniture(sx, sy, item.type);
      }
    });

    KEYBOARD_KEYS.forEach((key, i) => {
      if (i >= this.buildItems.length) return;
      this.scene.input.keyboard?.on(`keydown-${key}`, () => {
        if (!this.enabled) return;
        this.selectIndex(i);
      });
    });
  }

  cycleSelection(): void {
    this.selectIndex((this.selectedIndex + 1) % this.buildItems.length);
  }

  selectIndex(index: number): void {
    this.selectedIndex = index;
    this.refreshHudSelection();
    this.updatePreviewStyle();
  }

  private updatePreviewStyle(): void {
    const item = this.currentItem;
    if (item.kind === 'tower') {
      const stats = TOWER_VARIANTS_DATA[item.variant];
      this.placementPreview.setRadius(stats.radius || TOWER_SIZE);
      this.placementPreview.setFillStyle(stats.color, 0.35);
      this.placementPreview.setStrokeStyle(2, stats.color, 0.8);
    } else {
      const stats = FURNITURE_TYPES_DATA[item.type];
      this.placementPreview.setRadius(stats.radius);
      this.placementPreview.setFillStyle(stats.color, 0.35);
      this.placementPreview.setStrokeStyle(2, stats.color, 0.8);
    }
  }

  public refreshHudSelection(): void {
    const item = this.currentItem;
    if (item.kind === 'tower') {
      this.hud.setTowerSelect(this.selectedIndex, TOWER_VARIANTS_DATA[item.variant]);
    } else {
      const stats = FURNITURE_TYPES_DATA[item.type];
      const left = stats.maxCount - this.manager.countFurniture(item.type);
      this.hud.setFurnitureSelect(this.selectedIndex, stats, left);
    }
  }

  public isInOffice(x: number, y: number): boolean {
    const margin = 24;
    return (
      y > OFFICE_Y_TOP + margin &&
      y < OFFICE_Y_BOTTOM - margin &&
      x > margin &&
      x < GAME_WIDTH - margin &&
      Phaser.Math.Distance.Between(x, y, DESK_X, DESK_Y) > 84
    );
  }

  public isPlacementValid(x: number, y: number, ownRadius: number): boolean {
    for (const t of this.manager.towers) {
      if (t === this.carrying) continue;
      const tRadius = TOWER_VARIANTS_DATA[t.variant].radius || TOWER_SIZE;
      if (Phaser.Math.Distance.Between(t.x, t.y, x, y) < tRadius + ownRadius + 6) return false;
    }
    for (const f of this.manager.furniture) {
      if (f === this.carrying) continue;
      if (Phaser.Math.Distance.Between(f.x, f.y, x, y) < f.radius + ownRadius + 6) return false;
    }

    // Ensure path to desk is not completely blocked
    const tempFurniture = { x, y, radius: ownRadius };
    const furnitureArr = this.manager.furniture.filter(f => f !== this.carrying);
    const pathfinder = new Pathfinder(furnitureArr, tempFurniture);
    
    for (const door of SPAWN_DOORS) {
      if (!pathfinder.findPath(door.x, door.y, DESK_X, DESK_Y)) {
        return false;
      }
    }

    return true;
  }

  private getPartnerLimit(): number {
    const w = this.getWave();
    if (w > 6) return 2;
    if (w > 3) return 1;
    return 0;
  }

  private tryPlaceTower(x: number, y: number, variant: TowerVariant): void {
    if (variant === 'partner') {
      const count = this.manager.towers.filter(t => t.variant === 'partner').length;
      if (count >= this.getPartnerLimit()) {
        showFloatingText(this.scene, x, y, 'Лимит напарников', '#a29bfe');
        return;
      }
    }

    const cost = TOWER_VARIANTS_DATA[variant].cost;

    if (!this.economy.canAfford(cost)) {
      showFloatingText(this.scene, x, y, 'Недостаточно 💰', '#ff6b6b');
      return;
    }
    this.economy.spend(cost);

    const tower = new ToolTower(this.scene, x, y, variant);
    this.manager.addTower(tower);

    showFloatingText(this.scene, x, y, `-${cost} 💰`, '#ff7675');
    this.scene.cameras.main.shake(80, 0.003);
  }

  private tryUpgrade(tower: ToolTower): void {
    if (!tower.canUpgrade()) {
      showFloatingText(this.scene, tower.x, tower.y, 'Макс. уровень', '#a29bfe');
      return;
    }
    const cost = tower.getUpgradeCost();
    if (!this.economy.canAfford(cost)) {
      showFloatingText(this.scene, tower.x, tower.y, 'Недостаточно 💰', '#ff6b6b');
      return;
    }
    this.economy.spend(cost);
    tower.upgrade();
    showFloatingText(this.scene, tower.x, tower.y, `Ур. ${tower.level}!`, '#55efc4');
  }

  private tryPlaceFurniture(x: number, y: number, type: FurnitureType): void {
    const stats = FURNITURE_TYPES_DATA[type];
    if (this.manager.countFurniture(type) >= stats.maxCount) {
      showFloatingText(this.scene, x, y, 'Нет в наличии', '#a29bfe');
      return;
    }
    const piece = new Furniture(this.scene, x, y, type);
    this.manager.addFurniture(piece);
    this.refreshHudSelection();
  }

  private pickUp(piece: Furniture): void {
    this.carrying = piece;
    this.carryOrigin = { x: piece.x, y: piece.y };
    piece.setPicked(true);
  }

  private pickUpTower(tower: ToolTower): void {
    this.carrying = tower;
    this.carryOrigin = { x: tower.x, y: tower.y };
    tower.setAlpha(0.55);
  }

  private tryDrop(x: number, y: number): void {
    const piece = this.carrying!;
    const radius = piece instanceof Furniture ? piece.radius : (TOWER_VARIANTS_DATA[piece.variant].radius || TOWER_SIZE);
    
    if (this.isInOffice(x, y) && this.isPlacementValid(x, y, radius)) {
      piece.setPosition(x, y);
    } else {
      piece.setPosition(this.carryOrigin.x, this.carryOrigin.y);
    }
    
    if (piece instanceof Furniture) piece.setPicked(false);
    else piece.setAlpha(1);
    
    this.carrying = null;
  }
}
