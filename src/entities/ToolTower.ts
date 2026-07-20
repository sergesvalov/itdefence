import Phaser from 'phaser';
import type { Coworker } from './Coworker';
import {
  TOWER_VARIANTS_DATA, type TowerVariant, type TowerVariantStats,
  TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_BONUS, TOWER_UPGRADE_RANGE_BONUS, TOWER_UPGRADE_FIRE_RATE_MULT,
} from '../config';
import { MetaProgression } from '../systems/MetaProgression';
import { TowerView, TOWER_SIZE } from './TowerView';
import type { ITowerBehavior } from './behaviors/ITowerBehavior';
import { PartnerBehavior } from './behaviors/PartnerBehavior';
import { LureChainBehavior } from './behaviors/LureChainBehavior';
import { AoePulseBehavior } from './behaviors/AoePulseBehavior';
import { ProjectileBehavior } from './behaviors/ProjectileBehavior';

export { TOWER_SIZE };

type TowerSpecial = TowerVariantStats['special'];

/**
 * ToolTower – a defence tower placed by the player.
 */
export class ToolTower extends Phaser.GameObjects.Container {
  public readonly variant: TowerVariant;
  public level = 1;
  public tasksSolved = 0;
  public cooldown = 0;
  public range: number;
  public damage: number;
  public fireRate: number;
  public priority: 'first' | 'closest' | 'strongest';

  private readonly baseCost: number;
  private readonly baseRange: number;
  private readonly baseFireRate: number;
  private readonly baseDamage: number;
  public readonly special?: TowerSpecial;

  public view: TowerView;
  private behavior: ITowerBehavior;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: TowerVariant = 'cooler') {
    super(scene, x, y);
    this.variant = variant;

    const stats = TOWER_VARIANTS_DATA[variant];
    const meta = MetaProgression.get();
    const metaDamageBonus = 1 + meta.damageLevel * 0.10;
    
    this.baseRange    = stats.range;
    this.baseFireRate = stats.fireRate;
    this.baseDamage   = Math.round(stats.damage * metaDamageBonus);
    this.baseCost     = stats.cost;
    this.special      = stats.special;
    this.range    = this.baseRange;
    this.damage   = this.baseDamage;
    this.fireRate = this.baseFireRate;

    this.view = new TowerView(scene, this, variant, this.range, TOWER_MAX_LEVEL);
    
    // Setup Priority
    if (variant === 'docs') this.priority = 'strongest';
    else if (variant === 'coffee') this.priority = 'first';
    else this.priority = 'closest';
    
    // Strategy assignment based on special capability
    if (this.special === 'partner') {
      this.behavior = new PartnerBehavior(this);
    } else if (this.special === 'lureChain') {
      this.behavior = new LureChainBehavior(this);
    } else if (this.special === 'aoeSlow') {
      this.behavior = new AoePulseBehavior(this);
    } else {
      this.behavior = new ProjectileBehavior(this);
    }

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  // ── Upgrades ─────────────────────────────────────────────────────────

  public canUpgrade(): boolean {
    return this.level < TOWER_MAX_LEVEL;
  }

  public getUpgradeCost(): number {
    return this.baseCost * this.level;
  }

  public upgrade(): void {
    if (!this.canUpgrade()) return;
    this.level++;
    this.damage   = this.baseDamage + TOWER_UPGRADE_DAMAGE_BONUS * (this.level - 1);
    this.range    = this.baseRange  + TOWER_UPGRADE_RANGE_BONUS  * (this.level - 1);
    this.fireRate = this.baseFireRate * Math.pow(TOWER_UPGRADE_FIRE_RATE_MULT, this.level - 1);
    
    this.view.playUpgradeAnimation(this.level, this.range);
  }

  // ── Per-frame ─────────────────────────────────────────────────────────

  public tick(delta: number, enemies: Coworker[]): void {
    this.behavior.tick(delta, enemies);
  }
}
