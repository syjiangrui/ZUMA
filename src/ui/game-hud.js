// game-hud.js — Single-row floating HUD bar for the gameplay screen.
// Layout: [level] [score] [combo] --- [next-ball] [sound] [restart] [back]

import { BALL_RADIUS } from '../config.js';
import { drawBall } from '../render/ball-textures.js';

let hudEl = null;
let titleEl = null;
let scoreValEl = null;
let comboEl = null;
let nextCanvas = null;
let nextCtx = null;
let soundBtnEl = null;
let backBtnEl = null;

// Cache last-rendered values so we only touch the DOM when something changes.
let prevScore = -1;
let prevCombo = '';
let prevLevel = -1;
let prevNextPalette = -1;
let prevMuted = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createGameHudDOM(game) {
  hudEl = document.getElementById('gameHud');
  if (!hudEl) return;

  // --- Left: info section ---
  const infoGroup = document.createElement('div');
  infoGroup.className = 'game-hud__info';

  titleEl = document.createElement('span');
  titleEl.className = 'game-hud__title';
  infoGroup.appendChild(titleEl);

  // Separator dot
  const sep1 = document.createElement('span');
  sep1.className = 'game-hud__sep';
  sep1.textContent = '·';
  infoGroup.appendChild(sep1);

  scoreValEl = document.createElement('span');
  scoreValEl.className = 'game-hud__score-val';
  infoGroup.appendChild(scoreValEl);

  // Separator dot
  const sep2 = document.createElement('span');
  sep2.className = 'game-hud__sep';
  sep2.textContent = '·';
  infoGroup.appendChild(sep2);

  comboEl = document.createElement('span');
  comboEl.className = 'game-hud__combo';
  infoGroup.appendChild(comboEl);

  hudEl.appendChild(infoGroup);

  // --- Right: action buttons ---
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'game-hud__actions';

  // Next-ball preview
  const nextWrap = document.createElement('div');
  nextWrap.className = 'game-hud__next';
  nextCanvas = document.createElement('canvas');
  nextCanvas.width = 36;
  nextCanvas.height = 36;
  nextCtx = nextCanvas.getContext('2d');
  nextWrap.appendChild(nextCanvas);
  actionsGroup.appendChild(nextWrap);

  // Sound button
  soundBtnEl = document.createElement('button');
  soundBtnEl.className = 'game-hud__btn game-hud__btn--icon';
  soundBtnEl.setAttribute('aria-label', '切换声音');
  soundBtnEl.addEventListener('click', () => {
    game.sfx.unlock();
    game.sfx.toggleMute();
    syncSoundBtn(game);
  });
  actionsGroup.appendChild(soundBtnEl);

  // Restart button
  const restartBtn = document.createElement('button');
  restartBtn.className = 'game-hud__btn game-hud__btn--icon';
  restartBtn.textContent = '↻';  // ↻ restart symbol
  restartBtn.setAttribute('aria-label', '重新开始');
  restartBtn.addEventListener('click', () => {
    game.resetRound();
  });
  actionsGroup.appendChild(restartBtn);

  // Back/level-select button — now inside the HUD bar, not on <body>
  backBtnEl = document.createElement('button');
  backBtnEl.className = 'game-hud__btn game-hud__btn--icon';
  backBtnEl.textContent = '☰';  // ☰ menu symbol
  backBtnEl.setAttribute('aria-label', '返回选关');
  backBtnEl.addEventListener('click', () => {
    game.goToLevelSelect();
  });
  actionsGroup.appendChild(backBtnEl);

  hudEl.appendChild(actionsGroup);
}

/**
 * Per-frame update: sync DOM text with game state. Only touches the DOM when
 * values have actually changed (avoids layout thrashing).
 */
export function updateGameHud(game) {
  if (!hudEl) return;

  const levelName = game.levelConfig?.name ?? '祭坛试炼';
  const levelNum = game.currentLevel ?? 1;

  // Title (only update on level change)
  if (prevLevel !== levelNum) {
    titleEl.textContent = `${levelName}`;
    prevLevel = levelNum;
  }

  // Score
  if (prevScore !== game.score) {
    scoreValEl.textContent = game.score;
    prevScore = game.score;
  }

  // Combo
  const comboText = game.getComboHudText();
  if (prevCombo !== comboText) {
    comboEl.textContent = comboText;
    prevCombo = comboText;
  }

  // Sound button state
  syncSoundBtn(game);

  // Next-ball preview (mini canvas)
  if (nextCtx && prevNextPalette !== game.nextPaletteIndex) {
    prevNextPalette = game.nextPaletteIndex;
    renderNextBall(game);
  }
}

export function showGameHud() {
  if (hudEl) hudEl.classList.add('is-visible');
  resetCache();
}

export function hideGameHud() {
  if (hudEl) hudEl.classList.remove('is-visible');
}

/**
 * No-op — layout is fully CSS-driven, no JS positioning needed.
 */
export function layoutGameHud(game) {}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resetCache() {
  prevScore = -1;
  prevCombo = '';
  prevLevel = -1;
  prevNextPalette = -1;
  prevMuted = null;
}

function syncSoundBtn(game) {
  if (!soundBtnEl) return;
  const muted = game.sfx.muted;
  if (prevMuted !== muted) {
    soundBtnEl.textContent = muted ? '🔇' : '🔊';
    prevMuted = muted;
  }
}

function renderNextBall(game) {
  if (!nextCtx) return;
  const size = 36;
  nextCtx.clearRect(0, 0, size, size);
  drawBall(
    game,
    nextCtx,
    size / 2,
    size / 2,
    BALL_RADIUS - 2,
    game.nextPaletteIndex,
    0,
  );
}
