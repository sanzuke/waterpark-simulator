import * as THREE from "three";
import { WORLD } from "../core/config";

const MAX = 700;

/** Pooled droplets (Points) and expanding ripple rings. */
export class Effects {
  readonly group = new THREE.Group();
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private sizeAttr: THREE.BufferAttribute;
  private posAttr: THREE.BufferAttribute;
  private cursor = 0;
  private ripples: { mesh: THREE.Mesh; age: number; life: number; active: boolean }[] = [];
  private rippleCursor = 0;

  constructor(private groundAt: (x: number, z: number) => number) {
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1);
    geo.setAttribute("position", this.posAttr);
    geo.setAttribute("aSize", this.sizeAttr);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute float aSize; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if(d>0.5) discard;
        gl_FragColor = vec4(0.85,0.97,1.0, smoothstep(0.5,0.1,d) * 0.9); }`,
      uniforms: { uScale: { value: 600 } },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    this.points = pts;
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;

    const ringGeo = new THREE.RingGeometry(0.85, 1, 24);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 3;
      this.group.add(m);
      this.ripples.push({ mesh: m, age: 0, life: 1, active: false });
    }
  }
  private points: THREE.Points;

  setViewportScale(heightPx: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = heightPx * 0.9;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    const i = this.cursor++ % MAX;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.size[i] = size;
  }

  splash(x: number, y: number, z: number, strength = 1) {
    const n = Math.round(18 * strength) + 6;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.8 + Math.random() * 1.8) * (0.6 + strength * 0.5);
      this.emit(x, y, z, Math.cos(a) * s, 2.2 + Math.random() * 3 * strength, Math.sin(a) * s, 0.7 + Math.random() * 0.5, 0.2 + Math.random() * 0.18);
    }
    this.ripple(x, z, 1.4 + strength);
  }

  droplets(x: number, y: number, z: number, n = 3) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(x, y, z, Math.cos(a) * 0.8, 1.2 + Math.random() * 1.4, Math.sin(a) * 0.8, 0.45, 0.14);
    }
  }

  ripple(x: number, z: number, maxScale = 1.2) {
    const r = this.ripples[this.rippleCursor++ % this.ripples.length];
    r.active = true; r.age = 0; r.life = 0.9;
    r.mesh.visible = true;
    r.mesh.position.set(x, WORLD.waterY + 0.03, z);
    r.mesh.userData.max = maxScale;
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      this.vel[p + 1] -= 9.8 * dt;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const floorY = Math.max(this.groundAt(this.pos[p], this.pos[p + 2]), WORLD.waterY);
      if (this.life[i] <= 0 || this.pos[p + 1] < floorY) { this.life[i] = 0; this.pos[p + 1] = -999; }
    }
    this.posAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const s = 0.3 + t * (r.mesh.userData.max ?? 1.2);
      r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
    }
  }
}
