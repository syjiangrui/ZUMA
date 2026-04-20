import {
  GAME_WIDTH, GAME_HEIGHT, BALL_RADIUS, HUD_HEIGHT, BOTTOM_BUTTON_HEIGHT,
  AIM_GUIDE_LENGTH, TAU, BALL_PALETTES, TEMPLE_GLYPH_VARIANTS,
} from './config.js';

// ---------------------------------------------------------------------------
// Pure canvas helpers — NO game param, only ctx and other relevant params
// ---------------------------------------------------------------------------

// Path-only rounded rect for clip/stroke sites. Using fillRoundedRect() when
// only geometry is needed can silently pre-fill cached HUD panels with the
// default black fill before clip() runs.
function traceRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius) {
  traceRoundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

function drawStonePanel(ctx, x, y, width, height, radius, options = {}) {
  const {
    top = "#7a8590",
    bottom = "#636e78",
    stroke = "rgba(94, 72, 43, 0.88)",
    innerStroke = "rgba(247, 227, 181, 0.16)",
    shadow = "rgba(0, 0, 0, 0.16)",
  } = options;

  ctx.save();

  ctx.fillStyle = shadow;
  fillRoundedRect(ctx, x, y + 4, width, height, radius);

  const fill = ctx.createLinearGradient(x, y, x, y + height);
  fill.addColorStop(0, top);
  fill.addColorStop(0.48, bottom);
  fill.addColorStop(1, bottom);
  ctx.fillStyle = fill;
  fillRoundedRect(ctx, x, y, width, height, radius);

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  fillRoundedRect(ctx, x + 4, y + 4, width - 8, Math.max(12, height * 0.28), radius - 4);

  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  traceRoundedRect(ctx, x, y, width, height, radius);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = innerStroke;
  traceRoundedRect(ctx, x + 3, y + 3, width - 6, height - 6, Math.max(4, radius - 3));
  ctx.stroke();

  ctx.restore();
}

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

// Blend both horizontal edges after drawing. Hand-built motifs are rarely
// perfectly seamless on their own; this post-pass prevents a bright/dark jump
// when the belt completes a full rotation.
function makeHorizontalTextureSeamless(ctx, width, height, seamWidth) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const original = new Uint8ClampedArray(imageData.data);

  for (let x = 0; x < seamWidth; x += 1) {
    const leftX = x;
    const rightX = width - seamWidth + x;

    for (let y = 0; y < height; y += 1) {
      const leftIndex = (y * width + leftX) * 4;
      const rightIndex = (y * width + rightX) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const mixed = Math.round(
          (original[leftIndex + channel] + original[rightIndex + channel]) * 0.5,
        );
        imageData.data[leftIndex + channel] = mixed;
        imageData.data[rightIndex + channel] = mixed;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------------------------------------
// Functions that need game state — game as first param
// ---------------------------------------------------------------------------

function drawBackground(game, ctx) {
  const canopy = ctx.createLinearGradient(0, 0, 0, 176);
  canopy.addColorStop(0, "#17383e");
  canopy.addColorStop(0.55, "#10272d");
  canopy.addColorStop(1, "#0a1519");
  ctx.fillStyle = canopy;
  ctx.fillRect(0, 0, GAME_WIDTH, 176);

  const slab = ctx.createLinearGradient(0, 118, 0, GAME_HEIGHT);
  slab.addColorStop(0, "#7f8990");
  slab.addColorStop(0.48, "#6e7880");
  slab.addColorStop(1, "#5b646d");
  ctx.fillStyle = slab;
  ctx.fillRect(0, HUD_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);

  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  for (let i = 0; i < 16; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      28 + i * 26,
      156 + (i % 5) * 118,
      18 + (i % 3) * 11,
      12 + (i % 4) * 6,
      0.22 * (i % 4),
      0,
      TAU,
    );
    ctx.fill();
  }

  ctx.fillStyle = "rgba(43, 51, 57, 0.16)";
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      40 + i * 32,
      214 + (i % 4) * 146,
      22 + (i % 2) * 16,
      10 + (i % 3) * 7,
      0.3,
      0,
      TAU,
    );
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(
    game.shooter.x + 22, 118, 14,
    game.shooter.x + 22, 118, 268,
  );
  glow.addColorStop(0, "rgba(233, 192, 98, 0.18)");
  glow.addColorStop(1, "rgba(233, 192, 98, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const tileRects = [
    { x: 26, y: 194, w: 56, h: 50 },
    { x: GAME_WIDTH - 82, y: 194, w: 56, h: 50 },
    { x: 28, y: GAME_HEIGHT - 168, w: 48, h: 44 },
    { x: GAME_WIDTH - 78, y: GAME_HEIGHT - 168, w: 48, h: 44 },
  ];
  for (const rect of tileRects) {
    drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 12, {
      top: "#8d989f",
      bottom: "#67727a",
      stroke: "rgba(72, 54, 35, 0.5)",
      innerStroke: "rgba(255, 236, 185, 0.12)",
      shadow: "rgba(22, 26, 31, 0.12)",
    });
    ctx.strokeStyle = "rgba(78, 89, 95, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rect.x + rect.w * 0.42, rect.y + rect.h * 0.44, 9, 0.3, 4.9);
    ctx.lineTo(rect.x + rect.w * 0.65, rect.y + rect.h * 0.62);
    ctx.arc(rect.x + rect.w * 0.52, rect.y + rect.h * 0.54, 11, 5.2, 2.4);
    ctx.stroke();
  }

  const altarGlow = ctx.createRadialGradient(
    game.shooter.x,
    game.shooter.y,
    18,
    game.shooter.x,
    game.shooter.y,
    164,
  );
  altarGlow.addColorStop(0, "rgba(239, 212, 126, 0.24)");
  altarGlow.addColorStop(1, "rgba(239, 212, 126, 0)");
  ctx.fillStyle = altarGlow;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.strokeStyle = "rgba(73, 84, 94, 0.34)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(game.shooter.x, game.shooter.y + 8, 100, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = "rgba(196, 163, 98, 0.18)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(game.shooter.x, game.shooter.y + 8, 100, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "rgba(22, 28, 33, 0.42)";
  ctx.beginPath();
  ctx.ellipse(game.shooter.x, game.shooter.y + 72, 96, 26, 0, 0, TAU);
  ctx.fill();
}

function drawTrack(game, ctx) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(18, 22, 28, 0.14)";
  ctx.lineWidth = 16;
  strokePath(game, ctx);

  ctx.strokeStyle = "rgba(111, 121, 130, 0.92)";
  ctx.lineWidth = 10;
  strokePath(game, ctx);

  ctx.strokeStyle = "rgba(60, 70, 78, 0.34)";
  ctx.lineWidth = 4;
  strokePath(game, ctx);

  ctx.restore();
}

