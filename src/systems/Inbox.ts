import type Phaser from 'phaser';
import { DESK_X, DESK_Y } from '../config';
import type { HUD } from '../ui/HUD';
import { showFloatingText } from '../ui/FloatingText';
import { EventBus, GameEvents } from '../events/EventBus';

export interface Task {
  readonly id: number;
  readonly urgent: boolean;
}

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
  ) {
    this.resolveTimer = resolveIntervalMs;
    this.hud.setInbox(this.queue, this.limit);

    EventBus.on(GameEvents.TASK_ARRIVED, this.enqueue, this);

    this.scene.events.once('shutdown', () => {
      EventBus.off(GameEvents.TASK_ARRIVED, this.enqueue, this);
    });
  }

  get size(): number {
    return this.queue.length;
  }

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
      EventBus.emit(GameEvents.GAME_OVER);
    }
  }

  update(delta: number): void {
    if (this.isOver) return;

    if (this.queue.length === 0) {
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
