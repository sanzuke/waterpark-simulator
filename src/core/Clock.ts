/** The park day: opens at 08:00, closes at 17:00, game time runs faster than real time. */
export const PARK = {
  open: 8 * 60,
  close: 17 * 60,
  /** Game minutes per real second (0.7 ≈ a 13 minute day). */
  minutesPerSecond: 0.7,
  closingSoon: 16 * 60 + 30,
};

export type Phase = "morning" | "midday" | "afternoon";

/** Park clock. Rules only: the scene reads `dayProgress` to light itself. */
export class Clock {
  minutes = PARK.open;
  /** Fires once when the park is about to close, and once when it closes. */
  onClosingSoon: () => void = () => {};
  onClosed: () => void = () => {};
  private soon = false;
  private closed = false;

  update(dt: number) {
    if (this.minutes >= PARK.close) return;
    this.minutes = Math.min(PARK.close, this.minutes + dt * PARK.minutesPerSecond);
    if (!this.soon && this.minutes >= PARK.closingSoon) {
      this.soon = true;
      this.onClosingSoon();
    }
    if (!this.closed && this.minutes >= PARK.close) {
      this.closed = true;
      this.onClosed();
    }
  }

  /** 0 at opening, 1 at closing. */
  get dayProgress() {
    return (this.minutes - PARK.open) / (PARK.close - PARK.open);
  }

  get phase(): Phase {
    if (this.minutes < 11 * 60) return "morning";
    if (this.minutes < 15 * 60) return "midday";
    return "afternoon";
  }

  get label() {
    const m = Math.round(this.minutes);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  get isClosed() {
    return this.minutes >= PARK.close;
  }

  reset() {
    this.minutes = PARK.open;
    this.soon = false;
    this.closed = false;
  }

  load(minutes: number | undefined) {
    this.minutes = Number.isFinite(minutes) ? Math.min(PARK.close, Math.max(PARK.open, minutes!)) : PARK.open;
    this.soon = this.minutes >= PARK.closingSoon;
    this.closed = this.minutes >= PARK.close;
  }
}