function drawGoal(game, ctx) {
  const goal = game.pathPoints[game.pathPoints.length - 1];
  ctx.save();
  ctx.translate(goal.x, goal.y);

  const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 36);
  aura.addColorStop(0, "rgba(255, 220, 128, 0.28)");
  aura.addColorStop(1, "rgba(255, 220, 128, 0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#3f2514";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#d2a85c";
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, TAU);
  ctx.stroke();

  ctx.restore();
}

function drawChain(game, ctx) {
  // Clip to the play area so any portion of a ball that crosses into the
  // HUD / bottom-button strips is masked out (HUD panel isn't full-width,
  // so we can't rely on it to occlude). This also gives a smooth "ball
  // rolling out from behind the UI" reveal when the author places the path
  // start inside a UI strip.
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    0,
    HUD_HEIGHT,
    GAME_WIDTH,
    GAME_HEIGHT - HUD_HEIGHT - BOTTOM_BUTTON_HEIGHT,
  );
  ctx.clip();

  // Only draw balls that are currently on the playable portion of the path.
  for (const ball of game.chain) {
    if (ball.s < 0 || ball.s > game.totalPathLength) {
      continue;
    }

    const point = game.getPointAtDistance(ball.s);
    drawBall(
      game,
      ctx,
      point.x,
      point.y,
      ball.radius,
      ball.paletteIndex,
      ball.rotation,
      ball.impact,
    );
  }

  ctx.restore();
}

// Optimized ball renderer. Static gradient layers (body, matte shade, worn
// bloom, edge strokes) are pre-baked in createBallRenderCache(). Only the
// rolling band texture is drawn live each frame (it depends on rotation).
// This reduces per-ball gradient creation from 5 to 0.
function drawBall(game, ctx, x, y, radius, paletteIndex, rotation, impact = 0) {
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
  drawRollingBandTexture(game, ctx, pattern, radius, rotation);

  // Overlay shading (cached for standard radius)
  if (radius === BALL_RADIUS && game.ballOverCache) {
    ctx.drawImage(game.ballOverCache, -(radius + pad), -(radius + pad));
  }

  ctx.restore();
}

// Rolling belt texture + cached band shading overlay.
function drawRollingBandTexture(game, ctx, pattern, radius, rotation) {
  const sourceWidth = pattern.width;
  const sourceHeight = pattern.height;
  const sourceY = sourceHeight * 0.18;
  const sourceH = sourceHeight * 0.64;
  const bandWidth = radius * 2.3;
  const bandHeight = radius * 1.42;
  const offset = (((rotation / TAU) % 1 + 1) % 1) * bandWidth;

  ctx.save();
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

function drawProjectile(game, ctx) {
  if (!game.projectile) {
    return;
  }

  // Mirror drawChain's play-area clip so a projectile passing through the
  // HUD / bottom-button strips doesn't render on top of the UI.
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    0,
    HUD_HEIGHT,
    GAME_WIDTH,
    GAME_HEIGHT - HUD_HEIGHT - BOTTOM_BUTTON_HEIGHT,
  );
  ctx.clip();

  drawBall(
    game,
    ctx,
    game.projectile.x,
    game.projectile.y,
    game.projectile.radius,
    game.projectile.paletteIndex,
    game.projectile.rotation,
    0,
  );

  ctx.restore();
}

