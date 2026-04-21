import { GAME_WIDTH, GAME_HEIGHT, BALL_RADIUS, HUD_HEIGHT, BOTTOM_BUTTON_HEIGHT, TAU, BALL_PALETTES } from '../config.js';
import { drawStonePanel, fillRoundedRect, traceRoundedRect } from './draw-utils.js';
import { drawRestartButton, drawSoundButton } from './hud.js';

// End-of-round cards, all-clear screen, and level select screen.

export function drawRoundStateCard(game, ctx) {
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

export function drawLevelSelectScreen(game, ctx) {
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

export function drawAllClearScreen(game, ctx) {
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
