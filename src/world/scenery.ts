import * as THREE from "three";
import { PALETTE, WORLD } from "../core/config";
import type { BuildContext } from "./build-context";
import { WATER_BODIES } from "./layout";

const UMB = [PALETTE.coral, PALETTE.sun, PALETTE.aqua, PALETTE.pink, PALETTE.mint, PALETTE.grape];

function palm(c: BuildContext, x: number, z: number, h = 4.5 + c.rng() * 1.5) {
  const b = c.batch;
  const lean = (c.rng() - 0.5) * 0.35;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const y = (i / segs) * h;
    b.cyl(x + lean * (y / h) * 1.5, y, z, 0.2 - i * 0.025, 0.25 - i * 0.025, h / segs + 0.05, i % 2 ? 0xb07a4d : 0xc58f5c, 7);
  }
  const tx = x + lean * 1.5;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + c.rng() * 0.3;
    b.add(new THREE.BoxGeometry(0.5, 0.06, 2.6), k % 2 ? 0x2fae5a : 0x45c96e, tx + Math.sin(a) * 1.1, h + 0.1, z + Math.cos(a) * 1.1, 0.5, a, 0);
  }
  b.sphere(tx, h - 0.1, z, 0.28, 0x7a5230);
  c.circles.push({ x, z, r: 0.45 });
}

export function lounger(c: BuildContext, x: number, z: number, i: number, parasol = false) {
  const b = c.batch;
  const col = UMB[i % UMB.length];
  b.box(x, 0.15, z, 0.85, 0.2, 2.0, PALETTE.white);
  b.box(x, 0.3, z, 0.8, 0.12, 1.9, col);
  b.box(x, 0.4, z - 1.0, 0.8, 0.1, 0.9, col, 0, -0.9);
  for (const dx of [-0.35, 0.35]) for (const dz of [-0.8, 0.8]) b.box(x + dx, 0, z + dz, 0.08, 0.2, 0.08, PALETTE.white);
  if (parasol) {
    b.cyl(x + 0.8, 0, z - 0.6, 0.04, 0.04, 2.4, PALETTE.white);
    b.cone(x + 0.8, 2.2, z - 0.6, 1.5, 0.55, UMB[(i + 3) % UMB.length], 8);
  }
  const seat = { x, y: 0.4, z: z + 0.1, yaw: 0, exitX: x + 1.3, exitZ: z + 0.6, taken: false };
  c.seats.push(seat);
  c.interactables.push({
    id: `lounger-${x}-${z}`, x, z, radius: 1.5, y: 1.6,
    label: (g) => (g.player.isSitting || g.player.busy || seat.taken ? null : "Rest"),
    run: (g) => g.player.sit(seat),
  });
}

