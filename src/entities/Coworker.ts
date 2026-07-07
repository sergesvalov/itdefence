import Phaser from 'phaser';

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

  private readonly waypoints: Waypoint[];
  private waypointIndex = 0;
  private readonly speed: number;

  // Child visuals
  private coBody: Phaser.GameObjects.Arc;
  private emoji: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private ticket: Phaser.GameObjects.Graphics;
  private hitFlash = 0;

  constructor(scene: Phaser.Scene, waypoints: Waypoint[]) {
    const start = waypoints[0];
    super(scene, start.x, start.y);

    this.waypoints    = waypoints;
    this.waypointIndex = 1; // head towards waypoint[1] immediately
    this.speed        = BASE_SPEED + Phaser.Math.Between(-8, 16);
    this.maxHp        = BASE_HP;
    this.hp           = this.maxHp;

    // ── Body ─────────────────────────────────────────────────────────────
    this.coBody = scene.add.arc(0, 0, RADIUS, 0, 360, false, 0xff7675);
    this.coBody.setStrokeStyle(2, 0xd63031);

    // ── Face emoji ───────────────────────────────────────────────────────
    this.emoji = scene.add.text(0, -2, '😤', { fontSize: '13px' })
      .setOrigin(0.5, 0.5);

    // ── Ticket (carried "task") ──────────────────────────────────────────
    this.ticket = scene.add.graphics();
    this.drawTicket();

    // ── HP bar ───────────────────────────────────────────────────────────
    this.hpBar = scene.add.graphics();
    this.redrawHpBar();

    this.add([this.coBody, this.emoji, this.ticket, this.hpBar]);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private drawTicket(): void {
    this.ticket.clear();
    this.ticket.fillStyle(0xffeaa7);
    this.ticket.fillRect(-7, -30, 14, 10);
    this.ticket.lineStyle(1.5, 0xd4ac0d);
    this.ticket.strokeRect(-7, -30, 14, 10);
    // tiny lines simulating text
    this.ticket.lineStyle(1, 0xb7950b);
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

  // ── Per-frame ─────────────────────────────────────────────────────────

  public tick(delta: number): void {
    if (this.isDead || this.hasReachedDesk) return;

    // Hit-flash tint
    if (this.hitFlash > 0) {
      this.hitFlash -= delta;
      this.coBody.setFillStyle(0xffffff);
    } else {
      this.coBody.setFillStyle(0xff7675);
    }

    // Move toward current waypoint
    const target = this.waypoints[this.waypointIndex];
    if (!target) {
      // No more waypoints → reached desk
      this.hasReachedDesk = true;
      return;
    }

    const dx   = target.x - this.x;
    const dy   = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const dt   = delta / 1000;

    if (dist < 6) {
      this.x = target.x;
      this.y = target.y;
      this.waypointIndex++;
    } else {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    // Gentle bob
    this.rotation = Math.sin(this.scene.time.now / 250 + this.x * 0.01) * 0.07;
  }
}
