import * as THREE from "three";
import { PALETTE, PLAYER, WORLD } from "../core/config";
import { Batch } from "./Batch";
import { Effects } from "./Effects";
import { buildWaterBody, updateWater } from "./water";
import { WATER_BODIES, type Rect, type WaterBody } from "./layout";
import type { BuildContext, Circle, MapShape, StaffMember } from "./build-context";
import type { SlideDef } from "./SlideRide";
import type { BucketApi } from "./playground";
import type { Seat } from "../interaction/types";
import { buildEntrance, buildFoodCourt, buildLifeguards, buildPreparation } from "./buildings";
import { buildSlides } from "./slides";
import { buildPlayground } from "./playground";
import { WavePool, buildWavePool } from "./waves";
import { buildBackdrop, buildScenery } from "./scenery";
import type { Interactable } from "../interaction/types";

export interface WaterSample { body: WaterBody; surfaceY: number; depth: number }

const mulberry = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function tileTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f6ead0"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#efdfbd"; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  g.strokeStyle = "rgba(160,130,90,0.25)"; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Owns the static map, collision, water lookups and interactables. */
export class World {
  readonly scene = new THREE.Scene();
  readonly effects: Effects;
  readonly interactables: Interactable[] = [];
  readonly mapShapes: MapShape[] = [];
  private solids: Rect[] = [];
  private circles: Circle[] = [];
  private animated: ((dt: number, t: number) => void)[] = [];
  private clouds: THREE.Group;
  readonly seats: Seat[] = [];
  readonly staff: StaffMember[] = [];
  slides: SlideDef[] = [];
  readonly waves: WavePool;
  bucket!: BucketApi;
  /** Hooks the game sets so world events can reach sound, HUD and NPCs. */
  onBucketTip: () => void = () => {};
  onBucketHit: (x: number, z: number) => void = () => {};
  onWaveStart: () => void = () => {};
  private gate = { rect: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, rail: null as THREE.Object3D | null };
  gateOpen = false;
  private rings: THREE.Mesh[] = [];
  readonly ball = { x: 0, z: 29, vx: 0, vz: 0 };
  private ballMesh: THREE.Mesh;
  time = 0;

