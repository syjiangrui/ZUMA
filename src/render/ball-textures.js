import { BALL_RADIUS, TAU, BALL_PALETTES, TEMPLE_GLYPH_VARIANTS } from '../config.js';
import { makeHorizontalTextureSeamless } from './draw-utils.js';

// Frog body layers, temple glyphs, ball pattern canvases, drawBall,
// rolling band overlay, and all ball/frog cache setup.

// Squat stone-frog body. Green-stone Mayan idol silhouette filled with a
// moss-toned radial gradient and decorated with carved bands + gold trim.
function drawFrogBody(ctx) {
  // Main body silhouette — squat, wide toad shape
  ctx.beginPath();
  ctx.moveTo(0, -24);
  // right shoulder → haunch (wider, rounder curves)
  ctx.bezierCurveTo(30, -26, 54, -10, 56, 10);
  ctx.bezierCurveTo(56, 28, 46, 42, 34, 46);
  // belly bottom (wider)
  ctx.lineTo(-34, 46);
  // left haunch → shoulder
  ctx.bezierCurveTo(-46, 42, -56, 28, -56, 10);
  ctx.bezierCurveTo(-54, -10, -30, -26, 0, -24);
  ctx.closePath();

  const bodyGrad = ctx.createRadialGradient(-8, 6, 6, 0, 10, 58);
  bodyGrad.addColorStop(0, "#6b8a6e");
  bodyGrad.addColorStop(0.5, "#4a6b4e");
  bodyGrad.addColorStop(1, "#2e4430");
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 36, 22, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Head crest — three small triangular ridges on top (Mayan idol feature)
  ctx.fillStyle = "rgba(82, 120, 84, 0.7)";
  for (const ox of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(ox, -24);
    ctx.lineTo(ox - 4, -18);
    ctx.lineTo(ox + 4, -18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(20, 36, 22, 0.3)";
  ctx.lineWidth = 0.8;
  for (const ox of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(ox, -24);
    ctx.lineTo(ox - 4, -18);
    ctx.lineTo(ox + 4, -18);
    ctx.closePath();
    ctx.stroke();
  }

  // Carved horizontal bands across the chest (Mayan decorative lines)
  ctx.strokeStyle = "rgba(16, 30, 18, 0.28)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-36, 14);
  ctx.quadraticCurveTo(0, 19, 36, 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-30, 24);
  ctx.quadraticCurveTo(0, 28, 30, 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-22, 33);
  ctx.quadraticCurveTo(0, 36, 22, 33);
  ctx.stroke();

  // Gold ring at the base (sitting on altar)
  ctx.beginPath();
  ctx.ellipse(0, 46, 36, 7, 0, 0, TAU);
  ctx.strokeStyle = "rgba(200, 170, 50, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Front limbs — stone bumps on each side
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.ellipse(side * 46, 32, 13, 8, side * 0.3, 0, TAU);
    const limbGrad = ctx.createRadialGradient(
      side * 44, 30, 2, side * 46, 32, 13,
    );
    limbGrad.addColorStop(0, "#6a826c");
    limbGrad.addColorStop(1, "#3a5038");
    ctx.fillStyle = limbGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 36, 22, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Lower jaw + mouth cavity — drawn BEHIND the ball in the frog cache.
function drawFrogJawBehind(ctx) {
  const headLen = 48;
  const headW = 34;
  const mouthW = 24;
  const ballDist = 34;

  ctx.beginPath();
  ctx.moveTo(-headW, 4);
  ctx.bezierCurveTo(-headW, -14, -mouthW, -headLen + 10, -mouthW + 3, -headLen + 2);
  ctx.lineTo(mouthW - 3, -headLen + 2);
  ctx.bezierCurveTo(mouthW, -headLen + 10, headW, -14, headW, 4);
  ctx.closePath();

  const jawGrad = ctx.createLinearGradient(0, 4, 0, -headLen);
  jawGrad.addColorStop(0, "#5a7a5c");
  jawGrad.addColorStop(1, "#3a5a3c");
  ctx.fillStyle = jawGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 36, 22, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Mouth cavity (wider to match new mouthW)
  ctx.beginPath();
  ctx.ellipse(0, -ballDist, mouthW - 3, 14, 0, 0, TAU);
  ctx.fillStyle = "#0e1a10";
  ctx.fill();
}

// Upper jaw / snout + nostrils + gold accents — drawn IN FRONT of the ball.
function drawFrogJawFront(ctx) {
  const headLen = 48;
  const headW = 34;
  const mouthW = 24;

  ctx.beginPath();
  ctx.moveTo(-headW + 2, 2);
  ctx.bezierCurveTo(-headW + 2, -10, -mouthW + 1, -headLen + 14, -mouthW + 5, -headLen + 2);
  ctx.quadraticCurveTo(-3, -headLen - 4, 0, -headLen - 2);
  ctx.quadraticCurveTo(3, -headLen - 4, mouthW - 5, -headLen + 2);
  ctx.bezierCurveTo(mouthW - 1, -headLen + 14, headW - 2, -10, headW - 2, 2);
  ctx.closePath();

  const snoutGrad = ctx.createLinearGradient(0, 2, 0, -headLen);
  snoutGrad.addColorStop(0, "#6a8668");
  snoutGrad.addColorStop(0.6, "#4e6e50");
  snoutGrad.addColorStop(1, "#5a7a5c");
  ctx.fillStyle = snoutGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 36, 22, 0.32)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Nostrils
  ctx.fillStyle = "#1a2c1c";
  ctx.beginPath();
  ctx.arc(-9, -headLen + 6, 2.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, -headLen + 6, 2.5, 0, TAU);
  ctx.fill();

  // Gold accent lines along jaw edges
  ctx.strokeStyle = "rgba(210, 178, 50, 0.45)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-headW + 5, 0);
  ctx.quadraticCurveTo(-mouthW + 2, -headLen + 14, -mouthW + 6, -headLen + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headW - 5, 0);
  ctx.quadraticCurveTo(mouthW - 2, -headLen + 14, mouthW - 6, -headLen + 4);
  ctx.stroke();

  // Mayan zigzag pattern along snout bridge
  ctx.strokeStyle = "rgba(200, 170, 50, 0.3)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-12, -headLen + 16);
  for (let i = 0; i < 4; i++) {
    const bx = -8 + i * 5;
    ctx.lineTo(bx, -headLen + (i % 2 === 0 ? 13 : 19));
  }
  ctx.stroke();
}

// Belly socket only (no ball) — baked into the frog cache.
function drawFrogBellySocket(ctx) {
  ctx.beginPath();
  ctx.arc(0, 32, BALL_RADIUS + 3, 0, TAU);
  ctx.fillStyle = "#1a2c1c";
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 170, 50, 0.5)";
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

// Stone dome eyes — the most iconic part of the Zuma frog. Each eye is a
// large raised stone hemisphere with a warm golden iris and round pupil.
// Friendly and calm rather than menacing.
function drawFrogEyes(ctx) {
  const eyeX = 22;
  const eyeY = -20;
  const eyeR = 15;

  for (let side = -1; side <= 1; side += 2) {
    const ex = side * eyeX;

    // Eye dome — green-stone gradient
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeR, 0, TAU);
    const domeGrad = ctx.createRadialGradient(
      ex - 2, eyeY - 3, 2, ex, eyeY, eyeR,
    );
    domeGrad.addColorStop(0, "#7a9a7c");
    domeGrad.addColorStop(0.6, "#4e6e50");
    domeGrad.addColorStop(1, "#344a36");
    ctx.fillStyle = domeGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 36, 22, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Gold iris ring — warm but not harsh
    ctx.beginPath();
    ctx.arc(ex, eyeY, 9, 0, TAU);
    ctx.strokeStyle = "rgba(200, 175, 55, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Warm amber iris fill (softer gradient)
    ctx.beginPath();
    ctx.arc(ex, eyeY, 7.5, 0, TAU);
    const irisGrad = ctx.createRadialGradient(ex, eyeY, 1, ex, eyeY, 7.5);
    irisGrad.addColorStop(0, "#d4b840");
    irisGrad.addColorStop(0.6, "#b89828");
    irisGrad.addColorStop(1, "#8a7420");
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Round pupil (friendly, not reptilian slit)
    ctx.beginPath();
    ctx.arc(ex, eyeY, 3.5, 0, TAU);
    ctx.fillStyle = "#12120a";
    ctx.fill();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(ex - 2, eyeY - 2.5, 2.2, 0, TAU);
    ctx.fillStyle = "rgba(255, 252, 225, 0.40)";
    ctx.fill();
  }
}

// Draw a single glyph family. These marks are intentionally softer than HUD
// icons: on the moving ball they should read like carved ornament lines in
// stone, not like sharp vector logos pasted on the surface.
function drawTempleGlyph(ctx, variant, palette, size, options = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    medallion = true,
  } = options;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const bronzeFill = "rgba(223, 191, 112, 0.28)";
  const bronzeStroke = "rgba(104, 73, 35, 0.54)";
  const paleStroke = "rgba(249, 236, 190, 0.12)";

  if (medallion) {
    // Shared medallion base is useful for HUD-scale rendering, but inside the
    // rolling belt it reads like a flat coin sticker, so callers can disable it.
    ctx.fillStyle = "rgba(43, 31, 17, 0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(224, 191, 112, 0.24)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.stroke();
  }

  if (variant === "scarab") {
    ctx.fillStyle = bronzeFill;
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 16, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(238, 212, 141, 0.2)";
    ctx.beginPath();
    ctx.ellipse(-12, 0, 10, 7, -0.38, 0, TAU);
    ctx.ellipse(12, 0, 10, 7, 0.38, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = bronzeStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 16, 0, 0, TAU);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 14);
    ctx.moveTo(-16, -4);
    ctx.quadraticCurveTo(-8, -14, 0, -10);
    ctx.moveTo(16, -4);
    ctx.quadraticCurveTo(8, -14, 0, -10);
    ctx.stroke();
  } else if (variant === "eye") {
    ctx.strokeStyle = bronzeStroke;
    ctx.lineWidth = 3.3;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.quadraticCurveTo(0, -16, 22, 0);
    ctx.quadraticCurveTo(0, 16, -22, 0);
    ctx.stroke();

    ctx.fillStyle = bronzeFill;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = paleStroke;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.arc(0, 0, 13, -0.9, 0.9);
    ctx.stroke();

    ctx.strokeStyle = bronzeStroke;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.quadraticCurveTo(-12, 18, -20, 19);
    ctx.moveTo(6, 9);
    ctx.quadraticCurveTo(14, 12, 20, 8);
    ctx.stroke();
  } else if (variant === "sun") {
    ctx.fillStyle = bronzeFill;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = bronzeStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = "rgba(240, 214, 133, 0.26)";
    ctx.lineWidth = 2.1;
    for (let i = 0; i < 8; i += 1) {
      const angle = (TAU / 8) * i + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
      ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
      ctx.stroke();
    }
  } else if (variant === "mask") {
    ctx.fillStyle = bronzeFill;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(14, -15, 16, -2);
    ctx.quadraticCurveTo(18, 18, 0, 22);
    ctx.quadraticCurveTo(-18, 18, -16, -2);
    ctx.quadraticCurveTo(-14, -15, 0, -18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = bronzeStroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-2, -1);
    ctx.moveTo(8, -4);
    ctx.lineTo(2, -1);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 10);
    ctx.moveTo(-7, 14);
    ctx.quadraticCurveTo(0, 18, 7, 14);
    ctx.stroke();
  } else if (variant === "ankh") {
    ctx.strokeStyle = bronzeStroke;
    ctx.lineWidth = 3.3;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(-11, -21, -11, -9);
    ctx.quadraticCurveTo(-11, 2, 0, 4);
    ctx.quadraticCurveTo(11, 2, 11, -9);
    ctx.quadraticCurveTo(11, -21, 0, -22);
    ctx.moveTo(0, 4);
    ctx.lineTo(0, 23);
    ctx.moveTo(-13, 12);
    ctx.lineTo(13, 12);
    ctx.stroke();

    ctx.strokeStyle = paleStroke;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.arc(0, -8, 8, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Texture generation (called once at startup)
// ---------------------------------------------------------------------------

// Generate a horizontally tileable source texture for the rolling belt around
// each stone ball. This is the current compromise after several experiments:
// not a tiny center logo, not a fake full-sphere UV, but a broad symbolic
// band that rotates cleanly on mobile screens.
export function createBallPatternCanvas(palette, glyphVariant) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Build the texture as a circumferential band source. The renderer later
  // scrolls the middle belt around the ball. This preserves a wrapped rolling
  // read without bringing back the center-stretch artifact from the earlier
  // pseudo-3D full-sphere projection.
  ctx.fillStyle = "rgba(0, 0, 0, 0)";
  ctx.fillRect(0, 0, size, size);

  const mineral = ctx.createLinearGradient(0, 0, 0, size);
  mineral.addColorStop(0, `${palette.dark}36`);
  mineral.addColorStop(0.24, `${palette.stripeDark.slice(0, -4)}0.18)`);
  mineral.addColorStop(0.5, `${palette.base}14`);
  mineral.addColorStop(0.74, `${palette.stripeLight.slice(0, -4)}0.14)`);
  mineral.addColorStop(1, `${palette.dark}34`);
  ctx.fillStyle = mineral;
  ctx.fillRect(0, 0, size, size);

  // Keep the mineral veining horizontally tile-safe. Any strong diagonal or
  // one-sided gradient makes the seam readable once the band loops around.
  ctx.globalAlpha = 0.18;
  for (let i = -2; i <= 2; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? palette.stripeDark : palette.stripeLight;
    ctx.fillRect(0, size * 0.5 + i * 20 - 4, size, 8);
  }
  ctx.globalAlpha = 1;

  const band = ctx.createLinearGradient(0, size * 0.22, 0, size * 0.78);
  band.addColorStop(0, `${palette.dark}16`);
  band.addColorStop(0.2, `${palette.accent}28`);
  band.addColorStop(0.5, `${palette.stripeLight.slice(0, -4)}0.16)`);
  band.addColorStop(0.8, `${palette.accent}22`);
  band.addColorStop(1, `${palette.dark}16`);
  ctx.fillStyle = band;
  ctx.fillRect(0, size * 0.22, size, size * 0.56);

  ctx.strokeStyle = `${palette.dark}54`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.28);
  ctx.lineTo(size, size * 0.28);
  ctx.moveTo(0, size * 0.72);
  ctx.lineTo(size, size * 0.72);
  ctx.stroke();

  ctx.strokeStyle = `${palette.accent}44`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.39);
  ctx.lineTo(size, size * 0.39);
  ctx.moveTo(0, size * 0.61);
  ctx.lineTo(size, size * 0.61);
  ctx.stroke();

  // Make the glyph span most of the visible front hemisphere. The edge echoes
  // bleed across the seam so the pattern reads as a wrapped symbol belt instead
  // of a small logo sitting on top of the sphere.
  ctx.save();
  ctx.globalAlpha = 0.28;
  drawTempleGlyph(ctx, glyphVariant, palette, size, {
    x: -size * 0.5,
    y: size * 0.5,
    scale: 1.78,
    medallion: false,
  });
  drawTempleGlyph(ctx, glyphVariant, palette, size, {
    x: size * 1.5,
    y: size * 0.5,
    scale: 1.78,
    medallion: false,
  });
  ctx.restore();

  drawTempleGlyph(ctx, glyphVariant, palette, size, {
    x: size * 0.5,
    y: size * 0.5,
    scale: 1.78,
    medallion: false,
  });

  makeHorizontalTextureSeamless(ctx, size, size, 10);

  return canvas;
}

