import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

if (typeof window !== 'undefined') {
  (window as any).__EventBus = EventBus;
}

export const GameEvents = {
  TASK_ARRIVED: 'task-arrived',
  GAME_OVER: 'game-over',
};
