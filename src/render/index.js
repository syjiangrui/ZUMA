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
import { drawOverlay, drawMatchFeedback } from './hud.js';
import {
  drawRoundStateCard,
  drawAllClearScreen,
  drawLevelSelectScreen,
} from './screens.js';

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
  // staticSceneCache is lazily created in render() because it depends on
  // path data which may not exist yet (e.g. during levelSelect state).
}

export function render(game) {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (game.gameState === "levelSelect") {
    drawLevelSelectScreen(game, ctx);
    // Fade overlay must be drawn even during level select for transitions
    if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
      ctx.fillStyle = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    return;
  }

  // Screen shake on defeat — offset the entire canvas briefly
  if (game.screenShake > 0) {
    const intensity = game.screenShake * 14;
    const ox = (Math.random() - 0.5) * intensity;
    const oy = (Math.random() - 0.5) * intensity;
    ctx.save();
    ctx.translate(ox, oy);
  }

  // Static scene (background + track + goal) — rebuilt when path changes
  if (!game.staticSceneCache) {
    createStaticSceneCache(game);
  }
  ctx.drawImage(game.staticSceneCache, 0, 0);
  drawChain(game, ctx);
  drawParticles(game, ctx);
  drawProjectile(game, ctx);
  drawAimGuide(game, ctx);
  drawShooter(game, ctx);
  drawOverlay(game, ctx);
  drawMatchFeedback(game, ctx);

  if (game.screenShake > 0) {
    ctx.restore();
  }

  // Round-end effects and card are drawn outside the shake transform
  if (game.gameState !== "playing") {
    game.drawRoundEndEffect(ctx);
  }
  drawRoundStateCard(game, ctx);

  // All-clear overlay replaces the normal end card
  if (game.isAllClear()) {
    drawAllClearScreen(game, ctx);
  }

  // Fade overlay (level transitions) — drawn on top of everything
  if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
    ctx.fillStyle = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
