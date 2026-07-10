import Phaser from 'phaser';
import { ToolTower, TOWER_SIZE } from '../entities/ToolTower';
import type { Coworker } from '../entities/Coworker';
import {
  TOWER_VARIANTS_DATA, TOWER_VARIANT_KEYS, type TowerVariant,
  OFFICE_Y_TOP, OFFICE_Y_BOTTOM, GAME_WIDTH, DESK_X, DESK_Y,
} from '../config';
import type { Economy } from './Economy';
import type { HUD } from '../ui/HUD';
import { showFloatingText } from '../ui/FloatingText';

const KEYBOARD_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

/**
 * TowerPlacer — everything about putting towers down and upgrading them:
 * the placement-preview circle, pointer/keyboard input, the buildable-area
 * check, and the money side of placing/upgrading. Owns the `towers` list
 * that MainScene ticks every frame.
 */
export class TowerPlacer {
  public readonly towers: ToolTower[] = [];
  /** Set to false on game over to stop accepting placement/upgrade input. */
  public enabled = true;

  private selectedVariant = 0;
  private placementPreview: Phaser.GameObjects.Arc;

  constructor(private scene: Phaser.Scene, private economy: Economy, private hud: HUD) {
    this.placementPreview = scene.add.arc(0, 0, 26, 0, 360, false, 0x0984e3, 0.45);
    this.placementPreview.setStrokeStyle(2, 0x74b9ff, 0.8);
    this.placementPreview.setVisible(false);
    this.placementPreview.setDepth(10);

    hud.on('variant-tap', () => this.cycleVariant());
    hud.setTowerSelect(TOWER_VARIANTS_DATA[this.currentVariant]);

    this.setupInput();
  }

  get currentVariant(): TowerVariant {
    return TOWER_VARIANT_KEYS[this.selectedVariant];
  }

  tick(delta: number, enemies: Coworker[]): void {
    for (const tower of this.towers) {
      tower.tick(delta, enemies);
    }
  }

  // ── Input ────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const inOffice = this.isInOffice(ptr.x, ptr.y);
      this.placementPreview.setPosition(ptr.x, ptr.y);
      this.placementPreview.setVisible(inOffice);
    });

    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.enabled) return;

      if (ptr.rightButtonDown()) {
        this.cycleVariant();
        return;
      }

      const clickedTower = this.towers.find(
        t => Phaser.Math.Distance.Between(t.x, t.y, ptr.x, ptr.y) < TOWER_SIZE
      );
      if (clickedTower) {
        this.tryUpgrade(clickedTower);
        return;
      }

      if (!this.isInOffice(ptr.x, ptr.y)) return;
      if (!this.isPlacementValid(ptr.x, ptr.y)) return;
      this.tryPlace(ptr.x, ptr.y);
    });

    KEYBOARD_KEYS.forEach((key, i) => {
      if (i >= TOWER_VARIANT_KEYS.length) return;
      this.scene.input.keyboard?.on(`keydown-${key}`, () => {
        if (!this.enabled) return;
        this.selectVariant(i);
      });
    });
  }

  cycleVariant(): void {
    this.selectVariant((this.selectedVariant + 1) % TOWER_VARIANT_KEYS.length);
  }

  selectVariant(index: number): void {
    this.selectedVariant = index;
    this.hud.setTowerSelect(TOWER_VARIANTS_DATA[this.currentVariant]);
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

  private isPlacementValid(x: number, y: number): boolean {
    // Can't stack towers too close together
    for (const t of this.towers) {
      if (Phaser.Math.Distance.Between(t.x, t.y, x, y) < 52) return false;
    }
    return true;
  }

  // ── Money-gated actions ──────────────────────────────────────────────

  private tryPlace(x: number, y: number): void {
    const variant = this.currentVariant;
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
}
