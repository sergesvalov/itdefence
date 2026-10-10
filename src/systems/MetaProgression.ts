const META_SAVE_KEY = 'itdefence_meta';

export interface MetaSaveData {
  money: number;
  inboxLevel: number; // 0 to 5
  moneyLevel: number; // 0 to 5
  damageLevel: number; // 0 to 5
  shieldDurationLevel: number; // 0 to 5
  tutorialCompleted: boolean;
  /** How many chapters of act I are cleared (the next one is unlocked) */
  campaignCleared: number;
  /** Same for the later acts, by act id */
  actsCleared: Record<string, number>;
}

const DEFAULT_SAVE: MetaSaveData = {
  money: 0,
  inboxLevel: 0,
  moneyLevel: 0,
  damageLevel: 0,
  shieldDurationLevel: 0,
  tutorialCompleted: true,
  campaignCleared: 0,
  actsCleared: {},
};

export class MetaProgression {
  private static data: MetaSaveData;

  public static load(): void {
    const raw = localStorage.getItem(META_SAVE_KEY);
    if (raw) {
      try {
        this.data = JSON.parse(raw);
        // Add any missing fields for backward compatibility
        this.data = { ...DEFAULT_SAVE, ...this.data };
      } catch (e) {
        this.data = { ...DEFAULT_SAVE };
      }
    } else {
      this.data = { ...DEFAULT_SAVE };
    }
  }

  public static save(): void {
    if (!this.data) this.data = { ...DEFAULT_SAVE };
    localStorage.setItem(META_SAVE_KEY, JSON.stringify(this.data));
  }

  public static get(): MetaSaveData {
    if (!this.data) this.load();
    return this.data;
  }

  public static earnMoney(amount: number): void {
    this.get().money += amount;
    this.save();
  }

  public static getCleared(actId: string): number {
    const data = this.get();
    return actId === 'act1' ? data.campaignCleared : data.actsCleared[actId] ?? 0;
  }

  public static completeLevel(actId: string, index: number): void {
    const data = this.get();
    const cleared = Math.max(this.getCleared(actId), index + 1);
    if (actId === 'act1') data.campaignCleared = cleared;
    else data.actsCleared = { ...data.actsCleared, [actId]: cleared };
    this.save();
  }

  public static spendMoney(amount: number): boolean {
    if (this.get().money >= amount) {
      this.data.money -= amount;
      this.save();
      return true;
    }
    return false;
  }
}
