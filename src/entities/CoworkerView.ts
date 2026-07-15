import Phaser from 'phaser';
import type { CoworkerVariant, CoworkerStats } from '../config';
export const RADIUS = 22;

export class CoworkerView {
  private coBody: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  private readonly useSprite: boolean;
  private hpBar: Phaser.GameObjects.Graphics;
  private ticket: Phaser.GameObjects.Graphics;
  private sitIcon: Phaser.GameObjects.Text;
  public hitFlash = 0;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private urgent: boolean,
    private variant: CoworkerVariant,
    private stats: CoworkerStats
  ) {
    this.useSprite = scene.textures.exists('sprite-coworker');
    const bodyParts: Phaser.GameObjects.GameObject[] = [];

    if (this.useSprite) {
      this.coBody = scene.add.image(0, 0, 'sprite-coworker').setDisplaySize(RADIUS * 2 * stats.scale, RADIUS * 2.4 * stats.scale);
      bodyParts.push(this.coBody);
    } else {
      this.coBody = scene.add.arc(0, 0, RADIUS * stats.scale, 0, 360, false, stats.tint);
      this.coBody.setStrokeStyle(2, 0xd63031);
      bodyParts.push(this.coBody);
      // Face emoji
      bodyParts.push(scene.add.text(0, -2, '😤', { fontSize: '13px' }).setOrigin(0.5, 0.5));
    }
    
    if (stats.emoji) {
      bodyParts.push(scene.add.text(0, -RADIUS * stats.scale - 12, stats.emoji, { fontSize: '16px' }).setOrigin(0.5));
    }

    // ── Ticket (carried "task") ──────────────────────────────────────────
    this.ticket = scene.add.graphics();
    this.drawTicket();

    // ── HP bar ───────────────────────────────────────────────────────────
    this.hpBar = scene.add.graphics();

    // ── Sofa sit indicator (hidden unless sitting) ─────────────────────────
    this.sitIcon = scene.add.text(0, -32, '💺', { fontSize: '14px' }).setOrigin(0.5).setVisible(false);

    this.container.add([...bodyParts, this.ticket, this.hpBar, this.sitIcon]);
  }

  private drawTicket(): void {
    this.ticket.clear();
    const fill = this.urgent ? 0xff7675 : 0xffeaa7;
    const stroke = this.urgent ? 0xd63031 : 0xd4ac0d;
    this.ticket.fillStyle(fill);
    this.ticket.fillRect(-7, -30, 14, 10);
    this.ticket.lineStyle(1.5, stroke);
    this.ticket.strokeRect(-7, -30, 14, 10);
    
    this.ticket.lineStyle(1, this.urgent ? 0x922b21 : 0xb7950b);
    for (let i = 0; i < 3; i++) {
      this.ticket.lineBetween(-5, -28 + i * 3, 5, -28 + i * 3);
    }
  }

  public redrawHpBar(hp: number, maxHp: number): void {
    this.hpBar.clear();
    const W = 32, H = 4;
    const ratio = Math.max(0, hp / maxHp);
    this.hpBar.fillStyle(0x2d3436);
    this.hpBar.fillRect(-W / 2, RADIUS + 4, W, H);
    const col = ratio > 0.6 ? 0x00b894 : ratio > 0.3 ? 0xe17055 : 0xd63031;
    this.hpBar.fillStyle(col);
    this.hpBar.fillRect(-W / 2, RADIUS + 4, W * ratio, H);
  }

  public setSitIconVisible(visible: boolean): void {
    this.sitIcon.setVisible(visible);
  }

  public triggerHitFlash(): void {
    this.hitFlash = 120;
  }

  public updateVisuals(
    delta: number,
    isBlockedAtDoor: boolean,
    isSitting: boolean,
    slowMultiplier: number
  ): void {
    if (this.hitFlash > 0) {
      this.hitFlash -= delta;
      this.tintBody(0xffffff);
    } else if (isBlockedAtDoor) {
      this.tintBody(0xf39c12);
    } else if (isSitting) {
      this.tintBody(0xffeaa7);
    } else if (slowMultiplier === 0) {
      this.tintBody(0xa29bfe);
    } else if (slowMultiplier < 1) {
      this.tintBody(0x74b9ff);
    } else {
      this.tintBody(this.stats.tint);
    }
  }

  private tintBody(color: number): void {
    if (this.useSprite) {
      (this.coBody as Phaser.GameObjects.Image).setTint(color);
    } else {
      (this.coBody as Phaser.GameObjects.Arc).setFillStyle(color);
    }
  }

  public playDeathAnimation(onComplete: () => void): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 220,
      ease: 'Quad.Out',
      onComplete,
    });
  }

  public playHelpdeskAnimation(onComplete: () => void): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.1,
      y: this.container.y - 20,
      duration: 380,
      ease: 'Quad.In',
      onComplete,
    });
  }
}
