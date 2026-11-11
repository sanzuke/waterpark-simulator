import * as THREE from "three";
import type { Batch } from "./Batch";
import type { Rect } from "./layout";
import type { Interactable, Seat } from "../interaction/types";
import type { CharacterRig } from "../player/CharacterRig";

export interface Circle { x: number; z: number; r: number }
export interface MapShape { rect: Rect; color: string; round?: boolean }

export interface StaffMember {
  id: string;
  rig: CharacterRig;
  /** Seconds left of a "busy working" animation. */
  work: number;
  /** Seconds left of a wave. */
  wave: number;
  nextWave: number;
  /** Lifeguards slowly scan the water. */
  scan?: { base: number; amp: number };
}

export interface BuildContext {
  seats: Seat[];
  staff: StaffMember[];
  gate: { rect: Rect; rail: THREE.Object3D | null };
  batch: Batch;
  group: THREE.Group;
  solids: Rect[];
  circles: Circle[];
  interactables: Interactable[];
  mapShapes: MapShape[];
  animated: ((dt: number, t: number) => void)[];
  rng: () => number;
}

export const solidBox = (c: BuildContext, cx: number, cz: number, w: number, d: number, mapColor?: string) => {
  const r = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
  c.solids.push(r);
  if (mapColor) c.mapShapes.push({ rect: r, color: mapColor });
};

export const makeSign = (text: string, w: number, h: number, bg: string, fg = "#ffffff", sub?: string) => {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = Math.round((512 * h) / w);
  const g = cv.getContext("2d")!;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(4, 4, cv.width - 8, cv.height - 8, cv.height * 0.22);
  g.fill();
  g.lineWidth = 8; g.strokeStyle = "rgba(255,255,255,0.85)"; g.stroke();
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  const size = Math.min(cv.height * (sub ? 0.45 : 0.55), (cv.width * 0.86) / Math.max(4, text.length) * 1.7);
  g.font = `900 ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  g.fillText(text, cv.width / 2, cv.height * (sub ? 0.4 : 0.52));
  if (sub) { g.font = `700 ${cv.height * 0.2}px "Trebuchet MS", sans-serif`; g.fillText(sub, cv.width / 2, cv.height * 0.76); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
  return m;
};
