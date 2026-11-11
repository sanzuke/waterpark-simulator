import * as THREE from "three";
import { PLAYER, WORLD } from "../core/config";
import type { Input } from "../core/Input";
import type { World } from "../world/World";
import type { Seat } from "../interaction/types";
import { CharacterRig } from "./CharacterRig";
import type { SlideRide } from "../world/SlideRide";
import type { Food } from "../core/economy";
import { foodModel } from "../world/foodModels";

export const OUTFITS = [
  { name: "Sunny Coral", top: 0xff6b5e, shorts: 0x19c3d9 },
  { name: "Mint Splash", top: 0x5fd6a0, shorts: 0x16405c },
  { name: "Grape Wave", top: 0x8f6bff, shorts: 0xffd23f },
  { name: "Bubblegum", top: 0xff8fc7, shorts: 0x19c3d9 },
];

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Land / swim / sit controller. Game rules stay here; the rig only renders. */
export class Player {
  readonly rig = new CharacterRig();
  readonly pos = new THREE.Vector3();
  yaw = Math.PI;
  mode: "ground" | "swim" = "ground";
  private ride: SlideRide | null = null;
  private eating: { food: Food; left: number; onTick: (d: number) => void; onDone: () => void } | null = null;
  onRideEnd: () => void = () => {};
  private flow = { x: 0, z: 0 };
  private sprayT = 0;
  grounded = true;
  vy = 0;
  speed = 0;
  /** Hook for later systems (low energy slows the player slightly). */
  speedScale = 1;
  outfit = 0;
  private vel = { x: 0, z: 0 };
  private seat: Seat | null = null;
  private idleSwim = 0;
  private fxTimer = 0;
  private run = false;
  private wading = false;

  get isSitting() { return this.seat !== null; }
  /** True while a ride or a snack has control of the character. */
  get busy() { return this.ride !== null || this.eating !== null; }
  get isEating() { return this.eating !== null; }
  get isRiding() { return this.ride !== null; }

  startRide(ride: SlideRide) {
    this.standUp();
    this.ride = ride; this.vel.x = this.vel.z = 0; this.mode = "ground"; this.grounded = true;
    this.pos.copy(ride.pos);
  }

  /** Hand over food: plays the eating/drinking animation and feeds energy over time. */
  eat(food: Food, onTick: (d: number) => void, onDone: () => void) {
    this.eating = { food, left: food.seconds, onTick, onDone };
    this.rig.setHeld(foodModel(food.id));
  }
  get isSwimming() { return this.mode === "swim"; }
  get floating() { return this.mode === "swim" && this.idleSwim > 1; }

  teleport(x: number, z: number, yaw = this.yaw) {
    if (this.seat) this.seat.taken = false;
    this.seat = null; this.ride = null; this.eating = null; this.rig.setHeld(null);
    this.pos.set(x, 0, z); this.yaw = yaw; this.mode = "ground"; this.grounded = true; this.vy = 0;
    this.vel.x = this.vel.z = 0;
  }

  setOutfit(i: number) {
    this.outfit = ((i % OUTFITS.length) + OUTFITS.length) % OUTFITS.length;
    const o = OUTFITS[this.outfit];
    this.rig.setOutfit(o.top, o.shorts);
  }

  nextOutfit() {
    this.outfit = (this.outfit + 1) % OUTFITS.length;
    const o = OUTFITS[this.outfit];
    this.rig.setOutfit(o.top, o.shorts);
    return o.name;
  }

  sit(seat: Seat) {
    this.seat = seat;
    seat.taken = true;
    this.pos.set(seat.x, seat.y, seat.z);
    this.yaw = seat.yaw;
    this.vel.x = this.vel.z = 0;
    this.speed = 0;
  }

  standUp() {
    if (!this.seat) return;
    this.pos.set(this.seat.exitX, 0, this.seat.exitZ);
    this.seat.taken = false;
    this.seat = null;
    this.grounded = true;
  }

  update(dt: number, input: Input, world: World, camYaw: number) {
    const mv = input.move();
    const jump = input.consume("jump") && !this.eating;

    if (this.ride) { this.updateRide(dt, world); return; }
    this.tickEating(dt);

    if (this.seat) {
      if (!this.eating && (mv.mag > 0.3 || jump)) this.standUp();
      else {
        this.rig.update(dt, this.rigState());
        this.sync();
        return;
      }
    }

    const sample = world.waterAt(this.pos.x, this.pos.z);
    const fx = world.effects;

    // Horizontal intent, relative to camera
    const fx_ = -Math.sin(camYaw), fz_ = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const dx = fx_ * mv.y + rx * mv.x, dz = fz_ * mv.y + rz * mv.x;
    const locked = this.eating !== null;
    this.run = input.run && mv.mag > 0.05 && !locked;
    this.wading = !!sample && this.mode === "ground";
    let top: number;
    if (this.mode === "swim") top = this.run ? PLAYER.swimFastSpeed : PLAYER.swimSpeed;
    else top = (this.run ? PLAYER.runSpeed : PLAYER.walkSpeed) * (this.wading ? PLAYER.wadeFactor : 1);
    top *= this.speedScale * (mv.mag > 0.05 && !locked ? Math.max(0.55, mv.mag) : 0);
    const accel = this.mode === "swim" ? 7 : this.grounded ? 28 : 6;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (dx * top - this.vel.x) * k;
    this.vel.z += (dz * top - this.vel.z) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (this.mode === "swim" || this.wading) {
      world.flowAt(this.pos.x, this.pos.z, this.flow);
      const k = this.mode === "swim" ? 1 : 0.6;
      this.pos.x += this.flow.x * k * dt; this.pos.z += this.flow.z * k * dt;
    }
    world.resolve(this.pos, PLAYER.radius);
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    if (this.speed > 0.3) this.yaw += angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, 14 * dt);

