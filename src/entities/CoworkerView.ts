import Phaser from 'phaser';
import type { CoworkerVariant, CoworkerStats } from '../config';
export const RADIUS = 22;

export class CoworkerView {
  private coBody: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  private readonly useSprite: boolean;
  private hpBar: Phaser.GameObjects.Graphics;
  private ticket: Phaser.GameObjects.Graphics;
  private sitIcon: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  public hitFlash = 0;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private urgent: boolean,
    private variant: CoworkerVariant,
    private stats: CoworkerStats
  ) {
    const specificKey = `sprite-coworker-${variant}`;
    const keyToUse = scene.textures.exists(specificKey) ? specificKey : 'sprite-coworker';
    this.useSprite = scene.textures.exists(keyToUse);
    const bodyParts: Phaser.GameObjects.GameObject[] = [];

    if (this.useSprite) {
      this.coBody = scene.add.image(0, 0, keyToUse).setDisplaySize(RADIUS * 2 * stats.scale, RADIUS * 2.4 * stats.scale);
      bodyParts.push(this.coBody);
    } else {
      this.coBody = scene.add.arc(0, 0, RADIUS * stats.scale, 0, 360, false, stats.tint);
      this.coBody.setStrokeStyle(2, 0xd63031);
      bodyParts.push(this.coBody);
      // Face emoji
      bodyParts.push(scene.add.text(0, -2, '😤', { fontSize: '13px' }).setOrigin(0.5, 0.5));
    }
    
    if (stats.emoji && !this.useSprite) {
      bodyParts.push(scene.add.text(0, -RADIUS * stats.scale - 12, stats.emoji, { fontSize: '16px' }).setOrigin(0.5));
    }

    // ── Ticket (carried "task") ──────────────────────────────────────────
    this.ticket = scene.add.graphics();
    this.drawTicket();

    // ── HP bar ───────────────────────────────────────────────────────────
    this.hpBar = scene.add.graphics();

    // ── Sofa sit indicator (hidden unless sitting) ─────────────────────────
    this.sitIcon = scene.add.text(0, -32, '🛋️', { fontSize: '14px' }).setOrigin(0.5).setVisible(false);
    
    // ── Status Text (Zzz, Slow, etc) ─────────────────────────────────────
    this.statusText = scene.add.text(0, -RADIUS * stats.scale - 20, '', { fontSize: '14px' }).setOrigin(0.5);

    this.container.add([...bodyParts, this.ticket, this.hpBar, this.sitIcon, this.statusText]);
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
      this.statusText.setText('Zzz');
    } else if (slowMultiplier < 1) {
      this.tintBody(0x74b9ff);
      this.statusText.setText('🥶');
    } else {
      this.tintBody(this.useSprite ? 0xffffff : this.stats.tint);
      this.statusText.setText('');
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
    // Paper burst particles
    for (let i = 0; i < 10; i++) {
      const p = this.scene.add.rectangle(this.container.x, this.container.y, 6, 8, 0xffffff).setDepth(20);
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 40;
      this.scene.tweens.add({
        targets: p,
        x: this.container.x + Math.cos(angle) * dist,
        y: this.container.y + Math.sin(angle) * dist,
        rotation: Math.random() * 4 - 2,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        ease: 'Cubic.Out',
        onComplete: () => p.destroy()
      });
    }

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
    // Red ticket burst particles
    for (let i = 0; i < 8; i++) {
      const p = this.scene.add.rectangle(this.container.x, this.container.y, 10, 14, 0xff7675).setDepth(20);
      p.setStrokeStyle(1, 0xd63031);
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 50;
      this.scene.tweens.add({
        targets: p,
        x: this.container.x + Math.cos(angle) * dist,
        y: this.container.y - 20 + Math.sin(angle) * dist,
        rotation: Math.random() * 8 - 4,
        alpha: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.Out',
        onComplete: () => p.destroy()
      });
    }

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
