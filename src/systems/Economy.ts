import type { HUD } from '../ui/HUD';

/** Petya's money: spend it on towers/upgrades, earn it once per cleared wave. */
export class Economy {
  private money: number;

  constructor(private hud: HUD, startingMoney: number) {
    this.money = startingMoney;
    this.hud.setMoney(this.money);
  }

  get balance(): number {
    return this.money;
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  spend(cost: number): void {
    this.money -= cost;
    this.hud.setMoney(this.money);
  }

  earn(amount: number): void {
    this.money += amount;
    this.hud.setMoney(this.money);
    this.hud.pulseMoney('#2ecc71');
  }
}