// ---------------------------------------------------------------------------
// Per-ball rendering (hot path)
// ---------------------------------------------------------------------------

// Optimized ball renderer. Static gradient layers (body, matte shade, worn
// bloom, edge strokes) are pre-baked in createBallRenderCache(). Only the
// rolling band texture is drawn live each frame (it depends on rotation).
// This reduces per-ball gradient creation from 5 to 0.
export function drawBall(game, ctx, x, y, radius, paletteIndex, rotation, impact = 0, pathAngle = 0) {
  const pattern = game.ballPatterns[paletteIndex];
  const pad = game.ballCachePad;
  const scale = 1 + impact * 0.08;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Impact aura (only when ball is freshly hit — rare, ok to create live)
  if (impact > 0.02) {
    const aura = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.55);
    aura.addColorStop(0, "rgba(255, 249, 214, 0)");
    aura.addColorStop(0.55, "rgba(255, 241, 187, 0.18)");
    aura.addColorStop(1, "rgba(255, 241, 187, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.55, 0, TAU);
    ctx.fill();
  }

  // Use cached base if this is the standard ball radius, otherwise fall back
  // to a simple solid fill for non-standard sizes (e.g. preview balls).
  const baseImg = radius === BALL_RADIUS ? game.ballBaseCache[paletteIndex] : null;
  if (baseImg) {
    ctx.drawImage(baseImg, -(radius + pad), -(radius + pad));
  } else {
    const palette = BALL_PALETTES[paletteIndex];
    const body = ctx.createRadialGradient(
      -radius * 0.32, -radius * 0.4, radius * 0.28, 0, 0, radius,
    );
    body.addColorStop(0, palette.bright);
    body.addColorStop(0.54, palette.base);
    body.addColorStop(0.84, palette.base);
    body.addColorStop(1, palette.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
  }

  // Rolling belt (must be drawn live — rotation changes every frame).
  // The band texture handles its own elliptical clip internally.
  drawRollingBandTexture(game, ctx, pattern, radius, rotation, pathAngle);

  // Overlay shading (cached for standard radius)
  if (radius === BALL_RADIUS && game.ballOverCache) {
    ctx.drawImage(game.ballOverCache, -(radius + pad), -(radius + pad));
  }

  ctx.restore();
}

// Rolling belt texture + cached band shading overlay.
function drawRollingBandTexture(game, ctx, pattern, radius, rotation, pathAngle) {
  const sourceWidth = pattern.width;
  const sourceHeight = pattern.height;
  const sourceY = sourceHeight * 0.18;
  const sourceH = sourceHeight * 0.64;
  const bandWidth = radius * 2.3;
  const bandHeight = radius * 1.42;
  const offset = (((rotation / TAU) % 1 + 1) % 1) * bandWidth;

  ctx.save();
  // Rotate the band texture to align with the path tangent so the
  // rolling direction follows the track instead of always scrolling
  // horizontally regardless of curve direction.
  if (pathAngle !== 0) {
    ctx.rotate(pathAngle);
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.98, radius * 0.8, 0, 0, TAU);
  ctx.clip();

  for (let dx = -bandWidth - offset; dx < radius * 1.2; dx += bandWidth) {
    ctx.drawImage(
      pattern, 0, sourceY, sourceWidth, sourceH,
      dx, -bandHeight * 0.5, bandWidth, bandHeight,
    );
  }

  // Band edge shading — use cached canvas instead of creating 2 gradients
  if (radius === BALL_RADIUS && game.bandShadeCache) {
    const bs = game.bandShadeCache;
    ctx.drawImage(bs, -bs.width / 2, -bs.height / 2);
  } else {
    // Fallback for non-standard radius
    const topBottomShade = ctx.createLinearGradient(0, -radius * 0.82, 0, radius * 0.82);
    topBottomShade.addColorStop(0, "rgba(27, 18, 12, 0.22)");
    topBottomShade.addColorStop(0.16, "rgba(19, 12, 8, 0)");
    topBottomShade.addColorStop(0.84, "rgba(19, 12, 8, 0)");
    topBottomShade.addColorStop(1, "rgba(27, 18, 12, 0.24)");
    ctx.fillStyle = topBottomShade;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

    const sideShade = ctx.createLinearGradient(-radius, 0, radius, 0);
    sideShade.addColorStop(0, "rgba(34, 22, 14, 0.17)");
    sideShade.addColorStop(0.16, "rgba(26, 15, 9, 0)");
    sideShade.addColorStop(0.84, "rgba(26, 15, 9, 0)");
    sideShade.addColorStop(1, "rgba(34, 22, 14, 0.18)");
    ctx.fillStyle = sideShade;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cache builders (used by createTextures)
// ---------------------------------------------------------------------------

// Pre-render each palette's stone-body gradient, edge stroke, matte shading,
// and worn-bloom highlight to offscreen canvases. At runtime drawBall() just
// does drawImage instead of creating 5 gradients per ball per frame.
// Two layers per palette:
//   ballBaseCache[i]  — body gradient + edge stroke (drawn UNDER the belt)
//   ballOverCache[i]  — matteShade + wornBloom + worn arc (drawn OVER the belt)
// Plus one shared impact-aura cache (palette-independent).
export function createBallRenderCache(game) {
  const r = BALL_RADIUS;
  const pad = 4;          // extra pixels for anti-aliased edges
  const size = (r + pad) * 2;
  const cx = r + pad;

  game.ballBaseCache = [];
  game.ballOverCache = [];
  game.ballCachePad = pad;

  for (let i = 0; i < BALL_PALETTES.length; i++) {
    const palette = BALL_PALETTES[i];

    // --- Base layer: body gradient + edge stroke ---
    const base = document.createElement("canvas");
    base.width = size;
    base.height = size;
    const bCtx = base.getContext("2d");
    bCtx.translate(cx, cx);

    const body = bCtx.createRadialGradient(
      -r * 0.32, -r * 0.4, r * 0.28, 0, 0, r,
    );
    body.addColorStop(0, palette.bright);
    body.addColorStop(0.54, palette.base);
    body.addColorStop(0.84, palette.base);
    body.addColorStop(1, palette.dark);
    bCtx.fillStyle = body;
    bCtx.beginPath();
    bCtx.arc(0, 0, r, 0, TAU);
    bCtx.fill();

    game.ballBaseCache[i] = base;
  }

  // --- Overlay layer: matteShade + edge stroke + wornBloom + worn arc ---
  // These gradients only depend on radius, not palette, so one canvas for all.
  const over = document.createElement("canvas");
  over.width = size;
  over.height = size;
  const oCtx = over.getContext("2d");
  oCtx.translate(cx, cx);

  const matteShade = oCtx.createRadialGradient(
    r * 0.34, r * 0.42, r * 0.12, r * 0.24, r * 0.32, r * 1.08,
  );
  matteShade.addColorStop(0, "rgba(58, 40, 26, 0.01)");
  matteShade.addColorStop(0.5, "rgba(58, 40, 26, 0.05)");
  matteShade.addColorStop(1, "rgba(58, 40, 26, 0.1)");
  oCtx.fillStyle = matteShade;
  oCtx.beginPath();
  oCtx.arc(0, 0, r, 0, TAU);
  oCtx.fill();

  oCtx.strokeStyle = "rgba(122, 96, 68, 0.18)";
  oCtx.lineWidth = 1.15;
  oCtx.beginPath();
  oCtx.arc(0, 0, r - 0.8, 0, TAU);
  oCtx.stroke();

  const wornBloom = oCtx.createRadialGradient(
    -r * 0.34, -r * 0.42, r * 0.02, -r * 0.34, -r * 0.42, r * 0.68,
  );
  wornBloom.addColorStop(0, "rgba(252, 236, 192, 0.3)");
  wornBloom.addColorStop(0.38, "rgba(252, 236, 192, 0.16)");
  wornBloom.addColorStop(1, "rgba(252, 236, 192, 0)");
  oCtx.fillStyle = wornBloom;
  oCtx.beginPath();
  oCtx.arc(0, 0, r, 0, TAU);
  oCtx.fill();

  oCtx.strokeStyle = "rgba(234, 206, 144, 0.16)";
  oCtx.lineWidth = 1.1;
  oCtx.beginPath();
  oCtx.arc(0, 0, r - 1.7, -2.48, -1.12);
  oCtx.stroke();

  game.ballOverCache = over;

  // --- Band shading overlay (topBottom + side fade) ---
  // Only depends on radius, shared across all palettes.
  const bandShade = document.createElement("canvas");
  const bsSize = Math.ceil(r * 2.2);
  bandShade.width = bsSize;
  bandShade.height = bsSize;
  const bsCtx = bandShade.getContext("2d");
  const bsR = bsSize / 2;
  bsCtx.translate(bsR, bsR);

  const topBottomShade = bsCtx.createLinearGradient(0, -r * 0.82, 0, r * 0.82);
  topBottomShade.addColorStop(0, "rgba(27, 18, 12, 0.22)");
  topBottomShade.addColorStop(0.16, "rgba(19, 12, 8, 0)");
  topBottomShade.addColorStop(0.84, "rgba(19, 12, 8, 0)");
  topBottomShade.addColorStop(1, "rgba(27, 18, 12, 0.24)");
  bsCtx.fillStyle = topBottomShade;
  bsCtx.fillRect(-bsR, -bsR, bsSize, bsSize);

  const sideShade = bsCtx.createLinearGradient(-r, 0, r, 0);
  sideShade.addColorStop(0, "rgba(34, 22, 14, 0.17)");
  sideShade.addColorStop(0.16, "rgba(26, 15, 9, 0)");
  sideShade.addColorStop(0.84, "rgba(26, 15, 9, 0)");
  sideShade.addColorStop(1, "rgba(34, 22, 14, 0.18)");
  bsCtx.fillStyle = sideShade;
  bsCtx.fillRect(-bsR, -bsR, bsSize, bsSize);

  game.bandShadeCache = bandShade;
}

// Pre-render the stone frog to two offscreen canvases so drawShooter() only
// needs rotate + drawImage instead of rebuilding ~7 gradients every frame.
// Split into "behind the ball" and "in front of the ball" layers so the

// needs rotate + drawImage instead of rebuilding ~7 gradients every frame.
// Split into "behind the ball" and "in front of the ball" layers so the
// upper jaw still overlaps the held ball at runtime.
export function createFrogCache(game) {
  const size = 170;
  const cx = size / 2;
  const cy = size / 2 + 6; // bias downward so the taller head fits

  // --- Layer 1: body + lower jaw + mouth cavity + belly socket ---
  const behind = document.createElement("canvas");
  behind.width = size;
  behind.height = size;
  const bCtx = behind.getContext("2d");
  bCtx.translate(cx, cy);
  drawFrogBody(bCtx);
  drawFrogJawBehind(bCtx);
  drawFrogBellySocket(bCtx);
  game.frogCacheBehind = behind;
  game.frogCacheCx = cx;
  game.frogCacheCy = cy;

  // --- Layer 2: upper jaw + nostrils + bronze accents + eyes ---
  const front = document.createElement("canvas");
  front.width = size;
  front.height = size;
  const fCtx = front.getContext("2d");
  fCtx.translate(cx, cy);
  drawFrogJawFront(fCtx);
  drawFrogEyes(fCtx);
  game.frogCacheFront = front;
}

// Background, track and goal never change after path creation. Render them
// once to an offscreen canvas and blit every frame instead of rebuilding
