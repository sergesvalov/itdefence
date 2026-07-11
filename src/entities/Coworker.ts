import Phaser from 'phaser';
import { SHIELD_DOT_DAMAGE, SHIELD_DOT_INTERVAL_MS, SOFA_SIT_DURATION_MS } from '../config';
import type { Furniture } from './Furniture';
import type { ToolTower } from './ToolTower';

export interface Waypoint {
  x: number;
  y: number;
}

const RADIUS = 14;
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
  // sitCooldown* prevents immediately re-triggering on the same sofa right
  // after standing back up while still touching its edge.
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

  // Child visuals — either the placeholder circle + angry-face emoji, or
  // (if sprite-coworker was loaded) a single tinted image in its place.
  private coBody: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  private readonly useSprite: boolean;
  private hpBar: Phaser.GameObjects.Graphics;
  private ticket: Phaser.GameObjects.Graphics;
  private sitIcon: Phaser.GameObjects.Text;
  private hitFlash = 0;

  constructor(scene: Phaser.Scene, waypoints: Waypoint[], urgent = false) {
    const start = waypoints[0];
    super(scene, start.x, start.y);

    this.waypoints    = waypoints;
    this.waypointIndex = 1; // head towards waypoint[1] immediately
    this.speed        = BASE_SPEED + Phaser.Math.Between(-8, 16);
    this.maxHp        = BASE_HP;
    this.hp           = this.maxHp;
    this.urgent       = urgent;

    // ── Body ─────────────────────────────────────────────────────────────
    this.useSprite = scene.textures.exists('sprite-coworker');
    const bodyParts: Phaser.GameObjects.GameObject[] = [];

    if (this.useSprite) {
      this.coBody = scene.add.image(0, 0, 'sprite-coworker').setDisplaySize(RADIUS * 2, RADIUS * 2.4);
      bodyParts.push(this.coBody);
    } else {
      this.coBody = scene.add.arc(0, 0, RADIUS, 0, 360, false, 0xff7675);
      this.coBody.setStrokeStyle(2, 0xd63031);
      bodyParts.push(this.coBody);
      // Face emoji — only for the placeholder body; a real sprite draws its own face.
      bodyParts.push(scene.add.text(0, -2, '😤', { fontSize: '13px' }).setOrigin(0.5, 0.5));
    }

    // ── Ticket (carried "task") ──────────────────────────────────────────
    this.ticket = scene.add.graphics();
    this.drawTicket();

    // ── HP bar ───────────────────────────────────────────────────────────
    this.hpBar = scene.add.graphics();
    this.redrawHpBar();

    // ── Sofa sit indicator (hidden unless sitting) ─────────────────────────
    this.sitIcon = scene.add.text(0, -32, '💺', { fontSize: '14px' }).setOrigin(0.5).setVisible(false);

    this.add([...bodyParts, this.ticket, this.hpBar, this.sitIcon]);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /** Tints the body — setFillStyle for the placeholder Arc, setTint for a sprite. */
  private tintBody(color: number): void {
    if (this.useSprite) {
      (this.coBody as Phaser.GameObjects.Image).setTint(color);
    } else {
      (this.coBody as Phaser.GameObjects.Arc).setFillStyle(color);
    }
  }

  private drawTicket(): void {
    this.ticket.clear();
    // Urgent (red) tasks carry a visibly different ticket — the player
    // should be able to spot the priority threat before it reaches the desk.
    const fill = this.urgent ? 0xff7675 : 0xffeaa7;
    const stroke = this.urgent ? 0xd63031 : 0xd4ac0d;
    this.ticket.fillStyle(fill);
    this.ticket.fillRect(-7, -30, 14, 10);
    this.ticket.lineStyle(1.5, stroke);
    this.ticket.strokeRect(-7, -30, 14, 10);
    // tiny lines simulating text
    this.ticket.lineStyle(1, this.urgent ? 0x922b21 : 0xb7950b);
    for (let i = 0; i < 3; i++) {
      this.ticket.lineBetween(-5, -28 + i * 3, 5, -28 + i * 3);
    }
  }

  private redrawHpBar(): void {
    this.hpBar.clear();
    const W = 32, H = 4;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.fillStyle(0x2d3436);
    this.hpBar.fillRect(-W / 2, RADIUS + 4, W, H);
    const col = ratio > 0.6 ? 0x00b894 : ratio > 0.3 ? 0xe17055 : 0xd63031;
    this.hpBar.fillStyle(col);
    this.hpBar.fillRect(-W / 2, RADIUS + 4, W * ratio, H);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.hp -= amount;
    this.redrawHpBar();
    this.hitFlash = 120; // ms
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
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => { if (this.scene) this.destroy(); },
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
   * Visually distinct from kill(): squashes and floats up instead of
   * popping, but is otherwise identical (counts as a normal kill for wave
   * progress — see WaveManager).
   */
  public sendToHelpdesk(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.1,
      y: this.y - 20,
      duration: 380,
      ease: 'Quad.In',
      onComplete: () => { if (this.scene) this.destroy(); },
    });
  }

  /**
   * Called by WaveManager when this coworker reaches the desk while the
   * "Я на митинге" shield is up: instead of hitting Petya, they get stuck
   * at the door and take periodic damage until they die or the shield
   * expires (see releaseFromDoor()).
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
    this.sitIcon.setVisible(true);
    const angle = Phaser.Math.Angle.Between(f.x, f.y, this.x, this.y);
    this.x = f.x + Math.cos(angle) * (f.radius * 0.4);
    this.y = f.y + Math.sin(angle) * (f.radius * 0.4);
  }

  /** Stands up, stepping just clear of the sofa so it doesn't sit right back down. */
  private standUp(): void {
    const f = this.sitFurniture;
    this.sitIcon.setVisible(false);
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

    // Hit-flash / waiting-at-door / sitting / stunned / slow tint
    if (this.hitFlash > 0) {
      this.hitFlash -= delta;
      this.tintBody(0xffffff);
    } else if (this.isBlockedAtDoor) {
      this.tintBody(0xf39c12);
    } else if (this.isSitting) {
      this.tintBody(0xffeaa7); // lounging on the sofa
    } else if (this.slowMultiplier === 0) {
      this.tintBody(0xa29bfe); // stunned (Docs' RTFM) — dizzy purple
    } else if (this.slowMultiplier < 1) {
      this.tintBody(0x74b9ff); // slowed — blue
    } else {
      this.tintBody(this.useSprite ? 0xffffff : 0xff7675); // sprite: no tint = its natural colours
    }

    if (this.isBlockedAtDoor) {
      // Stuck at the "Не беспокоить" sign — take periodic damage instead
      // of moving, until it dies or the shield drops (releaseFromDoor()).
      this.waitDamageTimer -= delta;
      if (this.waitDamageTimer <= 0) {
        this.waitDamageTimer = SHIELD_DOT_INTERVAL_MS;
        this.takeDamage(SHIELD_DOT_DAMAGE);
      }
      // Agitated shake instead of the gentle bob.
      this.rotation = Math.sin(this.scene.time.now / 80) * 0.15;
      return;
    }

    if (this.isSitting) {
      this.sitTimer -= delta;
      this.rotation = 0;
      if (this.sitTimer <= 0) this.standUp();
      return;
    }

    // Move toward current waypoint or lure
    let targetX: number;
    let targetY: number;

    if (this.lureTarget && !this.lureTarget.scene) {
      this.lureTarget = null; // tower was sold/removed
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
        // No more waypoints → reached desk
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

    // Solid furniture collision: cabinets/drawers just steer them around;
    // a sofa (off cooldown) stops them entirely and sits them down instead.
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

    // Gentle bob
    this.rotation = Math.sin(this.scene.time.now / 250 + this.x * 0.01) * 0.07;
  }
}
