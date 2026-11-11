import * as THREE from "three";
import { WORLD } from "../core/config";
import type { WaterBody } from "./layout";

const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);

export const waterMaterial = new THREE.ShaderMaterial({
  uniforms,
  fog: true,
  transparent: true,
  depthWrite: false,
  vertexShader: /* glsl */ `
    attribute float aDepth;
    varying float vDepth;
    varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
      vDepth = aDepth;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying float vDepth;
    varying vec3 vWorld;
    #include <fog_pars_fragment>
    float ridge(vec2 p, float t) {
      float a = sin(p.x * 1.7 + t) + sin(p.y * 1.9 - t * 1.3) + sin((p.x + p.y) * 1.1 + t * 0.7);
      return pow(1.0 - abs(sin(a * 1.4)), 6.0);
    }
    void main() {
      vec3 shallow = vec3(0.22, 0.85, 0.92);
      vec3 deep = vec3(0.02, 0.38, 0.80);
      vec3 col = mix(shallow, deep, smoothstep(0.1, 1.6, vDepth));
      float c = ridge(vWorld.xz, uTime * 0.9) * 0.55 + ridge(vWorld.xz * 1.7 + 4.0, -uTime * 0.7) * 0.35;
      col += vec3(c) * 0.28;
      float sparkle = pow(max(0.0, sin(vWorld.x * 7.0 + uTime * 2.0) * sin(vWorld.z * 6.0 - uTime * 1.7)), 14.0);
      col += sparkle * 0.5;
      float alpha = mix(0.5, 0.92, smoothstep(0.0, 1.0, vDepth));
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});

export const updateWater = (t: number) => { uniforms.uTime.value = t; };

/** Water surface grid + tiled pool floor + side skirts for one body. */
export function buildWaterBody(body: WaterBody, tileTex: THREE.Texture): THREE.Group {
  const { bounds: b } = body;
  const g = new THREE.Group();
  const step = 1;
  const nx = Math.round((b.maxX - b.minX) / step);
  const nz = Math.round((b.maxZ - b.minZ) / step);
  const vx = nx + 1;
  const pos: number[] = [];
  const dep: number[] = [];
  const floorPos: number[] = [];
  const floorCol: number[] = [];
  const idx: number[] = [];
  const tile = new THREE.Color(0x9fe3ef);
  const grass = new THREE.Color(0x6fcf6a);
  const sand = new THREE.Color(0xf3e6c8);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = b.minX + (i / nx) * (b.maxX - b.minX);
      const z = b.minZ + (j / nz) * (b.maxZ - b.minZ);
      const d = body.depth(x, z);
      pos.push(x, WORLD.waterY, z);
      dep.push(Math.max(0, d - 0.1));
      floorPos.push(x, -d, z);
      const c = d < 0.02 ? (body.id === "lazy" ? grass : sand) : tile;
      floorCol.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i;
    idx.push(a, a + vx, a + 1, a + 1, a + vx, a + vx + 1);
  }
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  wGeo.setAttribute("aDepth", new THREE.Float32BufferAttribute(dep, 1));
  wGeo.setIndex(idx);
  const water = new THREE.Mesh(wGeo, waterMaterial);
  water.renderOrder = 2;
  g.add(water);

  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.Float32BufferAttribute(floorPos, 3));
  fGeo.setAttribute("color", new THREE.Float32BufferAttribute(floorCol, 3));
  fGeo.setIndex(idx);
  fGeo.computeVertexNormals();
  const floor = new THREE.Mesh(fGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  floor.receiveShadow = true;
  g.add(floor);

  // Skirts so the pool edge looks solid from the side.
  const sp: number[] = [];
  const si: number[] = [];
  const addSkirt = (x0: number, z0: number, x1: number, z1: number) => {
    const d0 = body.depth(x0, z0), d1 = body.depth(x1, z1);
    if (d0 < 0.01 && d1 < 0.01) return;
    const n = sp.length / 3;
    sp.push(x0, 0, z0, x1, 0, z1, x1, -d1, z1, x0, -d0, z0);
    si.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  for (let i = 0; i < nx; i++) {
    const x0 = b.minX + (i / nx) * (b.maxX - b.minX), x1 = b.minX + ((i + 1) / nx) * (b.maxX - b.minX);
    addSkirt(x0, b.minZ, x1, b.minZ);
    addSkirt(x0, b.maxZ, x1, b.maxZ);
  }
  for (let j = 0; j < nz; j++) {
    const z0 = b.minZ + (j / nz) * (b.maxZ - b.minZ), z1 = b.minZ + ((j + 1) / nz) * (b.maxZ - b.minZ);
    addSkirt(b.minX, z0, b.minX, z1);
    addSkirt(b.maxX, z0, b.maxX, z1);
  }
  if (sp.length) {
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    sGeo.setIndex(si);
    sGeo.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: 0xbff0f6, side: THREE.DoubleSide, map: tileTex });
    g.add(new THREE.Mesh(sGeo, m));
  }

  // Coloured coping around the rim.
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const rim = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), rimMat);
    m.position.set(x, 0.04, z);
    m.receiveShadow = true;
    g.add(m);
  };
  void rim;
  return g;
}
