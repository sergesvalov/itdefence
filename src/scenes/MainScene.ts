import Phaser from 'phaser';
import { Coworker, type Waypoint } from '../entities/Coworker';
import { ToolTower } from '../entities/ToolTower';
import {
  GAME_WIDTH, GAME_HEIGHT,
  HALLWAY_Y_TOP, HALLWAY_Y_BOTTOM,
  DESK_X, DESK_Y,
  MAX_TASKS,
  SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX,
} from '../config';

// ─── Spawn door definitions ────────────────────────────────────────────────
const SPAWN_DOORS: Array<{ x: number; y: number; label: string }> = [
  { x: 40,  y: 200, label: 'HR' },
  { x: 40,  y: 440, label: 'Finance' },
  { x: 200, y: 140, label: 'PM' },
  { x: 200, y: 500, label: 'Legal' },
];

// Coworkers take a bent path through the hallway then straight to the desk
function buildPath(door: { x: number; y: number }): Waypoint[] {
  return [
    { x: door.x, y: door.y },
    { x: 120,    y: door.y },        // step into hallway corridor
    { x: 120,    y: DESK_Y },         // walk to desk row
    { x: DESK_X, y: DESK_Y },        // arrive at desk
  ];
}

const TOWER_VARIANTS = ['script', 'router', 'docs'] as const;

export class MainScene extends Phaser.Scene {
  // ── Entity lists ─────────────────────────────────────────────────────
  private coworkers: Coworker[] = [];
  private towers: ToolTower[] = [];

  // ── UI ────────────────────────────────────────────────────────────────
  private tasksOnDesk = 0;
  private taskCounterText!: Phaser.GameObjects.Text;
  private towerSelectText!: Phaser.GameObjects.Text;
  private gameOverOverlay!: Phaser.GameObjects.Container;

  // ── State ─────────────────────────────────────────────────────────────
  private isGameOver = false;
  private spawnTimer = 0;
  private spawnInterval = 2500;
  private selectedVariant = 0; // index into TOWER_VARIANTS
  private wave = 1;
  private waveKills = 0;
  private readonly KILLS_PER_WAVE = 8;