export function buildScenery(c: BuildContext) {
  const b = c.batch;
  // Loungers
  let i = 0;
  for (const z of [19, 23, 27, 31]) { lounger(c, -18.8, z, i++, i % 2 === 0); lounger(c, 18.8, z, i++, i % 2 === 1); }
  for (const x of [-6, -2, 2, 6]) lounger(c, x, -13.6, i++, true);
  for (const x of [24, 28, 32, 36]) lounger(c, x, -6, i++, x % 8 === 0);

  // Palms: perimeter + some interior ones, kept off pools and solid props.
  const free = (x: number, z: number) =>
    !WATER_BODIES.some((w) => x > w.bounds.minX - 2 && x < w.bounds.maxX + 2 && z > w.bounds.minZ - 2 && z < w.bounds.maxZ + 2) &&
    !c.solids.some((s) => x > s.minX - 1.5 && x < s.maxX + 1.5 && z > s.minZ - 1.5 && z < s.maxZ + 1.5) &&
    !c.circles.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + 1.5) &&
    !(Math.abs(x) < 8 && z > 38) && !(x > 36 && x < 48 && z > 48) && !(z > 56 && Math.abs(x) < 14);
  for (let x = -57; x <= 57; x += 6.5) { for (const z of [-47, 65]) if (free(x, z)) palm(c, x, z); }
  for (let z = -43; z <= 64; z += 7) { for (const x of [-57.5, 57.5]) if (free(x, z)) palm(c, x, z); }
  let tries = 0, placed = 0;
  while (placed < 18 && tries++ < 400) {
    const x = (c.rng() - 0.5) * 100, z = -30 + c.rng() * 80;
    if (free(x, z)) { palm(c, x, z); placed++; }
  }
  for (const [x, z] of [[22, -10], [38, -10], [22, 0], [38, 0], [30, -6]]) palm(c, x, z, 5 + c.rng());
  // Bushes and flowers near the gate
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
    const x = sx * (16 + k * 1.3), z = 57.6;
    b.sphere(x, 0.4, z, 0.7, 0x3aa85a, 0.8);
    b.sphere(x + 0.3, 0.9, z, 0.18, [PALETTE.coral, PALETTE.sun, PALETTE.pink][k % 3]);
  }

  // Perimeter fence (the gate line is built with the entrance)
  const post = (x: number, z: number, k: number) => b.box(x, 0, z, 0.22, 1.5, 0.22, k % 2 ? PALETTE.white : PALETTE.aqua);
  let k = 0;
  for (let x = WORLD.minX; x <= WORLD.maxX; x += 3) { post(x, WORLD.minZ, k++); post(x, WORLD.maxZ, k++); }
  for (let z = WORLD.minZ; z <= WORLD.maxZ; z += 3) { post(WORLD.minX, z, k++); post(WORLD.maxX, z, k++); }
  const midZ = (WORLD.minZ + WORLD.maxZ) / 2, lenZ = WORLD.maxZ - WORLD.minZ;
  for (const y of [0.5, 1.1]) {
    for (const z of [WORLD.minZ, WORLD.maxZ]) b.box(0, y, z, 120, 0.12, 0.12, PALETTE.white);
    for (const x of [WORLD.minX, WORLD.maxX]) b.box(x, y, midZ, 0.12, 0.12, lenZ, PALETTE.white);
  }

  // Rope + buoys marking the deep end of the family pool
  for (let x = -14; x <= 14; x += 2) b.sphere(x, -0.1, 24, 0.17, x % 4 === 0 ? PALETTE.coral : PALETTE.white);
  // Diving-board style sign
  b.cyl(-15.5, 0, 14.6, 0.06, 0.06, 1.6, PALETTE.white);
  b.box(-15.5, 1.5, 14.6, 1.6, 0.5, 0.08, PALETTE.coral);
}

/** Outer world: grass, distant hills, clouds. */
export function buildBackdrop(scene: THREE.Scene, c: BuildContext) {
  // Grass ring around the park; the park deck covers the hole.
  const gs = new THREE.Shape();
  gs.moveTo(-450, 450); gs.lineTo(450, 450); gs.lineTo(450, -450); gs.lineTo(-450, -450);
  const hole = new THREE.Path();
  hole.moveTo(WORLD.minX, -WORLD.minZ); hole.lineTo(WORLD.minX, -WORLD.maxZ);
  hole.lineTo(WORLD.maxX, -WORLD.maxZ); hole.lineTo(WORLD.maxX, -WORLD.minZ);
  gs.holes.push(hole);
  const gg = new THREE.ShapeGeometry(gs);
  gg.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);
  const b = c.batch;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, d = 150 + c.rng() * 60;
    b.cone(Math.cos(a) * d, -1, Math.sin(a) * d, 28 + c.rng() * 22, 24 + c.rng() * 26, i % 3 ? 0x4cbf86 : 0x39a889, 6);
  }
  const clouds = new THREE.Group();
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(5 + c.rng() * 4, 0), cm);
      s.position.set(j * 6 - 9, c.rng() * 2, c.rng() * 3);
      s.scale.y = 0.55;
      cl.add(s);
    }
    cl.position.set((c.rng() - 0.5) * 360, 55 + c.rng() * 25, (c.rng() - 0.5) * 360);
    clouds.add(cl);
  }
  scene.add(clouds);
  return clouds;
}
