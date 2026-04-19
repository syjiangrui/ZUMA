// levels.js — Per-level configuration for the 8-level game.
// Each level overrides the global defaults from config.js.
// pathType + pathParams are consumed by path.js to generate the track.

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';

export const LEVELS = [
  {
    id: 1,
    name: "石阶祭坛",
    chainCount: 20,
    chainSpeed: 40,
    colorCount: 3,
    pathType: "drawn",
    pathParams: {
      segments: [
        // 1. Top line: right → left
        { type:"line", x1:395, y1:296, x2:145, y2:296 },
        // 2. Top-left corner: turn down, arc bulges LEFT (C opens right)
        { type:"arc", cx:145, cy:366, radius:70, startAngle:-Math.PI/2, endAngle:-Math.PI },
        // 3. Left side: down
        { type:"line", x1:75, y1:366, x2:75, y2:566 },
        // 4. Bottom-left corner: turn right, arc bulges LEFT
        { type:"arc", cx:145, cy:566, radius:70, startAngle:Math.PI, endAngle:Math.PI/2 },
        // 5. Bottom line: left → right (exit)
        { type:"line", x1:145, y1:636, x2:395, y2:636 },
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

// Helper: get level config by id, or null if not found.
export function getLevelById(id) {
  return LEVELS.find(level => level.id === id) || null;
}
