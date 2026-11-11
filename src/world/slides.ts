import * as THREE from "three";
import { PALETTE } from "../core/config";
import { t } from "../core/i18n";
import type { BuildContext } from "./build-context";
import { makeSign, solidBox } from "./build-context";
import type { SlideDef } from "./SlideRide";

const TZ = -34; // tower platform z

function tower(c: BuildContext, x: number, w: number, h: number, color: number, railColor: number) {
  const b = c.batch;
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) b.box(x + dx * (w / 2 - 0.2), 0, TZ + dz * 1.3, 0.35, h, 0.35, color);
  b.box(x, h, TZ, w, 0.3, 3.2, railColor);
  for (const dx of [-1, 1]) b.box(x + dx * (w / 2 - 0.05), h + 0.3, TZ, 0.1, 0.9, 3.2, railColor);
  const step = 0.36, n = Math.ceil(h / step);
  for (let k = 0; k < n; k++) b.box(x, 0, TZ + 1.6 + (n - 1 - k) * 0.45 + 0.22, 1.6, (k + 1) * (h / n), 0.45, k % 2 ? PALETTE.white : railColor);
  solidBox(c, x, TZ + (n * 0.45) / 2, w, 3.2 + n * 0.45);
  c.mapShapes.push({ rect: { minX: x - w / 2, maxX: x + w / 2, minZ: TZ - 1.6, maxZ: TZ + 1.6 + n * 0.45 }, color: "#ff6b5e" });
  return n;
}

const tube = (c: BuildContext, pts: THREE.Vector3[], r: number, color: number, opacity = 1) => {
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
  c.batch.add(new THREE.TubeGeometry(curve, 80, r, 10, false), color, 0, 0, 0, 0, 0, 0, opacity);
  return curve;
};

/** Registers a rideable slide: its entry interactable and ride path. */
function addSlide(c: BuildContext, slides: SlideDef[], id: string, name: string, x: number, h: number, n: number, lanes: THREE.Curve<THREE.Vector3>[], rideOffsetY: number) {
  const base = new THREE.Vector3(x, 0, TZ + 1.6 + n * 0.45 + 0.5);
  const def: SlideDef = {
    id, name, stairBase: base, stairTop: new THREE.Vector3(x, h + 0.3, TZ + 1.6), lanes, rideOffsetY, cooldown: 0,
  };
  slides.push(def);
  c.interactables.push({
    id: `slide-${id}`, x, z: base.z + 1.2, radius: 2.6, y: 2.6,
    label: (g) => (g.player.busy ? null : def.cooldown > 0 ? t("Wait for your turn...") : t("Ride {name}", { name: t(name) })),
    run: (g) => { if (def.cooldown <= 0) g.actions.startSlide(def); },
  });
  c.animated.push((dt) => { if (def.cooldown > 0) def.cooldown -= dt; });
}

export function buildSlides(c: BuildContext): SlideDef[] {
  const slides: SlideDef[] = [];
  const b = c.batch;
  const label = (text: string, x: number, col: string) => {
    const s = makeSign(text, 5, 0.9, col);
    s.position.set(x, 2.2, TZ + 7.5);
    c.group.add(s);
    b.cyl(x - 2.2, 0, TZ + 7.5, 0.08, 0.08, 2.2, PALETTE.white);
    b.cyl(x + 2.2, 0, TZ + 7.5, 0.08, 0.08, 2.2, PALETTE.white);
  };

  // 1. Small slide (kids)
  const n1 = tower(c, -30, 3, 3.2, PALETTE.mint, PALETTE.aqua);
  const c1 = tube(c, [new THREE.Vector3(-30, 3.5, TZ - 1.4), new THREE.Vector3(-30, 2.2, TZ - 3.6), new THREE.Vector3(-30, 1.2, TZ - 6), new THREE.Vector3(-30, 0.5, TZ - 8.2)], 0.75, PALETTE.sun);
  addSlide(c, slides, "small", "Small Slide", -30, 3.2, n1, [c1], -0.35);
  label("SMALL SLIDE", -30, "#5fd6a0");

  // 2. Spiral slide
  const n2 = tower(c, -10, 3.2, 9, PALETTE.grape, PALETTE.pink);
  b.cyl(-10, 0, TZ - 4.2, 0.6, 0.6, 9, PALETTE.white, 12);
  const sp: THREE.Vector3[] = [new THREE.Vector3(-10, 9.6, TZ - 1.5)];
  const turns = 2.25, steps = 36;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = Math.PI + t * turns * Math.PI * 2 * -1;
    sp.push(new THREE.Vector3(-10 + Math.sin(a) * 3.1, 9.2 - t * 8.3, TZ - 4.2 + Math.cos(a) * 3.1));
  }
  sp.push(new THREE.Vector3(-10, 0.6, TZ - 9));
  const c2 = tube(c, sp, 0.7, PALETTE.coral);
  addSlide(c, slides, "spiral", "Spiral Slide", -10, 9, n2, [c2], -0.3);
  label("SPIRAL SLIDE", -10, "#8f6bff");

  // 3. Racing slide (4 lanes)
  const n3 = tower(c, 10, 9, 5.4, PALETTE.aqua, PALETTE.sun);
  const raceLanes: THREE.Curve<THREE.Vector3>[] = [];
  const lane = [PALETTE.coral, PALETTE.sun, PALETTE.mint, PALETTE.grape];
  for (let i = 0; i < 4; i++) {
    const lx = 10 + (i - 1.5) * 2.1;
    const len = 7.6, drop = 5, ang = Math.atan2(drop, len);
    const cz = TZ - 1.5 - len / 2, cy = 0.9 + drop / 2 + 0.1;
    b.add(new THREE.BoxGeometry(1.7, 0.18, Math.hypot(len, drop)), lane[i], lx, cy, cz, ang, 0, 0);
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.12, 0.45, Math.hypot(len, drop)), PALETTE.white, lx + s * 0.85, cy + 0.2, cz, ang, 0, 0);
    raceLanes.push(new THREE.LineCurve3(new THREE.Vector3(lx, 6.1, TZ - 1.5), new THREE.Vector3(lx, 1.1, TZ - 9.1)));
  }
  addSlide(c, slides, "racing", "Racing Slide", 10, 5.4, n3, raceLanes, 0.05);
  label("RACING SLIDE", 10, "#19c3d9");

  // 4. Large tube slide
  const n4 = tower(c, 30, 3.4, 7.2, PALETTE.coral, PALETTE.sun);
  const c4 = tube(c, [
    new THREE.Vector3(30, 8.4, TZ - 1.4), new THREE.Vector3(32.5, 6.4, TZ - 3), new THREE.Vector3(27.5, 4.2, TZ - 5),
    new THREE.Vector3(32, 2.4, TZ - 7), new THREE.Vector3(30, 1.1, TZ - 9), new THREE.Vector3(30, 0.9, TZ - 10.4),
  ], 1.0, PALETTE.aqua, 0.82);
  addSlide(c, slides, "tube", "Tube Slide", 30, 7.2, n4, [c4], -0.5);
  label("TUBE SLIDE", 30, "#ff6b5e");
  return slides;
}
