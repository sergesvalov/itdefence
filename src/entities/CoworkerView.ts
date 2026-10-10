import Phaser from 'phaser';
import type { CoworkerVariant, CoworkerStats } from '../config';
export const RADIUS = 22;

/** On-screen sprite height at scale 1 */
const SPRITE_HEIGHT = 64;
const HP_BAR_WIDTH = 34;

export class CoworkerView {
  private coBody: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  private readonly useSprite: boolean;
  /** Half the body's on-screen height — anchors the ticket, HP bar and status icons */
  private readonly halfHeight: number;
  private hpBar: Phaser.GameObjects.Graphics;
  private ticket: Phaser.GameObjects.Graphics;
  private sitIcon: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  public hitFlash = 0;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private urgent: boolean,
    variant: CoworkerVariant,
    private stats: CoworkerStats,
    /** The problem this coworker brings (campaign) — shown instead of the plain ticket */
    private problem?: string,
    /** Background of the label for coworkers with a special rule (duplicates, verbal, small issue) */
    labelColor?: string
  ) {
    const specificKey = `sprite-coworker-${variant}`;
    const keyToUse = scene.textures.exists(specificKey) ? specificKey : 'sprite-coworker';
    this.useSprite = scene.textures.exists(keyToUse);
    const bodyParts: Phaser.GameObjects.GameObject[] = [];

    if (this.useSprite) {
      // Fixed height, width from the sprite's own proportions (never squashed)
      const height = SPRITE_HEIGHT * stats.scale;
      const img = scene.add.image(0, 0, keyToUse);
      img.setDisplaySize(height * img.width / img.height, height);
      this.halfHeight = height / 2;
      // Contact shadow so the figure reads against the floor
      bodyParts.push(scene.add.ellipse(0, this.halfHeight - 3, img.displayWidth * 0.95, 12, 0x000000, 0.35));
      this.coBody = img;
      bodyParts.push(this.coBody);
    } else {
      this.halfHeight = RADIUS * stats.scale;
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
    this.sitIcon = scene.add.text(26, -this.halfHeight + 10, '🛋️', { fontSize: '14px' }).setOrigin(0.5).setVisible(false);

    // ── Status Text (Zzz, Slow, etc) ─────────────────────────────────────
    this.statusText = scene.add.text(26, -this.halfHeight + 10, '', { fontSize: '14px' }).setOrigin(0.5);

    this.container.add([...bodyParts, this.ticket, this.hpBar, this.sitIcon, this.statusText]);

    if (problem) {
      this.container.add(scene.add.text(0, -this.halfHeight - 4, problem, {
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: labelColor || urgent ? '#ffffff' : '#1a2330',
        backgroundColor: labelColor ?? (urgent ? '#d63031' : '#ffeaa7'),
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1));
    }

    // ── Armor badge next to the HP bar ───────────────────────────────────
    if (stats.armor) {
      this.container.add(scene.add.text(-HP_BAR_WIDTH / 2 - 9, this.halfHeight + 6, '🛡️', { fontSize: '10px' }).setOrigin(0.5));
    }
  }

  private drawTicket(): void {
    this.ticket.clear();
    if (this.problem) return; // the problem label doubles as the ticket
    const fill = this.urgent ? 0xff7675 : 0xffeaa7;
    const stroke = this.urgent ? 0xd63031 : 0xd4ac0d;
    const top = -this.halfHeight - 13;
    this.ticket.fillStyle(fill);
    this.ticket.fillRect(-7, top, 14, 10);
    this.ticket.lineStyle(1.5, stroke);
    this.ticket.strokeRect(-7, top, 14, 10);

    this.ticket.lineStyle(1, this.urgent ? 0x922b21 : 0xb7950b);
    for (let i = 0; i < 3; i++) {
      this.ticket.lineBetween(-5, top + 2 + i * 3, 5, top + 2 + i * 3);
    }
  }

  public redrawHpBar(hp: number, maxHp: number): void {
    this.hpBar.clear();
    const W = HP_BAR_WIDTH, H = 5;
    const y = this.halfHeight + 3;
    const ratio = Math.max(0, hp / maxHp);
    this.hpBar.fillStyle(0x0e1a26);
    this.hpBar.fillRect(-W / 2 - 1, y - 1, W + 2, H + 2);
    const col = ratio > 0.6 ? 0x2ecc71 : ratio > 0.3 ? 0xf39c12 : 0xe74c3c;
    this.hpBar.fillStyle(col);
    this.hpBar.fillRect(-W / 2, y, W * ratio, H);
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
