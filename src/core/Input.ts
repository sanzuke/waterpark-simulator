/** Keyboard, mouse drag, and touch (joystick + buttons) mapped to one intent object. */
export class Input {
  private keys = new Set<string>();
  private edge = { jump: false, interact: false, pause: false };
  private joy = { x: 0, y: 0 };
  private joyPointer = -1;
  look = { dx: 0, dy: 0 };
  touch = false;
  private dragId = -1;
  private lastX = 0;
  private lastY = 0;

  constructor(canvas: HTMLElement, private ui: { joy: HTMLElement; knob: HTMLElement; jump: HTMLElement; act: HTMLElement }) {
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "Space") this.edge.jump = true;
      if (e.code === "KeyE" || e.code === "Enter") this.edge.interact = true;
      if (e.code === "Escape" || e.code === "KeyP") this.edge.pause = true;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("pointerdown", (e) => {
      if (this.dragId !== -1) return;
      this.dragId = e.pointerId; this.lastX = e.clientX; this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      if (e.pointerType === "touch") this.touch = true;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.dragId) return;
      this.look.dx += e.clientX - this.lastX; this.look.dy += e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.dragId) this.dragId = -1; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    const { joy, knob, jump, act } = ui;
    const setJoy = (e: PointerEvent) => {
      const r = joy.getBoundingClientRect();
      const R = r.width / 2;
      let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.joy.x = dx / R; this.joy.y = -dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    joy.addEventListener("pointerdown", (e) => { this.joyPointer = e.pointerId; joy.setPointerCapture(e.pointerId); this.touch = true; setJoy(e); });
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === this.joyPointer) setJoy(e); });
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = -1; this.joy.x = this.joy.y = 0; knob.style.transform = "translate(0,0)";
    };
    joy.addEventListener("pointerup", joyEnd);
    joy.addEventListener("pointercancel", joyEnd);
    jump.addEventListener("pointerdown", (e) => { e.preventDefault(); this.edge.jump = true; this.touch = true; });
    act.addEventListener("pointerdown", (e) => { e.preventDefault(); this.edge.interact = true; this.touch = true; });
    void ui;
  }

  /** x = right, y = forward, magnitude <= 1 */
  move() {
    let x = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    let y = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    x += this.joy.x; y += this.joy.y;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, mag: Math.min(1, m) };
  }

  get run() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || Math.hypot(this.joy.x, this.joy.y) > 0.85;
  }

  consume(k: "jump" | "interact" | "pause") {
    const v = this.edge[k]; this.edge[k] = false; return v;
  }

  takeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = this.look.dy = 0;
    return l;
  }

  clear() { this.keys.clear(); this.edge = { jump: false, interact: false, pause: false }; this.joy.x = this.joy.y = 0; }
}
