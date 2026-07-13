import type { Coworker } from '../Coworker';

export interface ITowerBehavior {
  tick(delta: number, enemies: Coworker[]): void;
}
