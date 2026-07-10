import Phaser from 'phaser';
import { ToolTower, TOWER_SIZE } from '../entities/ToolTower';
import { Furniture } from '../entities/Furniture';
import type { Coworker } from '../entities/Coworker';
import {
  TOWER_VARIANTS_DATA, TOWER_VARIANT_KEYS, type TowerVariant,
  FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS, type FurnitureType,
  OFFICE_Y_TOP, OFFICE_Y_BOTTOM, GAME_WIDTH, DESK_X, DESK_Y,
} from '../config';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import { showFloatingText } from '../ui/FloatingText';

const KEYBOARD_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** What's currently selected to place — cycled by the HUD tap / right-click / 1-9. */
type BuildItem =
  | { kind: 'tower'; variant: TowerVariant }
  | { kind: 'furniture'; type: FurnitureType };

/**
 * TowerPlacer — everything about putting things down in the office: the
 * placement-preview circle, pointer/keyboard input, the buildable-area
 * check, and the money side of placing/upgrading towers. Also owns
 * furniture (cabinets/drawers/sofas): free but finite-stock, and movable —
 * tapping an already-placed piece picks it up to drop somewhere else.
 * Owns the `towers`/`furniture` lists that MainScene ticks/reads every frame.
 */
export class TowerPlacer {
  public readonly towers: ToolTower[] = [];
  public readonly furniture: Furniture[] = [];
  /** Set to false on game over to stop accepting placement/upgrade input. */
  public enabled = true;

  private readonly buildItems: BuildItem[];
  private selectedIndex = 0;
  private placementPreview: Phaser.GameObjects.Arc;

  /** Furniture piece currently picked up and following the pointer, if any. */
  private carrying: Furniture | null = null;
  private carryOrigin = { x: 0, y: 0 };

  constructor(private scene: Phaser.Scene, private economy: Economy, private hud: HUD) {
    this.buildItems = [
      ...TOWER_VARIANT_KEYS.map((variant): BuildItem => ({ kind: 'tower', variant })),
      ...FURNITURE_TYPE_KEYS.map((type): BuildItem => ({ kind: 'furniture', type })),
    ];

    this.placementPreview = scene.add.arc(0, 0, TOWER_SIZE, 0, 360, false, 0x0984e3, 0.45);
    this.placementPreview.setStrokeStyle(2, 0x74b9ff, 0.8);
    this.placementPreview.setVisible(false);
    this.placementPreview.setDepth(10);

    hud.on('variant-tap', () => this.cycleSelection());
    this.refreshHudSelection();
    this.updatePreviewStyle();

    this.setupInput();
  }

  get currentItem(): BuildItem {
    return this.buildItems[this.selectedIndex];
  }

  tick(delta: number, enemies: Coworker[]): void {
    for (const tower of this.towers) {
      tower.tick(delta, enemies);
    }
  }