function drawAimGuide(game, ctx) {
  const startX = game.shooter.x + Math.cos(game.shooter.angle) * 56;
  const startY = game.shooter.y + Math.sin(game.shooter.angle) * 56;
  const endX = startX + Math.cos(game.shooter.angle) * AIM_GUIDE_LENGTH;
  const endY = startY + Math.sin(game.shooter.angle) * AIM_GUIDE_LENGTH;

  ctx.save();
  ctx.setLineDash([9, 10]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(251, 233, 179, 0.42)";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

function drawShooter(game, ctx) {
  const { x, y, angle } = game.shooter;
  const cx = game.frogCacheCx;
  const cy = game.frogCacheCy;

  ctx.save();
  ctx.translate(x, y);

  // --- 1. Ground shadow (stays flat, does not rotate) ---
  ctx.fillStyle = "rgba(18, 21, 24, 0.40)";
  ctx.beginPath();
  ctx.ellipse(0, 42, 56, 14, 0, 0, TAU);
  ctx.fill();

  // --- Rotate entire frog to face the aim direction ---
  ctx.rotate(angle + Math.PI * 0.5);

  // --- Scale down the frog (drawn at large size for detail, shrunk here) ---
  const frogScale = 0.78;
  ctx.scale(frogScale, frogScale);

  // --- 2. Cached layer: body + lower jaw + mouth cavity + belly socket ---
  ctx.drawImage(game.frogCacheBehind, -cx, -cy);

  // --- 3. Live ball inside the mouth (palette/rotation change each frame) ---
  drawBall(game, ctx, 0, -34, BALL_RADIUS, game.currentPaletteIndex, angle * 2.2);

  // --- 4. Cached layer: upper jaw + eyes (overlaps ball top) ---
  ctx.drawImage(game.frogCacheFront, -cx, -cy);

  // --- 5. Live current-ball echo in belly socket (matches mouth ball) ---
  drawBall(game, ctx, 0, 32, BALL_RADIUS - 1, game.currentPaletteIndex, -angle * 1.5);

  ctx.restore();
}

function drawParticles(game, ctx) {
  for (const p of game.particles) {
    const t = p.age / p.lifetime; // 0→1
    const alpha = 1 - t * t; // fade out (quadratic)
    const scale = 1 - t * 0.5; // shrink to 50%
    const r = p.size * scale;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The top overlay is now a real HUD layer: state, score/combo, next ball and
// touch-friendly restart all live here instead of temporary prototype text.
function drawOverlay(game, ctx) {
  // Stone panel backgrounds are pre-rendered; text is drawn live.
  if (!game.hudPanelCache) {
    game.hudPanelCache = document.createElement("canvas");
    game.hudPanelCache.width = GAME_WIDTH;
    game.hudPanelCache.height = 120;
    const hCtx = game.hudPanelCache.getContext("2d");

    // Main HUD panel — matches scene stone slab. Extends down to y=120 so
    // its bottom edge meets the play-area clip line (no hairline gap).
    drawStonePanel(hCtx, 16, 14, 232, 106, 22, {
      top: "#7a8590",
      bottom: "#636e78",
      stroke: "rgba(180, 150, 80, 0.55)",
      innerStroke: "rgba(240, 225, 180, 0.12)",
      shadow: "rgba(8, 12, 16, 0.15)",
    });

    // Stone speckle texture on main panel
    hCtx.save();
    traceRoundedRect(hCtx, 18, 16, 228, 102, 20);
    hCtx.clip();
    hCtx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let i = 0; i < 18; i += 1) {
      hCtx.beginPath();
      hCtx.ellipse(
        24 + (i * 37) % 220, 20 + (i * 19) % 80,
        4 + (i % 3) * 3, 2 + (i % 2) * 2,
        0.4 * (i % 5), 0, TAU,
      );
      hCtx.fill();
    }
    hCtx.fillStyle = "rgba(0, 0, 0, 0.03)";
    for (let i = 0; i < 10; i += 1) {
      hCtx.beginPath();
      hCtx.ellipse(
        30 + (i * 43) % 210, 24 + (i * 23) % 74,
        3 + (i % 2) * 2, 2 + (i % 3),
        0.6 * (i % 4), 0, TAU,
      );
      hCtx.fill();
    }
    hCtx.restore();

    // Mayan zigzag trim along bottom edge of main panel
    hCtx.save();
    traceRoundedRect(hCtx, 18, 16, 228, 102, 20);
    hCtx.clip();
    const zigY = 114;
    const zigH = 6;
    const zigW = 10;
    hCtx.fillStyle = "rgba(200, 170, 50, 0.22)";
    hCtx.beginPath();
    hCtx.moveTo(22, zigY);
    for (let zx = 22; zx < 242; zx += zigW) {
      hCtx.lineTo(zx + zigW * 0.5, zigY - zigH);
      hCtx.lineTo(zx + zigW, zigY);
    }
    hCtx.lineTo(242, zigY + 2);
    hCtx.lineTo(22, zigY + 2);
    hCtx.closePath();
    hCtx.fill();
    // Thin gold line above zigzag
    hCtx.strokeStyle = "rgba(220, 190, 80, 0.28)";
    hCtx.lineWidth = 1;
    hCtx.beginPath();
    hCtx.moveTo(26, zigY + 1);
    hCtx.lineTo(240, zigY + 1);
    hCtx.stroke();
    hCtx.restore();

    // Sun/altar icon at top-left as title decoration (cached)
    hCtx.save();
    const sunX = 222, sunY = 36;
    hCtx.strokeStyle = "rgba(220, 190, 80, 0.32)";
    hCtx.lineWidth = 1.5;
    hCtx.beginPath();
    hCtx.arc(sunX, sunY, 8, 0, TAU);
    hCtx.stroke();
    // Sun rays
    for (let r = 0; r < 8; r += 1) {
      const a = (r / 8) * TAU;
      hCtx.beginPath();
      hCtx.moveTo(sunX + Math.cos(a) * 10, sunY + Math.sin(a) * 10);
      hCtx.lineTo(sunX + Math.cos(a) * 14, sunY + Math.sin(a) * 14);
      hCtx.stroke();
    }
    hCtx.fillStyle = "rgba(220, 190, 80, 0.2)";
    hCtx.beginPath();
    hCtx.arc(sunX, sunY, 5, 0, TAU);
    hCtx.fill();
    hCtx.restore();

    // Sub-panels — slightly recessed from main panel
    drawStonePanel(hCtx, 28, 66, 86, 28, 12, {
      top: "#6e7a84",
      bottom: "#5a6570",
      stroke: "rgba(160, 130, 70, 0.5)",
      innerStroke: "rgba(240, 225, 180, 0.08)",
      shadow: "rgba(0, 0, 0, 0.08)",
    });
    drawStonePanel(hCtx, 120, 66, 118, 28, 12, {
      top: "#6e7a84",
      bottom: "#5a6570",
      stroke: "rgba(160, 130, 70, 0.5)",
      innerStroke: "rgba(240, 225, 180, 0.08)",
      shadow: "rgba(0, 0, 0, 0.08)",
    });

    // Micro speckle on sub-panels
    hCtx.fillStyle = "rgba(255, 255, 255, 0.035)";
    for (let i = 0; i < 6; i += 1) {
      hCtx.beginPath();
      hCtx.ellipse(34 + i * 12, 76 + (i % 2) * 6, 2, 1.5, 0, 0, TAU);
      hCtx.fill();
    }
    for (let i = 0; i < 8; i += 1) {
      hCtx.beginPath();
      hCtx.ellipse(126 + i * 13, 74 + (i % 3) * 5, 2, 1.5, 0, 0, TAU);
      hCtx.fill();
    }
  }
  ctx.drawImage(game.hudPanelCache, 0, 0);

  // Title with manual offset shadow (no shadowBlur — perf)
  const levelName = game.levelConfig?.name ?? "祭坛试炼";
  const levelNum = game.currentLevel ?? 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.font = "700 22px Georgia";
  ctx.fillText(levelName, 29, 41);
  ctx.fillStyle = "#f0d57a";
  ctx.fillText(levelName, 28, 40);

  // Subtitle — dimmer
  ctx.fillStyle = "rgba(220, 210, 180, 0.5)";
  ctx.font = "11px Georgia";
  ctx.fillText(`第 ${levelNum} 关 · 祭坛试炼`, 30, 56);

  // Status row with color dot indicator
  const stateLabel = game.getGameStateLabel();
  const stateDot = game.gameState === "win" ? "#f0d57a" :
    game.gameState === "lose" ? "#d45040" : "#6cc870";
  ctx.fillStyle = stateDot;
  ctx.beginPath();
  ctx.arc(37, 82, 3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#c8bfa8";
  ctx.font = "600 12px Georgia";
  ctx.fillText(`${stateLabel}`, 44, 85);
  ctx.fillText("链长", 130, 85);
  ctx.fillStyle = "#f5d872";
  ctx.font = "700 13px Georgia";
  ctx.fillText(`${game.chain.length}`, 155, 85);

  // Score row — label gray, number gold
  ctx.fillStyle = "#c8bfa8";
  ctx.font = "600 12px Georgia";
  ctx.fillText("分数", 30, 103);
  ctx.fillStyle = "#f5d872";
  ctx.font = "700 14px Georgia";
  ctx.fillText(`${game.score}`, 58, 103);
  ctx.fillStyle = "#c8bfa8";
  ctx.font = "600 12px Georgia";
  const comboText = game.getComboHudText();
  ctx.fillText(comboText, 128, 103);

  drawHudNextPreview(game, ctx);
  drawSoundButton(game, ctx);
  drawRestartButton(
    game,
    ctx,
    game.getHudRestartButtonRect(),
    "重开",
    game.uiPressAction === "restart" &&
      game.isPointInsideRect(game.pointer.x, game.pointer.y, game.getHudRestartButtonRect()),
  );

  // Back to level select button (bottom-left during gameplay)
  const backRect = game.getHudBackButtonRect();
  const isBackPressed =
    game.uiPressAction === "backToSelect" &&
    game.isPointInsideRect(game.pointer.x, game.pointer.y, backRect);
  drawRestartButton(game, ctx, backRect, "选关", isBackPressed);
}

function drawHudNextPreview(game, ctx) {
  const rect = game.getHudNextPreviewRect();
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + 20;

  ctx.save();
  // Brighter bronze border to stand out
  drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 14, {
    top: "#727e88",
    bottom: "#5e6a74",
    stroke: "rgba(200, 170, 50, 0.6)",
    innerStroke: "rgba(247, 228, 187, 0.2)",
    shadow: "rgba(0, 0, 0, 0.16)",
  });

  // Rotating dashed gold halo around ball — "ready" indicator
  const ringAngle = (game.lastTime / 1800) % TAU;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(ringAngle);
  ctx.strokeStyle = "rgba(228, 193, 108, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Small arrow label instead of text
  ctx.fillStyle = "rgba(244, 229, 189, 0.65)";
  ctx.font = "11px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("▸", centerX, rect.y + rect.h - 5);

  drawBall(
    game,
    ctx,
    centerX,
    centerY,
    BALL_RADIUS - 2,
    game.nextPaletteIndex,
    -game.shooter.angle * 1.5,
  );
  ctx.textAlign = "start";
  ctx.restore();
}

// Small sound toggle button in the HUD. Shows a speaker icon with a slash
// when muted. Drawn as canvas primitives to avoid external assets.
function drawSoundButton(game, ctx) {
  const rect = game.getHudSoundButtonRect();
  const isPressed =
    game.uiPressAction === "toggleSound" &&
    game.isPointInsideRect(game.pointer.x, game.pointer.y, rect);

  ctx.save();

  drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 14, {
    top: isPressed ? "#876748" : "#94724d",
    bottom: isPressed ? "#64472e" : "#705139",
    stroke: "rgba(242, 217, 151, 0.52)",
    innerStroke: "rgba(255, 240, 210, 0.15)",
    shadow: "rgba(0, 0, 0, 0.2)",
  });

  // Speaker icon (centered in button, press offset)
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.translate(cx, cy + (isPressed ? 1 : 0));

  // Speaker body — slightly larger
  ctx.fillStyle = "#f4e7c3";
  ctx.beginPath();
  ctx.moveTo(-7, -5);
  ctx.lineTo(-2, -5);
  ctx.lineTo(5, -9);
  ctx.lineTo(5, 9);
  ctx.lineTo(-2, 5);
  ctx.lineTo(-7, 5);
  ctx.closePath();
  ctx.fill();

  if (game.sfx.muted) {
    // Mute slash
    ctx.strokeStyle = "#e85050";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.lineTo(9, 10);
    ctx.stroke();
  } else {
    // Sound waves
    ctx.strokeStyle = "#f4e7c3";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(6, 0, 5, -0.6, 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, 0, 9, -0.5, 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRestartButton(game, ctx, rect, label, isPressed = false) {
  ctx.save();

  drawStonePanel(ctx, rect.x, rect.y + (isPressed ? 1 : 0), rect.w, rect.h, 18, {
    top: isPressed ? "#876748" : "#94724d",
    bottom: isPressed ? "#64472e" : "#705139",
    stroke: "rgba(242, 217, 151, 0.52)",
    innerStroke: "rgba(255, 240, 210, 0.15)",
    shadow: "rgba(0, 0, 0, 0.2)",
  });

  const yOff = isPressed ? 1 : 0;
  // Top highlight strip
  ctx.fillStyle = isPressed ? "rgba(54, 35, 20, 0.18)" : "rgba(255, 241, 210, 0.1)";
  fillRoundedRect(ctx, rect.x + 5, rect.y + 5 + yOff, rect.w - 10, Math.max(8, rect.h * 0.36), 13);

  ctx.fillStyle = "#f4e7c3";
  ctx.font = "600 15px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1 + yOff);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

// Floating score feedback stays brief, while the persistent HUD keeps the
// actual score and combo summary visible for longer inspection.
function drawMatchFeedback(game, ctx) {
  if (!game.matchFeedback) {
    return;
  }

  const fadeWindow = 0.25;
  const alpha =
    game.matchFeedback.timer > fadeWindow
      ? 1
      : Math.max(0, game.matchFeedback.timer / fadeWindow);
  const rise = (1 - Math.min(1, game.matchFeedback.timer / 1.2)) * 18;
  const combo = game.matchFeedback.combo || 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";

  // Combo > 2: panel border flashes gold
  const panelStroke = combo > 2
    ? `rgba(220, 185, 60, ${0.6 + 0.3 * Math.sin(game.lastTime / 120)})`
    : "rgba(94, 70, 40, 0.9)";

  drawStonePanel(ctx, GAME_WIDTH * 0.5 - 96, 114 - rise, 192, 60, 18, {
    top: "#727c86",
    bottom: "#5c6670",
    stroke: panelStroke,
    innerStroke: "rgba(246, 225, 171, 0.2)",
    shadow: "rgba(0, 0, 0, 0.15)",
  });

  // Score number with manual offset shadow (no shadowBlur — perf)
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.font = "700 22px Georgia";
  ctx.fillText(`+${game.matchFeedback.scoreDelta}`, GAME_WIDTH * 0.5 + 1, 144 - rise);
  ctx.fillStyle = "#f1d680";
  ctx.fillText(`+${game.matchFeedback.scoreDelta}`, GAME_WIDTH * 0.5, 143 - rise);

  ctx.fillStyle = "rgba(244, 229, 189, 0.88)";
  ctx.font = "13px Georgia";
  const detail =
    game.matchFeedback.label || `消除 ${game.matchFeedback.removedCount} 颗`;
  ctx.fillText(detail, GAME_WIDTH * 0.5, 163 - rise);

  ctx.textAlign = "start";
  ctx.restore();
}

// The round-end card doubles as the phone-friendly restart surface until a
// fuller post-game menu exists.
function drawRoundStateCard(game, ctx) {
  if (game.gameState === "playing") {
    return;
  }

  const isWin = game.gameState === "win";
  ctx.save();
  // Dim overlay
  ctx.fillStyle = "rgba(6, 10, 12, 0.52)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const panelWidth = 320;
  const panelHeight = 370;
  const panelX = (GAME_WIDTH - panelWidth) / 2;
  const panelY = GAME_HEIGHT * 0.18;
  const midX = GAME_WIDTH / 2;

  // Main panel with win-gold or lose-red border
  drawStonePanel(ctx, panelX, panelY, panelWidth, panelHeight, 26, {
    top: "#747f88",
    bottom: "#5f6a74",
    stroke: isWin
      ? "rgba(220, 185, 60, 0.9)"
      : "rgba(160, 70, 50, 0.85)",
    innerStroke: isWin
      ? "rgba(244, 220, 137, 0.3)"
      : "rgba(231, 167, 143, 0.25)",
    shadow: "rgba(8, 10, 12, 0.25)",
  });

  // Stone speckle texture on card panel
  ctx.save();
  traceRoundedRect(ctx, panelX + 2, panelY + 2, panelWidth - 4, panelHeight - 4, 24);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      panelX + 20 + (i * 41) % (panelWidth - 40),
      panelY + 16 + (i * 29) % (panelHeight - 32),
      4 + (i % 3) * 3, 2 + (i % 2) * 2,
      0.3 * (i % 5), 0, TAU,
    );
    ctx.fill();
  }
  ctx.restore();

  // Altar badge — double ring + sun (win) or crack lines (lose)
  const badgeY = panelY + 32;
  ctx.strokeStyle = isWin
    ? "rgba(220, 190, 80, 0.45)"
    : "rgba(180, 80, 60, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(midX, badgeY, 18, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(midX, badgeY, 13, 0, TAU);
  ctx.stroke();

  if (isWin) {
    // Sun icon inside badge
    ctx.fillStyle = "rgba(220, 190, 80, 0.3)";
    ctx.beginPath();
    ctx.arc(midX, badgeY, 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(220, 190, 80, 0.4)";
    ctx.lineWidth = 1.2;
    for (let r = 0; r < 8; r += 1) {
      const a = (r / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(midX + Math.cos(a) * 9, badgeY + Math.sin(a) * 9);
      ctx.lineTo(midX + Math.cos(a) * 14, badgeY + Math.sin(a) * 14);
      ctx.stroke();
    }
  } else {
    // Crack lines for defeat
    ctx.strokeStyle = "rgba(180, 80, 60, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(midX - 6, badgeY - 6);
    ctx.lineTo(midX, badgeY);
    ctx.lineTo(midX + 3, badgeY - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX + 2, badgeY + 2);
    ctx.lineTo(midX + 7, badgeY + 7);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  // Title with manual offset shadow (no shadowBlur — perf)
  ctx.textAlign = "center";
  const titleText = isWin ? "祭坛告捷" : "试炼中断";
  ctx.font = "700 32px Georgia";
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillText(titleText, midX + 1, panelY + 74);
  ctx.fillStyle = isWin ? "#f5d872" : "#e0b8a0";
  ctx.fillText(titleText, midX, panelY + 72);

  // Subtitle description
  ctx.fillStyle = "rgba(244, 232, 202, 0.65)";
  ctx.font = "13px Georgia";
  ctx.fillText(
    isWin ? "球链已被清空" : "球链抵达终点",
    midX, panelY + 94,
  );

  // Score — large gold number with manual offset shadow
  ctx.fillStyle = "#c8bfa8";
  ctx.font = "600 14px Georgia";
  ctx.fillText("本局得分", midX, panelY + 120);
  ctx.font = "700 28px Georgia";
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillText(`${game.score}`, midX + 1, panelY + 153);
  ctx.fillStyle = "#f5d872";
  ctx.fillText(`${game.score}`, midX, panelY + 152);

  // Combo badge — inset stone sub-panel
  const comboBadgeW = 140;
  const comboBadgeH = 24;
  const comboBadgeX = midX - comboBadgeW / 2;
  const comboBadgeY = panelY + 164;
  drawStonePanel(ctx, comboBadgeX, comboBadgeY, comboBadgeW, comboBadgeH, 10, {
    top: "#666f78",
    bottom: "#545e68",
    stroke: "rgba(80, 60, 35, 0.6)",
    innerStroke: "rgba(246, 229, 183, 0.1)",
    shadow: "rgba(0, 0, 0, 0.08)",
  });
  ctx.fillStyle = "rgba(240, 225, 185, 0.75)";
  ctx.font = "600 11px Georgia";
  ctx.fillText(
    game.bestCombo > 1 ? `最高连击 x${game.bestCombo}` : "本局未触发连击",
    midX, comboBadgeY + 16,
  );

  // --- Action buttons ---
  const isWinWithMore = isWin && game.currentLevel < (game.constructor._LEVELS || []).length;

  if (isWinWithMore) {
    const nextRect = game.getEndCardNextButtonRect();
    const pulse = 0.08 + 0.06 * Math.sin(game.roundEndTimer * 2.5);
    ctx.fillStyle = `rgba(244, 217, 100, ${pulse})`;
    fillRoundedRect(ctx, nextRect.x - 4, nextRect.y - 4, nextRect.w + 8, nextRect.h + 8, 22);
    drawRestartButton(
      game, ctx, nextRect, "下一关",
      game.uiPressAction === "nextLevel" &&
        game.isPointInsideRect(game.pointer.x, game.pointer.y, nextRect),
    );

    const restartRect = game.getEndCardRestartButtonRect();
    drawRestartButton(
      game, ctx, restartRect, "重玩本关",
      game.uiPressAction === "restart" &&
        game.isPointInsideRect(game.pointer.x, game.pointer.y, restartRect),
    );
  } else {
    const restartRect = game.getEndCardRestartButtonRect();
    const pulse = 0.08 + 0.06 * Math.sin(game.roundEndTimer * 2.5);
    ctx.fillStyle = isWin
      ? `rgba(244, 217, 100, ${pulse})`
      : `rgba(200, 100, 70, ${pulse * 0.7})`;
    fillRoundedRect(ctx, restartRect.x - 4, restartRect.y - 4, restartRect.w + 8, restartRect.h + 8, 22);
    drawRestartButton(
      game, ctx, restartRect, isWin ? "重新开始" : "重试",
      game.uiPressAction === "restart" &&
        game.isPointInsideRect(game.pointer.x, game.pointer.y, restartRect),
    );
  }

  const backRect = game.getEndCardBackButtonRect();
  drawRestartButton(
    game, ctx, backRect, "返回选关",
    game.uiPressAction === "backToSelect" &&
      game.isPointInsideRect(game.pointer.x, game.pointer.y, backRect),
  );

  // Mayan zigzag trim at panel bottom
  ctx.save();
  traceRoundedRect(ctx, panelX + 2, panelY + 2, panelWidth - 4, panelHeight - 4, 24);
  ctx.clip();
  const zigY2 = panelY + panelHeight - 8;
  const zigH2 = 5;
  const zigW2 = 12;
  ctx.fillStyle = isWin
    ? "rgba(200, 170, 50, 0.18)"
    : "rgba(160, 70, 50, 0.15)";
  ctx.beginPath();
  ctx.moveTo(panelX + 10, zigY2);
  for (let zx = panelX + 10; zx < panelX + panelWidth - 10; zx += zigW2) {
    ctx.lineTo(zx + zigW2 * 0.5, zigY2 - zigH2);
    ctx.lineTo(zx + zigW2, zigY2);
  }
  ctx.lineTo(panelX + panelWidth - 10, zigY2 + 2);
  ctx.lineTo(panelX + 10, zigY2 + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "start";
  ctx.restore();
}

function strokePath(game, ctx) {
  ctx.stroke(game.cachedTrackPath);
}

// ---------------------------------------------------------------------------
// Texture generation (called once at startup)
// ---------------------------------------------------------------------------

// Generate a horizontally tileable source texture for the rolling belt around
// each stone ball. This is the current compromise after several experiments:
// not a tiny center logo, not a fake full-sphere UV, but a broad symbolic
// band that rotates cleanly on mobile screens.
function createBallPatternCanvas(palette, glyphVariant) {
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

// Pre-render each palette's stone-body gradient, edge stroke, matte shading,
// and worn-bloom highlight to offscreen canvases. At runtime drawBall() just
// does drawImage instead of creating 5 gradients per ball per frame.
// Two layers per palette:
//   ballBaseCache[i]  — body gradient + edge stroke (drawn UNDER the belt)
//   ballOverCache[i]  — matteShade + wornBloom + worn arc (drawn OVER the belt)
// Plus one shared impact-aura cache (palette-independent).
function createBallRenderCache(game) {
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
// upper jaw still overlaps the held ball at runtime.
function createFrogCache(game) {
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
// ~20 gradients + 1848 lineTo ops each time.
function createStaticSceneCache(game) {
  const cache = document.createElement("canvas");
  cache.width = GAME_WIDTH;
  cache.height = GAME_HEIGHT;
  const cCtx = cache.getContext("2d");
  drawBackground(game, cCtx);
  // Clip the track + goal to the play area so any portion of an author-drawn
  // path that strays into the HUD or bottom-button strips doesn't render on
  // top of those UI zones. Background fills the whole canvas because the HUD
  // panel draws over it later.
  cCtx.save();
  cCtx.beginPath();
  cCtx.rect(
    0,
    HUD_HEIGHT,
    GAME_WIDTH,
    GAME_HEIGHT - HUD_HEIGHT - BOTTOM_BUTTON_HEIGHT,
  );
  cCtx.clip();
  drawTrack(game, cCtx);
  drawGoal(game, cCtx);
  cCtx.restore();
  game.staticSceneCache = cache;
}

// ---------------------------------------------------------------------------
// Exported public API — only render(game) and createTextures(game)
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
  // staticSceneCache is now lazily created in render() because it depends on
  // path data which may not exist yet (e.g. during levelSelect state).
}

function drawLevelSelectScreen(game, ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  bg.addColorStop(0, "#17383e");
  bg.addColorStop(0.3, "#10272d");
  bg.addColorStop(1, "#0a1519");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const slab = ctx.createLinearGradient(0, 120, 0, GAME_HEIGHT);
  slab.addColorStop(0, "#7f8990");
  slab.addColorStop(0.48, "#6e7880");
  slab.addColorStop(1, "#5b646d");
  ctx.fillStyle = slab;
  ctx.fillRect(0, 120, GAME_WIDTH, GAME_HEIGHT - 120);

  ctx.textAlign = "center";
  ctx.font = "700 34px Georgia";
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillText("祭坛试炼", GAME_WIDTH / 2 + 1, 61);
  ctx.fillStyle = "#f0d57a";
  ctx.fillText("祭坛试炼", GAME_WIDTH / 2, 60);

  ctx.fillStyle = "rgba(220, 210, 180, 0.5)";
  ctx.font = "14px Georgia";
  ctx.fillText("选择关卡", GAME_WIDTH / 2, 86);

  ctx.strokeStyle = "rgba(200, 170, 50, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(100, 100);
  ctx.lineTo(GAME_WIDTH - 100, 100);
  ctx.stroke();

  const LEVELS = game.constructor._LEVELS || [];
  for (const level of LEVELS) {
    drawLevelButton(game, ctx, level);
  }

  drawSoundButton(game, ctx);

  const resetRect = game.getResetProgressButtonRect();
  drawStonePanel(ctx, resetRect.x, resetRect.y, resetRect.w, resetRect.h, 14, {
    top: "#5a636c",
    bottom: "#485058",
    stroke: "rgba(160, 80, 60, 0.5)",
    innerStroke: "rgba(240, 180, 160, 0.1)",
    shadow: "rgba(0, 0, 0, 0.15)",
  });
  ctx.fillStyle = "rgba(220, 160, 140, 0.75)";
  ctx.font = "600 11px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("重置进度", resetRect.x + resetRect.w / 2, resetRect.y + resetRect.h / 2 + 4);

  ctx.textAlign = "start";
}

// Draw a tiny path outline inside a level button for visual preview.
function drawPathThumbnail(ctx, level, rect) {
  const cx = rect.x + rect.w / 2;
  const thumbY = rect.y + 44;
  const thumbW = rect.w * 0.5;
  const thumbH = 50;

  ctx.save();
  ctx.strokeStyle = "rgba(200, 180, 120, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";

  const pathType = level.pathType || "spiral";

  if (pathType === "spiral") {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const angle = t * Math.PI * 4;
      const r = 22 - t * 14;
      const x = cx + Math.cos(angle) * r;
      const y = thumbY + Math.sin(angle) * r * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (pathType === "serpentine") {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = cx + Math.sin(t * Math.PI * 3) * thumbW * 0.4;
      const y = thumbY - thumbH * 0.4 + t * thumbH * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (pathType === "rectangular") {
    ctx.beginPath();
    const inset = 8;
    ctx.moveTo(cx + thumbW * 0.4, thumbY - thumbH * 0.35);
    ctx.lineTo(cx - thumbW * 0.4, thumbY - thumbH * 0.35);
    ctx.lineTo(cx - thumbW * 0.4, thumbY + thumbH * 0.35);
    ctx.lineTo(cx + thumbW * 0.4, thumbY + thumbH * 0.35);
    ctx.lineTo(cx + thumbW * 0.4, thumbY - thumbH * 0.35 + inset);
    ctx.lineTo(cx - thumbW * 0.4 + inset, thumbY - thumbH * 0.35 + inset);
    ctx.stroke();
  } else if (pathType === "openArc") {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const angle = -0.2 * Math.PI + t * Math.PI * 1.45;
      const rx = 24 - t * 10;
      const ry = 20 - t * 6;
      const x = cx + Math.cos(angle) * rx;
      const y = thumbY + Math.sin(angle) * ry;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (pathType === "zigzag") {
    ctx.beginPath();
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const y = thumbY - thumbH * 0.35 + (r / (rows - 1)) * thumbH * 0.7;
      const goLeft = r % 2 === 0;
      const fromX = goLeft ? cx + thumbW * 0.4 : cx - thumbW * 0.4;
      const toX = goLeft ? cx - thumbW * 0.4 : cx + thumbW * 0.4;
      if (r === 0) ctx.moveTo(fromX, y);
      else ctx.lineTo(fromX, y);
      ctx.lineTo(toX, y);
    }
    ctx.stroke();
  } else if (pathType === "drawn") {
    // Drawn path thumbnail — render actual segments scaled to thumbnail
    const segs = level.pathParams?.segments;
    if (segs && segs.length > 0) {
      // Find bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const TAU2 = Math.PI * 2;
      for (const seg of segs) {
        if (seg.type === "line") {
          minX = Math.min(minX, seg.x1, seg.x2); maxX = Math.max(maxX, seg.x1, seg.x2);
          minY = Math.min(minY, seg.y1, seg.y2); maxY = Math.max(maxY, seg.y1, seg.y2);
        } else if (seg.type === "arc") {
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const a = seg.startAngle + (seg.endAngle - seg.startAngle) * t;
            const px = seg.cx + Math.cos(a) * seg.radius;
            const py = seg.cy + Math.sin(a) * seg.radius;
            minX = Math.min(minX, px); maxX = Math.max(maxX, px);
            minY = Math.min(minY, py); maxY = Math.max(maxY, py);
          }
        } else if (seg.type === "circle") {
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const a = seg.startAngle + seg.turns * TAU2 * t;
            const px = seg.cx + Math.cos(a) * seg.radius;
            const py = seg.cy + Math.sin(a) * seg.radius;
            minX = Math.min(minX, px); maxX = Math.max(maxX, px);
            minY = Math.min(minY, py); maxY = Math.max(maxY, py);
          }
        }
      }
      const bw = maxX - minX || 1;
      const bh = maxY - minY || 1;
      const scaleX = (thumbW * 0.8) / bw;
      const scaleY = (thumbH * 0.7) / bh;
      const sc = Math.min(scaleX, scaleY);
      const offX = cx - (minX + bw / 2) * sc;
      const offY = thumbY - (minY + bh / 2) * sc;
      ctx.beginPath();
      for (const seg of segs) {
        if (seg.type === "line") {
          ctx.moveTo(seg.x1 * sc + offX, seg.y1 * sc + offY);
          ctx.lineTo(seg.x2 * sc + offX, seg.y2 * sc + offY);
        } else if (seg.type === "arc") {
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const a = seg.startAngle + (seg.endAngle - seg.startAngle) * t;
            const px = (seg.cx + Math.cos(a) * seg.radius) * sc + offX;
            const py = (seg.cy + Math.sin(a) * seg.radius) * sc + offY;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        } else if (seg.type === "circle") {
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const a = seg.startAngle + seg.turns * TAU2 * t;
            const px = (seg.cx + Math.cos(a) * seg.radius) * sc + offX;
            const py = (seg.cy + Math.sin(a) * seg.radius) * sc + offY;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawLevelButton(game, ctx, level) {
  const rect = game.getLevelButtonRect(level.id);
  const isUnlocked = true;
  const levelData = game.levelProgress.levels[level.id];
  const isCleared = levelData?.cleared ?? false;
  const highScore = levelData?.highScore ?? 0;
  const isPressed =
    game.uiPressAction === `selectLevel:${level.id}` &&
    game.isPointInsideRect(game.pointer.x, game.pointer.y, rect);

  const topColor = !isUnlocked ? "#4a5058" : isCleared ? "#6a7a68" : "#7a8590";
  const bottomColor = !isUnlocked ? "#3a4248" : isCleared ? "#4e6048" : "#636e78";
  const strokeColor = isCleared
    ? "rgba(180, 200, 80, 0.7)"
    : isUnlocked
      ? "rgba(180, 150, 80, 0.55)"
      : "rgba(80, 80, 80, 0.4)";

  drawStonePanel(ctx, rect.x, rect.y + (isPressed ? 1 : 0), rect.w, rect.h, 18, {
    top: topColor,
    bottom: bottomColor,
    stroke: strokeColor,
    innerStroke: "rgba(240, 225, 180, 0.08)",
    shadow: "rgba(8, 12, 16, 0.15)",
  });

  const cx = rect.x + rect.w / 2;
  ctx.textAlign = "center";

  ctx.font = "700 28px Georgia";
  ctx.fillStyle = isUnlocked ? "#f0d57a" : "rgba(120, 120, 120, 0.5)";
  ctx.fillText(`${level.id}`, cx, rect.y + 38 + (isPressed ? 1 : 0));

  ctx.font = "600 13px Georgia";
  ctx.fillStyle = isUnlocked ? "rgba(240, 225, 185, 0.85)" : "rgba(120, 120, 120, 0.4)";
  ctx.fillText(level.name, cx, rect.y + 60 + (isPressed ? 1 : 0));

  ctx.font = "11px Georgia";
  if (!isUnlocked) {
    ctx.fillStyle = "rgba(120, 120, 120, 0.4)";
    ctx.fillText("🔒 未解锁", cx, rect.y + 82 + (isPressed ? 1 : 0));
  } else if (isCleared) {
    ctx.fillStyle = "rgba(180, 220, 100, 0.8)";
    ctx.fillText("✓ 已通关", cx, rect.y + 82 + (isPressed ? 1 : 0));
  } else {
    ctx.fillStyle = "rgba(220, 210, 180, 0.5)";
    ctx.fillText("未通关", cx, rect.y + 82 + (isPressed ? 1 : 0));
  }

  if (highScore > 0) {
    ctx.font = "600 11px Georgia";
    ctx.fillStyle = "#c8bfa8";
    ctx.fillText(`最高分: ${highScore}`, cx, rect.y + 100 + (isPressed ? 1 : 0));
  }

  if (isUnlocked) {
    drawPathThumbnail(ctx, level, rect);
  }

  if (isUnlocked) {
    const dotY = rect.y + 112 + (isPressed ? 1 : 0);
    const dotSpacing = 10;
    const dotStart = cx - ((level.colorCount - 1) * dotSpacing) / 2;
    for (let d = 0; d < level.colorCount; d++) {
      const palette = BALL_PALETTES[d % BALL_PALETTES.length];
      ctx.fillStyle = palette.base;
      ctx.beginPath();
      ctx.arc(dotStart + d * dotSpacing, dotY, 3, 0, TAU);
      ctx.fill();
    }
  }

  ctx.textAlign = "start";
}

function drawAllClearScreen(game, ctx) {
  ctx.fillStyle = "rgba(6, 10, 12, 0.6)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const midX = GAME_WIDTH / 2;
  const panelW = 340;
  const panelH = 400;
  const panelX = (GAME_WIDTH - panelW) / 2;
  const panelY = GAME_HEIGHT * 0.08;

  drawStonePanel(ctx, panelX, panelY, panelW, panelH, 28, {
    top: "#747f88",
    bottom: "#5f6a74",
    stroke: "rgba(220, 185, 60, 0.9)",
    innerStroke: "rgba(244, 220, 137, 0.3)",
    shadow: "rgba(8, 10, 12, 0.25)",
  });

  ctx.textAlign = "center";

  // Badge — sun
  ctx.fillStyle = "rgba(220, 190, 80, 0.3)";
  ctx.beginPath();
  ctx.arc(midX, panelY + 40, 18, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(220, 190, 80, 0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(midX, panelY + 40, 22, 0, TAU);
  ctx.stroke();
  for (let r = 0; r < 12; r++) {
    const a = (r / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(midX + Math.cos(a) * 26, panelY + 40 + Math.sin(a) * 26);
    ctx.lineTo(midX + Math.cos(a) * 34, panelY + 40 + Math.sin(a) * 34);
    ctx.stroke();
  }

  // Title
  ctx.font = "700 34px Georgia";
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillText("祭坛大捷", midX + 1, panelY + 88);
  ctx.fillStyle = "#f5d872";
  ctx.fillText("祭坛大捷", midX, panelY + 86);

  ctx.fillStyle = "rgba(244, 232, 202, 0.65)";
  ctx.font = "14px Georgia";
  ctx.fillText("全部关卡已通关", midX, panelY + 110);

  // Per-level score summary
  const LEVELS = game.constructor._LEVELS || [];
  let totalScore = 0;
  const startY = panelY + 138;
  ctx.font = "600 12px Georgia";
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    const data = game.levelProgress.levels[lv.id];
    const score = data?.highScore ?? 0;
    totalScore += score;
    const y = startY + i * 22;

    ctx.fillStyle = "#c8bfa8";
    ctx.textAlign = "left";
    ctx.fillText(`${lv.id}. ${lv.name}`, panelX + 24, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f5d872";
    ctx.fillText(`${score}`, panelX + panelW - 24, y);
  }

  // Total score
  ctx.textAlign = "center";
  const totalY = startY + LEVELS.length * 22 + 16;
  ctx.strokeStyle = "rgba(200, 170, 50, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 30, totalY - 10);
  ctx.lineTo(panelX + panelW - 30, totalY - 10);
  ctx.stroke();

  ctx.fillStyle = "#c8bfa8";
  ctx.font = "600 14px Georgia";
  ctx.fillText("总分", midX, totalY + 6);
  ctx.fillStyle = "#f5d872";
  ctx.font = "700 24px Georgia";
  ctx.fillText(`${totalScore}`, midX, totalY + 34);

  // Back to level select button
  const backRect = game.getEndCardBackButtonRect();
  const adjustedRect = { ...backRect, y: panelY + panelH - 50 };
  drawRestartButton(
    game, ctx, adjustedRect, "返回选关",
    game.uiPressAction === "backToSelect" &&
      game.isPointInsideRect(game.pointer.x, game.pointer.y, adjustedRect),
  );

  ctx.textAlign = "start";
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
