import { areaAt } from "../world/layout";
import { WORLD, } from "../core/config";
import { ENERGY } from "../core/economy";
import type { World } from "../world/World";
import type { Stats } from "../core/Save";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface MenuItem { id: string; icon: string; name: string; desc: string; price: number }
export interface MenuConfig {
  title: string;
  subtitle: string;
  items: MenuItem[];
  coins: () => number;
  /** Returns a friendly message; `close` ends the menu. */
  choose: (id: string) => { msg: string; close?: boolean };
}

/** DOM HUD: stats, area banner, prompt, toast, minimap, menus and overlays. */
export class Hud {
  private area = $("area");
  private toastEl = $("toast");
  private promptEl = $<HTMLButtonElement>("prompt");
  private promptText = $("prompt-text");
  private act = $<HTMLButtonElement>("btn-act");
  private actText = $("act-text");
  private minimap = $<HTMLCanvasElement>("minimap");
  private mapBase: HTMLCanvasElement;
  private lastArea = "";
  private toastTimer = 0;
  private areaTimer = 0;
  private scale: number;
  private menuCfg: MenuConfig | null = null;
  onPrompt: () => void = () => {};
  onMenuClosed: () => void = () => {};
  onUiSound: () => void = () => {};

  constructor(world: World) {
    this.scale = this.minimap.width / (WORLD.maxX - WORLD.minX);
    this.minimap.height = Math.round((WORLD.maxZ - WORLD.minZ) * this.scale);
    this.mapBase = this.renderBase(world);
    this.promptEl.addEventListener("pointerdown", (e) => { e.preventDefault(); this.onPrompt(); });
    $("btn-menu-close").addEventListener("click", () => this.closeMenu());
  }

  private renderBase(world: World) {
    const cv = document.createElement("canvas");
    cv.width = this.minimap.width; cv.height = this.minimap.height;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#f3e6c8"; g.fillRect(0, 0, cv.width, cv.height);
    for (const s of world.mapShapes) {
      g.fillStyle = s.color;
      g.fillRect(this.mx(s.rect.minX), this.mz(s.rect.minZ), (s.rect.maxX - s.rect.minX) * this.scale, (s.rect.maxZ - s.rect.minZ) * this.scale);
    }
    return cv;
  }
  private mx = (x: number) => (x - WORLD.minX) * this.scale;
  private mz = (z: number) => (z - WORLD.minZ) * this.scale;

  setPrompt(label: string | null) {
    const show = label !== null;
    this.promptEl.hidden = !show;
    this.act.hidden = !show;
    if (show) { this.promptText.textContent = label; this.actText.textContent = label; }
  }
  get prompt() { return this.promptEl.hidden ? null : this.promptText.textContent; }

  toast(text: string, ms = 2800) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("show"), ms);
  }

  setStats(coins: number, energy: number, tierIndex: number) {
    $("coins").textContent = String(coins);
    $("energy-num").textContent = String(Math.round(energy));
    const fill = $("energy-fill");
    fill.style.width = `${Math.max(3, energy)}%`;
    fill.style.background = ["#5fd6a0", "#ffd23f", "#ff9a3d", "#ff6b5e"][tierIndex];
    $("energy-name").textContent = ENERGY.tiers[tierIndex].name;
    $("energy-box").classList.toggle("low", tierIndex >= 2);
    if (this.menuCfg) $("menu-coins").textContent = String(coins);
  }

  bumpCoins() {
    const el = $("coin-box");
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  }

  /** Park clock, only rewritten when the minute changes. */
  setClock(label: string) {
    const el = $("clock-text");
    if (el.textContent !== label) el.textContent = label;
  }

  setStars(found: number, total: number, bump = false) {
    $("stars").textContent = String(found);
    $("stars-total").textContent = ` / ${total}`;
    if (!bump) return;
    const el = $("star-box");
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  }

  /** Pause-screen sticker list: unlocked first, the rest shown faded as a hint. */
  setAchievements(entries: { icon: string; name: string; desc: string; unlocked: boolean }[]) {
    $("ach-list").innerHTML = entries
      .map((e) => `<li class="${e.unlocked ? "" : "locked"}"><span class="icon">${e.icon}</span><div>${e.name}<small>${e.desc}</small></div></li>`)
      .join("");
  }

  showInfo() { $("info").hidden = false; }

  get menuOpen() { return this.menuCfg !== null; }

  openMenu(cfg: MenuConfig) {
    this.menuCfg = cfg;
    $("menu-title").textContent = cfg.title;
    $("menu-sub").textContent = cfg.subtitle;
    $("menu-msg").textContent = "";
    $("menu-coins").textContent = String(cfg.coins());
    const list = $("menu-items");
    list.textContent = "";
    for (const it of cfg.items) {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `<span class="icon">${it.icon}</span><div>${it.name}<small>${it.desc}</small></div>`;
      const btn = document.createElement("button");
      btn.className = "buy"; btn.textContent = `🪙 ${it.price}`;
      btn.addEventListener("click", () => {
        const r = cfg.choose(it.id);
        $("menu-msg").textContent = r.msg;
        $("menu-coins").textContent = String(cfg.coins());
        if (r.close) this.closeMenu();
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
    $("menu").hidden = false;
  }

  closeMenu() {
    if (!this.menuCfg) return;
    this.menuCfg = null;
    $("menu").hidden = true;
    this.onMenuClosed();
  }

  showSummary(s: Stats, minutes: number, onStay: () => void, onHome: () => void) {
    const rows: [string, string][] = [
      ["Swim time", `${minutes} min`], ["Slides", String(s.slides)], ["Snacks", String(s.eaten)],
      ["Coins found", String(s.collected)], ["Coins spent", String(s.spent)],
    ];
    $("summary-list").innerHTML = rows.map(([k, v]) => `<li><b>${k}</b> ${v}</li>`).join("");
    $("btn-stay").onclick = () => { $("summary").hidden = true; onStay(); };
    $("btn-home").onclick = () => { $("summary").hidden = true; onHome(); };
    $("summary").hidden = false;
  }

  update(world: World, x: number, z: number, yaw: number) {
    const name = areaAt(x, z);
    if (name !== this.lastArea) {
      this.lastArea = name;
      this.area.textContent = name;
      this.area.classList.remove("hide");
      clearTimeout(this.areaTimer);
      this.areaTimer = window.setTimeout(() => this.area.classList.add("hide"), 3200);
    }
    const g = this.minimap.getContext("2d")!;
    g.drawImage(this.mapBase, 0, 0);
    g.save();
    g.translate(this.mx(x), this.mz(z));
    g.rotate(-yaw + Math.PI);
    g.fillStyle = "#ff6b5e"; g.strokeStyle = "#fff"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
    void world;
  }
}
