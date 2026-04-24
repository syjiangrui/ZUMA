// game-hud.js — DOM-based HUD overlay for the gameplay screen.
// Replaces canvas-drawn HUD from src/render/hud.js (drawOverlay).

import { BALL_RADIUS, TAU } from '../config.js';
import { drawBall } from '../render/ball-textures.js';

let hudEl = null;
let titleEl = null;
let subtitleEl = null;
let statusDotEl = null;
let statusLabelEl = null;
let chainLenEl = null;
let scoreLabelEl = null;
let scoreValEl = null;
let comboEl = null;
let nextCanvas = null;
let nextCtx = null;
let backBtnEl = null;

// Cache last-rendered values so we only touch the DOM when something changes.
let prevScore = -1;
let prevChainLen = -1;
let prevCombo = '';
let prevState = '';
let prevLevel = -1;
let prevNextPalette = -1;
let prevMuted = null;

let soundBtnEl = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createGameHudDOM(game) {
  hudEl = document.getElementById('gameHud');
  if (!hudEl) return;

  // --- Main stone panel ---
  const panel = document.createElement('div');
  panel.className = 'game-hud__panel';

  const content = document.createElement('div');
  content.className = 'game-hud__content';

  // Title
  titleEl = document.createElement('h2');
  titleEl.className = 'game-hud__title';
  content.appendChild(titleEl);

  // Subtitle
  subtitleEl = document.createElement('p');
  subtitleEl.className = 'game-hud__subtitle';
  content.appendChild(subtitleEl);

  // Status + chain row
  const statusRow = document.createElement('div');
  statusRow.className = 'game-hud__row';

  const statusPanel = document.createElement('div');
  statusPanel.className = 'game-hud__sub-panel';
  statusDotEl = document.createElement('span');
  statusDotEl.className = 'game-hud__dot';
  statusLabelEl = document.createElement('span');
  statusPanel.appendChild(statusDotEl);
  statusPanel.appendChild(statusLabelEl);
  statusRow.appendChild(statusPanel);

  const chainPanel = document.createElement('div');
  chainPanel.className = 'game-hud__sub-panel';
  const chainLabel = document.createElement('span');
  chainLabel.textContent = '链长';
  chainLenEl = document.createElement('span');
  chainLenEl.className = 'game-hud__value';
  chainPanel.appendChild(chainLabel);
  chainPanel.appendChild(chainLenEl);
  statusRow.appendChild(chainPanel);

  content.appendChild(statusRow);

  // Score + combo row
  const scoreRow = document.createElement('div');
  scoreRow.className = 'game-hud__score-row';
  scoreLabelEl = document.createElement('span');
  scoreLabelEl.className = 'game-hud__label';
  scoreLabelEl.textContent = '分数';
  scoreValEl = document.createElement('span');
  scoreValEl.className = 'game-hud__score-val';
  comboEl = document.createElement('span');
  comboEl.className = 'game-hud__combo';
  scoreRow.appendChild(scoreLabelEl);
  scoreRow.appendChild(scoreValEl);
  scoreRow.appendChild(comboEl);
  content.appendChild(scoreRow);

  panel.appendChild(content);
  hudEl.appendChild(panel);

  // --- Right-side buttons ---
  const btns = document.createElement('div');
  btns.className = 'game-hud__buttons';

  // Next-ball preview
  const nextWrap = document.createElement('div');
  nextWrap.className = 'game-hud__next';
  nextCanvas = document.createElement('canvas');
  nextCanvas.width = 36;
  nextCanvas.height = 36;
  nextCtx = nextCanvas.getContext('2d');
  nextWrap.appendChild(nextCanvas);
  btns.appendChild(nextWrap);

  // Sound button
  soundBtnEl = document.createElement('button');
  soundBtnEl.className = 'game-hud__btn game-hud__btn--sound';
  soundBtnEl.setAttribute('aria-label', '切换声音');
  soundBtnEl.addEventListener('click', () => {
    game.sfx.unlock();
    game.sfx.toggleMute();
    syncSoundBtn(game);
  });
  btns.appendChild(soundBtnEl);

  // Restart button
  const restartBtn = document.createElement('button');
  restartBtn.className = 'game-hud__btn';
  restartBtn.textContent = '重开';
  restartBtn.addEventListener('click', () => {
    game.resetRound();
  });
  btns.appendChild(restartBtn);

  hudEl.appendChild(btns);

  // --- Back/level-select button (bottom-left of viewport) ---
  // Appended to <body> with position:fixed so it's independent of the
  // game-ui transform scaling.
  backBtnEl = document.createElement('button');
  backBtnEl.className = 'game-hud__btn game-hud__back';
  backBtnEl.textContent = '选关';
  backBtnEl.style.display = 'none';
  backBtnEl.addEventListener('click', () => {
    game.goToLevelSelect();
  });
  document.body.appendChild(backBtnEl);
}

/**
 * Per-frame update: sync DOM text with game state. Only touches the DOM when
 * values have actually changed (avoids layout thrashing).
 */
export function updateGameHud(game) {
  if (!hudEl) return;

  const levelName = game.levelConfig?.name ?? '祭坛试炼';
  const levelNum = game.currentLevel ?? 1;

  // Title + subtitle (only update on level change)
  if (prevLevel !== levelNum) {
    titleEl.textContent = levelName;
    subtitleEl.textContent = `第 ${levelNum} 关 · 祭坛试炼`;
    prevLevel = levelNum;
  }

  // State dot + label
  const state = game.gameState;
  if (prevState !== state) {
    statusDotEl.className = 'game-hud__dot' +
      (state === 'win' ? ' game-hud__dot--win' :
       state === 'lose' ? ' game-hud__dot--lose' : '');
    statusLabelEl.textContent = game.getGameStateLabel();
    prevState = state;
  }

  // Chain length
  const chainLen = game.chain.length;
  if (prevChainLen !== chainLen) {
    chainLenEl.textContent = chainLen;
    prevChainLen = chainLen;
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
  if (backBtnEl) backBtnEl.style.display = '';
  resetCache();
}

export function hideGameHud() {
  if (hudEl) hudEl.classList.remove('is-visible');
  if (backBtnEl) backBtnEl.style.display = 'none';
}

/**
 * No-op — back button is now position:fixed via CSS, no JS layout needed.
 */
export function layoutGameHud(game) {}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resetCache() {
  prevScore = -1;
  prevChainLen = -1;
  prevCombo = '';
  prevState = '';
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
