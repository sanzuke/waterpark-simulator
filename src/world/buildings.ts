import * as THREE from "three";
import { PALETTE, WORLD } from "../core/config";
import { SHOPS } from "../core/economy";
import { CharacterRig, type RigOptions } from "../player/CharacterRig";
import type { BuildContext } from "./build-context";
import { makeSign, solidBox } from "./build-context";

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const sign = (c: BuildContext, text: string, w: number, h: number, bg: number, x: number, y: number, z: number, yaw: number, sub?: string) => {
  const m = makeSign(text, w, h, hex(bg), "#ffffff", sub);
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  c.group.add(m);
};

/** A staff member standing in place. Their animation is driven from World.update. */
function addStaff(c: BuildContext, id: string, x: number, y: number, z: number, yaw: number, opt: RigOptions, scale = 1.1) {
  const rig = new CharacterRig(opt);
  rig.root.position.set(x, y, z);
  rig.root.rotation.y = yaw;
  rig.root.scale.setScalar(scale);
  c.group.add(rig.root);
  c.staff.push({ id, rig, work: 0, wave: 0, nextWave: 2 + Math.random() * 6 });
  return rig;
}

/** A simple coloured hut: walls, roof slab and a sign. */
function hut(c: BuildContext, cx: number, cz: number, w: number, d: number, h: number, wall: number, roof: number, label: string, yaw: number, signColor: number, mapColor: string) {
  const b = c.batch;
  b.box(cx, 0, cz, w, h, d, wall, yaw);
  b.box(cx, h, cz, w + 0.8, 0.35, d + 0.8, roof, yaw);
  const nx = Math.sin(yaw), nz = Math.cos(yaw);
  sign(c, label, Math.min(w - 0.6, 7), 1.1, signColor, cx + nx * (d / 2 + 0.05), h + 1, cz + nz * (d / 2 + 0.05), yaw);
  const swap = Math.abs(Math.sin(yaw)) > 0.5;
  solidBox(c, cx, cz, swap ? d : w, swap ? w : d, mapColor);
}

const fenceRow = (c: BuildContext, x0: number, x1: number, z: number) => {
  const b = c.batch;
  let k = 0;
  for (let x = x0; x <= x1 + 0.01; x += 3) b.box(x, 0, z, 0.22, 1.5, 0.22, k++ % 2 ? PALETTE.white : PALETTE.aqua);
  for (const y of [0.5, 1.1]) b.box((x0 + x1) / 2, y, z, x1 - x0, 0.12, 0.12, PALETTE.white);
};