  // ── Placement preview ─────────────────────────────────────────────────
  private placementPreview!: Phaser.GameObjects.Arc;
  private isPointerInHallway = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  create(): void {
    this.drawMap();
    this.setupPlacementPreview();
    this.setupInput();
    this.buildUI();
    this.scheduleNextSpawn();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    // Tick enemies
    for (let i = this.coworkers.length - 1; i >= 0; i--) {
      const cw = this.coworkers[i];
      cw.tick(delta);

      if (cw.hasReachedDesk && !cw.isDead) {
        cw.isDead = true;
        cw.setVisible(false);
        cw.destroy();
        this.coworkers.splice(i, 1);
        this.onTaskReachedDesk();
      } else if (cw.isDead) {
        this.coworkers.splice(i, 1);
        this.waveKills++;
        this.checkWaveProgress();
      }
    }

    // Tick towers
    for (const tower of this.towers) {
      tower.tick(delta, this.coworkers);
    }

    // Spawn timer
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnCoworker();
      this.scheduleNextSpawn();
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // MAP DRAWING
  // ──────────────────────────────────────────────────────────────────────

  private drawMap(): void {
    const gfx = this.add.graphics();

    // ── Floor background ──────────────────────────────────────────────
    gfx.fillStyle(0x1e2a3a);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── Outer office walls ────────────────────────────────────────────
    gfx.fillStyle(0x2d3e50);
    gfx.fillRect(0, 0, GAME_WIDTH, HALLWAY_Y_TOP);
    gfx.fillRect(0, HALLWAY_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - HALLWAY_Y_BOTTOM);

    // ── Hallway floor ─────────────────────────────────────────────────
    gfx.fillStyle(0x34495e, 0.6);
    gfx.fillRect(0, HALLWAY_Y_TOP, GAME_WIDTH, HALLWAY_Y_BOTTOM - HALLWAY_Y_TOP);

    // ── Hallway floor tiles ───────────────────────────────────────────
    gfx.lineStyle(1, 0x4a6b8a, 0.25);
    const tileSize = 40;
    for (let x = 0; x < GAME_WIDTH; x += tileSize) {
      gfx.lineBetween(x, HALLWAY_Y_TOP, x, HALLWAY_Y_BOTTOM);
    }
    for (let y = HALLWAY_Y_TOP; y <= HALLWAY_Y_BOTTOM; y += tileSize) {
      gfx.lineBetween(0, y, GAME_WIDTH, y);
    }

    // ── Hallway border lines ──────────────────────────────────────────
    gfx.lineStyle(3, 0x5dade2, 0.7);
    gfx.lineBetween(0, HALLWAY_Y_TOP,    GAME_WIDTH, HALLWAY_Y_TOP);
    gfx.lineBetween(0, HALLWAY_Y_BOTTOM, GAME_WIDTH, HALLWAY_Y_BOTTOM);

    // ── Spawn doors ───────────────────────────────────────────────────
    for (const door of SPAWN_DOORS) {
      // Door frame
      gfx.fillStyle(0xe74c3c, 0.9);
      gfx.fillRect(door.x - 20, door.y - 22, 40, 44);
      gfx.lineStyle(2, 0xff6b6b);
      gfx.strokeRect(door.x - 20, door.y - 22, 40, 44);
      // Door knob
      gfx.fillStyle(0xf1c40f);
      gfx.fillCircle(door.x + 12, door.y, 4);
      // Label
      this.add.text(door.x, door.y + 30, door.label, {
        fontSize: '10px',
        color: '#ff7675',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
    }

    // ── Petya's office (right side) ───────────────────────────────────
    const officeX = 760, officeY = 80;
    const officeW = GAME_WIDTH - officeX - 10, officeH = GAME_HEIGHT - 160;

    gfx.fillStyle(0x1a5276, 0.9);
    gfx.fillRect(officeX, officeY, officeW, officeH);
    gfx.lineStyle(3, 0x3498db, 0.9);
    gfx.strokeRect(officeX, officeY, officeW, officeH);

    // Office door gap
    gfx.fillStyle(0x34495e, 0.6);
    gfx.fillRect(officeX - 1, DESK_Y - 30, 4, 60);

    // Desk
    gfx.fillStyle(0x8b4513);
    gfx.fillRect(DESK_X - 50, DESK_Y - 30, 90, 55);
    gfx.lineStyle(2, 0xa0522d);
    gfx.strokeRect(DESK_X - 50, DESK_Y - 30, 90, 55);

    // Computer monitor on desk
    gfx.fillStyle(0x2c3e50);
    gfx.fillRect(DESK_X - 20, DESK_Y - 52, 38, 28);
    gfx.fillStyle(0x1abc9c, 0.8);
    gfx.fillRect(DESK_X - 16, DESK_Y - 48, 30, 20);
    gfx.fillStyle(0x7f8c8d);
    gfx.fillRect(DESK_X - 5, DESK_Y - 24, 8, 6);

    // Petya label
    this.add.text(DESK_X, DESK_Y + 34, '🧑‍💻 Petya', {
      fontSize: '12px',
      color: '#74b9ff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Office label
    this.add.text(officeX + officeW / 2, officeY + 12, "PETYA'S OFFICE", {
      fontSize: '11px',
      color: '#3498db',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Desk zone warning glow (player can't place here)
    gfx.lineStyle(1, 0xe74c3c, 0.4);
    gfx.strokeCircle(DESK_X, DESK_Y, 60);
  }

  // ──────────────────────────────────────────────────────────────────────
  // INPUT & PLACEMENT
  // ──────────────────────────────────────────────────────────────────────

  private setupPlacementPreview(): void {
    this.placementPreview = this.add.arc(0, 0, 26, 0, 360, false, 0x0984e3, 0.45);
    this.placementPreview.setStrokeStyle(2, 0x74b9ff, 0.8);
    this.placementPreview.setVisible(false);
    this.placementPreview.setDepth(10);
  }

  private setupInput(): void {
    // Track pointer for placement preview
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.isPointerInHallway = this.isInHallway(ptr.x, ptr.y);
      if (this.isPointerInHallway) {
        this.placementPreview.setPosition(ptr.x, ptr.y);
        this.placementPreview.setVisible(true);
      } else {
        this.placementPreview.setVisible(false);
      }
    });

    // Click to place tower
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.isGameOver) return;
      if (ptr.rightButtonDown()) {
        // Right-click: cycle tower type
        this.selectedVariant = (this.selectedVariant + 1) % TOWER_VARIANTS.length;
        this.updateTowerSelectText();
        return;
      }
      if (!this.isInHallway(ptr.x, ptr.y)) return;
      if (!this.isPlacementValid(ptr.x, ptr.y)) return;
      this.placeTower(ptr.x, ptr.y);
    });

    // Keyboard: 1/2/3 to select tower type
    this.input.keyboard?.on('keydown-ONE',   () => { this.selectedVariant = 0; this.updateTowerSelectText(); });
    this.input.keyboard?.on('keydown-TWO',   () => { this.selectedVariant = 1; this.updateTowerSelectText(); });
    this.input.keyboard?.on('keydown-THREE', () => { this.selectedVariant = 2; this.updateTowerSelectText(); });
    this.input.keyboard?.on('keydown-R',     () => { if (this.isGameOver) this.restartGame(); });
  }

  private isInHallway(x: number, y: number): boolean {
    const margin = 30;
    return (
      y > HALLWAY_Y_TOP + margin &&
      y < HALLWAY_Y_BOTTOM - margin &&
      x > 280 &&                       // don't block spawn entrance
      x < DESK_X - 80                  // don't block the desk itself
    );
  }

  private isPlacementValid(x: number, y: number): boolean {
    // Can't stack towers too close together
    for (const t of this.towers) {
      if (Phaser.Math.Distance.Between(t.x, t.y, x, y) < 52) return false;
    }
    return true;
  }

  private placeTower(x: number, y: number): void {
    const variant = TOWER_VARIANTS[this.selectedVariant];
    const tower = new ToolTower(this, x, y, variant);
    this.towers.push(tower);

    // Quick screen shake
    this.cameras.main.shake(80, 0.003);
  }

  // ──────────────────────────────────────────────────────────────────────
  // SPAWNING
  // ──────────────────────────────────────────────────────────────────────

  private scheduleNextSpawn(): void {
    this.spawnTimer = Phaser.Math.Between(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);
    // Faster in later waves
    const waveSpeed = Math.max(0.45, 1 - (this.wave - 1) * 0.08);
    this.spawnTimer *= waveSpeed;
  }

  private spawnCoworker(): void {
    const door = SPAWN_DOORS[Phaser.Math.Between(0, SPAWN_DOORS.length - 1)];
    const path = buildPath(door);
    const cw = new Coworker(this, path);
    this.coworkers.push(cw);
  }

  // ──────────────────────────────────────────────────────────────────────
  // GAME LOGIC
  // ──────────────────────────────────────────────────────────────────────

  private onTaskReachedDesk(): void {
    this.tasksOnDesk++;
    this.taskCounterText.setText(`📋 Tasks on Desk: ${this.tasksOnDesk} / ${MAX_TASKS}`);

    // Flash the counter red
    this.tweens.add({
      targets: this.taskCounterText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 120,
      yoyo: true,
      onStart: () => this.taskCounterText.setColor('#ff6b6b'),
      onComplete: () => this.taskCounterText.setColor('#ffeaa7'),
    });

    if (this.tasksOnDesk >= MAX_TASKS) this.triggerGameOver();
  }

  private checkWaveProgress(): void {
    if (this.waveKills >= this.KILLS_PER_WAVE * this.wave) {
      this.wave++;
      this.waveKills = 0;
      this.showWaveAnnouncement();
    }
  }

  private showWaveAnnouncement(): void {
    const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, `⚠️ WAVE ${this.wave}`, {
      fontSize: '42px', fontStyle: 'bold', color: '#ffeaa7',
      stroke: '#2d3436', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: txt,
      alpha: 0,
      y: GAME_HEIGHT / 2 - 110,
      duration: 1800,
      ease: 'Quad.Out',
      onComplete: () => txt.destroy(),
    });
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    console.log('Game Over – Petya is overwhelmed by tasks!');
    this.gameOverOverlay.setVisible(true);
    this.cameras.main.shake(600, 0.012);
  }

  private restartGame(): void {
    // Clean up
    for (const cw of this.coworkers) cw.destroy();
    for (const t  of this.towers)    t.destroy();
    this.coworkers = [];
    this.towers    = [];
    this.scene.restart();
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────────

  private buildUI(): void {
    const pad = 12;

    // ── Top-left HUD panel ────────────────────────────────────────────
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.55);
    hudBg.fillRoundedRect(pad, pad, 280, 110, 10);
    hudBg.setDepth(15);

    // Task counter
    this.taskCounterText = this.add.text(pad + 14, pad + 12, `📋 Tasks on Desk: 0 / ${MAX_TASKS}`, {
      fontSize: '16px',
      color: '#ffeaa7',
      fontStyle: 'bold',
    }).setDepth(16);

    // Wave indicator
    this.add.text(pad + 14, pad + 40, '', { fontSize: '13px', color: '#a29bfe' })
      .setDepth(16)
      .setName('waveTxt');

    // Tower selector
    this.towerSelectText = this.add.text(pad + 14, pad + 62, '', { fontSize: '13px', color: '#74b9ff' })
      .setDepth(16);
    this.updateTowerSelectText();

    // Hint text
    this.add.text(pad + 14, pad + 86, 'Click hallway to build  |  R-click / 1-2-3 to switch', {
      fontSize: '10px',
      color: '#636e72',
    }).setDepth(16);

    // ── Game Over overlay ─────────────────────────────────────────────
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.gameOverOverlay.setVisible(false);
    this.gameOverOverlay.setDepth(50);
  }

  private updateTowerSelectText(): void {
    const icons = ['📜 Script', '📡 Router', '📖 Docs'];
    this.towerSelectText.setText(`🔧 Building: ${icons[this.selectedVariant]}`);
  }

  private buildGameOverOverlay(): Phaser.GameObjects.Container {
    const overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Dark veil
    const veil = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x1e2a3a, 1);
    panel.fillRoundedRect(-240, -160, 480, 320, 18);
    panel.lineStyle(3, 0xe74c3c, 0.9);
    panel.strokeRoundedRect(-240, -160, 480, 320, 18);

    const title = this.add.text(0, -110, '💀 GAME OVER', {
      fontSize: '46px', fontStyle: 'bold', color: '#e74c3c',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    const sub = this.add.text(0, -45, "Petya's desk is buried in tasks!", {
      fontSize: '18px', color: '#dfe6e9',
    }).setOrigin(0.5);

    const hint = this.add.text(0, 20, 'Press  R  to try again', {
      fontSize: '22px', color: '#74b9ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Pulsing hint
    this.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    overlay.add([veil, panel, title, sub, hint]);
    return overlay;
  }
}
