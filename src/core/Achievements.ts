/** Optional exploration stickers. Nothing here gates play; they only reward curiosity. */

export interface AchContext {
  swimSeconds: number;
  lazySeconds: number;
  slides: number;
  eaten: number;
  visited: ReadonlySet<string>;
  /** Set once energy dropped below the "needs rest" tier. */
  rested: boolean;
  energy: number;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  reward: number;
  check: (s: AchContext) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-swim", name: "First Swim", icon: "🏊", desc: "Splash into any pool.", reward: 10, check: (s) => s.swimSeconds > 3 },
  { id: "slide-explorer", name: "Slide Explorer", icon: "🛝", desc: "Ride a water slide.", reward: 10, check: (s) => s.slides >= 1 },
  { id: "lazy-river", name: "Lazy River Adventure", icon: "🛟", desc: "Float along the lazy river.", reward: 10, check: (s) => s.lazySeconds > 4 },
  { id: "happy-eater", name: "Happy Eater", icon: "🍦", desc: "Enjoy a snack at the food court.", reward: 10, check: (s) => s.eaten >= 1 },
  { id: "explorer", name: "Waterpark Explorer", icon: "🗺️", desc: "Visit six different areas.", reward: 15, check: (s) => s.visited.size >= 6 },
  { id: "full-energy", name: "Back in Action", icon: "⚡", desc: "Get your energy back to full after resting.", reward: 15, check: (s) => s.rested && s.energy >= 99 },
  { id: "super-visitor", name: "Super Waterpark Visitor", icon: "🌟", desc: "Ride three slides, eat twice and see six areas.", reward: 25, check: (s) => s.slides >= 3 && s.eaten >= 2 && s.visited.size >= 6 },
];

/** Tracks unlocks and the areas a player has seen. */
export class Achievements {
  readonly unlocked = new Set<string>();
  readonly visited = new Set<string>();
  onUnlock: (a: Achievement) => void = () => {};

  visit(area: string) {
    if (area && area !== "Waterpark") this.visited.add(area);
  }

  update(s: AchContext) {
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id) || !a.check(s)) continue;
      this.unlocked.add(a.id);
      this.onUnlock(a);
    }
  }

  reset() {
    this.unlocked.clear();
    this.visited.clear();
  }

  load(unlocked: string[] | undefined, visited: string[] | undefined) {
    this.unlocked.clear(); this.visited.clear();
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of unlocked ?? []) if (ids.has(id)) this.unlocked.add(id);
    for (const a of visited ?? []) if (typeof a === "string") this.visited.add(a);
  }
}
