import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  TASK_ARRIVED: 'task-arrived',
  GAME_OVER: 'game-over',
};
