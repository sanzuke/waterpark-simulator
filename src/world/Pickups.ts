import * as THREE from "three";
import { WORLD } from "../core/config";
import type { World } from "./World";

interface Coin { mesh: THREE.Mesh; x: number; z: number; base: number; value: number; respawn: number }

/** Shiny Water Coins scattered around the park. They come back after a while, so nobody runs out. */
export class Pickups {
  private coins: Coin[] = [];
  private geo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14);
  private mats = [
    new THREE.MeshLambertMaterial({ color: 0xffc928, emissive: 0x7a5200 }),
    new THREE.MeshLambertMaterial({ color: 0x4fc3ff, emissive: 0x0a4a7a }),
  ];

  constructor(private world: World, scene: THREE.Scene, count = 30) {
    this.geo.rotateX(Math.PI / 2);
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let tries = 0;
    while (this.coins.length < count && tries++ < 600) {
      const p = { x: WORLD.minX + 4 + rnd() * 112, z: WORLD.minZ + 4 + rnd() * 100 };
      if (p.z > 53) continue;
      const q = { ...p };
      world.resolve(q, 0.9);
      if (Math.hypot(q.x - p.x, q.z - p.z) > 0.05) continue;
      const big = rnd() < 0.2;
      const mesh = new THREE.Mesh(this.geo, this.mats[big ? 1 : 0]);
      mesh.castShadow = true;
      const base = Math.max(world.groundHeight(p.x, p.z), WORLD.waterY) + 0.85;
      mesh.position.set(p.x, base, p.z);
      scene.add(mesh);
      this.coins.push({ mesh, x: p.x, z: p.z, base, value: big ? 5 : 2, respawn: 0 });
    }
  }

  update(dt: number, t: number, px: number, py: number, pz: number, collect: (value: number, x: number, y: number, z: number) => void, active: boolean) {
    for (const c of this.coins) {
      if (c.respawn > 0) { c.respawn -= dt; if (c.respawn <= 0) c.mesh.visible = true; continue; }
      c.mesh.rotation.y = t * 2.5 + c.x;
      c.mesh.position.y = c.base + Math.sin(t * 2.4 + c.z) * 0.08;
      if (active && Math.hypot(c.x - px, c.z - pz) < 1.2 && Math.abs(c.base - (py + 1)) < 1.6) {
        c.mesh.visible = false; c.respawn = 100;
        collect(c.value, c.x, c.base, c.z);
      }
    }
  }
}
