import * as THREE from "three";

/** Smooth third-person orbit camera (drag to rotate). */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
  yaw = 0;
  pitch = 0.42;
  dist = 8;
  private look = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private ready = false;

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    // Keep the character framed in tall (portrait) viewports.
    this.camera.fov = w / h < 0.8 ? 70 : 58;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, target: THREE.Vector3, d: { dx: number; dy: number }) {
    this.yaw -= d.dx * 0.0055;
    this.pitch = Math.min(1.3, Math.max(0.08, this.pitch + d.dy * 0.0045));
    const focus = new THREE.Vector3(target.x, Math.max(target.y, -0.4) + 1.15, target.z);
    const cp = Math.cos(this.pitch);
    const want = new THREE.Vector3(
      focus.x + Math.sin(this.yaw) * cp * this.dist,
      focus.y + Math.sin(this.pitch) * this.dist,
      focus.z + Math.cos(this.yaw) * cp * this.dist,
    );
    want.y = Math.max(want.y, 0.5);
    if (!this.ready) { this.look.copy(focus); this.pos.copy(want); this.ready = true; }
    const k = 1 - Math.exp(-9 * dt);
    this.look.lerp(focus, 1 - Math.exp(-14 * dt));
    this.pos.lerp(want, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  snap() { this.ready = false; }
}