export function buildEntrance(c: BuildContext) {
  const b = c.batch;
  const GZ = 56;
  // Main gate pillars + arch
  for (const sx of [-1, 1]) {
    b.box(sx * 6.2, 0, GZ, 2.2, 6.5, 2.2, sx < 0 ? PALETTE.coral : PALETTE.aqua);
    b.sphere(sx * 6.2, 7, GZ, 1.1, PALETTE.sun);
  }
  b.box(0, 5.2, GZ, 14.6, 1.6, 1.6, PALETTE.sun);
  b.box(0, 6.8, GZ, 14.6, 0.35, 1.8, PALETTE.coral);
  sign(c, "KIDS WATERPARK", 10, 1.35, PALETTE.aqua, 0, 6, GZ - 0.85, Math.PI);
  sign(c, "KIDS WATERPARK", 10, 1.35, PALETTE.aqua, 0, 6, GZ + 0.85, 0);

  // Fence line along the gate: only the turnstile opening lets you in.
  for (const [x0, x1] of [[-60, -3.6], [3.6, 60]] as const) {
    fenceRow(c, x0, x1, GZ);
    c.solids.push({ minX: x0, maxX: x1, minZ: GZ - 0.4, maxZ: GZ + 0.4 });
  }
  // Turnstile: a barrier arm that lifts once you hold a ticket.
  for (const x of [-3.4, 3.4]) b.cyl(x, 0, GZ - 0.8, 0.14, 0.14, 1.2, PALETTE.white);
  c.gate.rect = { minX: -3.4, maxX: 3.4, minZ: GZ - 1.0, maxZ: GZ - 0.6 };
  c.solids.push(c.gate.rect);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: PALETTE.coral }));
  const pivot = new THREE.Group();
  pivot.position.set(-3.4, 1.0, GZ - 0.8);
  rail.position.x = 3.3;
  pivot.add(rail);
  c.group.add(pivot);
  c.gate.rail = pivot;
  addStaff(c, "officer", 4.7, 0, GZ - 1.4, Math.PI * 0.85, { top: 0x16405c, shorts: 0x16405c, hair: 0x2a2a2a, skin: 0xc68a5e });
  c.mapShapes.push({ rect: { minX: -60, maxX: 60, minZ: GZ - 0.4, maxZ: GZ + 0.4 }, color: "#16405c" });

  // Ticket kiosk (outside the gate)
  const kx = -10, kz = 61;
  b.box(kx - 1.5, 0, kz, 0.2, 3, 4.2, PALETTE.sun);
  b.box(kx, 0, kz - 2.1, 3.2, 3, 0.2, PALETTE.sun);
  b.box(kx, 0, kz + 2.1, 3.2, 3, 0.2, PALETTE.sun);
  b.box(kx + 1.5, 0, kz, 0.5, 1.1, 4.2, PALETTE.coral);
  b.box(kx + 1.5, 1.1, kz, 0.8, 0.1, 4.4, PALETTE.white);
  b.box(kx, 3.0, kz, 4.2, 0.3, 5, PALETTE.coral);
  sign(c, "TICKETS", 3.6, 0.9, PALETTE.coral, kx + 1.95, 3.55, kz, Math.PI / 2);
  solidBox(c, kx, kz, 3.4, 4.4, "#ffb347");
  addStaff(c, "seller", kx - 0.3, 0, kz, Math.PI / 2, { top: 0xffffff, shorts: 0xff6b5e, hair: 0x7a3b1e });
  c.interactables.push({
    id: "ticket-booth", x: kx + 3.2, z: kz, radius: 3.2, y: 3.3,
    label: (g) => (g.state.ticket ? "Say Hi" : "Buy Ticket"),
    run: (g) => { if (g.state.ticket) g.hud.toast("Your ticket is ready. Have a splashy day!"); else g.actions.openTickets(); },
  });

  // Info board (outside)
  const ix = 10, iz = 61;
  b.box(ix - 2.8, 0, iz, 0.3, 2.4, 0.3, PALETTE.wood);
  b.box(ix + 2.8, 0, iz, 0.3, 2.4, 0.3, PALETTE.wood);
  b.box(ix, 1.1, iz, 6.2, 2.6, 0.3, PALETTE.navy);
  sign(c, "INFO", 5.4, 1.9, PALETTE.aqua, ix, 2.4, iz + 0.2, 0, "Welcome! Press E");
  solidBox(c, ix, iz, 6.2, 0.6, "#ffffff");
  c.interactables.push({
    id: "info-board", x: ix, z: iz + 1.8, radius: 3, y: 4.2,
    label: () => "Read Info Board",
    run: (g) => g.hud.showInfo(),
  });

  // Souvenir shop (scenery) + exit gate
  hut(c, 31, 52, 8, 5, 3.4, PALETTE.pink, PALETTE.grape, "SOUVENIRS", 0, PALETTE.grape, "#ff8fc7");
  for (const sx of [-1, 1]) b.box(42 + sx * 3.6, 0, GZ, 1.4, 4.6, 1.4, PALETTE.grape);
  b.box(42, 4.4, GZ, 8.6, 1.2, 1.2, PALETTE.mint);
  sign(c, "EXIT", 4.2, 1, PALETTE.grape, 42, 5.1, GZ - 0.7, Math.PI);
  sign(c, "EXIT", 4.2, 1, PALETTE.grape, 42, 5.1, GZ + 0.7, 0);
  c.interactables.push({
    id: "exit", x: 42, z: GZ - 2.2, radius: 3, y: 3.4,
    label: () => "Go Home",
    run: (g) => g.actions.goHome(),
  });
}

