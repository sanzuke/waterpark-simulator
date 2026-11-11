import * as THREE from "three";
import { PLAYER, WORLD } from "../core/config";
import { CharacterRig } from "../player/CharacterRig";
import { SlideRide } from "../world/SlideRide";
import { WATER_BODIES } from "../world/layout";
import { foodModel } from "../world/foodModels";
import type { World } from "../world/World";
import type { Seat } from "../interaction/types";
import type { FoodId } from "../core/economy";

type State = "idle" | "walk" | "swim" | "sit" | "queue" | "ride" | "cheer";
type Role = "kid" | "parent";

const SKINS = [0xf2b790, 0xd9a07a, 0xc68a5e, 0x8d5a3b, 0xf6cba8];
const HAIR = [0x2a1a10, 0x6b3b1a, 0xd9a43a, 0x1e1e1e, 0xb5482a];
const SUITS = [[0xff6b5e, 0x19c3d9], [0x5fd6a0, 0x16405c], [0x8f6bff, 0xffd23f], [0xff8fc7, 0x19c3d9], [0xffd23f, 0xff6b5e], [0x19c3d9, 0xffffff]];
const FOODS: FoodId[] = ["icecream", "fries", "juice", "burger"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A simple wandering visitor: a small state machine over walk / swim / sit / queue / slide. */
export class Npc {
  readonly rig: CharacterRig;
  readonly pos = new THREE.Vector3();
  yaw = Math.random() * 6;
  state: State = "idle";
  private timer = rand(0.5, 3);
  private target = { x: 0, z: 0 };
  private activity: "walk" | "swim" | "sit" | "slide" = "walk";
  private seat: Seat | null = null;
  private ride: SlideRide | null = null;
  private slideIdx = 0;
  private vel = { x: 0, z: 0 };
  private flow = { x: 0, z: 0 };
  private speed = 0;
  private stuckT = 0;
  private lastPos = { x: 0, z: 0 };
  private cheerT = 0;
  private hopT = 0;
  private swimming = false;
  private eatingFood = false;

  constructor(private world: World, public role: Role, x: number, z: number, scene: THREE.Scene) {
    const [top, shorts] = pick(SUITS);
    this.rig = new CharacterRig({ skin: pick(SKINS), hair: pick(HAIR), top, shorts });
    if (role === "parent") this.rig.root.scale.setScalar(1.3);
    this.pos.set(x, 0, z);
    this.lastPos = { x, z };
    scene.add(this.rig.root);
  }

  cheer() {
    if (this.state === "ride" || this.state === "sit") return;
    this.state = "cheer"; this.cheerT = 1.6; this.hopT = 0;
  }

  private choose() {
    const r = Math.random();
    const kid = this.role === "kid";
    const free = (s: Seat) => !s.taken;
    let a: "walk" | "swim" | "sit" | "slide";
    if (kid) a = r < 0.25 ? "walk" : r < 0.55 ? "swim" : r < 0.7 ? "sit" : "slide";
    else a = r < 0.6 ? "sit" : r < 0.85 ? "walk" : "swim";
    this.activity = a;
    this.speed = kid ? rand(2.0, 2.8) : rand(1.5, 2.0);
    if (a === "sit") {
      const seats = this.world.seats.filter(free);
      if (!seats.length) a = this.activity = "walk";
      else {
        this.seat = pick(seats); this.seat.taken = true;
        this.target = { x: this.seat.x, z: this.seat.z }; this.state = "walk"; return;
      }
    }
    if (a === "slide") {
      this.slideIdx = Math.floor(Math.random() * this.world.slides.length);
      const sl = this.world.slides[this.slideIdx];
      this.target = { x: sl.stairBase.x + rand(-0.6, 0.6), z: sl.stairBase.z + 1.6 + Math.random() * 2.5 };
      this.state = "walk"; return;
    }
    if (a === "swim") {
      const w = pick(WATER_BODIES.filter((b) => ["family", "kids", "relax", "lazy"].includes(b.id)));
      for (let i = 0; i < 12; i++) {
        const x = rand(w.bounds.minX + 1, w.bounds.maxX - 1), z = rand(w.bounds.minZ + 1, w.bounds.maxZ - 1);
        if (w.depth(x, z) > 0.6) { this.target = { x, z }; break; }
      }
      this.state = "walk"; return;
    }
    // Dry wander point
    for (let i = 0; i < 20; i++) {
      const p = { x: rand(-54, 54), z: rand(-44, 52) };
      const q = { ...p };
      this.world.resolve(q, 0.5);
      if (Math.hypot(q.x - p.x, q.z - p.z) < 0.05 && this.world.groundHeight(p.x, p.z) > -0.05) { this.target = p; break; }
    }
    this.state = "walk";
  }

  /** Move towards a point; returns true when close. */
  private go(dt: number, tx: number, tz: number, speed: number) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.45) { this.vel.x *= 0.5; this.vel.z *= 0.5; return true; }
    const sp = this.swimming ? speed * 0.65 : speed;
    const k = 1 - Math.exp(-8 * dt);
    this.vel.x += ((dx / d) * sp - this.vel.x) * k;
    this.vel.z += ((dz / d) * sp - this.vel.z) * k;
    return false;
  }

  update(dt: number) {
    const w = this.world;
    let action: "eat" | "cheer" | "slide" | null = null;

    switch (this.state) {
      case "idle":
        this.vel.x *= 0.8; this.vel.z *= 0.8;
        this.timer -= dt;
        if (this.timer <= 0) this.choose();
        break;
      case "walk": {
        if (this.go(dt, this.target.x, this.target.z, this.speed)) this.arrive();
        this.stuckT += dt;
        if (this.stuckT > 2.5) {
          if (Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) < 0.4) { this.releaseSeat(); this.state = "idle"; this.timer = 0.2; }
          this.lastPos = { x: this.pos.x, z: this.pos.z }; this.stuckT = 0;
        }
        break;
      }
      case "swim": {
        this.timer -= dt;
        if (this.go(dt, this.target.x, this.target.z, this.speed * 0.6)) {
          const b = w.bodyAt(this.pos.x, this.pos.z);
          if (b) for (let i = 0; i < 8; i++) {
            const x = rand(b.bounds.minX + 1, b.bounds.maxX - 1), z = rand(b.bounds.minZ + 1, b.bounds.maxZ - 1);
            if (b.depth(x, z) > 0.5) { this.target = { x, z }; break; }
          }
        }
        if (this.timer <= 0) { this.state = "idle"; this.timer = 0.3; }
        break;
      }
      case "sit":
        this.timer -= dt;
        action = this.eatingFood ? "eat" : null;
        if (this.timer <= 0) this.standUp();
        break;
      case "queue": {
        const sl = w.slides[this.slideIdx];
        this.go(dt, sl.stairBase.x + (this.slideIdx % 2 ? 0.7 : -0.7), sl.stairBase.z + 1.2, 1.5);
        this.timer -= dt;
        if (sl.cooldown <= 0) {
          this.ride = new SlideRide(sl); this.state = "ride";
        } else if (this.timer <= 0) { this.state = "idle"; this.timer = 0.5; }
        break;
      }
      case "ride": {
        const r = this.ride!;
        r.update(dt);
        this.pos.copy(r.pos); this.yaw = r.yaw;
        action = r.phase === "climb" ? null : "slide";
        this.rig.root.rotation.x = r.phase === "slide" ? r.pitch : 0;
        if (r.phase === "done") {
          this.vel.x = r.exitVel.x; this.vel.z = r.exitVel.z; this.ride = null;
          this.rig.root.rotation.x = 0; this.pos.y = Math.max(this.pos.y, 0.4);
          this.state = "swim"; this.timer = rand(4, 9);
          const sl = w.slides[this.slideIdx];
          this.target = { x: sl.lanes[0].getPointAt(1).x + rand(-1, 1), z: sl.lanes[0].getPointAt(1).z - rand(0.5, 2) };
        }
        break;
      }
      case "cheer":
        this.cheerT -= dt; this.hopT += dt;
        this.vel.x *= 0.8; this.vel.z *= 0.8;
        action = "cheer";
        if (this.cheerT <= 0) { this.state = "idle"; this.timer = 0.5; }
        break;
    }

    if (this.state !== "ride" && this.state !== "sit") this.move(dt);
    if (this.state === "sit" && this.seat) { this.pos.set(this.seat.x, this.seat.y, this.seat.z); this.yaw = this.seat.yaw; }

    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.25 && this.state !== "ride") this.yaw += Math.atan2(Math.sin(Math.atan2(this.vel.x, this.vel.z) - this.yaw), Math.cos(Math.atan2(this.vel.x, this.vel.z) - this.yaw)) * Math.min(1, 10 * dt);
    this.rig.update(dt, {
      speed: this.state === "ride" ? (this.ride?.phase === "climb" ? 2.6 : 0) : sp,
      run: false, mode: this.swimming ? "swim" : "ground", grounded: true, vy: 0,
      floating: this.swimming && sp < 0.2, sitting: this.state === "sit", wading: w.waterAt(this.pos.x, this.pos.z) !== null && !this.swimming,
      action,
    });
    this.rig.root.position.copy(this.pos);
    if (this.state === "cheer") this.rig.root.position.y += Math.abs(Math.sin(this.hopT * 7)) * 0.35;
    this.rig.root.rotation.y = this.yaw;
  }

  private arrive() {
    switch (this.activity) {
      case "sit":
        if (this.seat) {
          this.state = "sit"; this.timer = rand(14, 30);
          this.eatingFood = this.seat.y > 0.45 && this.role === "kid" && Math.random() < 0.7;
          if (this.eatingFood) this.rig.setHeld(foodModel(pick(FOODS)));
        } else this.state = "idle";
        break;
      case "swim": this.state = "swim"; this.timer = rand(14, 30); break;
      case "slide": this.state = "queue"; this.timer = 18; break;
      default: this.state = "idle"; this.timer = rand(1, 4);
    }
  }

  private standUp() {
    this.releaseSeat();
    this.state = "idle"; this.timer = 0.5;
  }
  private releaseSeat() {
    if (this.seat) { this.seat.taken = false; this.pos.set(this.seat.exitX, 0, this.seat.exitZ); this.seat = null; }
    this.eatingFood = false;
    this.rig.setHeld(null);
  }

  private move(dt: number) {
    const w = this.world;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.swimming) {
      w.flowAt(this.pos.x, this.pos.z, this.flow);
      this.pos.x += this.flow.x * dt; this.pos.z += this.flow.z * dt;
    }
    w.resolve(this.pos, 0.35);
    const floor = w.groundHeight(this.pos.x, this.pos.z);
    const s = w.waterAt(this.pos.x, this.pos.z);
    const wasSwim = this.swimming;
    this.swimming = !!s && s.depth > (wasSwim ? PLAYER.swimDepth - 0.3 : PLAYER.swimDepth);
    if (this.swimming) this.pos.y += (s!.surfaceY - PLAYER.swimBodyOffset - this.pos.y) * Math.min(1, 7 * dt);
    else this.pos.y += (floor - this.pos.y) * Math.min(1, 14 * dt);
    this.pos.x = Math.min(WORLD.maxX - 1, Math.max(WORLD.minX + 1, this.pos.x));
  }
}

export class NpcManager {
  readonly npcs: Npc[] = [];
  private fxT = 0;

  constructor(private world: World, scene: THREE.Scene) {
    const spots: [number, number][] = [[-20, 44], [20, 44], [-8, 48], [8, 40], [30, 46], [-44, 28], [-34, 8], [-34, -4], [0, -14], [24, 18], [-24, -24], [6, -26]];
    spots.forEach(([x, z], i) => this.npcs.push(new Npc(world, i >= 10 ? "parent" : "kid", x, z, scene)));
  }

  /** Bucket splash: nearby kids cheer. */
  react(x: number, z: number) {
    for (const n of this.npcs) if (n.role === "kid" && Math.hypot(n.pos.x - x, n.pos.z - z) < 9) n.cheer();
  }

  update(dt: number) {
    for (const n of this.npcs) n.update(dt);
    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = 0.5;
      for (const n of this.npcs) if (n.state === "swim" || (n.state === "walk" && n.pos.y < -0.2)) this.world.effects.ripple(n.pos.x, n.pos.z, 1.2);
    }
  }
}
