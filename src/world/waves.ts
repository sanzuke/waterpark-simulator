import * as THREE from "three";
import { PALETTE, WORLD } from "../core/config";
import type { BuildContext } from "./build-context";
import { makeSign, solidBox } from "./build-context";
import type { Rect } from "./layout";
import { t } from "../core/i18n";

/** The wave machine rolls a set of waves for a while, then rests. */
const CYCLE = { calm: 9, waves: 12 };
const RIDE = 2.2; // wave travel speed, m/s toward the beach (+z)
const AMP = 0.34; // crest height in metres

export interface WaveHooks {
  onStart?: () => void;
}

/**
 * Wave pool surface + machine state. Swimming physics read `height` and `push`;
 * the meshes here are only the look of the water.
 */
export class WavePool {
  strength = 0; // 0..1 envelope of the current wave set
  running = false;
  private timer = CYCLE.calm;
  private time = 0;
  private crests: THREE.Mesh[] = [];
  private floats: THREE.Mesh[] = [];
  private wheel: THREE.Object3D | null = null;
  readonly bounds: Rect;
  hooks: WaveHooks = {};

  constructor(bounds: Rect, scene: THREE.Object3D) {
    this.bounds = bounds;
    const foam = foamTexture();
    const w = bounds.maxX - bounds.minX;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 1.2, 2.6),
        new THREE.MeshBasicMaterial({ map: foam, transparent: true, opacity: 0, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      m.position.set((bounds.minX + bounds.maxX) / 2, WORLD.waterY + 0.12, bounds.minZ + 2 + i * 8);
      scene.add(m);
      this.crests.push(m);
    }
    const ring = new THREE.TorusGeometry(0.5, 0.18, 8, 14);
    ring.rotateX(Math.PI / 2);
    [0xff6b5e, 0xffd23f, 0x5fd6a0, 0xff8fc7].forEach((color, i) => {
      const f = new THREE.Mesh(ring, new THREE.MeshLambertMaterial({ color }));
      f.position.set(bounds.minX + 3 + i * 3.4, WORLD.waterY + 0.12, bounds.maxZ - 4 - (i % 2) * 3);
      scene.add(f);
      this.floats.push(f);
    });
  }

  /** The machine wheel, spun by `update`. */
  setWheel(wheel: THREE.Object3D | null) { this.wheel = wheel; }

  /** Height of the surface at a point (metres, may be negative in a trough). */
  height(x: number, z: number) {
    if (this.strength <= 0) return 0;
    const b = this.bounds;
    // Fade the swell out at the pool walls so the rim never clips.
    const edge = Math.min(1, (x - b.minX) / 3, (b.maxX - x) / 3);
    const phase = (z - b.minZ) * 0.85 - this.time * RIDE * 0.85;
    return AMP * this.strength * edge * (Math.sin(phase) * 0.75 + Math.sin(phase * 2.1 + 1.3) * 0.25);
  }

  /** Water push toward the beach (+z) at a point. */
  push(x: number, z: number) {
    if (this.strength <= 0) return 0;
    const phase = (z - this.bounds.minZ) * 0.85 - this.time * RIDE * 0.85;
    // Gentle shove: kids should drift, not be swept off their feet.
    return this.strength * (0.45 + 0.5 * (0.5 + 0.5 * Math.sin(phase)));
  }

  /** Start a wave set now, if the pool is resting. */
  start() {
    if (this.running) return false;
    this.running = true;
    this.timer = CYCLE.waves;
    this.hooks.onStart?.();
    return true;
  }

  update(dt: number) {
    this.timer -= dt;
    if (this.running && this.timer <= 0) { this.running = false; this.timer = CYCLE.calm; }
    else if (!this.running && this.timer <= 0) this.start();

    // Ramp in and out so the water never jumps.
    const target = this.running ? (this.timer > CYCLE.waves - 1.5 ? (CYCLE.waves - this.timer) / 1.5 : this.timer < 2 ? this.timer / 2 : 1) : 0;
    this.strength += (target - this.strength) * Math.min(1, dt * 2.5);
    if (this.strength < 0.002) this.strength = 0;
    this.time += dt;

    if (this.wheel) this.wheel.rotation.x += dt * (1 + this.strength * 7);

    const b = this.bounds, span = b.maxZ - b.minZ;
    this.crests.forEach((m, i) => {
      const travel = (this.time * RIDE + i * 2.6) % span;
      m.position.z = b.minZ + 1.5 + travel;
      const fade = Math.min(1, travel / 3, (span - travel) / 3);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * this.strength * Math.max(0, fade);
      m.position.y = WORLD.waterY + 0.12 + this.height(m.position.x, m.position.z);
    });
    this.floats.forEach((f, i) => {
      const bob = this.height(f.position.x, f.position.z);
      f.position.y = WORLD.waterY + 0.12 + bob;
      f.rotation.z = Math.sin(this.time * 2 + i) * 0.12 * this.strength;
    });
  }
}

function foamTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 64;
  const g = cv.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.5})`;
    g.beginPath();
    g.arc(Math.random() * 256, 20 + Math.random() * 26, 2 + Math.random() * 7, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Machine house, sign, deck props and the button that starts a wave set. */
export function buildWavePool(c: BuildContext, waves: WavePool) {
  const b = c.batch;
  const cx = (waves.bounds.minX + waves.bounds.maxX) / 2;
  const mz = waves.bounds.minZ - 1.6;

  // Machine house with two turning paddle wheels.
  b.box(cx, 0, mz, 6.4, 2.2, 2.4, PALETTE.aqua);
  b.box(cx, 2.3, mz, 7, 0.35, 2.9, PALETTE.white);
  b.box(cx - 1.9, 1.4, mz + 1.2, 1.5, 1.2, 0.25, PALETTE.navy);
  b.box(cx + 1.9, 1.4, mz + 1.2, 1.5, 1.2, 0.25, PALETTE.navy);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.16, 8, 16),
    new THREE.MeshLambertMaterial({ color: PALETTE.sun }),
  );
  wheel.position.set(cx, 1.35, mz + 1.35);
  wheel.castShadow = true;
  c.group.add(wheel);
  waves.setWheel(wheel);
  solidBox(c, cx, mz, 6.4, 2.4, "#19c3d9");
  const signMesh = makeSign("WAVE POOL", 5.6, 1.1, "#19c3d9", "#ffffff", "Press E");
  signMesh.position.set(cx, 3.0, mz + 1.5);
  c.group.add(signMesh);

  // Blue coping so the pool reads as "waves" from the deck.
  for (const x of [-1, 1]) b.box(cx + x * 3.4, 0.1, mz + 1.1, 0.5, 0.5, 0.5, PALETTE.white);

  c.interactables.push({
    id: "wave-machine",
    x: cx, z: mz + 2.4, radius: 3.2, y: 2.8,
    label: () => (waves.running ? null : t("Start the waves")),
    run: (g) => {
      if (!waves.start()) { g.hud.toast(t("Waves are resting. Try again soon!")); return; }
      g.hud.toast(t("Waves are coming!"));
    },
  });

  // Beachy props along the shallow south end.
  for (const [x, z] of [[waves.bounds.minX + 1.6, waves.bounds.maxZ + 1.4], [waves.bounds.maxX - 1.6, waves.bounds.maxZ + 1.4]]) {
    b.box(x, 0, z, 0.18, 2.2, 0.18, PALETTE.white);
    b.cone(x, 2.4, z, 1.6, 0.6, PALETTE.pink);
    c.circles.push({ x, z, r: 0.25 });
  }
}
