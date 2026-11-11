import { WORLD } from "../core/config";

export interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }

export const rect = (cx: number, cz: number, w: number, d: number): Rect => ({
  minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2,
});

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface WaterBody {
  id: string;
  name: string;
  bounds: Rect;
  /** Depth below the deck (0 = dry). Smooth, so players can walk the slopes. */
  depth(x: number, z: number): number;
}

const edgeDist = (r: Rect, x: number, z: number) =>
  Math.min(x - r.minX, r.maxX - x, z - r.minZ, r.maxZ - z);

const beachPool = (id: string, name: string, bounds: Rect, maxDepth: number, slope: number): WaterBody => ({
  id, name, bounds,
  depth: (x, z) => maxDepth * smoothstep(0, slope, edgeDist(bounds, x, z)),
});

const familyBounds = rect(0, 26, 28, 20);
const waveBounds = rect(-48, 17, 20, 18);
const ringOuter = rect(30, -6, 36, 28);
const ringInner = rect(30, -6, 26, 18);

export const WATER_BODIES: WaterBody[] = [
  {
    // Shallow beach entry on the south side, deep end to the north.
    id: "family", name: "Family Pool", bounds: familyBounds,
    depth: (x, z) => {
      const t = (familyBounds.maxZ - z) / (familyBounds.maxZ - familyBounds.minZ);
      const profile = 0.45 + 1.8 * smoothstep(0.15, 0.75, t);
      return profile * smoothstep(0, 2.2, familyBounds.maxZ - z);
    },
  },
  beachPool("kids", "Children's Pool", rect(-28, 20, 14, 12), 0.6, 1.6),
  beachPool("relax", "Relaxing Pool", rect(0, -4, 20, 12), 1.4, 1.6),
  {
    // Wave pool: sandy beach entry on the south side, deepest at the machine.
    id: "wave", name: "Wave Pool", bounds: waveBounds,
    depth: (x, z) => {
      const t = (waveBounds.maxZ - z) / (waveBounds.maxZ - waveBounds.minZ);
      const profile = 0.4 + 1.7 * smoothstep(0.2, 0.8, t);
      return profile * smoothstep(0, 2.6, waveBounds.maxZ - z);
    },
  },
  {
    id: "lazy", name: "Lazy River", bounds: ringOuter,
    depth: (x, z) => {
      const dOuter = edgeDist(ringOuter, x, z);
      const dInner = Math.max(ringInner.minX - x, x - ringInner.maxX, ringInner.minZ - z, z - ringInner.maxZ);
      if (dInner < 0) return 0; // island
      return 1.35 * smoothstep(0, 1.5, Math.min(dOuter, dInner));
    },
  },
  beachPool("splash-small", "Small Slide Splash Pool", rect(-30, -45, 8, 7), 1.4, 1.4),
  beachPool("splash-spiral", "Spiral Slide Splash Pool", rect(-10, -45, 8, 7), 1.4, 1.4),
  beachPool("splash-race", "Racing Slide Splash Pool", rect(10, -45, 14, 7), 1.4, 1.4),
  beachPool("splash-tube", "Tube Slide Splash Pool", rect(30, -45, 8, 7), 1.4, 1.4),
];

export const ISLAND = ringInner;

export interface Area { name: string; rect: Rect }
export const AREAS: Area[] = [
  { name: "Entrance", rect: { minX: -60, maxX: 60, minZ: 42, maxZ: 68 } },
  { name: "Changing Rooms", rect: { minX: -60, maxX: -32, minZ: 27, maxZ: 42 } },
  { name: "Children's Pool", rect: { minX: -37, maxX: -19, minZ: 12, maxZ: 28 } },
  { name: "Family Pool", rect: { minX: -17, maxX: 17, minZ: 14, maxZ: 38 } },
  { name: "Food Court", rect: { minX: 38, maxX: 60, minZ: 10, maxZ: 42 } },
  { name: "Lazy River", rect: { minX: 10, maxX: 50, minZ: -22, maxZ: 10 } },
  { name: "Relaxing Pool", rect: { minX: -13, maxX: 13, minZ: -13, maxZ: 5 } },
  { name: "Water Playground", rect: { minX: -48, maxX: -22, minZ: -18, maxZ: 6 } },
  { name: "Wave Pool", rect: { minX: -60, maxX: -36, minZ: 6, maxZ: 26 } },
  { name: "Water Slides", rect: { minX: -45, maxX: 45, minZ: -50, maxZ: -24 } },
];

export const areaAt = (x: number, z: number) =>
  AREAS.find((a) => x >= a.rect.minX && x <= a.rect.maxX && z >= a.rect.minZ && z <= a.rect.maxZ)?.name ?? "Waterpark";

export const SPAWN = { x: 0, z: 64, yaw: Math.PI };
export { WORLD };
