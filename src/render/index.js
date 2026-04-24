import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, BALL_PALETTES, TEMPLE_GLYPH_VARIANTS } from '../config.js';
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
}

// Fill the bottom gap (when the game is shorter than the viewport) with the
// slab gradient so no black strip appears at the bottom.  When the game
// overflows (cropBottom > 0), there is no gap — the game extends beyond
// the screen.  This only applies to tall phones where the game doesn't fill
// the viewport height.
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

// Fill the entire native-resolution canvas with a solid colour (used for
// fade / dim overlays that must cover the safe-area zones too).
function fillMobileOverlay(ctx, game, fillStyle) {
  const m = game.mobileLayout;
  if (!m) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
  ctx.restore();
}

// Apply the mobile coordinate transform so all subsequent drawing happens in
// the 430×932 game coordinate space.
function applyMobileTransform(game, ctx) {
  const m = game.mobileLayout;
  if (!m) return;
  ctx.setTransform(m.scale * m.dpr, 0, 0, m.scale * m.dpr, 0, 0);
}

export function render(game) {
  const ctx = game.ctx;
  const mobile = game.mobileLayout;

  if (mobile) {
    // 1. Clear the entire native-resolution canvas (identity transform).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);

    // 2. Fill bottom gap with slab gradient (if any).
    fillMobileBottomGap(game, ctx);

    // 3. Switch to the game coordinate transform for all subsequent drawing.
    applyMobileTransform(game, ctx);
  } else {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  if (game.gameState === "levelSelect") {
    drawLevelSelectScreen(game, ctx);
    if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
      const c = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
      if (mobile) {
        fillMobileOverlay(ctx, game, c);
        applyMobileTransform(game, ctx);
      } else {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      }
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

  // Mobile play-area shift: translate the static scene + gameplay layers up
  // so the path's vertical midpoint sits at the centre of the visible play
  // region.  HUD is drawn unshifted below, so it stays pinned to the top.
  const playShift = mobile?.playShift || 0;
  if (playShift > 0) {
    ctx.save();
    ctx.translate(0, -playShift);
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

  if (playShift > 0) {
    ctx.restore();
  }

  // HUD overlay — on mobile, draw a canopy-colored fill behind the notch
  // so the top of the screen (behind the notch) has color instead of black.
  // Then draw the HUD panel background at its natural position (y=0) while
  // shifting only the interactive elements (buttons, preview) down by hudShift.
  //
  // When playShift > 0 (play area is shifted up to centre the path), the top
  // of the shifted play area could otherwise leak into the HUD strip through
  // the transparent regions of the HUD panel (x<16 or x>248).  Covering the
  // full HUD strip height with the canopy gradient prevents that.
  if (mobile && (mobile.hudShift > 0 || (mobile.playShift || 0) > 0)) {
    const fillH = HUD_HEIGHT + (mobile.hudShift || 0);
    const canopyFill = ctx.createLinearGradient(0, 0, 0, fillH);
    canopyFill.addColorStop(0, "#17383e");
    canopyFill.addColorStop(1, "#10272d");
    ctx.fillStyle = canopyFill;
    ctx.fillRect(0, 0, GAME_WIDTH, fillH);
  }
  drawOverlay(game, ctx, mobile?.hudShift || 0);
  drawMatchFeedback(game, ctx);

  if (game.screenShake > 0) {
    ctx.restore();
  }

  // Round-end effects and card are drawn outside the shake transform
  if (game.gameState !== "playing") {
    game.drawRoundEndEffect(ctx);
  }

  // Dim overlay behind round-end cards — must cover safe-area zones on mobile.
  if (game.gameState !== "playing" && game.gameState !== "levelSelect") {
    const dimC = "rgba(6, 10, 12, 0.52)";
    if (mobile) {
      fillMobileOverlay(ctx, game, dimC);
      applyMobileTransform(game, ctx);
    } else {
      ctx.fillStyle = dimC;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  drawRoundStateCard(game, ctx);

  // All-clear overlay replaces the normal end card
  if (game.isAllClear()) {
    drawAllClearScreen(game, ctx);
  }

  // Fade overlay (level transitions) — drawn on top of everything.
  if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
    const c = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
    if (mobile) {
      fillMobileOverlay(ctx, game, c);
      applyMobileTransform(game, ctx);
    } else {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }
}
