import * as THREE from "three";
import { WORLD } from "./config";
import { Input } from "./Input";
import { World } from "../world/World";
import { Player, OUTFITS } from "../player/Player";
import { CameraRig } from "../player/CameraRig";
import { Interaction } from "../interaction/Interaction";
import { Hud } from "../ui/Hud";
import { SPAWN, areaAt } from "../world/layout";
import { SlideRide, type SlideDef } from "../world/SlideRide";
import { Pickups } from "../world/Pickups";
import { NpcManager } from "../npc/Npc";
import { GameState } from "./GameState";
import { ENERGY, FOODS, SHOPS, TICKET_PRICE, type FoodId } from "./economy";
import { clearSave, loadSave, newStats, writeSave } from "./Save";
import { Sfx } from "./Sfx";
import { Clock, PARK } from "./Clock";
import { ACHIEVEMENTS, Achievements } from "./Achievements";
import type { GameActions, GameApi } from "../interaction/types";

type State = "start" | "play" | "pause" | "info" | "menu" | "summary";
const $ = (id: string) => document.getElementById(id)!;
const GATE_Z = 56;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private world = new World();
  private player = new Player();
  private data = new GameState();
  private cam = new CameraRig();
  private input: Input;
  private hud: Hud;
  private interaction: Interaction;
  private pickups: Pickups;
  private npcs: NpcManager;
  private api: GameApi;
  private sun = new THREE.DirectionalLight(0xfff2d6, 2.1);
  private state: State = "start";
  private last = performance.now();
  private saveTimer = 0;
  private chewT = 0;
  private gateHintT = 0;
  private welcomed = false;
  private serve: { t: number; food: FoodId } | null = null;
  private clock = new Clock();
  private ach = new Achievements();
  /** Energy dipped into the tired tiers at some point today. */
  private rested = false;
  private sunWarm = new THREE.Color(0xffcf9e);
  private sunNoon = new THREE.Color(0xfff6e6);
  private skyWarm = new THREE.Color(0xffe2c2);
  private skyNoon = new THREE.Color(0xbfe8ff);
  private tint = new THREE.Color();

  constructor(private canvas: HTMLCanvasElement) {
    const coarse = matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const scene = this.world.scene;
    const sh = this.sun.shadow;
    sh.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    Object.assign(sh.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    sh.bias = -0.0005; sh.normalBias = 0.04;
    this.sun.castShadow = true;
    scene.add(this.sun, this.sun.target);
    scene.add(this.player.rig.root);

    this.input = new Input(canvas, { joy: $("joy"), knob: $("knob"), jump: $("btn-jump"), act: $("btn-act") });
    this.hud = new Hud(this.world);
    this.pickups = new Pickups(this.world, scene);
    this.npcs = new NpcManager(this.world, scene);
    const actions: GameActions = {
      startSlide: (d) => this.startSlide(d),
      openShop: (id) => this.openShop(id),
      openTickets: () => this.openTickets(),
      goHome: () => this.goHome(),
      save: () => this.save(),
    };
    this.api = { player: this.player, world: this.world, hud: this.hud, effects: this.world.effects, state: this.data, actions };
    this.interaction = new Interaction(this.world.interactables, scene);
    this.hud.onPrompt = () => this.interact();
    this.hud.onMenuClosed = () => { if (this.state === "menu") this.setState("play"); };

    this.data.onChange = () => this.refreshStats();
    this.data.onTier = (tip) => this.hud.toast(tip, 5000);
    this.clock.onClosingSoon = () => this.hud.toast("The park closes at 17:00. Still time for one more splash!", 5000);
    this.clock.onClosed = () => this.hud.toast("What a fun day! Visit the exit gate whenever you like.", 6000);
    this.ach.onUnlock = (a) => {
      this.data.earn(a.reward);
      this.hud.toast(`⭐ ${a.name}! You earned ${a.reward} Water Coins.`, 4500);
      this.hud.setStars(this.ach.unlocked.size, ACHIEVEMENTS.length, true);
      Sfx.coin();
      this.save();
    };
    this.world.onBucketTip = () => Sfx.bucket();
    this.world.onBucketHit = (x, z) => {
      this.npcs.react(x, z);
      const p = this.player.pos;
      if (!this.player.isRiding && Math.hypot(p.x - x, p.z - z) < 3.2) {
        this.world.effects.splash(p.x, Math.max(p.y, 0) + 0.8, p.z, 1.5);
        this.hud.toast("SPLASH! You got soaked!");
        Sfx.splash(1.5);
      }
    };
    this.player.onRideEnd = () => { setTimeout(() => Sfx.splash(1.4), 350); this.save(); };

    const unlock = () => Sfx.unlock();
    addEventListener("pointerdown", unlock, { once: false });
    addEventListener("keydown", unlock, { once: false });
    $("btn-start").addEventListener("click", () => this.begin(false));
    $("btn-continue").addEventListener("click", () => this.begin(true));
    $("btn-resume").addEventListener("click", () => this.setState("play"));
    $("btn-pause").addEventListener("click", () => this.setState("pause"));
    $("btn-info-close").addEventListener("click", () => this.setState("play"));
    new MutationObserver(() => { if (!$("info").hidden && this.state === "play") this.state = "info"; }).observe($("info"), { attributes: true });
    addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.save(); if (this.state === "play") this.setState("pause"); } });
    addEventListener("pagehide", () => this.save());

    if (loadSave()) $("btn-continue").hidden = false;
    if (coarse) document.body.classList.add("touch");
    this.resetWorldState();
    this.resize();
    this.exposeTestBridge();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ---- lifecycle -------------------------------------------------------

  private resetWorldState() {
    this.player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
    this.player.setOutfit(0);
    this.cam.yaw = 0;
    this.cam.snap();
    this.world.setGateOpen(false);
    this.welcomed = false;
    this.refreshStats();
  }

  private begin(continueGame: boolean) {
    Sfx.unlock();
    this.data = Object.assign(new GameState(), { onChange: () => this.refreshStats(), onTier: (t: string) => this.hud.toast(t, 5000) });
    this.api.state = this.data;
    const saved = continueGame ? loadSave() : null;
    if (!continueGame) clearSave();
    this.resetWorldState();
    this.clock.reset();
    this.ach.reset();
    this.rested = false;
    if (saved) {
      this.data.load(saved);
      this.clock.load(saved.minutes);
      this.ach.load(saved.unlocked, saved.visited);
      this.player.setOutfit(saved.outfit);
      let x = saved.x, z = saved.z;
      if (!saved.ticket && z < GATE_Z + 1) { x = SPAWN.x; z = SPAWN.z; }
      this.player.teleport(x, z, saved.yaw);
      const p = { x, z }; this.world.resolve(p, 0.4); this.player.pos.x = p.x; this.player.pos.z = p.z;
      this.world.setGateOpen(saved.ticket);
      this.welcomed = saved.ticket && z < GATE_Z;
      this.cam.yaw = saved.yaw + Math.PI;
      this.cam.snap();
    }
    this.refreshStats();
    this.refreshProgress();
    this.setState("play");
    this.hud.toast(saved ? "Welcome back!" : "Buy a ticket at the booth to enter the park!", 4000);
  }

  private refreshStats() { this.hud.setStats(this.data.coins, this.data.energy, this.data.tierIndex); }

  /** Clock, stickers and the pause-screen list. */
  private refreshProgress() {
    this.hud.setClock(this.clock.label);
    this.hud.setStars(this.ach.unlocked.size, ACHIEVEMENTS.length);
    this.hud.setAchievements(ACHIEVEMENTS.map((a) => ({ icon: a.icon, name: a.name, desc: a.desc, unlocked: this.ach.unlocked.has(a.id) })));
  }

  save() {
    if (this.state === "start" || this.player.busy) return;
    const p = this.player.pos;
    writeSave({
      v: 1, coins: this.data.coins, energy: this.data.energy, ticket: this.data.ticket,
      outfit: this.player.outfit, x: p.x, z: p.z, yaw: this.player.yaw, stats: this.data.stats,
      minutes: this.clock.minutes, unlocked: [...this.ach.unlocked], visited: [...this.ach.visited],
    });
  }

  private setState(s: State) {
    this.state = s;
    $("start").hidden = s !== "start";
    $("pause").hidden = s !== "pause";
    $("info").hidden = s !== "info";
    $("menu").hidden = s !== "menu";
    $("summary").hidden = s !== "summary";
    this.input.clear();
    this.last = performance.now();
    if (s === "pause") { this.refreshProgress(); this.save(); }
  }

  // ---- gameplay actions ------------------------------------------------

  private interact() {
    if (this.state !== "play") return;
    if (this.player.isSitting && !this.player.isEating) { this.player.standUp(); return; }
    this.interaction.trigger(this.api);
  }

  private startSlide(def: SlideDef) {
    if (this.player.busy) return;
    this.player.startRide(new SlideRide(def));
    this.data.addEnergy(-ENERGY.slideCost);
    this.data.stats.slides++;
    Sfx.whoosh();
  }

  private openTickets() {
    this.setState("menu");
    this.hud.openMenu({
      title: "Ticket Booth", subtitle: "One ticket lets you play all day!", coins: () => this.data.coins,
      items: [{ id: "ticket", icon: "🎟️", name: "Day Ticket", desc: "Pools, slides and the whole park", price: TICKET_PRICE }],
      choose: () => {
        if (this.data.ticket) return { msg: "You already have a ticket. Off you go!" };
        if (!this.data.spend(TICKET_PRICE)) {
          Sfx.no();
          return { msg: `You need ${TICKET_PRICE - this.data.coins} more Water Coins. Shiny coins are hiding around the park!` };
        }
        this.data.ticket = true;
        this.world.setGateOpen(true);
        this.world.staffById("seller")!.wave = 2;
        Sfx.buy();
        this.hud.toast("Ticket ready! Walk through the gate.");
        this.save();
        return { msg: "", close: true };
      },
    });
  }

  private openShop(id: string) {
    const shop = SHOPS.find((s) => s.id === id)!;
    this.setState("menu");
    this.hud.openMenu({
      title: shop.name, subtitle: "What would you like?", coins: () => this.data.coins,
      items: shop.menu.map((f) => ({ id: f, icon: FOODS[f].icon, name: FOODS[f].name, desc: `${FOODS[f].desc} · +${FOODS[f].energy} ⚡`, price: FOODS[f].price })),
      choose: (fid) => {
        const food = FOODS[fid as FoodId];
        if (this.player.isEating || this.serve) return { msg: "Finish your snack first!" };
        if (this.data.energy >= ENERGY.max - 0.5 && food.energy > 0) { /* still allowed: treats are fun */ }
        if (!this.data.spend(food.price)) {
          Sfx.no();
          return { msg: `Oh! You need ${food.price - this.data.coins} more Water Coins for the ${food.name}. Look for shiny coins!` };
        }
        Sfx.buy();
        this.data.stats.bought++;
        this.serve = { t: 1.4, food: food.id };
        const keeper = this.world.staffById(id);
        if (keeper) keeper.work = 1.4;
        this.hud.toast(`Preparing your ${food.name}...`);
        this.save();
        return { msg: "", close: true };
      },
    });
  }

  private goHome() {
    const s = this.data.stats;
    this.setState("summary");
    this.hud.showSummary(s, Math.round(s.swimSeconds / 60), () => this.setState("play"), () => {
      this.clock.reset();
      this.rested = false;
      this.data.ticket = false;
      this.data.energy = ENERGY.max;
      this.data.stats = newStats();
      this.player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
      this.world.setGateOpen(false);
      this.welcomed = false;
      this.cam.yaw = 0; this.cam.snap();
      this.refreshStats();
      this.refreshProgress();
      this.setState("play");
      this.save();
      this.hud.toast("See you next time! Buy a new ticket to come back.", 4000);
    });
  }

  // ---- per-frame systems -----------------------------------------------

  private energySystem(dt: number) {
    const p = this.player;
    let perMin = 0;
    if (p.isSitting && !p.isEating) perMin = ENERGY.restPerMin;
    else if (p.mode === "swim") {
      const lazy = this.world.bodyAt(p.pos.x, p.pos.z)?.id === "lazy";
      perMin = -(p.floating ? ENERGY.floatPerMin : lazy ? ENERGY.lazyPerMin : ENERGY.swimPerMin);
      this.data.stats.swimSeconds += dt;
      if (lazy) this.data.stats.lazySeconds += dt;
    } else if (p.grounded && p.speed > 5.2) perMin = -ENERGY.runPerMin;
    if (perMin) this.data.addEnergy((perMin * dt) / 60);
    p.speedScale = this.data.speedScale;
  }

  private serveSystem(dt: number) {
    if (!this.serve || this.player.busy) return;
    this.serve.t -= dt;
    if (this.serve.t > 0) return;
    const food = FOODS[this.serve.food];
    this.serve = null;
    this.hud.toast("Here you go! Enjoy!");
    this.player.eat(food, (d) => this.data.addEnergy(d), () => {
      this.data.stats.eaten++;
      this.hud.toast(food.drink ? "Ahh, so refreshing!" : "Yum! That was tasty!");
      this.save();
    });
  }

  /** Advance the simulation one step. */
  private tick(dt: number) {
    const look = this.input.takeLook();
    if (this.input.consume("pause")) {
      if (this.state === "play") this.setState("pause");
      else if (this.state === "menu") this.hud.closeMenu();
      else if (this.state === "pause" || this.state === "info") this.setState("play");
    }
    const playing = this.state === "play";
    if (playing) {
      if (this.input.consume("interact")) this.interact();
      this.player.update(dt, this.input, this.world, this.cam.yaw);
      this.clock.update(dt);
      this.hud.setClock(this.clock.label);
      this.energySystem(dt);
      this.progressSystem();
      this.serveSystem(dt);
      this.gateSystem(dt);
      const p = this.player.pos;
      this.pickups.update(dt, this.world.time, p.x, p.y, p.z, (v, x, y, z) => {
        this.data.earn(v); this.data.stats.collected += v;
        this.hud.bumpCoins(); Sfx.coin();
        this.world.effects.droplets(x, y, z, 8);
        this.hud.toast(`+${v} Water Coins!`, 1200);
      }, this.data.ticket);
      this.chewT -= dt;
      if (this.player.isEating && this.chewT <= 0) { this.chewT = 0.5; if (FOODS.water && this.api.player.isEating) Sfx.crunch(); }
      this.saveTimer += dt;
      if (this.saveTimer > 20) { this.saveTimer = 0; this.save(); }
    } else { this.input.consume("jump"); this.input.consume("interact"); }
    this.world.update(dt, { x: this.player.pos.x, z: this.player.pos.z, speed: this.player.speed, swimming: this.player.isSwimming });
    this.npcs.update(dt);
    this.cam.update(dt, this.player.pos, playing ? look : { dx: 0, dy: 0 });
    this.interaction.update(this.api, this.world.time);
    if (this.player.isSitting && !this.player.isEating && playing) this.hud.setPrompt("Stand Up");
    if (!playing) this.hud.setPrompt(null);

    const p = this.player.pos;
    this.updateSun(p);
    this.hud.update(this.world, p.x, p.z, this.player.yaw);
    if (this.input.touch) document.body.classList.add("touch");
  }

  /** Optional stickers: they only reward exploring, never gate the park. */
  private progressSystem() {
    this.ach.visit(areaAt(this.player.pos.x, this.player.pos.z));
    if (this.data.tierIndex >= 2) this.rested = true;
    this.ach.update({
      swimSeconds: this.data.stats.swimSeconds,
      lazySeconds: this.data.stats.lazySeconds,
      slides: this.data.stats.slides,
      eaten: this.data.stats.eaten,
      visited: this.ach.visited,
      rested: this.rested,
      energy: this.data.energy,
    });
  }

  /** Morning to afternoon light: warm, bright at midday, golden before closing. */
  private updateSun(p: THREE.Vector3) {
    const t = this.clock.dayProgress;
    const rise = Math.sin(Math.PI * t);
    this.sun.position.set(p.x + Math.cos(Math.PI * t) * 60, 18 + 46 * rise, p.z + 26);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.intensity = 1.45 + 0.75 * rise;
    // 1 at opening and closing, 0 at midday: the light warms at both ends.
    const half = t < 0.5 ? (0.5 - t) * 2 : (t - 0.5) * 2;
    this.sun.color.copy(this.sunNoon).lerp(this.sunWarm, half * 0.75);
    this.tint.copy(this.skyNoon).lerp(this.skyWarm, half * 0.8);
    (this.world.scene.background as THREE.Color).copy(this.tint);
    if (this.world.scene.fog) this.world.scene.fog.color.copy(this.tint);
  }

  private gateSystem(dt: number) {
    const p = this.player.pos;
    this.gateHintT -= dt;
    if (!this.data.ticket && p.z > GATE_Z && p.z < GATE_Z + 3 && Math.abs(p.x) < 5 && this.gateHintT <= 0) {
      this.gateHintT = 7;
      this.hud.toast("The gate needs a ticket first. Visit the ticket booth!");
    }
    if (this.data.ticket && !this.welcomed && p.z < GATE_Z - 1) {
      this.welcomed = true;
      this.world.staffById("officer")!.wave = 2.5;
      this.hud.toast("Welcome to the waterpark! Go wherever you like.", 4000);
    }
  }

  private resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.resize(w, h);
    this.world.effects.setViewportScale(h * this.renderer.getPixelRatio());
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tick(dt);
    this.renderer.render(this.world.scene, this.cam.camera);
    requestAnimationFrame(this.frame);
  }

  private exposeTestBridge() {
    const g = this;
    (globalThis as Record<string, unknown>).__OHMYGAME_PLAYTEST__ = {
      snapshot: () => ({
        state: g.state, mode: g.player.mode, sitting: g.player.isSitting, floating: g.player.floating,
        eating: g.player.isEating, riding: g.player.isRiding, grounded: g.player.grounded,
        pos: g.player.pos.toArray().map((n) => +n.toFixed(2)), speed: +g.player.speed.toFixed(2),
        prompt: g.hud.prompt, interactable: g.interaction.current?.id ?? null, outfit: g.player.outfit,
        coins: g.data.coins, energy: +g.data.energy.toFixed(1), tier: g.data.tier.name, ticket: g.data.ticket,
        stats: g.data.stats, bucket: +g.world.bucket.fill.toFixed(2), bounds: WORLD,
        clock: g.clock.label, minutes: +g.clock.minutes.toFixed(1), phase: g.clock.phase,
        unlocked: [...g.ach.unlocked], visited: [...g.ach.visited], stars: g.ach.unlocked.size,
        npcs: g.npcs.npcs.map((n) => n.state),
      }),
      reset: () => { g.begin(false); },
      step: (ms: number) => { for (let t = 0; t < ms; t += 16) g.tick(0.016); g.renderer.render(g.world.scene, g.cam.camera); },
      teleport: (x: number, z: number) => { g.player.teleport(x, z); g.cam.snap(); },
      start: () => g.begin(false),
      give: (n: number) => g.data.earn(n),
      setEnergy: (n: number) => g.data.addEnergy(n - g.data.energy),
      clickMenu: (i: number) => (document.querySelectorAll("#menu-items .buy")[i] as HTMLElement | undefined)?.click(),
      look: (yaw: number, pitch = 0.3) => { g.cam.yaw = yaw; g.cam.pitch = pitch; g.cam.snap(); },
      outfits: OUTFITS.length,
      setClock: (minutes: number) => { g.clock.load(minutes); g.hud.setClock(g.clock.label); },
    };
  }
}
