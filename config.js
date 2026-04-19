// Fixed logical resolution. The canvas is CSS-scaled to fit the screen, while
// all gameplay math stays in this coordinate system.
export const GAME_WIDTH = 430;
export const GAME_HEIGHT = 932;

// Ball geometry and default spacing. BALL_SPACING is intentionally slightly
// smaller than diameter so the chain reads as a continuous packed line.
export const BALL_RADIUS = 14;
export const BALL_DIAMETER = BALL_RADIUS * 2;
export const BALL_SPACING = 27;
export const START_CHAIN_COUNT = 30;

// Base movement tuning. CHAIN_SPEED is the normal conveyor speed toward the
// goal. EXIT_GAP lets the whole chain travel a bit past the visible goal before
// the prototype resets.
export const CHAIN_SPEED = 72;
export const CHAIN_ENTRY_SPEED = 340;
export const CHAIN_ENTRY_TAIL_S = -42;
export const CHAIN_ENTRY_START_HEAD_S = -32;
export const EXIT_GAP = 180;

// Projectile tuning for both mouse and touch play.
export const PROJECTILE_SPEED = 820;
export const PROJECTILE_MARGIN = 72;
export const MUZZLE_OFFSET = 68;
export const AIM_GUIDE_LENGTH = 118;

// Transition tuning. INSERT_SETTLE_SPEED controls how quickly an insertion
// "makes room", while GAP_CLOSE_SPEED controls how quickly a broken rear
// segment catches back up after a removal. These are rule-affecting values, not
// just cosmetic easing constants.
export const INSERT_SETTLE_SPEED = 180;
export const GAP_CLOSE_SPEED = 60;
export const SPLIT_CLOSE_SPEED = 84;
export const IMPACT_FADE_SPEED = 7;
export const INSERT_MATCH_DELAY = 0.11;
export const SPLIT_FRONT_PULL_RATIO = 0.5;
export const SPLIT_FRONT_PULL_MAX = 42;
export const SPLIT_FRONT_PULL_MIN_RATIO = 1.0;
export const SPLIT_FRONT_PULL_CURVE = 0.6;
export const SPLIT_FRONT_PULL_SPEED = 96;
export const SPLIT_MERGE_EPSILON = 1.2;
export const MERGE_SETTLE_DURATION = 0.085;
export const MERGE_SETTLE_MIN_SPEED_SCALE = 0.34;
export const TAU = Math.PI * 2;

// Particle system tuning. Particles spawn on ball elimination and fly outward
// with gravity, shrinking and fading over their lifetime.
export const PARTICLE_COUNT_PER_BALL = 6;
export const PARTICLE_LIFETIME = 0.55;
export const PARTICLE_SPEED_MIN = 60;
export const PARTICLE_SPEED_MAX = 220;
export const PARTICLE_GRAVITY = 320;
export const PARTICLE_MAX_TOTAL = 120;
// Every palette is paired with one temple glyph family. Color remains the
// fastest match-read signal, while glyph silhouette is there to support the
// "ancient relic sphere" mood once the player notices the rolling detail.
export const TEMPLE_GLYPH_VARIANTS = ["scarab", "eye", "sun", "mask", "ankh"];

// Programmatic palettes used both for initial chain colors and procedural ball
// textures. The texture generator later combines these into stripes, arcs and
// highlights so the balls read as rolling textured objects instead of flat dots.
export const BALL_PALETTES = [
  {
    base: "#d85d5d",
    bright: "#ffd0be",
    dark: "#702723",
    accent: "#fff4c8",
    stripeDark: "rgba(101, 26, 23, 0.58)",
    stripeLight: "rgba(255, 244, 200, 0.7)",
  },
  {
    base: "#40a56f",
    bright: "#d1ffd0",
    dark: "#114f34",
    accent: "#dffdb9",
    stripeDark: "rgba(6, 54, 31, 0.58)",
    stripeLight: "rgba(214, 255, 205, 0.64)",
  },
  {
    base: "#4f84df",
    bright: "#dceaff",
    dark: "#1f366e",
    accent: "#f1f5c5",
    stripeDark: "rgba(19, 45, 104, 0.56)",
    stripeLight: "rgba(235, 241, 255, 0.62)",
  },
  {
    base: "#e0bb4d",
    bright: "#fff5c9",
    dark: "#80561c",
    accent: "#fff4d3",
    stripeDark: "rgba(119, 76, 10, 0.48)",
    stripeLight: "rgba(255, 249, 212, 0.62)",
  },
  {
    base: "#9a63d3",
    bright: "#f0ddff",
    dark: "#4d2679",
    accent: "#fff6c7",
    stripeDark: "rgba(67, 20, 100, 0.52)",
    stripeLight: "rgba(245, 225, 255, 0.6)",
  },
];
