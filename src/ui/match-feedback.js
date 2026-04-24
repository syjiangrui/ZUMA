// match-feedback.js — DOM-based floating score feedback popup.
// Replaces canvas-drawn drawMatchFeedback() from src/render/hud.js.

let feedbackEl = null;
let scoreEl = null;
let detailEl = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createMatchFeedbackDOM() {
  feedbackEl = document.getElementById('matchFeedback');
  if (!feedbackEl) return;

  scoreEl = document.createElement('div');
  scoreEl.className = 'match-feedback__score';
  feedbackEl.appendChild(scoreEl);

  detailEl = document.createElement('div');
  detailEl.className = 'match-feedback__detail';
  feedbackEl.appendChild(detailEl);
}

/**
 * Show the match feedback popup with score delta and description.
 * Each call re-triggers the CSS animation by removing and re-adding the class.
 * @param {{ scoreDelta: number, combo: number, removedCount: number, label: string }} data
 */
export function showMatchFeedback(data) {
  if (!feedbackEl) return;

  scoreEl.textContent = `+${data.scoreDelta}`;
  detailEl.textContent = data.label || `消除 ${data.removedCount} 颗`;

  // High combo gold border
  feedbackEl.classList.toggle('is-combo-high', (data.combo || 0) > 2);

  // Re-trigger animation: remove class, force reflow, add class
  feedbackEl.classList.remove('is-visible');
  // eslint-disable-next-line no-unused-expressions
  feedbackEl.offsetHeight; // force reflow
  feedbackEl.classList.add('is-visible');
}

export function hideMatchFeedback() {
  if (!feedbackEl) return;
  feedbackEl.classList.remove('is-visible');
}
