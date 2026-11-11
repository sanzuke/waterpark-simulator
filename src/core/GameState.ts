import { ENERGY, START_COINS } from "./economy";
import { newStats, type SaveData, type Stats } from "./Save";

/** Plain game data and rules for money, tickets and energy. No Three.js in here. */
export class GameState {
  coins = START_COINS;
  energy = ENERGY.max;
  ticket = false;
  outfit = 0;
  stats: Stats = newStats();
  onChange: () => void = () => {};
  onTier: (tip: string) => void = () => {};
  private lastTier = 0;

  get tierIndex() {
    const i = ENERGY.tiers.findIndex((t) => this.energy >= t.min);
    return i < 0 ? ENERGY.tiers.length - 1 : i;
  }
  get tier() { return ENERGY.tiers[this.tierIndex]; }
  get speedScale() { return this.tier.speed; }

  canAfford(n: number) { return this.coins >= n; }
  spend(n: number) {
    if (this.coins < n) return false;
    this.coins -= n; this.stats.spent += n; this.onChange();
    return true;
  }
  earn(n: number) { this.coins += n; this.onChange(); }

  addEnergy(d: number) {
    const before = this.energy;
    this.energy = Math.min(ENERGY.max, Math.max(0, this.energy + d));
    if (Math.floor(before) !== Math.floor(this.energy)) this.onChange();
    const t = this.tierIndex;
    if (t > this.lastTier && this.tier.tip) this.onTier(this.tier.tip);
    this.lastTier = t;
  }

  load(d: SaveData) {
    this.coins = d.coins; this.energy = d.energy; this.ticket = !!d.ticket;
    this.outfit = d.outfit | 0; this.stats = d.stats;
    this.lastTier = this.tierIndex;
    this.onChange();
  }
}
