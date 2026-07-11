import Phaser from 'phaser';
import { SHIELD_DOT_DAMAGE, SHIELD_DOT_INTERVAL_MS, SOFA_SIT_DURATION_MS } from '../config';
import type { Furniture } from './Furniture';
import type { ToolTower } from './ToolTower';
import { CoworkerView, RADIUS } from './CoworkerView';

export interface Waypoint {
  x: number;
  y: number;
}

const BASE_SPEED = 65;
const BASE_HP = 4;

/**
 * Coworker – the enemy unit.
 * Follows a waypoint path toward Petya's desk carrying a task ticket.
 */
export class Coworker extends Phaser.GameObjects.Container {
  public hp: number;
  public readonly maxHp: number;
  public isDead = false;
  public hasReachedDesk = false;
  /** Red/urgent task — jumps the Inbox queue on arrival (see Inbox.enqueue()). */
  public readonly urgent: boolean;

  private readonly waypoints: Waypoint[];
  private waypointIndex = 0;
  private readonly speed: number;
  private slowMultiplier = 1;
  private slowUntil = 0;
  private isBlockedAtDoor = false;
  private waitDamageTimer = 0;

  // Sofa contact: stops and sits for SOFA_SIT_DURATION_MS instead of moving.
  private isSitting = false;
  private sitTimer = 0;
  private sitFurniture: Furniture | null = null;
  private sitCooldownFurniture: Furniture | null = null;
  private sitCooldownUntil = 0;

  // Lure mechanic (for Cooler tower)
  public visitedCoolers = new Set<ToolTower>();
  private lureTarget: ToolTower | null = null;
  public partnerTarget: ToolTower | null = null;
  private hasRolledForPartner = false;

  private view: CoworkerView;

  constructor(scene: Phaser.Scene, waypoints: Waypoint[], urgent = false) {
    const start = waypoints[0];
    super(scene, start.x, start.y);

    this.waypoints    = waypoints;
    this.waypointIndex = 1; // head towards waypoint[1] immediately
    this.speed        = BASE_SPEED + Phaser.Math.Between(-8, 16);
    this.maxHp        = BASE_HP;
    this.hp           = this.maxHp;
    this.urgent       = urgent;

    this.view = new CoworkerView(scene, this, urgent);
    this.view.redrawHpBar(this.hp, this.maxHp);

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.hp -= amount;
    this.view.redrawHpBar(this.hp, this.maxHp);
    this.view.triggerHitFlash();
    if (this.hp <= 0) this.kill();
  }

  public setLure(tower: ToolTower): void {
    this.lureTarget = tower;
  }

  public getLure(): ToolTower | null {
    return this.lureTarget;
  }

  public clearLure(): void {
    this.lureTarget = null;
  }

  public kill(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.view.playDeathAnimation(() => {
      if (this.scene) this.destroy();
    });
  }

  /**
   * Slows movement to `multiplier`× speed for `durationMs` (coffee tower,
   * router's pulse). A multiplier of 0 is a full stun (Docs' RTFM hit) —
   * same mechanism, just frozen instead of merely slowed.
   */
  public applySlow(multiplier: number, durationMs: number): void {
    this.slowMultiplier = multiplier;
    this.slowUntil = this.scene.time.now + durationMs;
  }

  /**
   * Removed by the "Создай тикет" ultimate — too lazy to file an official
   * ticket, so they just deflate and leave instead of dying in combat.
   */
  public sendToHelpdesk(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.view.playHelpdeskAnimation(() => {
      if (this.scene) this.destroy();
    });
  }

  /**
   * Called by WaveManager when this coworker reaches the desk while the
   * "Я на митинге" shield is up.
   */
  public blockAtDoor(): void {
    if (this.isBlockedAtDoor) return;
    this.isBlockedAtDoor = true;
    this.hasReachedDesk = false;
    this.waitDamageTimer = SHIELD_DOT_INTERVAL_MS;
  }

  /** Shield expired while this coworker was still waiting — they barge in. */
  public releaseFromDoor(): void {
    if (!this.isBlockedAtDoor) return;
    this.isBlockedAtDoor = false;
    this.hasReachedDesk = true;
  }

  /** Sofa contact: stop and sit for a while (towers can still hit them). */
  private sitDown(f: Furniture): void {
    this.isSitting = true;
    this.sitTimer = SOFA_SIT_DURATION_MS;
    this.sitFurniture = f;
    this.view.setSitIconVisible(true);
    const angle = Phaser.Math.Angle.Between(f.x, f.y, this.x, this.y);
    this.x = f.x + Math.cos(angle) * (f.radius * 0.4);
    this.y = f.y + Math.sin(angle) * (f.radius * 0.4);
  }

