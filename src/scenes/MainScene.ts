import Phaser from 'phaser';
import { Coworker, type Waypoint } from '../entities/Coworker';
import { ToolTower, TOWER_SIZE } from '../entities/ToolTower';
import {
  GAME_WIDTH, GAME_HEIGHT,
  OFFICE_Y_TOP, OFFICE_Y_BOTTOM,
  DESK_X, DESK_Y,
  MAX_TASKS,
  SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX,
  STARTING_MONEY, SALARY_AMOUNT, SALARY_INTERVAL_WAVES,
  TOWER_VARIANTS_DATA, type TowerVariant,
  TEXTURE_ASSETS,
} from '../config';

// ─── Spawn door definitions (reception strip along the top edge) ───────────
// One row, below the HUD panel (which sits in the top-left corner) so
// nothing gets visually covered.
const SPAWN_DOORS: Array<{ x: number; y: number; label: string }> = [
  { x: 60,  y: 165, label: 'HR' },
  { x: 180, y: 165, label: 'Finance' },
  { x: 300, y: 165, label: 'PM' },
  { x: 420, y: 165, label: 'Legal' },
];

// Coworkers step down into the office, converge on the desk's column, then
// walk straight down that column to the desk.
function buildPath(door: { x: number; y: number }): Waypoint[] {
  return [
    { x: door.x, y: door.y },
    { x: door.x, y: OFFICE_Y_TOP },  // step down into the office
    { x: DESK_X, y: OFFICE_Y_TOP },  // converge on the desk's column
    { x: DESK_X, y: DESK_Y },        // walk down to the desk
  ];
}

// Order matches how right-click / 1-6 / HUD-tap cycle through variants.
const TOWER_VARIANTS = Object.keys(TOWER_VARIANTS_DATA) as TowerVariant[];

export class MainScene extends Phaser.Scene {
  // ── Entity lists ─────────────────────────────────────────────────────
  private coworkers: Coworker[] = [];
  private towers: ToolTower[] = [];

  // ── Economy ───────────────────────────────────────────────────────────
  private money = STARTING_MONEY;
  private moneyText!: Phaser.GameObjects.Text;

