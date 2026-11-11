import * as THREE from "three";

export interface RigOptions { skin?: number; hair?: number; top?: number; shorts?: number }

export interface RigState {
  speed: number;
  run: boolean;
  mode: "ground" | "swim";
  grounded: boolean;
  vy: number;
  floating: boolean;
  sitting: boolean;
  wading: boolean;
  action?: "eat" | "drink" | "work" | "slide" | "cheer" | "wave" | null;
}

type Params = { pitch: number; hipY: number; aLx: number; aRx: number; aLz: number; aRz: number; lLx: number; lRx: number; headX: number };
const ZERO: Params = { pitch: 0, hipY: 0.5, aLx: 0, aRx: 0, aLz: 0.1, aRz: -0.1, lLx: 0, lRx: 0, headX: 0 };

/**
 * Procedural low-poly child. Faces +Z; local +X is the character's left.
 * All animation is blended from a single parameter set, so land <-> water
 * transitions ease instead of popping.
 */
export class CharacterRig {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private topMat: THREE.MeshLambertMaterial;
  private shortsMat: THREE.MeshLambertMaterial;
  private cur: Params = { ...ZERO };
  private phase = Math.random() * 6;
  private t = Math.random() * 10;
  private held: THREE.Object3D | null = null;

  constructor(opt: RigOptions = {}) {
    const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const skin = mat(opt.skin ?? 0xf2b790);
    const hair = mat(opt.hair ?? 0x4a2f1f);
    this.topMat = mat(opt.top ?? 0xff6b5e);
    this.shortsMat = mat(opt.shorts ?? 0x19c3d9);
    const dark = mat(0x222233);
    const shoe = mat(0xffd23f);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    add(this.pivot, new THREE.CapsuleGeometry(0.17, 0.2, 4, 10), this.topMat, 0, 0.22, 0);
    add(this.pivot, new THREE.CylinderGeometry(0.18, 0.19, 0.2, 10), this.shortsMat, 0, 0.0, 0);

    this.head.position.set(0, 0.64, 0);
    add(this.head, new THREE.SphereGeometry(0.23, 14, 12), skin);
    const cap = add(this.head, new THREE.SphereGeometry(0.245, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.rotation.x = -0.35;
    add(this.head, new THREE.SphereGeometry(0.1, 8, 8), hair, 0, 0.12, -0.2);
    for (const s of [-1, 1]) {
      add(this.head, new THREE.SphereGeometry(0.035, 8, 8), dark, s * 0.09, 0.02, 0.21);
      add(this.head, new THREE.SphereGeometry(0.03, 6, 6), mat(0xff9aa8), s * 0.14, -0.06, 0.19);
    }
    add(this.head, new THREE.BoxGeometry(0.07, 0.02, 0.02), mat(0xc4564d), 0, -0.08, 0.22);
    this.pivot.add(this.head);

    for (const [arm, s] of [[this.armL, 1], [this.armR, -1]] as const) {
      arm.position.set(s * 0.22, 0.36, 0);
      add(arm, new THREE.CapsuleGeometry(0.055, 0.2, 3, 8), skin, 0, -0.16, 0);
      add(arm, new THREE.SphereGeometry(0.065, 8, 8), skin, 0, -0.33, 0);
      this.pivot.add(arm);
    }
    for (const [leg, s] of [[this.legL, 1], [this.legR, -1]] as const) {
      leg.position.set(s * 0.09, 0, 0);
      add(leg, new THREE.CapsuleGeometry(0.075, 0.24, 3, 8), skin, 0, -0.2, 0);
      add(leg, new THREE.BoxGeometry(0.12, 0.07, 0.22), shoe, 0, -0.44, 0.04);
      this.pivot.add(leg);
    }
    this.root.rotation.order = "YXZ";
    this.root.add(this.pivot);
    this.pivot.position.y = ZERO.hipY;
  }

  setOutfit(top: number, shorts: number) {
    this.topMat.color.setHex(top);
    this.shortsMat.color.setHex(shorts);
  }

  private target(s: RigState, dt: number): Params {
    const p: Params = { ...ZERO };
    const sp = s.speed;
    const moving = sp > 0.25;
    if (s.sitting) {
      p.hipY = 0.3; p.lLx = p.lRx = -1.45; p.aLx = p.aRx = -0.7; p.aLz = 0.15; p.aRz = -0.15;
      p.headX = Math.sin(this.t * 1.5) * 0.03;
    } else if (s.mode === "swim") {
      if (s.floating) {
        p.pitch = -1.5; p.hipY = 0.5 + Math.sin(this.t * 1.7) * 0.03;
        p.aLx = p.aRx = -0.2; p.aLz = 1.1 + Math.sin(this.t * 1.7) * 0.12; p.aRz = -p.aLz;
        p.lLx = Math.sin(this.t * 1.7) * 0.12; p.lRx = -p.lLx; p.headX = 0.1;
      } else {
        const f = moving ? 4.5 + sp * 1.4 : 2.6;
        this.phase += dt * f;
        const a = moving ? 0.95 : 0.35;
        p.pitch = moving ? 1.25 : 0.7;
        p.aLx = 3.0 + Math.sin(this.phase) * a; p.aRx = 3.0 - Math.sin(this.phase) * a;
        p.aLz = 0.12; p.aRz = -0.12;
        p.lLx = Math.sin(this.phase * 2) * 0.45; p.lRx = -p.lLx;
        p.headX = -0.7;
      }
    } else if (!s.grounded) {
      const up = s.vy > 0;
      p.aLx = p.aRx = up ? -2.7 : -2.0; p.aLz = 0.6; p.aRz = -0.6;
      p.lLx = up ? -0.7 : -0.35; p.lRx = up ? 0.35 : 0.1;
    } else if (moving) {
      this.phase += dt * (4.5 + sp * 1.25);
      const amp = s.run ? 0.95 : 0.6;
      const sw = Math.sin(this.phase) * amp * (s.wading ? 0.7 : 1);
      p.lLx = sw; p.lRx = -sw; p.aLx = -sw * 0.9; p.aRx = sw * 0.9;
      p.hipY = 0.5 + Math.abs(Math.cos(this.phase)) * (s.run ? 0.06 : 0.03);
      p.pitch = s.run ? 0.14 : 0.04;
      if (s.run) { p.aLx -= 0.3; p.aRx -= 0.3; }
    } else {
      p.hipY = 0.5 + Math.sin(this.t * 2) * 0.008;
      p.aLz = 0.1 + Math.sin(this.t * 2) * 0.03; p.aRz = -p.aLz;
      p.headX = Math.sin(this.t * 0.9) * 0.04;
    }
    switch (s.action) {
      case "slide":
        p.hipY = 0.3; p.lLx = p.lRx = -1.45; p.aLx = p.aRx = -2.8; p.aLz = 0.55; p.aRz = -0.55; p.pitch = 0; p.headX = 0;
        break;
      case "eat":
        p.aRx = -2.25 + Math.sin(this.t * 9) * 0.22; p.aLx = -0.7; p.aRz = -0.1; p.headX = Math.sin(this.t * 10) * 0.07;
        break;
      case "drink":
        p.aRx = -2.7; p.aRz = -0.1; p.aLx = -0.5; p.headX = -0.38;
        break;
      case "work":
        p.aLx = -1.1 + Math.sin(this.t * 8) * 0.3; p.aRx = -1.1 + Math.cos(this.t * 8) * 0.3; p.headX = 0.15;
        break;
      case "cheer":
        p.aLx = p.aRx = -2.9 + Math.sin(this.t * 14) * 0.2; p.aLz = 0.5; p.aRz = -0.5;
        break;
      case "wave":
        p.aRx = -2.9; p.aRz = -0.5 + Math.sin(this.t * 8) * 0.4; p.headX = 0.05;
        break;
    }
    return p;
  }

  /** Attach something (food) to the right hand. */
  setHeld(obj: THREE.Object3D | null) {
    if (this.held) this.armR.remove(this.held);
    this.held = obj;
    if (obj) { obj.position.set(0, -0.33, 0.06); this.armR.add(obj); }
  }

  update(dt: number, s: RigState) {
    this.t += dt;
    const tgt = this.target(s, dt);
    const k = 1 - Math.exp(-(s.sitting ? 10 : 16) * dt);
    const c = this.cur as Record<string, number>;
    for (const key of Object.keys(tgt)) c[key] += ((tgt as Record<string, number>)[key] - c[key]) * k;
    this.apply();
  }

  snapTo(pose: "sit" | "stand") {
    this.cur = { ...ZERO };
    if (pose === "sit") this.cur = this.target({ speed: 0, run: false, mode: "ground", grounded: true, vy: 0, floating: false, sitting: true, wading: false }, 0);
    this.apply();
  }

  private apply() {
    const c = this.cur;
    this.pivot.position.y = c.hipY;
    this.pivot.rotation.x = c.pitch;
    this.armL.rotation.set(c.aLx, 0, c.aLz);
    this.armR.rotation.set(c.aRx, 0, c.aRz);
    this.legL.rotation.x = c.lLx;
    this.legR.rotation.x = c.lRx;
    this.head.rotation.x = c.headX;
  }
}
