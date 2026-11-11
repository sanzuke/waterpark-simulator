# Kids Waterpark Simulator — Main Design

## Stack decision
No engine existed in the workspace. The project is a browser game (OhMyGame preview/publish), so Godot is not applicable; the game uses **Three.js + TypeScript + Vite**. Same architecture goals as requested: modular systems, logic separated from rendering.

## Player fantasy
A cheerful kid spends a whole sunny day at a waterpark: buy a ticket, change, swim, slide, eat, rest, explore, leave happy. No fail states.

## Core loop (final)
Ticket -> changing room -> explore -> swim / slides / lazy river / playground -> energy drops -> food court -> recover -> repeat -> exit summary.

## MVP 1.0 scope (current build)
Areas: entrance + ticket booth, changing room, pools (family, children's, relaxing, wave pool), slides (4, all rideable), lazy river, splash bucket, food court.
Features: one character (walk, run, swim, jump, sit, eat/drink, slide); energy; Water Coins + ticket; food purchase + eating animation; simple NPCs; save game; park clock with morning-to-afternoon light; optional stickers (achievements).

### Design principle: free play, not missions
No quests, objectives or timers. The player chooses what to do (e.g. ten minutes in the children's pool, then an ice cream, then a slide). Rules only add gentle texture:
- The ticket gates the park entrance; the gate stays closed until a ticket is bought.
- Energy drains slowly while swimming/running and recovers by resting or eating. Low energy only slows the character slightly and suggests a snack or rest; no fail state.
- Coins are never a dead end: shiny Water Coins (2 or 5) are scattered around the park and respawn after ~100 s.
- "Go Home" at the exit gate shows a friendly summary and starts a new day (new ticket, full energy, coins kept, clock back to 08:00).
- The park day runs 08:00-17:00 at 0.7 game minutes per real second (about 13 real minutes). The clock never ends the session: at 16:30 a gentle "closing soon" tip appears, and at 17:00 it stops with a friendly message. Leaving is always the player's choice.
- Stickers are exploration rewards only: every unlock pays 10-25 bonus Water Coins and appears in the pause screen. They never gate anything.
- The wave pool runs on its own rhythm: 9 s calm, then 12 s of rolling waves. The machine by the deep end starts a set early, and the prompt disappears while waves run. Waves lift the swimming character and shove them gently toward the sandy beach (about 0.7 m/s), so nobody is swept off their feet.
- The game speaks English and Indonesian. The language button on the title and pause screens switches every label, prompt, menu, toast, sticker and the HUD hint; the choice is remembered. English is the source language, so a missing Indonesian line falls back to English instead of breaking.

### Numbers (src/core/economy.ts)
Start 150 coins; ticket 50. Energy 0-100: swim -3/min, float -0.5/min, lazy river -1/min, run -2/min, slide -5, resting +6/min. Tiers: 70+ normal, 40-69 getting tired (95% speed), 20-39 needs rest (88%), 0-19 very tired (78%). Food: burger 20/+25, pizza 25/+30, fries 12/+15, ice cream 10/+10, orange juice 8/+15, water 5/+10 (energy arrives gradually during the eating animation).

### Systems
- Slides: `world/SlideRide.ts` (climb stairs, sit, slide along a curve, release into the splash pool); shared by player and NPCs; riders are spaced by a short cooldown so others queue.
- Lazy river: clockwise current (`World.flowAt`) applied to swimmers and waders, plus drifting rings.
- Splash bucket: fills over ~22 s, tips on its own or when the player pulls it; anyone under the pour gets soaked and nearby kids cheer.
- Shops: DOM menus; shopkeeper plays a working animation, then the player holds the food and eats/drinks.
- NPCs (`npc/Npc.ts`): kids and parents run a small state machine (walk, swim, sit/eat at tables and loungers, queue + ride slides, cheer). Staff (ticket seller, gate officer, 5 shopkeepers, lifeguards) are stationary, with wave/work/scan animations.
- Wave pool (`world/waves.ts`): `WavePool` owns the wave envelope and the surface the player feels (`height`, `push`); the foam crests and floating rings are only its look. `layout.ts` defines the pool body, `World` exposes `surfaceOffset` and adds the push in `flowAt`, `Player` adds the offset to its swim bob, and the wave machine is a normal interactable.
- Languages (`core/i18n.ts`): `t("English text", { slots })` with a flat English->Indonesian dictionary, persisted in localStorage; `data-i18n` attributes cover the static HTML, and `Game.switchLang()` redraws HUD stats, the area banner and the sticker list.
- Clock and light (`core/Clock.ts`): the sun arcs east to west with height and warmth from `dayProgress`; sky and fog colour blend from warm morning through blue midday to golden afternoon. Game rules stay in the clock class; the scene only reads it.
- Stickers (`core/Achievements.ts`): seven optional achievements (first swim, slide explorer, lazy river, happy eater, six areas, back in action, super visitor) checked against stats the game already tracks; unlock order is stored so each pays once.
- Save (`core/Save.ts`, localStorage, versioned): coins, energy, ticket, outfit, position, stats, park minute, unlocked stickers and visited areas; autosaves every 20 s and on purchases, rides, unlocks and pause; "Continue" on the title screen. Older saves without the new fields still load.

## Later (not in MVP)
Ring rental, souvenirs, diving/celebrate emotes, music and ambience, more NPC variety, staff schedules that follow the clock.

## Architecture (src/)
- `core/` Game loop, Input (keyboard, pointer, touch joystick/buttons), config constants, park Clock, Achievements, economy numbers, Save, Sfx.
- `world/` WaterparkWorld (layout, colliders, water zones, ground height), builders (props, buildings, slides, water material), Particles.
- `player/` Player (controller state machine: ground / swim / sit), CharacterRig (procedural animation), CameraRig.
- `interaction/` Interactable registry + nearest-target resolver.
- `ui/` Hud, Minimap, overlays (DOM).
- Game state lives in plain objects; Three.js objects are a rendering adapter.

## Map (metres, +x east, +z south, entrance at south)
Entrance plaza (z 40-62) · Changing rooms west (-40,36) · Wave pool west (-48,17, 20x18) with the machine at its north end · Family pool (0,26) shallow->deep · Kids pool (-28,20) · Water playground (-34,-6) · Relaxing pool (0,-4) · Lazy river ring east (30,-6) · Slide area north (z -30..-45) with 4 landing pools · Food court east (x 42-56, z 14-38) · Exit gate + souvenir shop (40,56).

## Content language
Every player-facing string is English in the source and translated at display time (see `core/i18n.ts`); the 3D sign boards stay English as park signage.

## Controls
WASD/arrows move, Shift run, Space jump, E interact, drag mouse to orbit, Esc pause. Touch: left joystick, Jump, Act, drag right side to look.

## Art direction
Low-poly, saturated tropical palette (aqua #19c3d9, coral #ff6b5e, sun yellow #ffd23f, mint #5fd6a0, deck cream #f3e6c8). Rounded friendly UI font stack, big buttons. Art is built from code-generated low-poly geometry (stylised primitives, extruded/tube slides, canvas-texture signs) — a deliberate choice for performance on mid-range mobile; no generated 3D models were used in Phase 1.

## Asset list
| Asset | Role | Source | Destination |
|---|---|---|---|
| Child character | player | procedural rig | `player/CharacterRig.ts` |
| Pools, deck, buildings, slides, palms, loungers, signs | environment | procedural low-poly | `world/*` |
| Water surface | pools | custom shader | `world/water.ts` |
| Splash / ripple particles | feedback | code particles | `world/Particles.ts` |
