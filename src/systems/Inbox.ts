import type Phaser from 'phaser';
import { DESK_X, DESK_Y } from '../config';
import type { HUD } from '../ui/HUD';
import { showFloatingText } from '../ui/FloatingText';

/** A single ticket sitting in Petya's Inbox, waiting to be resolved. */
export interface Task {
  readonly id: number;
  /** Red/urgent tasks jump to the front of the queue on arrival (see enqueue()). */
  readonly urgent: boolean;
}

/**
 * Inbox — the task queue behind "Очередь задач" / "Саморешаемые задачи".
 * Coworkers who reach the desk no longer hit Petya directly (see
 * WaveManager's onTaskArrived callback) — they drop a Task here instead.
 * Petya auto-resolves the task at the front of the queue every
 * `resolveIntervalMs`, regardless of what the player does — that's the
 * "self-resolving" part. Urgent (red) tasks are inserted at the front
 * instead of the back — a priority jump, not strict FIFO. If the queue
 * ever grows past `limit`, the game is over.
 */
export class Inbox {
  private queue: Task[] = [];
  private resolveTimer: number;
  private nextId = 0;
  private isOver = false;

  constructor(
    private scene: Phaser.Scene,
    private hud: HUD,
    private readonly limit: number,
    private readonly resolveIntervalMs: number,
    private onOverflow: () => void,
  ) {
    this.resolveTimer = resolveIntervalMs;
    this.hud.setInbox(this.queue, this.limit);
  }

  get size(): number {
    return this.queue.length;
  }

  /** Called when a coworker reaches the desk — throws their ticket in the Inbox. */
  enqueue(urgent: boolean): void {
    if (this.isOver) return;

    const task: Task = { id: this.nextId++, urgent };
    if (urgent) {
      this.queue.unshift(task);
      showFloatingText(this.scene, DESK_X, DESK_Y - 30, '🔴 Срочная задача!', '#ff4757');
    } else {
      this.queue.push(task);
    }

    this.hud.setInbox(this.queue, this.limit);

    if (this.queue.length > this.limit) {
      this.isOver = true;
      this.onOverflow();
    }
  }

  /** Ticks the auto-resolve timer — call every frame from MainScene.update(). */
  update(delta: number): void {
    if (this.isOver) return;

    if (this.queue.length === 0) {
      // Stay "charged" at a full interval while idle, so the first task to
      // arrive after a lull doesn't get resolved almost instantly.
      this.resolveTimer = this.resolveIntervalMs;
      return;
    }

    this.resolveTimer -= delta;
    if (this.resolveTimer <= 0) {
      this.resolveTimer = this.resolveIntervalMs;
      this.resolveOne();
    }
  }

  private resolveOne(): void {
    this.queue.shift();
    this.hud.setInbox(this.queue, this.limit);
    showFloatingText(this.scene, DESK_X, DESK_Y - 30, '✅ Решено', '#55efc4');
  }
}
