const KEY = "kids-waterpark-save";

export interface Stats { swimSeconds: number; lazySeconds: number; slides: number; bought: number; eaten: number; collected: number; spent: number }
export const newStats = (): Stats => ({ swimSeconds: 0, lazySeconds: 0, slides: 0, bought: 0, eaten: 0, collected: 0, spent: 0 });

export interface SaveData {
  v: 1;
  coins: number;
  energy: number;
  ticket: boolean;
  outfit: number;
  x: number;
  z: number;
  yaw: number;
  stats: Stats;
  /** Park clock and exploration progress; older saves simply lack them. */
  minutes?: number;
  unlocked?: string[];
  visited?: string[];
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d?.v !== 1 || ![d.coins, d.energy, d.x, d.z].every(Number.isFinite)) return null; // unreadable: leave it untouched
    return { ...d, stats: { ...newStats(), ...(d.stats ?? {}) } };
  } catch { return null; }
}

export function writeSave(d: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full or blocked: play on */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