  // ── Input ────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.carrying) {
        this.carrying.setPosition(ptr.x, ptr.y);
        return;
      }
      const inOffice = this.isInOffice(ptr.x, ptr.y);
      this.placementPreview.setPosition(ptr.x, ptr.y);
      this.placementPreview.setVisible(inOffice);
    });

    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.enabled) return;

      if (ptr.rightButtonDown()) {
        this.cycleSelection();
        return;
      }

      if (this.carrying) {
        this.tryDrop(ptr.x, ptr.y);
        return;
      }

      const clickedTower = this.towers.find(
        t => Phaser.Math.Distance.Between(t.x, t.y, ptr.x, ptr.y) < TOWER_SIZE
      );
      if (clickedTower) {
        this.tryUpgrade(clickedTower);
        return;
      }

      const clickedFurniture = this.furniture.find(
        f => Phaser.Math.Distance.Between(f.x, f.y, ptr.x, ptr.y) < f.radius + 4
      );
      if (clickedFurniture) {
        this.pickUp(clickedFurniture);
        return;
      }

      if (!this.isInOffice(ptr.x, ptr.y)) return;

      const item = this.currentItem;
      if (item.kind === 'tower') {
        if (!this.isPlacementValid(ptr.x, ptr.y, TOWER_SIZE)) return;
        this.tryPlaceTower(ptr.x, ptr.y, item.variant);
      } else {
        const stats = FURNITURE_TYPES_DATA[item.type];
        if (!this.isPlacementValid(ptr.x, ptr.y, stats.radius)) return;
        this.tryPlaceFurniture(ptr.x, ptr.y, item.type);
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
      this.placementPreview.setRadius(TOWER_SIZE);
      this.placementPreview.setFillStyle(stats.color, 0.35);
      this.placementPreview.setStrokeStyle(2, stats.color, 0.8);
    } else {
      const stats = FURNITURE_TYPES_DATA[item.type];
      this.placementPreview.setRadius(stats.radius);
      this.placementPreview.setFillStyle(stats.color, 0.35);
      this.placementPreview.setStrokeStyle(2, stats.color, 0.8);
    }
  }

  private refreshHudSelection(): void {
    const item = this.currentItem;
    if (item.kind === 'tower') {
      this.hud.setTowerSelect(TOWER_VARIANTS_DATA[item.variant]);
    } else {
      const stats = FURNITURE_TYPES_DATA[item.type];
      const left = stats.maxCount - this.countPlaced(item.type);
      this.hud.setFurnitureSelect(stats, left);
    }
  }

  private countPlaced(type: FurnitureType): number {
    return this.furniture.filter(f => f.type === type).length;
  }

  // ── Placement rules ─────────────────────────────────────────────────

  private isInOffice(x: number, y: number): boolean {
    const margin = 24;
    return (
      y > OFFICE_Y_TOP + margin &&
      y < OFFICE_Y_BOTTOM - margin &&
      x > margin &&
      x < GAME_WIDTH - margin &&
      Phaser.Math.Distance.Between(x, y, DESK_X, DESK_Y) > 70  // don't block the desk itself
    );
  }

  /** Checks against towers and other furniture (skipping the piece being carried). */
  private isPlacementValid(x: number, y: number, ownRadius: number): boolean {
    for (const t of this.towers) {
      if (Phaser.Math.Distance.Between(t.x, t.y, x, y) < TOWER_SIZE + ownRadius + 6) return false;
    }
    for (const f of this.furniture) {
      if (f === this.carrying) continue;
      if (Phaser.Math.Distance.Between(f.x, f.y, x, y) < f.radius + ownRadius + 6) return false;
    }
    return true;
  }

  // ── Money-gated tower actions ──────────────────────────────────────────

  private tryPlaceTower(x: number, y: number, variant: TowerVariant): void {
    const cost = TOWER_VARIANTS_DATA[variant].cost;

    if (!this.economy.canAfford(cost)) {
      showFloatingText(this.scene, x, y, 'Недостаточно 💰', '#ff6b6b');
      return;
    }
    this.economy.spend(cost);

    const tower = new ToolTower(this.scene, x, y, variant);
    this.towers.push(tower);

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

  // ── Furniture: free, finite stock, movable ───────────────────────────

  private tryPlaceFurniture(x: number, y: number, type: FurnitureType): void {
    const stats = FURNITURE_TYPES_DATA[type];
    if (this.countPlaced(type) >= stats.maxCount) {
      showFloatingText(this.scene, x, y, 'Нет в наличии', '#a29bfe');
      return;
    }
    const piece = new Furniture(this.scene, x, y, type);
    this.furniture.push(piece);
    this.refreshHudSelection();
  }

  private pickUp(piece: Furniture): void {
    this.carrying = piece;
    this.carryOrigin = { x: piece.x, y: piece.y };
    piece.setPicked(true);
  }

  private tryDrop(x: number, y: number): void {
    const piece = this.carrying!;
    if (this.isInOffice(x, y) && this.isPlacementValid(x, y, piece.radius)) {
      piece.setPosition(x, y);
    } else {
      piece.setPosition(this.carryOrigin.x, this.carryOrigin.y);
    }
    piece.setPicked(false);
    this.carrying = null;
  }
}
