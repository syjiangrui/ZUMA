// end-card.js — DOM-based round-end cards (win / lose / all-clear).
// Replaces canvas-drawn cards from src/render/screens.js.

import { LEVELS } from '../levels.js';

let overlayEl = null;
let cardEl = null;
let badgeEl = null;
let titleEl = null;
let subtitleEl = null;
let scoreLabelEl = null;
let scoreValEl = null;
let comboEl = null;
let actionsEl = null;
let allClearEl = null;
let allClearScoresEl = null;
let allClearTotalEl = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createEndCardDOM(game) {
  overlayEl = document.getElementById('endCardOverlay');
  if (!overlayEl) return;

  // --- Normal end card ---
  cardEl = document.createElement('div');
  cardEl.className = 'end-card';

  badgeEl = document.createElement('div');
  badgeEl.className = 'end-card__badge';
  cardEl.appendChild(badgeEl);

  titleEl = document.createElement('h2');
  titleEl.className = 'end-card__title';
  cardEl.appendChild(titleEl);

  subtitleEl = document.createElement('p');
  subtitleEl.className = 'end-card__subtitle';
  cardEl.appendChild(subtitleEl);

  scoreLabelEl = document.createElement('p');
  scoreLabelEl.className = 'end-card__score-label';
  scoreLabelEl.textContent = '本局得分';
  cardEl.appendChild(scoreLabelEl);

  scoreValEl = document.createElement('p');
  scoreValEl.className = 'end-card__score-value';
  cardEl.appendChild(scoreValEl);

  comboEl = document.createElement('div');
  comboEl.className = 'end-card__combo';
  cardEl.appendChild(comboEl);

  actionsEl = document.createElement('div');
  actionsEl.className = 'end-card__actions';
  cardEl.appendChild(actionsEl);

  overlayEl.appendChild(cardEl);

  // --- All-clear card ---
  allClearEl = document.createElement('div');
  allClearEl.className = 'all-clear-card';

  allClearEl.innerHTML = `
    <div class="end-card__badge">☀</div>
    <h2 class="all-clear-card__title">祭坛大捷</h2>
    <p class="all-clear-card__subtitle">全部关卡已通关</p>
    <div class="all-clear-card__scores" id="allClearScores"></div>
    <div class="all-clear-card__total">
      <div class="all-clear-card__total-label">总分</div>
      <div class="all-clear-card__total-value" id="allClearTotal"></div>
    </div>
    <div class="end-card__actions" style="margin-top:16px">
      <button class="end-card__btn end-card__btn--back" id="allClearBackBtn">返回选关</button>
    </div>
  `;
  overlayEl.appendChild(allClearEl);

  allClearScoresEl = allClearEl.querySelector('#allClearScores');
  allClearTotalEl = allClearEl.querySelector('#allClearTotal');

  // All-clear back button
  allClearEl.querySelector('#allClearBackBtn').addEventListener('click', () => {
    game.goToLevelSelect();
  });
}

/**
 * Show the normal win/lose end card. Populates data from game state.
 */
export function showEndCard(game) {
  if (!overlayEl || !cardEl) return;

  const isWin = game.gameState === 'win';
  const isAllClear = game.isAllClear();

  cardEl.classList.toggle('end-card--lose', !isWin);

  // Badge
  badgeEl.textContent = isWin ? '☀' : '✕';

  // Title + subtitle
  titleEl.textContent = isWin ? '祭坛告捷' : '试炼中断';
  subtitleEl.textContent = isWin ? '球链已被清空' : '球链抵达终点';

  // Score
  scoreValEl.textContent = game.score;

  // Combo badge
  comboEl.textContent = game.bestCombo > 1
    ? `最高连击 x${game.bestCombo}`
    : '本局未触发连击';

  // Buttons
  actionsEl.innerHTML = '';
  const isWinWithMore = isWin && game.currentLevel < LEVELS.length;

  if (isWinWithMore) {
    const nextBtn = createBtn('下一关', 'end-card__btn--primary', () => {
      game.loadLevel(game.currentLevel + 1);
    });
    actionsEl.appendChild(nextBtn);

    const retryBtn = createBtn('重玩本关', '', () => {
      game.resetRound();
    });
    actionsEl.appendChild(retryBtn);
  } else {
    const retryBtn = createBtn(isWin ? '重新开始' : '重试', 'end-card__btn--primary', () => {
      game.resetRound();
    });
    actionsEl.appendChild(retryBtn);
  }

  const backBtn = createBtn('返回选关', 'end-card__btn--back', () => {
    game.goToLevelSelect();
  });
  actionsEl.appendChild(backBtn);

  // Show
  if (isAllClear) {
    cardEl.style.display = 'none';
    showAllClear(game);
  } else {
    cardEl.style.display = '';
    allClearEl.classList.remove('is-visible');
  }

  overlayEl.classList.add('is-visible');
}

export function hideEndCard() {
  if (!overlayEl) return;
  overlayEl.classList.remove('is-visible');
  allClearEl?.classList.remove('is-visible');
  if (cardEl) cardEl.style.display = '';
}

// ---------------------------------------------------------------------------
// All-clear
// ---------------------------------------------------------------------------

function showAllClear(game) {
  if (!allClearEl || !allClearScoresEl || !allClearTotalEl) return;

  allClearScoresEl.innerHTML = '';
  let totalScore = 0;

  for (const lv of LEVELS) {
    const data = game.levelProgress.levels[lv.id];
    const score = data?.highScore ?? 0;
    totalScore += score;

    const row = document.createElement('div');
    row.className = 'all-clear-card__level-row';
    row.innerHTML = `<span>${lv.id}. ${lv.name}</span><span>${score}</span>`;
    allClearScoresEl.appendChild(row);
  }

  allClearTotalEl.textContent = totalScore;
  allClearEl.classList.add('is-visible');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBtn(label, extraClass, onClick) {
  const btn = document.createElement('button');
  btn.className = `end-card__btn ${extraClass}`.trim();
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
