import * as THREE from "three";
import type { FoodId } from "../core/economy";

const m = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const part = (g: THREE.BufferGeometry, c: number, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(g, m(c));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
};

/** Small low-poly food props held in the hand (origin = where the fingers grip). */
export function foodModel(id: FoodId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "burger":
      g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), 0xe0a04a, 0, 0, 0));
      g.add(part(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 10), 0x6b3a22, 0, 0.03, 0));
      g.add(part(new THREE.CylinderGeometry(0.115, 0.115, 0.015, 10), 0x5fd64a, 0, 0.05, 0));
      g.add(part(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8b060, 0, 0.06, 0));
      break;
    case "pizza": {
      const wedge = part(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 3), 0xffc83d);
      wedge.rotation.y = Math.PI / 6;
      g.add(wedge, part(new THREE.SphereGeometry(0.02, 6, 6), 0xd8352e, 0.03, 0.02, 0.02), part(new THREE.SphereGeometry(0.02, 6, 6), 0xd8352e, -0.04, 0.02, -0.03));
      break;
    }
    case "fries":
      g.add(part(new THREE.BoxGeometry(0.1, 0.1, 0.06), 0xe8433f, 0, 0, 0));
      for (let i = 0; i < 5; i++) g.add(part(new THREE.BoxGeometry(0.018, 0.1, 0.018), 0xffd23f, -0.04 + i * 0.02, 0.09, 0));
      break;
    case "icecream":
      g.add(part(new THREE.ConeGeometry(0.05, 0.14, 8), 0xe0a04a, 0, -0.02, 0));
      g.add(part(new THREE.SphereGeometry(0.065, 10, 8), 0xff8fc7, 0, 0.07, 0));
      g.add(part(new THREE.SphereGeometry(0.04, 8, 6), 0xffffff, 0, 0.13, 0));
      break;
    case "juice":
      g.add(part(new THREE.CylinderGeometry(0.06, 0.045, 0.14, 10), 0xff9a2e, 0, 0.02, 0));
      g.add(part(new THREE.BoxGeometry(0.012, 0.12, 0.012), 0xffffff, 0.02, 0.15, 0));
      break;
    case "water":
      g.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 10), 0x7fd8ff, 0, 0.03, 0));
      g.add(part(new THREE.CylinderGeometry(0.018, 0.04, 0.04, 8), 0x19c3d9, 0, 0.14, 0));
      break;
  }
  return g;
}
