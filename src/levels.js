// levels.js — Per-level configuration for the 8-level game.
// Each level overrides the global defaults from config.js.
// pathType + pathParams are consumed by path.js to generate the track.
// If level-paths.json exists (saved by the path editor), bezier levels
// are loaded from there instead of the hardcoded defaults.

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';

// Hardcoded defaults — used when level-paths.json is not available.
const DEFAULT_LEVELS = [
  {
    id: 1,
    name: "石阶祭坛",
    chainCount: 20,
    chainSpeed: 40,
    colorCount: 3,
    pathType: "bezier",
    pathParams: {
      // Each curve = 3 points (p1, cp, p2). No deduplication.
      points: [
        {x:395, y:296}, {x:270, y:296}, {x:145, y:296},  // 曲线1
        {x:145, y:296}, {x:75, y:296},  {x:75, y:366},   // 曲线2
        {x:75, y:366},  {x:75, y:466},  {x:75, y:566},   // 曲线3
        {x:75, y:566},  {x:75, y:636},  {x:145, y:636},  // 曲线4
        {x:145, y:636}, {x:270, y:636}, {x:395, y:636},  // 曲线5
      ],
    },
    shooterPos: { x:215, y:466 },
  },
  {
    id: 2,
    name: "密林回廊",
    chainCount: 23,
    chainSpeed: 43,
    colorCount: 3,
    pathType: "rectangular",
    pathParams: {
      rings: 1,
      outerW: 286,
      outerH: 370,
      shrink: 70,
      cornerRadius: 34,
      topY: 180,
      centerX: GAME_WIDTH * 0.5,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
  {
    id: 3,
    name: "月影偏环",
    chainCount: 27,
    chainSpeed: 47,
    colorCount: 4,
    pathType: "spiral",
    pathParams: {
      centerX: GAME_WIDTH * 0.44,
      centerY: GAME_HEIGHT * 0.42,
      turnCount: 2.0,
      outerRadius: 180,
      innerRadius: 78,
      startAngle: 0.22,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
  {
    id: 4,
    name: "神庙长廊",
    chainCount: 30,
    chainSpeed: 50,
    colorCount: 4,
    pathType: "rectangular",
    pathParams: {
      rings: 2,
      outerW: 286,
      outerH: 400,
      shrink: 70,
      cornerRadius: 34,
      topY: 150,
      centerX: GAME_WIDTH * 0.5,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
  {
    id: 5,
    name: "断月回旋",
    chainCount: 32,
    chainSpeed: 53,
    colorCount: 4,
    pathType: "openArc",
    pathParams: {
      centerX: GAME_WIDTH * 0.5,
      centerY: GAME_HEIGHT * 0.40,
      outerRadiusX: 176,
      outerRadiusY: 200,
      innerRadiusX: 100,
      innerRadiusY: 118,
      startAngle: -0.2 * Math.PI,
      endAngle: 1.22 * Math.PI,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
  {
    id: 6,
    name: "双庭回廊",
    chainCount: 35,
    chainSpeed: 56,
    colorCount: 5,
    pathType: "rectangular",
    pathParams: {
      rings: 2,
      outerW: 312,
      outerH: 440,
      shrink: 70,
      cornerRadius: 34,
      topY: 120,
      centerX: GAME_WIDTH * 0.5,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
  {
    id: 7,
    name: "观星偏廊",
    chainCount: 38,
    chainSpeed: 60,
    colorCount: 5,
    pathType: "rectangular",
    pathParams: {
      rings: 2,
      outerW: 298,
      outerH: 420,
      shrink: 70,
      cornerRadius: 34,
      topY: 132,
      centerX: GAME_WIDTH * 0.44,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
  {
    id: 8,
    name: "黄金祭坛",
    chainCount: 42,
    chainSpeed: 64,
    colorCount: 5,
    pathType: "spiral",
    pathParams: {
      centerX: GAME_WIDTH * 0.52,
      centerY: GAME_HEIGHT * 0.40,
      turnCount: 2.5,
      outerRadius: 186,
      innerRadius: 70,
      startAngle: 0.46,
    },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.82 },
  },
];

// Mutable levels array — starts as a deep copy of defaults,
// then gets overwritten by level-paths.json if it exists.
export const LEVELS = JSON.parse(JSON.stringify(DEFAULT_LEVELS));

// Try to load level-paths.json (saved by the path editor).
// Must be called before the game starts. Returns a Promise.
export async function initLevels() {
  try {
    const resp = await fetch('./level-paths.json');
    if (!resp.ok) return;
    const data = await resp.json();
    // Merge: for each level that has curves in the JSON, convert to bezier
    for (let i = 0; i < Math.min(data.length, LEVELS.length); i++) {
      if (data[i] && data[i].curves && data[i].curves.length > 0) {
        const curves = data[i].curves;
        // Detect curve family: explicit pathType wins; otherwise any segment
        // carrying cp1+cp2 signals cubic Bezier authoring.
        const isCubic =
          data[i].pathType === "cubic" ||
          curves.some(c => c && c.cp1 && c.cp2);
        const points = [];
        if (isCubic) {
          for (const c of curves) {
            // Tolerate mixed legacy {p1, cp, p2} segments by upgrading them
            // via the exact quadratic→cubic formula.
            const cp1 = c.cp1 ?? {
              x: c.p1.x + (2 / 3) * (c.cp.x - c.p1.x),
              y: c.p1.y + (2 / 3) * (c.cp.y - c.p1.y),
            };
            const cp2 = c.cp2 ?? {
              x: c.p2.x + (2 / 3) * (c.cp.x - c.p2.x),
              y: c.p2.y + (2 / 3) * (c.cp.y - c.p2.y),
            };
            points.push({ x: c.p1.x, y: c.p1.y });
            points.push({ x: cp1.x, y: cp1.y });
            points.push({ x: cp2.x, y: cp2.y });
            points.push({ x: c.p2.x, y: c.p2.y });
          }
          LEVELS[i].pathType = "cubic";
        } else {
          // Legacy quadratic: 3 points per curve (p1, cp, p2). path.js sampler
          // handles duplicate adjacent points between segments.
          for (const c of curves) {
            points.push({ x: c.p1.x, y: c.p1.y });
            points.push({ x: c.cp.x, y: c.cp.y });
            points.push({ x: c.p2.x, y: c.p2.y });
          }
          LEVELS[i].pathType = "bezier";
        }
        LEVELS[i].pathParams = { points };
        LEVELS[i].shooterPos = data[i].shooterPos || LEVELS[i].shooterPos;
      }
      // Per-level background artwork (painted by path editor). Optional —
      // legacy levels without this field fall back to the procedural
      // gradient + drawTrack rendering in src/render/scene.js.
      if (data[i] && data[i].background && data[i].background.src) {
        LEVELS[i].background = {
          src: String(data[i].background.src),
          x: Number(data[i].background.x) || 0,
          y: Number(data[i].background.y) || 0,
          scale: Number(data[i].background.scale) || 1,
        };
      }
    }
  } catch (e) {
    // File not found or parse error — use defaults
  }
}

// Helper: get level config by id, or null if not found.
export function getLevelById(id) {
  return LEVELS.find(level => level.id === id) || null;
}
