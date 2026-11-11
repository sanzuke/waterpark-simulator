import type { Player } from "../player/Player";
import type { World } from "../world/World";
import type { Hud } from "../ui/Hud";
import type { Effects } from "../world/Effects";
import type { GameState } from "../core/GameState";
import type { SlideDef } from "../world/SlideRide";

export interface GameActions {
  startSlide(def: SlideDef): void;
  openShop(id: string): void;
  openTickets(): void;
  goHome(): void;
  save(): void;
}

export interface GameApi { player: Player; world: World; hud: Hud; effects: Effects; state: GameState; actions: GameActions }

export interface Interactable {
  id: string;
  x: number;
  z: number;
  y?: number; // marker height (default 2)
  radius: number;
  /** Prompt text for the current state, or null when not available. */
  label: (g: GameApi) => string | null;
  run: (g: GameApi) => void;
}

export interface Seat { x: number; y: number; z: number; yaw: number; exitX: number; exitZ: number; taken?: boolean }