  constructor() {
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(0xcfeeff, 90, 260);
    this.effects = new Effects((x, z) => this.groundHeight(x, z));
    const group = new THREE.Group();
    this.scene.add(group);
    this.waves = new WavePool(WATER_BODIES.find((w) => w.id === "wave")!.bounds, group);
    this.waves.hooks.onStart = () => this.onWaveStart();
    const batch = new Batch();
    const ctx: BuildContext = {
      batch, group, solids: this.solids, circles: this.circles, interactables: this.interactables,
      mapShapes: this.mapShapes, animated: this.animated, rng: mulberry(7),
      seats: this.seats, staff: this.staff, gate: this.gate,
    };

    // Deck with holes where water bodies sit
    const tex = tileTexture();
    tex.repeat.set(0.25, 0.25);
    const shape = new THREE.Shape();
    shape.moveTo(WORLD.minX, -WORLD.minZ); shape.lineTo(WORLD.maxX, -WORLD.minZ);
    shape.lineTo(WORLD.maxX, -WORLD.maxZ); shape.lineTo(WORLD.minX, -WORLD.maxZ);
    for (const w of WATER_BODIES) {
      const { minX, maxX, minZ, maxZ } = w.bounds;
      const hole = new THREE.Path();
      hole.moveTo(minX, -minZ); hole.lineTo(minX, -maxZ); hole.lineTo(maxX, -maxZ); hole.lineTo(maxX, -minZ);
      shape.holes.push(hole);
      group.add(buildWaterBody(w, tex));
      this.mapShapes.push({ rect: w.bounds, color: w.id === "lazy" ? "#2bb8e6" : "#35d0ef" });
    }
    const deckGeo = new THREE.ShapeGeometry(shape);
    deckGeo.rotateX(-Math.PI / 2);
    const deck = new THREE.Mesh(deckGeo, new THREE.MeshLambertMaterial({ map: tex }));
    deck.receiveShadow = true;
    group.add(deck);
    // Lazy-river island is the only dry patch inside a hole; give it grass + trees.
    this.mapShapes.push({ rect: { minX: 17, maxX: 43, minZ: -15, maxZ: 3 }, color: "#8fe08a" });

    buildEntrance(ctx);
    buildPreparation(ctx);
    buildFoodCourt(ctx);
    this.slides = buildSlides(ctx);
    this.bucket = buildPlayground(ctx, this.effects, { onTip: () => this.onBucketTip(), onHit: (x, z) => this.onBucketHit(x, z) });
    buildWavePool(ctx, this.waves);
    this.buildRings();
    buildLifeguards(ctx);
    buildScenery(ctx);
    // Island palms
    this.clouds = buildBackdrop(this.scene, ctx);
    batch.build(group);
    this.scene.add(this.effects.group);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 14, 10),
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.ballTexture() }),
    );
    ball.castShadow = true;
    this.ballMesh = ball;
    this.scene.add(ball);

    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0xf3e6c8, 1.15));
  }

  private ballTexture() {
    const cv = document.createElement("canvas");
    cv.width = 128; cv.height = 64;
    const g = cv.getContext("2d")!;
    const cols = ["#ff6b5e", "#ffffff", "#ffd23f", "#ffffff", "#19c3d9", "#ffffff"];
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * 128) / 6, 0, 128 / 6 + 1, 64); });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  bodyAt(x: number, z: number): WaterBody | null {
    for (const w of WATER_BODIES) {
      const b = w.bounds;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return w;
    }
    return null;
  }

  groundHeight(x: number, z: number): number {
    const w = this.bodyAt(x, z);
    return w ? -w.depth(x, z) : 0;
  }

  setGateOpen(open: boolean) { this.gateOpen = open; }

  staffById(id: string) { return this.staff.find((m) => m.id === id); }

  /** Wave height (metres) added to the surface, only inside the wave pool. */
  surfaceOffset(x: number, z: number) {
    return this.bodyAt(x, z)?.id === "wave" ? this.waves.height(x, z) : 0;
  }

  /** Lazy-river current (m/s) at a point; zero elsewhere. Flows clockwise around the island. */
  flowAt(x: number, z: number, out = { x: 0, z: 0 }) {
    out.x = out.z = 0;
    const body = this.bodyAt(x, z);
    if (body?.id === "wave") {
      // Waves shove swimmers toward the sandy beach.
      if (this.groundHeight(x, z) < -0.45) out.z = this.waves.push(x, z);
      return out;
    }
    if (body?.id !== "lazy" || this.groundHeight(x, z) > -0.45) return out;
    const dx = x - 30, dz = z + 6;
    const speed = 1.5;
    if (Math.abs(dx) / 18 > Math.abs(dz) / 14) out.z = dx > 0 ? speed : -speed;
    else out.x = dz < 0 ? speed : -speed;
    return out;
  }

  private buildRings() {
    const cols = [0xff6b5e, 0xffd23f, 0x5fd6a0, 0xff8fc7, 0x8f6bff];
    const geo = new THREE.TorusGeometry(0.55, 0.2, 8, 14);
    geo.rotateX(Math.PI / 2);
    cols.forEach((c) => {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c }));
      m.castShadow = true;
      this.scene.add(m);
      this.rings.push(m);
    });
  }

  /** Position on the lazy-river centre line for a distance along the loop. */
  private loopPoint(d: number): [number, number] {
    const x0 = 14.5, x1 = 45.5, z0 = -17.5, z1 = 5.5, w = x1 - x0, h = z1 - z0, per = 2 * (w + h);
    d = ((d % per) + per) % per;
    if (d < w) return [x0 + d, z0];
    if (d < w + h) return [x1, z0 + (d - w)];
    if (d < 2 * w + h) return [x1 - (d - w - h), z1];
    return [x0, z1 - (d - 2 * w - h)];
  }

  /** Water at a point if the floor is under the surface. */
  waterAt(x: number, z: number): WaterSample | null {
    const w = this.bodyAt(x, z);
    if (!w) return null;
    const depth = w.depth(x, z);
    return depth > 0.25 ? { body: w, surfaceY: WORLD.waterY, depth: depth + WORLD.waterY } : null;
  }

  /** Push a circle out of solid props and clamp to the park fence. */
  resolve(p: { x: number; z: number }, r: number) {
    for (const s of this.solids) {
      if (this.gateOpen && s === this.gate.rect) continue;
      const cx = Math.max(s.minX, Math.min(p.x, s.maxX));
      const cz = Math.max(s.minZ, Math.min(p.z, s.maxZ));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
      else {
        const l = p.x - s.minX, rr = s.maxX - p.x, t = p.z - s.minZ, bt = s.maxZ - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) p.x = s.minX - r; else if (m === rr) p.x = s.maxX + r; else if (m === t) p.z = s.minZ - r; else p.z = s.maxZ + r;
      }
    }
    for (const c of this.circles) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = r + c.r;
      if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
    }
    p.x = Math.min(WORLD.maxX - r, Math.max(WORLD.minX + r, p.x));
    p.z = Math.min(WORLD.maxZ - r, Math.max(WORLD.minZ + r, p.z));
  }

  update(dt: number, player: { x: number; z: number; speed: number; swimming: boolean }) {
    this.updateStaff(dt, player);
    this.waves.update(dt);
    this.time += dt;
    updateWater(this.time);
    for (const a of this.animated) a(dt, this.time);
    this.effects.update(dt);
    this.clouds.position.x = Math.sin(this.time * 0.02) * 20;

    // Beach ball: floats in the family pool, shoved by anyone nearby.
    const b = this.ball;
    const dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz);
    if (d < 1.1 && d > 0.001) {
      const push = 2.2 + player.speed * 0.9;
      b.vx = (dx / d) * push; b.vz = (dz / d) * push;
      if (player.speed > 0.3) this.effects.droplets(b.x, WORLD.waterY, b.z, 2);
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    const damp = Math.exp(-1.4 * dt);
    b.vx *= damp; b.vz *= damp;
    const fp = WATER_BODIES[0].bounds;
    if (b.x < fp.minX + 0.6 || b.x > fp.maxX - 0.6) { b.vx *= -0.6; b.x = Math.min(fp.maxX - 0.6, Math.max(fp.minX + 0.6, b.x)); }
    if (b.z < fp.minZ + 0.6 || b.z > fp.maxZ - 0.9) { b.vz *= -0.6; b.z = Math.min(fp.maxZ - 0.9, Math.max(fp.minZ + 0.6, b.z)); }
    this.ballMesh.position.set(b.x, WORLD.waterY + 0.28 + Math.sin(this.time * 2.2) * 0.04, b.z);
    this.ballMesh.rotation.y += (b.vx + b.vz) * dt * 0.8;
    this.rings.forEach((r, i) => {
      const [x, z] = this.loopPoint(this.time * 1.5 + i * 22);
      r.position.set(x, WORLD.waterY + 0.1 + Math.sin(this.time * 2 + i) * 0.03, z);
      r.rotation.y = this.time * 0.3 + i;
    });
    const rail = this.gate.rail;
    if (rail) rail.rotation.z += ((this.gateOpen ? Math.PI / 2 : 0) - rail.rotation.z) * Math.min(1, dt * 5);
    void PLAYER;
  }

  private updateStaff(dt: number, p: { x: number; z: number }) {
    for (const m of this.staff) {
      m.work = Math.max(0, m.work - dt); m.wave = Math.max(0, m.wave - dt);
      m.nextWave -= dt;
      const near = Math.hypot(m.rig.root.position.x - p.x, m.rig.root.position.z - p.z) < 6;
      if (m.nextWave <= 0 && !m.scan) { m.wave = 1.6; m.nextWave = (near ? 6 : 12) + Math.random() * 8; }
      if (m.scan) m.rig.root.rotation.y = m.scan.base + Math.sin(this.time * 0.5 + m.rig.root.position.x) * m.scan.amp;
      const action = m.work > 0 ? "work" : m.wave > 0 ? "wave" : null;
      m.rig.update(dt, { speed: 0, run: false, mode: "ground", grounded: true, vy: 0, floating: false, sitting: !!m.scan, wading: false, action });
    }
  }
}
