// levels.js — Per-level configuration for the 8-level game.
// Each level overrides the global defaults from config.js.
// pathType + pathParams are consumed by path.js to generate the track.

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';

export const LEVELS = [
  {
    id: 1,
    name: "石阶祭坛",
    chainCount: 20,
    chainSpeed: 52,
    colorCount: 3,
    pathType: "spiral",
    pathParams: { turnCount: 2.2, outerRadius: 190, innerRadius: 84, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 2,
    name: "密林通道",
    chainCount: 24,
    chainSpeed: 58,
    colorCount: 3,
    pathType: "spiral",
    pathParams: { turnCount: 2.4, outerRadius: 196, innerRadius: 80, startAngle: 1.2 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 3,
    name: "月牙河谷",
    chainCount: 28,
    chainSpeed: 64,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.5, outerRadius: 200, innerRadius: 78, startAngle: 0.7 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 4,
    name: "祭司回廊",
    chainCount: 30,
    chainSpeed: 68,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.6, outerRadius: 204, innerRadius: 82, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 5,
    name: "羽蛇阶梯",
    chainCount: 32,
    chainSpeed: 72,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.7, outerRadius: 206, innerRadius: 80, startAngle: 1.1 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 6,
    name: "太阳神殿",
    chainCount: 35,
    chainSpeed: 76,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 2.8, outerRadius: 208, innerRadius: 78, startAngle: 0.8 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 7,
    name: "星象迷宫",
    chainCount: 38,
    chainSpeed: 80,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 3.0, outerRadius: 210, innerRadius: 76, startAngle: 0.6 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 8,
    name: "黄金祭坛",
    chainCount: 42,
    chainSpeed: 86,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 3.2, outerRadius: 212, innerRadius: 74, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
];

// Helper: get level config by id, or null if not found.
export function getLevelById(id) {
  return LEVELS.find(level => level.id === id) || null;
}
