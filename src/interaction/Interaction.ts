import * as THREE from "three";
import type { GameApi, Interactable } from "./types";

/** Finds the nearest available interactable, shows its prompt and marker, runs it on request. */
export class Interaction {
  current: Interactable | null = null;
  private marker: THREE.Mesh;

  constructor(private items: Interactable[], scene: THREE.Scene) {
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.55, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    scene.add(this.marker);
  }

  update(g: GameApi, t: number) {
    const p = g.player.pos;
    let best: Interactable | null = null, bestScore = Infinity, label: string | null = null;
    for (const it of this.items) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > it.radius || d >= bestScore) continue;
      const l = it.label(g);
      if (l) { best = it; bestScore = d; label = l; }
    }
    this.current = best;
    g.hud.setPrompt(label);
    if (best) {
      this.marker.visible = true;
      this.marker.position.set(best.x, (best.y ?? 2) + Math.sin(t * 4) * 0.15, best.z);
      this.marker.rotation.y = t * 2;
    } else this.marker.visible = false;
  }

  trigger(g: GameApi) {
    if (!this.current) return false;
    this.current.run(g);
    return true;
  }
}
