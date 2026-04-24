import { GAME_WIDTH, GAME_HEIGHT, BALL_RADIUS, HUD_HEIGHT, BOTTOM_BUTTON_HEIGHT, AIM_GUIDE_LENGTH, TAU } from '../config.js';
import { drawStonePanel } from './draw-utils.js';
import { drawBall } from './ball-textures.js';

// Background layers, path track, goal, chain, projectile, aim guide,
// shooter, particles, and static scene cache.

export function drawBackground(game, ctx) {
  const canopy = ctx.createLinearGradient(0, 0, 0, 120);
  canopy.addColorStop(0, "#17383e");
  canopy.addColorStop(0.55, "#10272d");
  canopy.addColorStop(1, "#0a1519");
  ctx.fillStyle = canopy;
  ctx.fillRect(0, 0, GAME_WIDTH, 120);

  const slab = ctx.createLinearGradient(0, 60, 0, GAME_HEIGHT);
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

// drawTrack 现在接受 trackPath 参数（Path2D），而不是从 game 上读取。
// 这样单轨和双轨关卡都可以用同一函数绘制各自的轨道——调用方只需传入
// 对应的 cachedTrackPath 或 cachedTrackPath2。
export function drawTrack(game, ctx, trackPath) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 外阴影层：宽边深色描边，让轨道有立体厚重感
  ctx.strokeStyle = "rgba(18, 22, 28, 0.14)";
  ctx.lineWidth = 16;
  strokePath(ctx, trackPath);

  // 主轨道层：石材灰色填充
  ctx.strokeStyle = "rgba(111, 121, 130, 0.92)";
  ctx.lineWidth = 10;
  strokePath(ctx, trackPath);

  // 内边缘层：深色细线，增强轨道槽感
  ctx.strokeStyle = "rgba(60, 70, 78, 0.34)";
  ctx.lineWidth = 4;
  strokePath(ctx, trackPath);

  ctx.restore();
}

// drawGoal 现在接受 pathPoints 参数，而不是从 game.pathPoints 读取。
// 这样双轨关卡可以分别为 pathPoints 和 pathPoints2 绘制终点标记。
export function drawGoal(game, ctx, pathPoints) {
  // 终点标记始终取路径最后一个采样点
  const goal = pathPoints[pathPoints.length - 1];
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

// drawChain 现在接受 chain 数组和 totalPathLength 作为显式参数。
// 这样单轨和双轨关卡都可以复用同一函数：
//   单轨：drawChain(game, ctx, game.chain, game.totalPathLength)
//   双轨：drawChain(game, ctx, game.chain2, game.totalPathLength2)
export function drawChain(game, ctx, chain, totalPathLength) {
  // HUD 是 DOM 覆盖层，球不需要裁剪到播放区域——DOM HUD 自然浮在 canvas 上方。
  // 跑出路径范围的球（ball.s < 0 或 > totalPathLength）不绘制，
  // 避免在路径外渲染已消失的球。
  for (const ball of chain) {
    if (ball.s < 0 || ball.s > totalPathLength) {
      continue;
    }

    drawBall(
      game,
      ctx,
      ball.screenX,
      ball.screenY,
      ball.radius,
      ball.paletteIndex,
      ball.rotation,
      ball.impact,
      ball.pathAngle,
    );
  }
}

export function drawProjectile(game, ctx) {
  if (!game.projectile) {
    return;
  }

  // No play-area clip needed — DOM HUD covers the top zone naturally.

  drawBall(
    game,
    ctx,
    game.projectile.x,
    game.projectile.y,
    game.projectile.radius,
    game.projectile.paletteIndex,
    game.projectile.rotation,
    0,
    0,
  );
}

export function drawAimGuide(game, ctx) {
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

export function drawShooter(game, ctx) {
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
  drawBall(game, ctx, 0, -34, BALL_RADIUS, game.currentPaletteIndex, angle * 2.2, 0, 0);

  // --- 4. Cached layer: upper jaw + eyes (overlaps ball top) ---
  ctx.drawImage(game.frogCacheFront, -cx, -cy);

  // --- 5. Live current-ball echo in belly socket (matches mouth ball) ---
  drawBall(game, ctx, 0, 32, BALL_RADIUS - 1, game.currentPaletteIndex, -angle * 1.5, 0, 0);

  ctx.restore();
}

export function drawParticles(game, ctx) {
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

// strokePath 现在接受显式的 trackPath（Path2D）参数，
// 而不是通过 game 间接读取。调用方决定绘制哪条路径。
function strokePath(ctx, trackPath) {
  ctx.stroke(trackPath);
}

export function createStaticSceneCache(game) {
  const cache = document.createElement("canvas");
  cache.width = GAME_WIDTH;
  cache.height = GAME_HEIGHT;
  const cCtx = cache.getContext("2d");

  // Layer 0: procedural gradient + tile decor. Kept as a fallback so the
  // scene still reads as "a place" when an authored background is missing,
  // fails to load, or doesn't fully cover the play area.
  drawBackground(game, cCtx);

  // Play-area clip rect.  Now that all UI is DOM overlays, no top/bottom
  // reserves needed — clip the full canvas height.
  const clipTop = 0;
  const clipBottom = GAME_HEIGHT;
  const clipH = clipBottom - clipTop;

  // Layer 1 (optional): authored background artwork from the path editor.
  // When present, it's painted over the procedural gradient using the
  // {x, y, scale} authored in the editor (which previews the runtime result
  // pixel-for-pixel). We still clip to the play area so the authored art
  // never spills onto HUD or bottom-button strips — matches the expectation
  // the editor sets with its "HUD 区域 / 按钮区域" overlays.
  const bgCfg = game.levelConfig && game.levelConfig.background;
  const bgImg = bgCfg && game.backgroundImages && game.backgroundImages[bgCfg.src];
  if (bgCfg && bgImg) {
    cCtx.save();
    cCtx.beginPath();
    cCtx.rect(0, clipTop, GAME_WIDTH, clipH);
    cCtx.clip();
    cCtx.translate(bgCfg.x || 0, bgCfg.y || 0);
    const scale = bgCfg.scale || 1;
    cCtx.scale(scale, scale);
    cCtx.drawImage(bgImg, 0, 0);
    cCtx.restore();
  }

  // Clip the track + goal to the play area so any portion of an author-drawn
  // path that strays into the HUD or bottom-button strips doesn't render on
  // top of those UI zones. Background fills the whole canvas because the HUD
  // panel draws over it later.
  cCtx.save();
  cCtx.beginPath();
  cCtx.rect(0, clipTop, GAME_WIDTH, clipH);
  cCtx.clip();
  // When an authored background supplies the track artwork, skip the
  // procedural drawTrack() — otherwise we'd paint a stone track on top of
  // the dirt path in the background image. drawGoal still runs so the
  // glowing end marker appears at the logical path terminus regardless of
  // what the art does.
  if (!(bgCfg && bgImg)) {
    // 主路径轨道
    drawTrack(game, cCtx, game.cachedTrackPath);
    // 双轨关卡：绘制第二条轨道（cachedTrackPath2 仅在双轨关卡中非空）
    if (game.cachedTrackPath2) {
      drawTrack(game, cCtx, game.cachedTrackPath2);
    }
  }
  // 主路径终点标记
  drawGoal(game, cCtx, game.pathPoints);
  // 双轨关卡：绘制第二个终点标记（pathPoints2 仅在双轨关卡中有内容）
  if (game.pathPoints2 && game.pathPoints2.length > 0) {
    drawGoal(game, cCtx, game.pathPoints2);
  }
  cCtx.restore();
  game.staticSceneCache = cache;
}
