import { PALETTE } from "../core/config";
import type { BuildContext } from "./build-context";
import { makeSign, solidBox } from "./build-context";
import * as THREE from "three";
import type { Effects } from "./Effects";

export interface BucketHooks { onTip(): void; onHit(x: number, z: number): void }
export interface BucketApi { fill: number; tipping: boolean; landing: { x: number; z: number }; tip(): void }

export const PLAY = { cx: -34, cz: -6 };

export function buildPlayground(c: BuildContext, fx: Effects, hooks: BucketHooks): BucketApi {
  const b = c.batch;
  // Splash pad
  b.box(PLAY.cx, 0, PLAY.cz, 20, 0.05, 20, 0x59d6e8);
  c.mapShapes.push({ rect: { minX: PLAY.cx - 10, maxX: PLAY.cx + 10, minZ: PLAY.cz - 10, maxZ: PLAY.cz + 10 }, color: "#59d6e8" });
  for (let i = 0; i < 6; i++) b.cyl(PLAY.cx + (i % 3 - 1) * 5.5, 0.05, PLAY.cz + 2 + Math.floor(i / 3) * 6 - 3, 1.2, 1.2, 0.02, i % 2 ? PALETTE.sun : PALETTE.pink, 16);

  // Fountain jets: 3 x 3 grid, toggled by the central controller.
  const jets: [number, number][] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i || j) jets.push([PLAY.cx + i * 4, PLAY.cz + 3 + j * 3.5]);
  for (const [x, z] of jets) b.cyl(x, 0.05, z, 0.25, 0.35, 0.18, PALETTE.white);
  b.cyl(PLAY.cx, 0.05, PLAY.cz + 3, 0.45, 0.6, 0.3, PALETTE.coral);
  let on = 0;
  c.animated.push((dt, t) => {
    if (on <= 0) return;
    on -= dt;
    for (const [x, z] of jets) {
      const n = Math.random() < dt * 60 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const hi = 5.5 + Math.sin(t * 3 + x + z) * 1.2 + Math.random();
        fx.emit(x, 0.3, z, (Math.random() - 0.5) * 0.9, hi, (Math.random() - 0.5) * 0.9, 1.2, 0.2);
      }
    }
  });
  c.interactables.push({
    id: "fountains", x: PLAY.cx, z: PLAY.cz + 3, radius: 3.4, y: 2.2,
    label: () => (on > 0 ? "Fountains Are On!" : "Start Fountains"),
    run: (g) => { if (on > 0) { g.hud.toast("Run through the splashes!"); return; } on = 25; g.hud.toast("Whoosh! Fountains on for a while"); },
  });
  c.circles.push({ x: PLAY.cx, z: PLAY.cz + 3, r: 0.6 });

  // Water-cannon posts
  for (const sx of [-1, 1]) {
    b.cyl(PLAY.cx + sx * 8.5, 0, PLAY.cz + 8, 0.14, 0.14, 1.4, PALETTE.white);
    b.box(PLAY.cx + sx * 8.5, 1.4, PLAY.cz + 7.6, 0.3, 0.3, 1.1, PALETTE.coral, 0, 0.3);
    c.circles.push({ x: PLAY.cx + sx * 8.5, z: PLAY.cz + 8, r: 0.3 });
  }

  // Giant tipping bucket: fills, tips over the splash pad, then swings back.
  const bx = PLAY.cx + 6, bz = PLAY.cz - 6;
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) b.box(bx + dx * 1.4, 0, bz + dz * 1.4, 0.3, 5.2, 0.3, PALETTE.sun);
  b.box(bx, 5.2, bz, 3.4, 0.3, 3.4, PALETTE.coral);
  solidBox(c, bx, bz, 3.2, 3.2, "#ffd23f");
  const pivot = new THREE.Group();
  pivot.position.set(bx - 1.3, 6.3, bz);
  const bucketMat = new THREE.MeshLambertMaterial({ color: PALETTE.aqua, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.0, 1.6, 12, 1, true), bucketMat);
  body.position.set(1.3, 0, 0); body.castShadow = true;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 12), new THREE.MeshLambertMaterial({ color: PALETTE.coral }));
  bottom.position.set(1.3, -0.8, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 6, 16), new THREE.MeshLambertMaterial({ color: PALETTE.sun }));
  rim.rotation.x = Math.PI / 2; rim.position.set(1.3, 0.8, 0);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.0, 1.4, 12), new THREE.MeshLambertMaterial({ color: 0x59d6ff, transparent: true, opacity: 0.85 }));
  water.position.set(1.3, -0.8, 0);
  pivot.add(body, bottom, rim, water);
  c.group.add(pivot);
  const lx = bx - 4.6, lz = bz;
  const api: BucketApi = { fill: 0, tipping: false, landing: { x: lx, z: lz }, tip: () => {} };
  let phase = 0, t = 0, hit = false;
  const POUR_FROM = 0.9;
  api.tip = () => { if (api.tipping) return; api.tipping = true; phase = 1; t = 0; hit = false; hooks.onTip(); };
  c.animated.push((dt) => {
    if (!api.tipping) {
      api.fill = Math.min(1, api.fill + dt / 22);
      if (api.fill >= 1) api.tip();
    } else {
      t += dt;
      let theta = 0;
      if (phase === 1) { theta = Math.min(1, t / 1.4); theta = theta * theta * (3 - 2 * theta) * 1.9; if (t >= 1.4) { phase = 2; t = 0; } }
      else if (phase === 2) {
        theta = 1.9;
        const pour = 1.4 + api.fill * 0.8;
        const rate = 240 * api.fill + 60;
        const n = Math.round(rate * dt);
        for (let k = 0; k < n; k++) fx.emit(pivot.position.x - 0.75, 5.95, bz + (Math.random() - 0.5) * 1.6, -2.2 - Math.random() * 1.2, -0.3, (Math.random() - 0.5) * 1.4, 1.6, 0.24);
        if (!hit && t > 0.9) { hit = true; fx.splash(lx, 0.1, lz, 1.8); fx.splash(lx - 1, 0.1, lz + 1, 1.2); fx.splash(lx + 1, 0.1, lz - 1, 1.2); hooks.onHit(lx, lz); }
        api.fill = Math.max(0, api.fill - dt / pour);
        if (t >= pour) { phase = 3; t = 0; }
      } else {
        theta = 1.9 * (1 - Math.min(1, t / 1.6)) ;
        if (t >= 1.6) { api.tipping = false; api.fill = 0; theta = 0; }
      }
      pivot.rotation.z = theta;
    }
    if (!api.tipping) pivot.rotation.z = Math.sin(performance.now() / 700) * 0.01;
    const wl = api.fill * 1.4;
    const tilt = pivot.rotation.z;
    water.visible = wl > 0.03 && tilt < POUR_FROM * 2;
    water.scale.y = Math.max(0.01, wl / 1.4);
    water.position.y = -0.8 + wl / 2 + 0.05;
  });
  c.interactables.push({
    id: "bucket", x: bx, z: bz + 3, radius: 3.2, y: 2.4,
    label: () => (api.tipping ? "Splash!" : api.fill > 0.3 ? "Tip the Bucket!" : "Bucket is filling..."),
    run: (g) => { if (api.tipping) return; if (api.fill > 0.3) { g.hud.toast("Here it comes... stand under it!"); api.tip(); } else g.hud.toast("Almost... let it fill a bit more"); },
  });

  // Climbing structure
  const cx = PLAY.cx - 6, cz = PLAY.cz - 6;
  const cols = [PALETTE.coral, PALETTE.sun, PALETTE.mint, PALETTE.grape];
  for (let i = 0; i < 4; i++) b.box(cx + i * 1.1, 0, cz, 1.1, 0.6 + i * 0.6, 3, cols[i]);
  b.box(cx + 4.4 + 1.1, 0, cz, 2.2, 3, 3, PALETTE.aqua);
  solidBox(c, cx + 3.4, cz, 7.6, 3, "#ff6b5e");

  // Mushroom shade + sign
  b.cyl(PLAY.cx - 7, 0, PLAY.cz + 6, 0.18, 0.18, 2.4, PALETTE.white);
  b.cone(PLAY.cx - 7, 2.2, PLAY.cz + 6, 2.2, 0.9, PALETTE.pink, 12);
  c.circles.push({ x: PLAY.cx - 7, z: PLAY.cz + 6, r: 0.3 });
  const s = makeSign("SPLASH PLAYGROUND", 6, 1, "#19c3d9");
  s.position.set(PLAY.cx, 3.2, PLAY.cz + 10.2);
  c.group.add(s);
  b.cyl(PLAY.cx - 3, 0, PLAY.cz + 10.2, 0.08, 0.08, 3.6, PALETTE.white);
  b.cyl(PLAY.cx + 3, 0, PLAY.cz + 10.2, 0.08, 0.08, 3.6, PALETTE.white);
  return api;
}