  // ── UI ────────────────────────────────────────────────────────────────
  private tasksOnDesk = 0;
  private taskCounterText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
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
  private isPointerInOffice = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  preload(): void {
    // Textures are optional — see TEXTURE_ASSETS in config.ts and the
    // README files under public/assets/. Files that don't exist yet just
    // 404 quietly; drawMap() falls back to programmatic graphics for
    // whichever slots aren't loaded.
    for (const asset of TEXTURE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    // Reset all round state — scene.restart() re-runs create() on the same
    // Scene instance, so without this a new game would inherit the
    // previous run's money/tasks/wave and could instantly game-over.
    this.money = STARTING_MONEY;
    this.tasksOnDesk = 0;
    this.wave = 1;
    this.waveKills = 0;
    this.isGameOver = false;
    this.selectedVariant = 0;
    this.coworkers = [];
    this.towers = [];

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

    // ── Floor background (base layer, always drawn) ─────────────────────
    gfx.fillStyle(0x1e2a3a);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── Reception strip (top 1/4) + bottom wall strip ────────────────────
    // Same "wall" texture slot for both — they're the non-buildable areas.
    if (this.textures.exists('tile-wall')) {
      this.add.tileSprite(0, 0, GAME_WIDTH, OFFICE_Y_TOP, 'tile-wall').setOrigin(0, 0);
      this.add.tileSprite(0, OFFICE_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - OFFICE_Y_BOTTOM, 'tile-wall').setOrigin(0, 0);
    } else {
      gfx.fillStyle(0x2d3e50);
      gfx.fillRect(0, 0, GAME_WIDTH, OFFICE_Y_TOP);
      gfx.fillRect(0, OFFICE_Y_BOTTOM, GAME_WIDTH, GAME_HEIGHT - OFFICE_Y_BOTTOM);
    }

    // ── Petya's office (bottom 3/4) — the battlefield ───────────────────
    if (this.textures.exists('tile-office-floor')) {
      this.add.tileSprite(0, OFFICE_Y_TOP, GAME_WIDTH, OFFICE_Y_BOTTOM - OFFICE_Y_TOP, 'tile-office-floor').setOrigin(0, 0);
    } else {
      gfx.fillStyle(0x1a5276, 0.55);
      gfx.fillRect(0, OFFICE_Y_TOP, GAME_WIDTH, OFFICE_Y_BOTTOM - OFFICE_Y_TOP);

      // Placeholder floor tile grid — a real floor texture already has its
      // own pattern, so only draw this when there isn't one.
      gfx.lineStyle(1, 0x4a6b8a, 0.25);
      const tileSize = 40;
      for (let x = 0; x < GAME_WIDTH; x += tileSize) {
        gfx.lineBetween(x, OFFICE_Y_TOP, x, OFFICE_Y_BOTTOM);
      }
      for (let y = OFFICE_Y_TOP; y <= OFFICE_Y_BOTTOM; y += tileSize) {
        gfx.lineBetween(0, y, GAME_WIDTH, y);
      }
    }

    // ── Office border lines (gameplay boundary, always drawn) ───────────
    gfx.lineStyle(3, 0x3498db, 0.8);
    gfx.lineBetween(0, OFFICE_Y_TOP,    GAME_WIDTH, OFFICE_Y_TOP);
    gfx.lineBetween(0, OFFICE_Y_BOTTOM, GAME_WIDTH, OFFICE_Y_BOTTOM);

    // ── Spawn doors ───────────────────────────────────────────────────
    const hasDoorSprite = this.textures.exists('sprite-door');
    for (const door of SPAWN_DOORS) {
      if (hasDoorSprite) {
        this.add.image(door.x, door.y, 'sprite-door').setDisplaySize(40, 44);
      } else {
        // Door frame
        gfx.fillStyle(0xe74c3c, 0.9);
        gfx.fillRect(door.x - 20, door.y - 16, 40, 32);
        gfx.lineStyle(2, 0xff6b6b);
        gfx.strokeRect(door.x - 20, door.y - 16, 40, 32);
        // Door knob
        gfx.fillStyle(0xf1c40f);
        gfx.fillCircle(door.x + 12, door.y, 4);
      }
      // Label
      this.add.text(door.x, door.y + 20, door.label, {
        fontSize: '9px',
        color: '#ff7675',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
    }

    // ── "PETYA'S OFFICE" label near the top of the room ─────────────────
    this.add.text(GAME_WIDTH / 2, OFFICE_Y_TOP + 8, "PETYA'S OFFICE", {
      fontSize: '11px',
      color: '#74b9ff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Desk zone warning glow (towers can't be placed too close, always drawn)
    gfx.lineStyle(1, 0xe74c3c, 0.4);
    gfx.strokeCircle(DESK_X, DESK_Y, 60);

    // Desk (+ monitor, baked into the sprite if one is supplied)
    if (this.textures.exists('sprite-desk')) {
      this.add.image(DESK_X, DESK_Y - 10, 'sprite-desk').setDisplaySize(100, 90);
    } else {
      gfx.fillStyle(0x8b4513);
      gfx.fillRect(DESK_X - 45, DESK_Y - 25, 90, 50);
      gfx.lineStyle(2, 0xa0522d);
      gfx.strokeRect(DESK_X - 45, DESK_Y - 25, 90, 50);

      // Computer monitor on desk
      gfx.fillStyle(0x2c3e50);
      gfx.fillRect(DESK_X - 19, DESK_Y - 46, 38, 26);
      gfx.fillStyle(0x1abc9c, 0.8);
      gfx.fillRect(DESK_X - 15, DESK_Y - 42, 30, 18);
      gfx.fillStyle(0x7f8c8d);
      gfx.fillRect(DESK_X - 4, DESK_Y - 20, 8, 6);
    }

    // Petya label
    this.add.text(DESK_X, DESK_Y + 30, '🧑‍💻 Petya', {
      fontSize: '12px',
      color: '#74b9ff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
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
      this.isPointerInOffice = this.isInOffice(ptr.x, ptr.y);
      if (this.isPointerInOffice) {
        this.placementPreview.setPosition(ptr.x, ptr.y);
        this.placementPreview.setVisible(true);
      } else {
        this.placementPreview.setVisible(false);
      }
    });

    // Click to place a tower, or click an existing tower to upgrade it
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.isGameOver) return;
      if (ptr.rightButtonDown()) {
        // Right-click: cycle tower type
        this.selectedVariant = (this.selectedVariant + 1) % TOWER_VARIANTS.length;
        this.updateTowerSelectText();
        return;
      }
      const clickedTower = this.towers.find(
        t => Phaser.Math.Distance.Between(t.x, t.y, ptr.x, ptr.y) < TOWER_SIZE
      );
      if (clickedTower) {
        this.tryUpgradeTower(clickedTower);
        return;
      }
      if (!this.isInOffice(ptr.x, ptr.y)) return;
      if (!this.isPlacementValid(ptr.x, ptr.y)) return;
      this.tryPlaceTower(ptr.x, ptr.y);
    });

    // Keyboard: 1-6 to select tower type directly
    const keys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
    keys.forEach((key, i) => {
      if (i >= TOWER_VARIANTS.length) return;
      this.input.keyboard?.on(`keydown-${key}`, () => {
        this.selectedVariant = i;
        this.updateTowerSelectText();
      });
    });
    this.input.keyboard?.on('keydown-R', () => { if (this.isGameOver) this.restartGame(); });
  }

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

  private tryPlaceTower(x: number, y: number): void {
    const variant = TOWER_VARIANTS[this.selectedVariant];
    const cost = TOWER_VARIANTS_DATA[variant].cost;

    if (this.money < cost) {
      this.showFloatingText(x, y, 'Недостаточно 💰', '#ff6b6b');
      return;
    }
    this.money -= cost;
    this.updateMoneyText();

    const tower = new ToolTower(this, x, y, variant);
    this.towers.push(tower);

    this.showFloatingText(x, y, `-${cost} 💰`, '#ff7675');
    // Quick screen shake
    this.cameras.main.shake(80, 0.003);
  }

  private tryUpgradeTower(tower: ToolTower): void {
    if (!tower.canUpgrade()) {
      this.showFloatingText(tower.x, tower.y, 'Макс. уровень', '#a29bfe');
      return;
    }
    const cost = tower.getUpgradeCost();
    if (this.money < cost) {
      this.showFloatingText(tower.x, tower.y, 'Недостаточно 💰', '#ff6b6b');
      return;
    }
    this.money -= cost;
    this.updateMoneyText();
    tower.upgrade();
    this.showFloatingText(tower.x, tower.y, `Ур. ${tower.level}!`, '#55efc4');
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const txt = this.add.text(x, y - 20, text, {
      fontSize: '13px',
      color,
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);

    this.tweens.add({
      targets: txt,
      y: y - 50,
      alpha: 0,
      duration: 700,
      ease: 'Quad.Out',
      onComplete: () => txt.destroy(),
    });
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
      this.updateWaveText();

      if (this.wave % SALARY_INTERVAL_WAVES === 0) this.paySalary();
    }
  }

  private updateWaveText(): void {
    const wavesToSalary = SALARY_INTERVAL_WAVES - (this.wave % SALARY_INTERVAL_WAVES);
    this.waveText.setText(`🌊 Волна ${this.wave}  (зарплата через ${wavesToSalary})`);
  }

  private paySalary(): void {
    this.money += SALARY_AMOUNT;
    this.updateMoneyText();
    this.showFloatingText(DESK_X, DESK_Y - 40, `+${SALARY_AMOUNT} 💰 Зарплата!`, '#2ecc71');

    this.tweens.add({
      targets: this.moneyText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 150,
      yoyo: true,
      onStart: () => this.moneyText.setColor('#2ecc71'),
      onComplete: () => this.moneyText.setColor('#f1c40f'),
    });
  }

  private updateMoneyText(): void {
    this.moneyText.setText(`💰 ${this.money}`);
  }

  private showWaveAnnouncement(): void {
    const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, `⚠️ WAVE ${this.wave}`, {
      fontSize: '34px', fontStyle: 'bold', color: '#ffeaa7',
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
    // Destroy this run's Phaser objects — create() (re-run by scene.restart())
    // resets all the round-state fields (money, tasks, wave, arrays, ...).
    for (const cw of this.coworkers) cw.destroy();
    for (const t  of this.towers)    t.destroy();
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
    hudBg.fillRoundedRect(pad, pad, 280, 134, 10);
    hudBg.setDepth(15);

    // Money
    this.moneyText = this.add.text(pad + 14, pad + 10, `💰 ${this.money}`, {
      fontSize: '16px',
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setDepth(16);

    // Task counter
    this.taskCounterText = this.add.text(pad + 14, pad + 36, `📋 Tasks on Desk: 0 / ${MAX_TASKS}`, {
      fontSize: '16px',
      color: '#ffeaa7',
      fontStyle: 'bold',
    }).setDepth(16);

    // Wave indicator
    this.waveText = this.add.text(pad + 14, pad + 64, '', { fontSize: '13px', color: '#a29bfe' })
      .setDepth(16);
    this.updateWaveText();

    // Tower selector — tap to cycle type (right-click / 1-2-3 don't exist on touch)
    this.towerSelectText = this.add.text(pad + 14, pad + 86, '', { fontSize: '13px', color: '#74b9ff' })
      .setDepth(16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.selectedVariant = (this.selectedVariant + 1) % TOWER_VARIANTS.length;
        this.updateTowerSelectText();
      });
    this.updateTowerSelectText();

    // Hint text
    this.add.text(pad + 14, pad + 110, 'Тап: кабинет — башня, башня — апгрейд, тип — смена', {
      fontSize: '9px',
      color: '#636e72',
    }).setDepth(16);

    // ── Game Over overlay ─────────────────────────────────────────────
    this.gameOverOverlay = this.buildGameOverOverlay();
    this.gameOverOverlay.setVisible(false);
    this.gameOverOverlay.setDepth(50);
  }

  private updateTowerSelectText(): void {
    const stats = TOWER_VARIANTS_DATA[TOWER_VARIANTS[this.selectedVariant]];
    this.towerSelectText.setText(`🔧 Building: ${stats.icon} ${stats.label} (💰${stats.cost})`);
  }

  private buildGameOverOverlay(): Phaser.GameObjects.Container {
    const overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Dark veil
    const veil = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x1e2a3a, 1);
    panel.fillRoundedRect(-190, -170, 380, 340, 18);
    panel.lineStyle(3, 0xe74c3c, 0.9);
    panel.strokeRoundedRect(-190, -170, 380, 340, 18);

    const title = this.add.text(0, -110, '💀 GAME OVER', {
      fontSize: '34px', fontStyle: 'bold', color: '#e74c3c',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    const sub = this.add.text(0, -40, "Petya's desk is buried in tasks!", {
      fontSize: '15px', color: '#dfe6e9', align: 'center', wordWrap: { width: 320 },
    }).setOrigin(0.5);

    const hint = this.add.text(0, 30, 'Press  R  to try again', {
      fontSize: '20px', color: '#74b9ff', fontStyle: 'bold',
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