  /** Stands up, stepping just clear of the sofa so it doesn't sit right back down. */
  private standUp(): void {
    const f = this.sitFurniture;
    this.view.setSitIconVisible(false);
    if (f) {
      const angle = Phaser.Math.Angle.Between(f.x, f.y, this.x, this.y);
      const pushDist = RADIUS + f.radius + 4;
      this.x = f.x + Math.cos(angle) * pushDist;
      this.y = f.y + Math.sin(angle) * pushDist;
      this.sitCooldownFurniture = f;
      this.sitCooldownUntil = this.scene.time.now + 1500;
    }
    this.isSitting = false;
    this.sitFurniture = null;
  }

  // ── Per-frame ─────────────────────────────────────────────────────────

  public tick(delta: number, furniture: Furniture[], towers: ToolTower[]): void {
    if (this.isDead || this.hasReachedDesk) return;
    
    this.setDepth(this.y);

    if (!this.hasRolledForPartner) {
      this.hasRolledForPartner = true;
      if (Math.random() < 0.5) {
        const activePartners = towers.filter(t => t.variant === 'partner' && t.tasksSolved < 10);
        if (activePartners.length > 0) {
          this.partnerTarget = Phaser.Utils.Array.GetRandom(activePartners);
        }
      }
    }

    if (this.partnerTarget && (!this.partnerTarget.scene || this.partnerTarget.tasksSolved >= 10)) {
      this.partnerTarget = null;
    }

    if (this.slowUntil > 0 && this.scene.time.now > this.slowUntil) {
      this.slowMultiplier = 1;
      this.slowUntil = 0;
    }

    this.view.updateVisuals(delta, this.isBlockedAtDoor, this.isSitting, this.slowMultiplier);

    if (this.isBlockedAtDoor) {
      this.waitDamageTimer -= delta;
      if (this.waitDamageTimer <= 0) {
        this.waitDamageTimer = SHIELD_DOT_INTERVAL_MS;
        this.takeDamage(SHIELD_DOT_DAMAGE);
      }
      this.rotation = Math.sin(this.scene.time.now / 80) * 0.15;
      return;
    }

    if (this.isSitting) {
      this.sitTimer -= delta;
      this.rotation = 0;
      if (this.sitTimer <= 0) this.standUp();
      return;
    }

    let targetX: number;
    let targetY: number;

    if (this.lureTarget && !this.lureTarget.scene) {
      this.lureTarget = null; 
    }

    if (this.lureTarget) {
      targetX = this.lureTarget.x;
      targetY = this.lureTarget.y;
    } else if (this.partnerTarget) {
      targetX = this.partnerTarget.x;
      targetY = this.partnerTarget.y;
    } else {
      const target = this.waypoints[this.waypointIndex];
      if (!target) {
        this.hasReachedDesk = true;
        return;
      }
      targetX = target.x;
      targetY = target.y;
    }

    const dx   = targetX - this.x;
    const dy   = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const dt   = delta / 1000;
    const effectiveSpeed = this.speed * this.slowMultiplier;

    let nx = this.x;
    let ny = this.y;
    const reachedTarget = dist < 6;
    if (reachedTarget) {
      nx = targetX;
      ny = targetY;
    } else {
      nx = this.x + (dx / dist) * effectiveSpeed * dt;
      ny = this.y + (dy / dist) * effectiveSpeed * dt;
    }

    for (const f of furniture) {
      const fd = Phaser.Math.Distance.Between(nx, ny, f.x, f.y);
      const minDist = RADIUS + f.radius;
      if (fd >= minDist) continue;

      const onCooldown = this.sitCooldownFurniture === f && this.scene.time.now < this.sitCooldownUntil;
      if (f.type === 'sofa' && !onCooldown) {
        this.sitDown(f);
        return;
      }

      const pushAngle = fd > 0.01
        ? Phaser.Math.Angle.Between(f.x, f.y, nx, ny)
        : Phaser.Math.Angle.Between(f.x, f.y, targetX, targetY);
      nx = f.x + Math.cos(pushAngle) * minDist;
      ny = f.y + Math.sin(pushAngle) * minDist;
    }

    this.x = nx;
    this.y = ny;
    if (reachedTarget && !this.lureTarget) {
      this.waypointIndex++;
    }

    this.rotation = Math.sin(this.scene.time.now / 250 + this.x * 0.01) * 0.07;
  }
}
