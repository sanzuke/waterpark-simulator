import * as THREE from "three";

export interface SlideDef {
  id: string;
  name: string;
  /** Where riders queue / start climbing. */
  stairBase: THREE.Vector3;
  stairTop: THREE.Vector3;
  /** Curve per lane (lane = pick one at random for multi-lane slides). */
  lanes: THREE.Curve<THREE.Vector3>[];
  /** Rider height above the curve (tubes sit lower than the centre line). */
  rideOffsetY: number;
  /** Seconds since the last rider started; used to space riders out. */
  cooldown: number;
}

export const SLIDE_SPACING = 3.2;

/** One trip up the stairs and down a slide. Used by the player and by NPCs. */
export class SlideRide {
  phase: "climb" | "sit" | "slide" | "done" = "climb";
  readonly pos = new THREE.Vector3();
  readonly exitVel = new THREE.Vector3();
  yaw = 0;
  /** Nose-down angle for the rider while sliding. */
  pitch = 0;
  private route: THREE.Vector3[];
  private seg = 0;
  private segT = 0;
  private curve: THREE.Curve<THREE.Vector3>;
  private len: number;
  private s = 0;
  private v = 2.5;
  private sitTimer = 0.7;
  private tmp = new THREE.Vector3();

  constructor(private def: SlideDef, lane = Math.floor(Math.random() * def.lanes.length)) {
    this.curve = def.lanes[lane];
    this.len = this.curve.getLength();
    const start = this.curve.getPointAt(0).add(new THREE.Vector3(0, def.rideOffsetY, 0));
    this.route = [def.stairBase.clone(), def.stairTop.clone(), new THREE.Vector3(start.x, def.stairTop.y, def.stairTop.z), start.clone().setY(start.y)];
    this.route[3].copy(start);
    this.pos.copy(this.route[0]);
    def.cooldown = SLIDE_SPACING;
  }

  get moving() { return this.phase === "climb"; }

  update(dt: number) {
    if (this.phase === "climb") {
      let step = 3.0 * dt;
      while (step > 0 && this.seg < this.route.length - 1) {
        const a = this.route[this.seg], b = this.route[this.seg + 1];
        const segLen = a.distanceTo(b);
        const left = segLen - this.segT;
        if (step >= left) { step -= left; this.seg++; this.segT = 0; } else { this.segT += step; step = 0; }
      }
      if (this.seg >= this.route.length - 1) {
        this.phase = "sit";
        this.pos.copy(this.route[this.route.length - 1]);
        this.curve.getTangentAt(0, this.tmp);
        this.yaw = Math.atan2(this.tmp.x, this.tmp.z);
      } else {
        const a = this.route[this.seg], b = this.route[this.seg + 1];
        this.pos.lerpVectors(a, b, this.segT / Math.max(0.001, a.distanceTo(b)));
        this.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      }
    } else if (this.phase === "sit") {
      this.sitTimer -= dt;
      if (this.sitTimer <= 0) this.phase = "slide";
    } else if (this.phase === "slide") {
      this.v = Math.min(9.5, this.v + 5 * dt);
      this.s += this.v * dt;
      const u = Math.min(1, this.s / this.len);
      this.curve.getPointAt(u, this.pos);
      this.pos.y += this.def.rideOffsetY;
      this.curve.getTangentAt(u, this.tmp);
      this.yaw = Math.atan2(this.tmp.x, this.tmp.z);
      this.pitch = Math.asin(THREE.MathUtils.clamp(-this.tmp.y, -1, 1));
      if (u >= 1) {
        this.phase = "done";
        this.exitVel.copy(this.tmp).multiplyScalar(4);
        this.exitVel.y = 0;
      }
    }
  }
}
