// level-select.js — DOM-based level selection screen.
// Replaces the canvas-drawn level select from src/render/screens.js.

import { BALL_PALETTES } from '../config.js';
import { LEVELS } from '../levels.js';
import { resetProgress } from '../save.js';

// Module-level refs so show/hide don't need to query the DOM each time.
let containerEl = null;
let gridEl = null;
let soundBtnEl = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the level-select DOM tree and wire up event listeners.
 * Called once from ZumaGame constructor.
 */
export function createLevelSelectDOM(game) {
  containerEl = document.getElementById('levelSelect');
  if (!containerEl) return;

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'level-select__header';
  header.innerHTML = `
    <h1 class="level-select__title">祭坛试炼</h1>
    <p class="level-select__subtitle">选择关卡</p>
    <hr class="level-select__divider" />
  `;
  containerEl.appendChild(header);

  // --- Stone slab body (the bottom ~80% with the grey stone gradient) ---
  const body = document.createElement('div');
  body.className = 'level-select__body';

  // --- Grid of level cards ---
  gridEl = document.createElement('div');
  gridEl.className = 'level-select__grid';
  gridEl.id = 'levelGrid';

  for (const level of LEVELS) {
    const card = createLevelCard(level);
    card.addEventListener('click', () => {
      game.sfx.unlock();
      game.loadLevel(level.id);
    });
    gridEl.appendChild(card);
  }
  body.appendChild(gridEl);

  // --- Footer (sound + reset) ---
  const footer = document.createElement('div');
  footer.className = 'level-select__footer';

  // Sound toggle
  soundBtnEl = document.createElement('button');
  soundBtnEl.className = 'stone-btn stone-btn--small level-select__sound-btn';
  soundBtnEl.setAttribute('aria-label', '切换声音');
  soundBtnEl.addEventListener('click', () => {
    game.sfx.unlock();
    game.sfx.toggleMute();
    updateSoundButtonState(game);
  });
  footer.appendChild(soundBtnEl);

  // Reset progress
  const resetBtn = document.createElement('button');
  resetBtn.className = 'stone-btn stone-btn--danger stone-btn--small';
  resetBtn.textContent = '重置进度';
  resetBtn.addEventListener('click', () => {
    game.levelProgress = resetProgress();
    refreshLevelCards(game);
  });
  footer.appendChild(resetBtn);

  body.appendChild(footer);
  containerEl.appendChild(body);
}

/**
 * Show the level-select screen and refresh all card states.
 */
export function showLevelSelect(game) {
  if (!containerEl) return;
  refreshLevelCards(game);
  updateSoundButtonState(game);
  containerEl.classList.add('is-visible');
}

/**
 * Hide the level-select screen.
 */
export function hideLevelSelect() {
  if (!containerEl) return;
  containerEl.classList.remove('is-visible');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createLevelCard(level) {
  const btn = document.createElement('button');
  btn.className = 'level-card';
  btn.dataset.levelId = level.id;

  btn.innerHTML = `
    <span class="level-card__number">${level.id}</span>
    <span class="level-card__name">${level.name}</span>
    <span class="level-card__status"></span>
    <span class="level-card__score"></span>
    <span class="level-card__dots"></span>
  `;

  return btn;
}

/**
 * Refresh every level card's visual state (cleared / score / color dots).
 */
function refreshLevelCards(game) {
  if (!gridEl) return;

  const cards = gridEl.querySelectorAll('.level-card');
  for (const card of cards) {
    const id = Number(card.dataset.levelId);
    const level = LEVELS.find(l => l.id === id);
    if (!level) continue;

    const levelData = game.levelProgress.levels[id];
    const isCleared = levelData?.cleared ?? false;
    const highScore = levelData?.highScore ?? 0;

    // Card modifier class
    card.classList.toggle('level-card--cleared', isCleared);

    // Status
    const statusEl = card.querySelector('.level-card__status');
    if (isCleared) {
      statusEl.textContent = '✓ 已通关';
      statusEl.className = 'level-card__status level-card__status--cleared';
    } else {
      statusEl.textContent = '未通关';
      statusEl.className = 'level-card__status level-card__status--pending';
    }

    // High score
    const scoreEl = card.querySelector('.level-card__score');
    scoreEl.textContent = highScore > 0 ? `最高分: ${highScore}` : '';

    // Color dots
    const dotsEl = card.querySelector('.level-card__dots');
    dotsEl.innerHTML = '';
    for (let d = 0; d < level.colorCount; d++) {
      const dot = document.createElement('span');
      dot.className = 'level-card__dot';
      dot.style.backgroundColor = BALL_PALETTES[d % BALL_PALETTES.length].base;
      dotsEl.appendChild(dot);
    }
  }
}

function updateSoundButtonState(game) {
  if (!soundBtnEl) return;
  soundBtnEl.textContent = game.sfx.muted ? '🔇 声音' : '🔊 声音';
}
