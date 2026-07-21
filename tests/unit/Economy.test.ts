import { describe, it, expect, vi } from 'vitest';
import { Economy } from '../../src/systems/Economy';

vi.mock('../../src/systems/SoundFX', () => ({
  SoundFX: {
    playCoin: vi.fn()
  }
}));

describe('Economy', () => {
  it('should initialize with starting money', () => {
    const mockHUD = { setMoney: vi.fn(), pulseMoney: vi.fn() } as any;
    const economy = new Economy(mockHUD, 100);
    expect(economy.balance).toBe(100);
    expect(mockHUD.setMoney).toHaveBeenCalledWith(100);
  });

  it('canAfford should return true if balance is sufficient', () => {
    const mockHUD = { setMoney: vi.fn(), pulseMoney: vi.fn() } as any;
    const economy = new Economy(mockHUD, 100);
    expect(economy.canAfford(50)).toBe(true);
    expect(economy.canAfford(150)).toBe(false);
  });

  it('spend should decrease balance and update HUD', () => {
    const mockHUD = { setMoney: vi.fn(), pulseMoney: vi.fn() } as any;
    const economy = new Economy(mockHUD, 100);
    economy.spend(40);
    expect(economy.balance).toBe(60);
    expect(mockHUD.setMoney).toHaveBeenCalledWith(60);
  });

  it('earn should increase balance, update HUD and pulse', () => {
    const mockHUD = { setMoney: vi.fn(), pulseMoney: vi.fn() } as any;
    const economy = new Economy(mockHUD, 100);
    economy.earn(50);
    expect(economy.balance).toBe(150);
    expect(mockHUD.setMoney).toHaveBeenCalledWith(150);
    expect(mockHUD.pulseMoney).toHaveBeenCalledWith('#2ecc71');
  });
});
