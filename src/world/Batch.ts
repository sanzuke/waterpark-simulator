import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Collects static low-poly pieces and merges them by colour so the whole park
 * renders in a few dozen draw calls (important for mid-range phones).
 */
export class Batch {
  private groups = new Map<string, { color: number; opacity: number; geos: THREE.BufferGeometry[] }>();
  private tmp = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, opacity = 1) {
    this.e.set(rx, ry, rz, "YXZ");
    this.q.setFromEuler(this.e);
    this.tmp.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(this.tmp);
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    const key = `${color}|${opacity}`;
    let grp = this.groups.get(key);
    if (!grp) this.groups.set(key, (grp = { color, opacity, geos: [] }));
    grp.geos.push(g);
  }

  /** Box whose bottom centre is (x, y, z). */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, ry = 0, rx = 0, rz = 0) {
    this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, rx, ry, rz);
  }
  cyl(x: number, y: number, z: number, rTop: number, rBot: number, h: number, color: number, seg = 10) {
    this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y + h / 2, z);
  }
  cone(x: number, y: number, z: number, r: number, h: number, color: number, seg = 8) {
    this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z);
  }
  sphere(x: number, y: number, z: number, r: number, color: number, sy = 1) {
    const g = new THREE.SphereGeometry(r, 10, 8);
    g.scale(1, sy, 1);
    this.add(g, color, x, y, z);
  }

  build(parent: THREE.Object3D) {
    for (const { color, opacity, geos } of this.groups.values()) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mat = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.groups.clear();
  }
}
