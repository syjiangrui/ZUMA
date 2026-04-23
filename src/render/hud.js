import { GAME_WIDTH, GAME_HEIGHT, BALL_RADIUS, HUD_HEIGHT, TAU } from '../config.js';
import { drawStonePanel, fillRoundedRect, traceRoundedRect } from './draw-utils.js';
import { drawBall } from './ball-textures.js';

// Top HUD overlay (score/state/buttons), next-ball preview,
// sound toggle, restart/back buttons, and floating match feedback.

export function drawOverlay(game, ctx, hudShift = 0) {
  // Stone panel backgrounds are pre-rendered; text is drawn live.
  // On mobile, hudShift > 0 means the panel background stays at y=0 (so
  // its color extends behind the notch) while interactive elements (buttons,
  // preview ball) shift down to avoid the notch.
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
  // Panel background — always drawn at y=0 so its color extends behind
  // the notch on mobile.
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

  // Interactive elements — their rects already include hudShift from
  // game.getHudXxxRect(), so they render at the shifted position directly.
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

export function drawHudNextPreview(game, ctx) {
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

export function drawSoundButton(game, ctx) {
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

export function drawRestartButton(game, ctx, rect, label, isPressed = false) {
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

export function drawMatchFeedback(game, ctx) {
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
