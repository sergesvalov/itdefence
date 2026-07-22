import Phaser from 'phaser';
import { ToolTower, TOWER_SIZE } from '../entities/ToolTower';
import { Furniture } from '../entities/Furniture';
import {
  TOWER_VARIANTS_DATA, TOWER_VARIANT_KEYS, type TowerVariant,
  FURNITURE_TYPES_DATA, FURNITURE_TYPE_KEYS, type FurnitureType,
} from '../config';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import type { TowerManager } from './TowerManager';
import { SoundFX } from './SoundFX';
import { isInOffice, isPlacementValid } from './PlacementValidator';
import { Builder } from './Builder';
import { EventBus } from '../events/EventBus';
import { MetaProgression } from './MetaProgression';

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
  private builder: Builder;

  constructor(
    private scene: Phaser.Scene,
    economy: Economy,
    private hud: HUD,
    private manager: TowerManager
  ) {
    this.builder = new Builder(scene, economy, manager, () => this.getWave());

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
    return Math.round(val / 80) * 80;
  }

  public isInOffice(x: number, y: number): boolean {
    return isInOffice(x, y);
  }

  public isPlacementValid(x: number, y: number, radius: number): boolean {
    return isPlacementValid(x, y, radius, this.manager, this.carrying);
  }

  private setupInput(): void {
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const sx = this.snap(ptr.x);
      const sy = this.snap(ptr.y);

      if (this.carrying) {
        this.carrying.setPosition(sx, sy);
      }
      
      const inOffice = isInOffice(sx, sy);
      this.placementPreview.setPosition(sx, sy);
      this.placementPreview.setVisible(inOffice);
      
      if (inOffice) {
        let radius = TOWER_SIZE;
        let isTower = false;
        
        if (this.carrying) {
          radius = (this.carrying as any).radius || TOWER_SIZE; // Furniture has .radius, Tower might not explicitly expose it here but we can approximate or just use TOWER_SIZE
          // wait, actually we can just use `this.carrying instanceof ToolTower`
          isTower = (this.carrying as any).variant !== undefined;
          if (isTower) {
            radius = TOWER_VARIANTS_DATA[(this.carrying as ToolTower).variant].radius || TOWER_SIZE;
          }
        } else {
          const item = this.currentItem;
          if (item.kind === 'tower') {
            isTower = true;
            radius = TOWER_VARIANTS_DATA[item.variant].radius || TOWER_SIZE;
          } else {
            isTower = false;
            radius = FURNITURE_TYPES_DATA[item.type].radius;
          }
        }
        
        const valid = isPlacementValid(sx, sy, radius, this.manager, this.carrying, isTower);
        if (valid) {
          this.placementPreview.setFillStyle(0x0984e3, 0.45);
          this.placementPreview.setStrokeStyle(2, 0x74b9ff, 0.8);
        } else {
          this.placementPreview.setFillStyle(0xd63031, 0.45);
          this.placementPreview.setStrokeStyle(2, 0xff7675, 0.8);
        }
      }
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
          this.builder.tryUpgrade(clickedTower);
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
      if (!isInOffice(sx, sy)) {
        // Only show text if they clicked somewhat in the game area, not if they clicked the left menu
        if (ptr.x > 84) {
          import('../ui/FloatingText').then(m => m.showFloatingText(this.scene, ptr.x, ptr.y, 'Вне зоны офиса', '#ff6b6b'));
        }
        return;
      }

      const item = this.currentItem;
      if (item.kind === 'tower') {
        const stats = TOWER_VARIANTS_DATA[item.variant];
        const radius = stats.radius || TOWER_SIZE;
        if (!isPlacementValid(sx, sy, radius, this.manager, this.carrying, true)) {
          import('../ui/FloatingText').then(m => m.showFloatingText(this.scene, sx, sy, 'Нельзя строить здесь', '#ff6b6b'));
          return;
        }
        this.builder.tryPlaceTower(sx, sy, item.variant);
      } else {
        const stats = FURNITURE_TYPES_DATA[item.type];
        if (!isPlacementValid(sx, sy, stats.radius, this.manager, this.carrying, false)) {
          import('../ui/FloatingText').then(m => m.showFloatingText(this.scene, sx, sy, 'Нельзя строить здесь', '#ff6b6b'));
          return;
        }
        if (this.builder.tryPlaceFurniture(sx, sy, item.type)) {
          this.refreshHudSelection();
        }
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
    SoundFX.playClick();
    this.selectIndex((this.selectedIndex + 1) % this.buildItems.length);
  }

  selectIndex(index: number): void {
    if (index > 0 && !MetaProgression.get().tutorialCompleted) {
      import('../ui/FloatingText').then(m => m.showFloatingText(this.scene, 80, 150, 'Заблокировано', '#f39c12'));
      return;
    }
    SoundFX.playClick();
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
    const isTower = piece instanceof ToolTower;
    const radius = piece instanceof Furniture ? piece.radius : (TOWER_VARIANTS_DATA[(piece as ToolTower).variant].radius || TOWER_SIZE);
    
    if (isInOffice(x, y) && isPlacementValid(x, y, radius, this.manager, this.carrying, isTower)) {
      piece.setPosition(x, y);
      SoundFX.playBuild();
      if (!isTower) EventBus.emit('furniture_moved');
    } else {
      piece.setPosition(this.carryOrigin.x, this.carryOrigin.y);
      import('../ui/FloatingText').then(m => m.showFloatingText(this.scene, x, y, 'Нельзя разместить здесь', '#ff6b6b'));
    }
    
    if (piece instanceof Furniture) piece.setPicked(false);
    else piece.setAlpha(1);
    
    this.carrying = null;
  }
}
