export const PALETTE = {
  aqua: 0x19c3d9,
  coral: 0xff6b5e,
  sun: 0xffd23f,
  mint: 0x5fd6a0,
  deck: 0xf3e6c8,
  grape: 0x8f6bff,
  pink: 0xff8fc7,
  sky: 0xbfe8ff,
  navy: 0x16405c,
  white: 0xffffff,
  wood: 0xb9855a,
  grass: 0x6fcf6a,
} as const;

export const PLAYER = {
  radius: 0.4,
  walkSpeed: 4,
  runSpeed: 7,
  swimSpeed: 2.6,
  swimFastSpeed: 3.8,
  wadeFactor: 0.7,
  jumpSpeed: 6.2,
  gravity: 18,
  swimDepth: 1.1, // water deeper than this makes the player swim
  swimBodyOffset: 0.62, // how far below the surface the root sits while swimming
};

export const WORLD = {
  minX: -60,
  maxX: 60,
  minZ: -50,
  maxZ: 68,
  waterY: -0.22,
};
