import { GAME_WIDTH, GAME_HEIGHT, BALL_PALETTES, TEMPLE_GLYPH_VARIANTS } from '../config.js';
import {
  createBallPatternCanvas,
  createBallRenderCache,
  createFrogCache,
} from './ball-textures.js';
import {
  drawChain,
  drawParticles,
  drawProjectile,
  drawAimGuide,
  drawShooter,
  createStaticSceneCache,
} from './scene.js';

// ---------------------------------------------------------------------------
// Public API — only createTextures(game) and render(game) are consumed by main.
// ---------------------------------------------------------------------------

export function createTextures(game) {
  game.ballPatterns = BALL_PALETTES.map((palette, index) =>
    createBallPatternCanvas(
      palette,
      TEMPLE_GLYPH_VARIANTS[index % TEMPLE_GLYPH_VARIANTS.length],
    ),
  );
  createBallRenderCache(game);
  createFrogCache(game);
}

// Fill the bottom gap (when the game is shorter than the viewport) with the
// slab gradient so no black strip appears at the bottom.
function fillMobileBottomGap(game, ctx) {
  const m = game.mobileLayout;
  if (!m || m.cropBottom > 0) return;

  const gameH = GAME_HEIGHT * m.scale;
  if (gameH >= m.screenHeight) return;

  const cw = game.canvas.width;
  const ch = game.canvas.height;
  const top = Math.floor(gameH * m.dpr);
  const grad = ctx.createLinearGradient(0, top, 0, ch);
  grad.addColorStop(0, '#5b646d');
  grad.addColorStop(1, '#3a4248');
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, cw, ch - top);
}

// Apply the mobile coordinate transform so all subsequent drawing happens in
// the 430×932 game coordinate space.
function applyMobileTransform(game, ctx) {
  const m = game.mobileLayout;
  if (!m) return;
  ctx.setTransform(m.scale * m.dpr, 0, 0, m.scale * m.dpr, 0, 0);
}

// ---------------------------------------------------------------------------
// render() — now only draws the game world: background, track, balls,
// shooter, particles, and round-end visual effects (golden glow / red
// vignette). All UI (HUD, buttons, end cards, match feedback) is handled
// by DOM overlays managed from src/ui/*.js.
// ---------------------------------------------------------------------------

export function render(game) {
  const ctx = game.ctx;
  const mobile = game.mobileLayout;

  if (mobile) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
    fillMobileBottomGap(game, ctx);
    applyMobileTransform(game, ctx);
  } else {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  if (game.gameState === "levelSelect") {
    // Level-select screen is a DOM overlay — nothing to draw on canvas.
    return;
  }

  // Screen shake on defeat
  if (game.screenShake > 0) {
    const intensity = game.screenShake * 14;
    const ox = (Math.random() - 0.5) * intensity;
    const oy = (Math.random() - 0.5) * intensity;
    ctx.save();
    ctx.translate(ox, oy);
  }

  // Static scene (background + track + goal)
  if (!game.staticSceneCache) {
    createStaticSceneCache(game);
  }
  ctx.drawImage(game.staticSceneCache, 0, 0);
  // 绘制球链。drawChain 接受显式的 chain 数组和 totalPathLength，
  // 这样单轨和双轨关卡都可以复用同一函数而无需内部分支。
  // 主路径球链（所有关卡都有）
  drawChain(game, ctx, game.chain, game.totalPathLength);
  // 双轨关卡：绘制第二条路径上的球链（isDualTrack 为 false 时 chain2 为空数组，跳过）
  if (game.isDualTrack) {
    drawChain(game, ctx, game.chain2, game.totalPathLength2);
  }
  drawParticles(game, ctx);
  drawProjectile(game, ctx);
  drawAimGuide(game, ctx);
  drawShooter(game, ctx);

  if (game.screenShake > 0) {
    ctx.restore();
  }

  // Round-end visual effects (golden glow / red vignette) — still canvas-drawn
  // because they are radial gradient animations that are hard to replicate in CSS.
  if (game.gameState !== "playing") {
    game.drawRoundEndEffect(ctx);
  }
}