    // Vertical: land, water, jump
    const floor = world.groundHeight(this.pos.x, this.pos.z);
    const s2 = world.waterAt(this.pos.x, this.pos.z);
    if (this.mode === "ground") {
      if (jump && this.grounded) { this.vy = PLAYER.jumpSpeed; this.grounded = false; }
      if (this.grounded) {
        const diff = floor - this.pos.y;
        if (diff > 0) this.pos.y = Math.min(floor, this.pos.y + 6 * dt);
        else if (diff < -0.15) { this.grounded = false; this.vy = 0; }
        else this.pos.y += diff * Math.min(1, 25 * dt);
      }
      if (!this.grounded) {
        this.vy -= PLAYER.gravity * dt;
        this.pos.y += this.vy * dt;
        if (s2 && s2.depth > PLAYER.swimDepth && this.pos.y <= s2.surfaceY && this.vy <= 0) {
          fx.splash(this.pos.x, WORLD.waterY, this.pos.z, Math.min(2, 0.6 + -this.vy / 8));
          this.mode = "swim"; this.vy = 0; this.idleSwim = 0;
        } else if (this.pos.y <= floor && this.vy <= 0) {
          if (s2) fx.splash(this.pos.x, WORLD.waterY, this.pos.z, Math.min(1.4, 0.3 + -this.vy / 12));
          this.pos.y = floor; this.grounded = true; this.vy = 0;
        }
      } else if (s2 && s2.depth > PLAYER.swimDepth && this.pos.y <= s2.surfaceY) {
        fx.splash(this.pos.x, WORLD.waterY, this.pos.z, 0.5);
        this.mode = "swim"; this.idleSwim = 0;
      }
    } else {
      if (!s2 || s2.depth < PLAYER.swimDepth - 0.3) {
        this.mode = "ground"; this.grounded = true;
        if (s2 === null) fx.droplets(this.pos.x, 0.2, this.pos.z, 6);
      } else if (jump) {
        this.mode = "ground"; this.grounded = false; this.vy = PLAYER.jumpSpeed * 1.25; // clears the surface so the hop is visible
        fx.splash(this.pos.x, WORLD.waterY, this.pos.z, 0.6);
      } else {
        const bob = Math.sin(world.time * 2.2) * 0.03;
        const target = s2.surfaceY - PLAYER.swimBodyOffset + bob;
        this.pos.y += (target - this.pos.y) * Math.min(1, 7 * dt);
        this.idleSwim = this.speed < 0.3 ? this.idleSwim + dt : 0;
      }
    }

    // Water feedback
    this.fxTimer -= dt;
    if (this.fxTimer <= 0 && this.speed > 0.8) {
      if (this.mode === "swim") { fx.ripple(this.pos.x, this.pos.z, 1.6); this.fxTimer = 0.35; fx.droplets(this.pos.x, WORLD.waterY, this.pos.z, 1); }
      else if (this.wading) { fx.droplets(this.pos.x, Math.max(WORLD.waterY, this.pos.y) + 0.05, this.pos.z, 3); this.fxTimer = 0.22; }
    }

    this.rig.update(dt, this.rigState());
    this.sync();
  }

  private tickEating(dt: number) {
    const e = this.eating;
    if (!e) return;
    const step = Math.min(dt, e.left);
    e.left -= dt;
    e.onTick((e.food.energy / e.food.seconds) * step);
    if (e.left <= 0) { this.eating = null; this.rig.setHeld(null); e.onDone(); }
  }

  private updateRide(dt: number, world: World) {
    const r = this.ride!;
    r.update(dt);
    this.pos.copy(r.pos);
    this.yaw = r.yaw;
    this.speed = r.phase === "climb" ? 2.6 : 0;
    if (r.phase === "slide") {
      this.sprayT -= dt;
      if (this.sprayT <= 0) { world.effects.droplets(this.pos.x, this.pos.y + 0.2, this.pos.z, 3); this.sprayT = 0.07; }
    }
    this.rig.update(dt, { ...this.rigState(), action: r.phase === "climb" ? null : "slide", sitting: false, grounded: true, speed: this.speed });
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.root.rotation.x = r.phase === "slide" ? r.pitch : 0;
    if (r.phase === "done") {
      this.vel.x = r.exitVel.x; this.vel.z = r.exitVel.z;
      this.ride = null; this.grounded = false; this.vy = 0; this.mode = "ground";
      this.rig.root.rotation.x = 0;
      this.onRideEnd();
    }
  }

  private rigState() {
    return {
      action: this.eating ? (this.eating.food.drink ? ("drink" as const) : ("eat" as const)) : null,
      speed: this.speed, run: this.run, mode: this.mode, grounded: this.grounded, vy: this.vy,
      floating: this.floating, sitting: this.isSitting, wading: this.wading,
    };
  }

  private sync() {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.root.rotation.x = 0;
  }
}
