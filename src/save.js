// save.js — localStorage persistence for level progress.
// The save format is versioned so future phases can migrate data.

const STORAGE_KEY = "zuma_save";
const CURRENT_VERSION = 1;

// Returns a fresh initial save state (level 1 unlocked, nothing cleared).
function createInitialSave() {
  return {
    version: CURRENT_VERSION,
    unlockedLevel: 1,
    levels: {},
  };
}

// Read save from localStorage. Returns initial state on missing/corrupt data.
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialSave();
    }
    const data = JSON.parse(raw);
    if (!data || typeof data.version !== "number" || typeof data.unlockedLevel !== "number") {
      return createInitialSave();
    }
    // Future: if data.version < CURRENT_VERSION, run migrations here.
    return data;
  } catch (e) {
    return createInitialSave();
  }
}

// Persist current progress to localStorage.
export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // Storage full or blocked — silently ignore.
  }
}

// Record a level completion: mark cleared, update high score, unlock next.
export function recordLevelClear(progress, levelId, score) {
  if (!progress.levels[levelId]) {
    progress.levels[levelId] = { cleared: false, highScore: 0 };
  }
  progress.levels[levelId].cleared = true;
  if (score > progress.levels[levelId].highScore) {
    progress.levels[levelId].highScore = score;
  }
  // Unlock the next level (if any).
  if (levelId >= progress.unlockedLevel) {
    progress.unlockedLevel = levelId + 1;
  }
  saveProgress(progress);
}

// Update high score for a level even on failure (only if higher than existing).
export function updateHighScore(progress, levelId, score) {
  if (!progress.levels[levelId]) {
    progress.levels[levelId] = { cleared: false, highScore: 0 };
  }
  if (score > progress.levels[levelId].highScore) {
    progress.levels[levelId].highScore = score;
  }
  saveProgress(progress);
}

// Wipe all progress back to initial state.
export function resetProgress() {
  const fresh = createInitialSave();
  saveProgress(fresh);
  return fresh;
}
