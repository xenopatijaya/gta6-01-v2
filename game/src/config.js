// Coral Bay — shared tuning constants for the whole game.
// One place holds every number a designer would tweak: city size, speeds,
// wanted rules, mission payouts and colours. Nothing here knows about three.js.
export const CITY = {
  blocks: 7,
  block: 44,
  road: 14,
  pitch: 58,
  half: 203,
  beachZ: 218,
  seaZ: 262,
};

export const PLAYER_TUNING = {
  walkSpeed: 7,
  runSpeed: 11.5,
  accel: 42,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.7,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 2.2,
  punchCooldown: 0.45,
};

export const CAR_TUNING = {
  accel: 16,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  brake: 30,
  drag: 0.6,
  grip: 8,
};

export const WANTED_RULES = {
  maxStars: 5,
  stealCar: 1,
  hitPedestrian: 1,
  shoot: 1,
  killOfficer: 2,
  decaySeconds: 14,
  bustSeconds: 2.5,
};

export const WEAPON = {
  magSize: 12,
  reserveStart: 72,
  damage: 34,
  range: 60,
  fireCooldown: 0.22,
  reloadSeconds: 1.1,
  spread: 0.012,
};

export const MISSIONS = [
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Vera Solano',
    brief: 'Vera needs wheels, fast. Take any car on the street and bring it to her garage.',
    steps: [
      { kind: 'steal', text: 'Take a car (walk up and press E)' },
      { kind: 'goto', at: [174, -174], text: 'Drive the car to Vera\u2019s garage' },
    ],
    reward: 300,
  },
  {
    id: 'sunset-courier',
    title: 'Sunset Courier',
    giver: 'Vera Solano',
    brief: 'A package is waiting at the docks. Pick it up and drop it at the beach bar before the sun sets.',
    steps: [
      { kind: 'goto', at: [174, 174], text: 'Pick up the package at the east docks' },
      { kind: 'goto', at: [-174, 174], timeLimit: 90, text: 'Deliver the package to the beach bar — 90 seconds!' },
    ],
    reward: 500,
  },
  {
    id: 'collect-the-debt',
    title: 'Collect the Debt',
    giver: 'Vera Solano',
    brief: 'Rocco Vale owes Vera $800 and keeps dodging her. Find him at the market and make him pay.',
    steps: [
      { kind: 'goto', at: [0, 58], text: 'Find Rocco Vale at the market square' },
      { kind: 'beat', target: 'rocco', text: 'Teach Rocco a lesson (punch or shoot him until he pays)' },
      { kind: 'goto', at: [174, -174], text: 'Bring the $800 back to Vera\u2019s garage' },
    ],
    reward: 800,
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    giver: 'Vera Solano',
    brief: 'The Coral Bay PD is onto you. Lose the heat and get to the hideout in one piece.',
    steps: [
      { kind: 'heat', stars: 3, text: 'You are wanted! Lose the cops' },
      { kind: 'goto', at: [-58, -58], text: 'Reach the hideout with no wanted stars' },
    ],
    reward: 700,
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    giver: 'Vera Solano',
    brief: 'One last job: a gold sedan sits in the harbor lot under armed guard. Take it, shake the cops, and bring it home.',
    steps: [
      { kind: 'goto', at: [174, 174], text: 'Reach the harbor lot' },
      { kind: 'fight', count: 3, text: 'Deal with the harbor guards' },
      { kind: 'steal', text: 'Take the gold sedan (press E)' },
      { kind: 'goto', at: [174, -174], text: 'Deliver the sedan to Vera\u2019s garage' },
    ],
    reward: 2500,
  },
];

export const PALETTE = {
  sky: 0xffd9a0,
  skyTop: 0x87b5d6,
  fog: 0xf2c98f,
  sun: 0xffe0b0,
  ground: 0xc9b18c,
  sidewalk: 0xd8cdb8,
  asphalt: 0x3a3f46,
  line: 0xf5d76e,
  building: [0xf6e3c8, 0xe8a87c, 0x7fb3a3, 0xd97b6c, 0xf2d492, 0x9fb8c8, 0xe6b8a2, 0xc7d3a1],
  sea: 0x2e8fa3,
  sand: 0xecd9a8,
  palm: 0x3f7d4e,
};

export const CONTROLS_TEXT = [
  'W A S D — move / drive',
  'Mouse — look around (drag)',
  'Shift — sprint',
  'Space — jump / handbrake',
  'E — enter / exit car',
  'Click — shoot pistol',
  'F — punch',
  'R — reload',
  'H — horn',
  'M — mute',
  'P / Esc — pause',
];

export const SAVE_KEY = 'coral-bay-save-v1';