export function buildPreparation(c: BuildContext) {
  const b = c.batch;
  hut(c, -40, 36, 14, 8, 3.8, PALETTE.aqua, PALETTE.white, "CHANGING ROOMS", 0, PALETTE.navy, "#19c3d9");
  for (let i = 0; i < 4; i++) b.box(-45 + i * 3.3 + 1.6, 0, 40.05, 1.3, 2.4, 0.15, [PALETTE.coral, PALETTE.sun, PALETTE.mint, PALETTE.grape][i]);
  hut(c, -53, 36, 9, 8, 3.8, PALETTE.mint, PALETTE.white, "SHOWERS & TOILETS", 0, PALETTE.navy, "#5fd6a0");
  const cols = [PALETTE.coral, PALETTE.sun, PALETTE.aqua, PALETTE.grape, PALETTE.mint, PALETTE.pink];
  for (let i = 0; i < 6; i++) b.box(-44.5 + i * 1.7, 0, 42.4, 1.5, 2.0, 0.7, cols[i]);
  solidBox(c, -40, 42.4, 10.2, 0.9, "#ff6b5e");
  c.interactables.push({
    id: "lockers", x: -40, z: 44, radius: 3.2, y: 3,
    label: () => "Change Clothes",
    run: (g) => { const n = g.player.nextOutfit(); g.state.outfit = g.player.outfit; g.hud.toast(`Ta-da! New swimsuit: ${n}`); g.effects.droplets(g.player.pos.x, 1.6, g.player.pos.z, 8); g.actions.save(); },
  });
  hut(c, -28, 41, 4, 2, 2.4, PALETTE.sun, PALETTE.coral, "TOWELS", 0, PALETTE.coral, "#ffd23f");
  for (let i = 0; i < 3; i++) b.box(-29 + i * 1, 1.0, 42.1, 0.8, 0.35, 0.5, [PALETTE.pink, PALETTE.aqua, PALETTE.mint][i]);
  b.cyl(-31, 0, 31, 0.08, 0.08, 2.6, PALETTE.white);
  b.box(-30.7, 2.5, 31, 0.6, 0.1, 0.1, PALETTE.white);
  b.cyl(-30.4, 2.35, 31, 0.25, 0.25, 0.1, PALETTE.aqua);
  c.circles.push({ x: -31, z: 31, r: 0.3 });
}

export function buildFoodCourt(c: BuildContext) {
  const b = c.batch;
  const look = [
    { name: "BURGERS", col: 0xff8a3d, z: 14 },
    { name: "PIZZA", col: 0xe8433f, z: 20 },
    { name: "SNACKS", col: 0xffc83d, z: 26 },
    { name: "ICE CREAM", col: PALETTE.pink, z: 32 },
    { name: "JUICE BAR", col: 0x4fcf70, z: 38 },
  ];
  look.forEach((s, i) => {
    const x = 56;
    b.box(x + 2.1, 0, s.z, 1, 3.4, 5, 0xfff3d6);
    b.box(x + 0.2, 0, s.z - 2.5, 3.8, 3.4, 0.2, 0xfff3d6);
    b.box(x + 0.2, 0, s.z + 2.5, 3.8, 3.4, 0.2, 0xfff3d6);
    b.box(x - 0.2, 3.4, s.z, 4.6, 0.3, 5.6, s.col);
    b.box(x - 1.6, 0, s.z, 0.9, 1.1, 4.8, s.col); // counter
    b.box(x - 1.6, 1.1, s.z, 1.1, 0.12, 5, PALETTE.white);
    for (let k = 0; k < 5; k++) b.box(x - 2.1, 2.75, s.z - 2.2 + k * 1.1, 1.8, 0.14, 1.1, k % 2 ? PALETTE.white : s.col, 0, 0, 0.35);
    sign(c, s.name, 4.6, 1, s.col, x - 2.3, 4.5, s.z, -Math.PI / 2);
    solidBox(c, x + 0.2, s.z, 5.4, 5.4, "#ffb347");
    const shop = SHOPS[i];
    addStaff(c, shop.id, x + 0.9, 0, s.z, -Math.PI / 2, { top: s.col, shorts: 0xffffff, hair: [0x2a1a10, 0x6b3b1a, 0x1e1e1e, 0x8a5a2b, 0x3a2a1e][i], skin: [0xf2b790, 0xd9a07a, 0xc68a5e, 0xf2b790, 0xe8b08a][i] }, 1.25);
    c.interactables.push({
      id: `shop-${shop.id}`, x: x - 3.4, z: s.z, radius: 2.8, y: 3.6,
      label: (g) => (g.player.busy ? null : "Buy Food"),
      run: (g) => g.actions.openShop(shop.id),
    });
  });
  const umb = [PALETTE.coral, PALETTE.sun, PALETTE.aqua, PALETTE.mint, PALETTE.pink];
  let ti = 0;
  for (const tx of [41, 46.5]) for (const tz of [17, 22, 27, 32, 37]) {
    b.cyl(tx, 0, tz, 0.1, 0.1, 0.75, PALETTE.white);
    b.cyl(tx, 0.75, tz, 0.85, 0.85, 0.08, PALETTE.wood, 12);
    b.cyl(tx, 0, tz, 0.5, 0.5, 0.06, PALETTE.white);
    b.cyl(tx, 0, tz, 0.05, 0.05, 2.6, PALETTE.white);
    b.cone(tx, 2.4, tz, 1.7, 0.7, umb[ti % umb.length], 8);
    c.circles.push({ x: tx, z: tz, r: 0.8 });
    for (const side of [-1, 1]) {
      const sx = tx + side * 1.4;
      b.cyl(sx, 0, tz, 0.3, 0.3, 0.5, umb[(ti + 2) % umb.length], 8);
      const seat = { x: sx, y: 0.5, z: tz, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2, exitX: tx + side * 2.3, exitZ: tz, taken: false };
      c.seats.push(seat);
      c.interactables.push({
        id: `seat-${ti}-${side}`, x: sx, z: tz, radius: 1.3, y: 1.8,
        label: (g) => (g.player.isSitting || g.player.busy || seat.taken ? null : "Sit Down"),
        run: (g) => g.player.sit(seat),
      });
    }
    ti++;
  }
  c.mapShapes.push({ rect: { minX: 39, maxX: 49, minZ: 15, maxZ: 39 }, color: "rgba(255,200,120,0.5)" });
}

export function buildLifeguards(c: BuildContext) {
  const b = c.batch;
  const spots: [number, number, number][] = [
    [-15.8, 22, Math.PI / 2], [15.8, 30, -Math.PI / 2], [-19.5, 20, -Math.PI / 2], [11.8, -4, -Math.PI / 2],
    [30, 11, Math.PI], [-36, -45, Math.PI / 2], [20.5, -45, -Math.PI / 2], [38, -45, -Math.PI / 2],
  ];
  spots.forEach(([x, z, yaw], i) => {
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) b.box(x + dx, 0, z + dz, 0.12, 2.2, 0.12, PALETTE.white);
    b.box(x, 2.2, z, 1.3, 0.12, 1.3, PALETTE.coral);
    b.box(x - Math.sin(yaw) * 0.6, 2.3, z - Math.cos(yaw) * 0.6, 1.3, 0.9, 0.12, PALETTE.coral, yaw);
    b.cyl(x - Math.sin(yaw) * 0.55, 2.3, z - Math.cos(yaw) * 0.55, 0.04, 0.04, 1.9, PALETTE.white);
    b.cone(x - Math.sin(yaw) * 0.55, 4.0, z - Math.cos(yaw) * 0.55, 1.5, 0.5, PALETTE.white);
    c.circles.push({ x, z, r: 0.8 });
    const rig = addStaff(c, `guard-${i}`, x, 2.3, z, yaw, { top: 0xff3b3b, shorts: 0xff3b3b, skin: 0xe0ac82, hair: 0x3a2a1e }, 1.15);
    rig.snapTo("sit");
    c.staff[c.staff.length - 1].scan = { base: yaw, amp: 0.5 };
  });
  void WORLD;
}
