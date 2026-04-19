# Phase 4: Multi-Level Game Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-level Zuma prototype into an 8-level complete game with level selection, difficulty progression, multiple path shapes, and local save/load.

**Architecture:** The game gains a `levels.js` module defining per-level configs and a `save.js` module for localStorage persistence. `path.js` becomes a dispatcher routing to 4 path generators (spiral, serpentine, rectangular, zigzag). `main.js` gains a `"levelSelect"` game state and level management. `render.js` gains level-select screen, all-clear screen, and path thumbnail drawing. Rule-layer modules (chain.js, match.js, projectile.js) remain untouched.

**Tech Stack:** Vanilla JavaScript ES modules, Canvas 2D, localStorage

---

## File Structure

### New files
- `levels.js` — Level configuration array (id, name, chainCount, chainSpeed, colorCount, pathType, pathParams, shooterPos, goalPos)
- `save.js` — localStorage read/write/reset/migration for level progress

### Modified files
- `config.js` — No changes to existing constants; they become fallback defaults
- `path.js` — `createPath()` becomes a dispatcher; extract current spiral into `generateSpiralPath()`; add `generateSerpentinePath()`, `generateRectangularPath()`, `generateZigzagPath()`
- `chain.js` — `createChain()` reads `game.levelConfig.chainCount` and `game.levelConfig.colorCount` instead of `START_CHAIN_COUNT` and hardcoded `4`
- `main.js` — New fields (`currentLevel`, `levelProgress`, `levelConfig`); new state `"levelSelect"`; `resetRound()` applies level config; `setGameState()` handles level transitions; new UI hit-testing for level-select and back-to-select button
- `render.js` — New functions: `drawLevelSelectScreen()`, `drawLevelButton()`, `drawAllClearScreen()`, `drawPathThumbnail()`, `drawBackButton()`; modify `render()` to branch on `"levelSelect"` state; modify `drawOverlay()` to add back button; modify `drawRoundStateCard()` to show "next level" / "back to select" buttons

---

## Task 1: Create `levels.js` with 8-level configuration array

**Files:**
- Create: `levels.js`

This is the foundational data module. All 8 levels start with `pathType: "spiral"` (parameterized variants). Path types will be swapped to diverse shapes in Task 9.

- [ ] **Step 1: Create `levels.js` with the full 8-level config array**

```javascript
// levels.js — Per-level configuration for the 8-level game.
// Each level overrides the global defaults from config.js.
// pathType + pathParams are consumed by path.js to generate the track.

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';

export const LEVELS = [
  {
    id: 1,
    name: "石阶祭坛",
    chainCount: 20,
    chainSpeed: 52,
    colorCount: 3,
    pathType: "spiral",
    pathParams: { turnCount: 2.2, outerRadius: 190, innerRadius: 84, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 2,
    name: "密林通道",
    chainCount: 24,
    chainSpeed: 58,
    colorCount: 3,
    pathType: "spiral",
    pathParams: { turnCount: 2.4, outerRadius: 196, innerRadius: 80, startAngle: 1.2 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 3,
    name: "月牙河谷",
    chainCount: 28,
    chainSpeed: 64,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.5, outerRadius: 200, innerRadius: 78, startAngle: 0.7 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 4,
    name: "祭司回廊",
    chainCount: 30,
    chainSpeed: 68,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.6, outerRadius: 204, innerRadius: 82, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 5,
    name: "羽蛇阶梯",
    chainCount: 32,
    chainSpeed: 72,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.7, outerRadius: 206, innerRadius: 80, startAngle: 1.1 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 6,
    name: "太阳神殿",
    chainCount: 35,
    chainSpeed: 76,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 2.8, outerRadius: 208, innerRadius: 78, startAngle: 0.8 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 7,
    name: "星象迷宫",
    chainCount: 38,
    chainSpeed: 80,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 3.0, outerRadius: 210, innerRadius: 76, startAngle: 0.6 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 8,
    name: "黄金祭坛",
    chainCount: 42,
    chainSpeed: 86,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 3.2, outerRadius: 212, innerRadius: 74, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
];

// Helper: get level config by id, or null if not found.
export function getLevelById(id) {
  return LEVELS.find(level => level.id === id) || null;
}
```

- [ ] **Step 2: Verify the module loads without errors**

Run: Open browser console after starting `python3 -m http.server 8000`. Temporarily add `import { LEVELS } from './levels.js'; console.log('LEVELS loaded:', LEVELS.length);` to the top of `main.js` (after existing imports). Verify console shows `LEVELS loaded: 8` with no import errors.

Remove the temporary console.log line after verifying.

- [ ] **Step 3: Commit**

```bash
git add levels.js
git commit -m "feat: add levels.js with 8-level configuration array"
```

---

## Task 2: Create `save.js` for localStorage persistence

**Files:**
- Create: `save.js`

The save module is a standalone utility with no game-state dependency. It reads/writes a versioned JSON blob to localStorage.

- [ ] **Step 1: Create `save.js`**

```javascript
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
```

- [ ] **Step 2: Verify the module loads**

Temporarily add `import { loadProgress } from './save.js'; console.log('save loaded:', loadProgress());` to `main.js`. Verify console shows the initial save object. Remove the temporary line.

- [ ] **Step 3: Commit**

```bash
git add save.js
git commit -m "feat: add save.js for localStorage level progress persistence"
```

---

## Task 3: Wire level config into `main.js` game state

**Files:**
- Modify: `main.js`

This task adds `levelConfig`, `currentLevel`, and `levelProgress` to ZumaGame and makes `resetRound()` read from the level config. The game still starts directly in `"playing"` with level 1 — the level-select screen comes in Task 5.

- [ ] **Step 1: Add imports for levels.js and save.js at top of main.js**

In `main.js`, add these imports after the existing `import { render ... } from './render.js';` line:

```javascript
import { LEVELS, getLevelById } from './levels.js';
import { loadProgress, saveProgress, recordLevelClear, updateHighScore, resetProgress } from './save.js';
```

- [ ] **Step 2: Add new fields to ZumaGame constructor**

In the `constructor(canvas)` method of `ZumaGame`, add these fields after the `this.chainIntro = null;` line and before `this.lastTime = 0;`:

```javascript
    // Level management — added in Phase 4.
    this.levelProgress = loadProgress();
    this.currentLevel = 1;
    this.levelConfig = getLevelById(1);
```

- [ ] **Step 3: Modify `resetRound()` to apply level config**

Replace the existing `resetRound()` method with:

```javascript
  resetRound() {
    // Apply level config (or fall back to defaults for backward compatibility).
    const cfg = this.levelConfig;
    if (cfg && cfg.shooterPos) {
      this.shooter.x = cfg.shooterPos.x;
      this.shooter.y = cfg.shooterPos.y;
    }

    this.setGameState("playing");
    this.projectile = null;
    this.splitState = null;
    this.pendingMatchChecks = [];
    this.nextBallId = 1;
    this.nextActionId = 1;
    this.actionContexts.clear();
    this.matchFeedback = null;
    this.recentCombo = null;
    this.bestCombo = 0;
    this.mergeSettle = null;
    this.chainIntro = null;
    this.particles = [];
    this.roundEndTimer = 0;
    this.screenShake = 0;
    this.score = 0;
    this.currentPaletteIndex = this.getRandomPaletteIndex();
    this.nextPaletteIndex = this.getRandomPaletteIndex();
    this.shooter.angle = -Math.PI / 2;
    this.pointer.active = false;
    this.pointer.x = this.shooter.x + 90;
    this.pointer.y = this.shooter.y - 120;

    // Rebuild path for this level (path shape/params may differ per level).
    this.createPath();
    // Invalidate cached rendering that depends on the path.
    this.hudPanelCache = null;
    this.staticSceneCache = null;

    this.createChain();
  }
```

- [ ] **Step 4: Add `loadLevel()` helper method**

Add this method to `ZumaGame`, after `resetRound()`:

```javascript
  // Switch to a specific level and start a fresh round.
  loadLevel(levelId) {
    const cfg = getLevelById(levelId);
    if (!cfg) {
      return;
    }
    this.currentLevel = levelId;
    this.levelConfig = cfg;
    this.resetRound();
  }
```

- [ ] **Step 5: Modify `getRandomPaletteIndex()` to respect level colorCount**

Replace the existing `getRandomPaletteIndex()` method with:

```javascript
  getRandomPaletteIndex() {
    const colorCount = this.levelConfig?.colorCount ?? 4;
    return Math.floor(Math.random() * colorCount);
  }
```

- [ ] **Step 6: Modify `createPath()` to pass level config to path.js**

Replace the existing `createPath()` method with:

```javascript
  createPath() {
    const cfg = this.levelConfig;
    const pathType = cfg?.pathType ?? "spiral";
    const pathParams = cfg?.pathParams ?? {};
    const pathData = createPathFn(this.shooter.x, this.shooter.y, pathType, pathParams);
    this.pathPoints = pathData.pathPoints;
    this.totalPathLength = pathData.totalPathLength;
    this.cachedTrackPath = pathData.cachedTrackPath;
  }
```

- [ ] **Step 7: Update constructor to call `createTextures` after `resetRound` builds the path**

The constructor currently calls `createPath()` then `createTextures()` then `resetRound()`. Since `resetRound()` now calls `createPath()` internally, we need to reorder. Replace the constructor's initialization block (lines `this.createPath()` through `requestAnimationFrame(...)`) with:

```javascript
    this.createTextures();
    this.resetRound();
    this.bindEvents();
    this.resize();
    requestAnimationFrame((time) => this.loop(time));
```

Note: Remove the standalone `this.createPath();` call that was before `this.createTextures()`. The `resetRound()` → `createPath()` flow now handles path creation. `createTextures()` only needs to run once (it creates ball textures and frog cache, which are path-independent). The `staticSceneCache` will be lazily rebuilt by `render()` since `resetRound()` sets it to null.

- [ ] **Step 8: Remove `createStaticSceneCache` from `createTextures` in render.js**

In `render.js`, in the `createTextures(game)` function, remove the `createStaticSceneCache(game);` call. The static scene cache is now lazily created in `render()` when it detects `game.staticSceneCache` is null. This is necessary because in `"levelSelect"` state no path data exists yet.

Replace:
```javascript
export function createTextures(game) {
  game.ballPatterns = BALL_PALETTES.map((palette, index) =>
    createBallPatternCanvas(
      palette,
      TEMPLE_GLYPH_VARIANTS[index % TEMPLE_GLYPH_VARIANTS.length],
    ),
  );
  createBallRenderCache(game);
  createFrogCache(game);
  createStaticSceneCache(game);
}
```

with:

```javascript
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
```

- [ ] **Step 9: Make `render()` in render.js handle null staticSceneCache**

In `render.js`, in the `render(game)` function, replace:

```javascript
  // Static scene (background + track + goal) is pre-rendered once
  ctx.drawImage(game.staticSceneCache, 0, 0);
```

with:

```javascript
  // Static scene (background + track + goal) — rebuilt when path changes
  if (!game.staticSceneCache) {
    createStaticSceneCache(game);
  }
  ctx.drawImage(game.staticSceneCache, 0, 0);
```

- [ ] **Step 10: Verify the game still works**

Run: `python3 -m http.server 8000`, open browser. The game should load and play exactly as before (level 1 config matches the old defaults). Try playing a round — fire, match, win/lose, restart. All should work unchanged.

- [ ] **Step 11: Commit**

```bash
git add main.js render.js
git commit -m "feat: wire level config into ZumaGame state and resetRound"
```

---

## Task 4: Make chain.js read from level config

**Files:**
- Modify: `chain.js`

Currently `createChain()` hardcodes `START_CHAIN_COUNT` and `index % 4` for colors. It needs to read from `game.levelConfig`.

- [ ] **Step 1: Modify `createChain()` to use level config**

In `chain.js`, replace the existing `createChain` function body:

```javascript
export function createChain(game) {
  const chainCount = game.levelConfig?.chainCount ?? START_CHAIN_COUNT;
  const colorCount = game.levelConfig?.colorCount ?? 4;
  game.chain = Array.from({ length: chainCount }, (_, index) =>
    createChainBall(game, index % colorCount),
  );

  const targetHeadS =
    (game.chain.length - 1) * BALL_SPACING + CHAIN_ENTRY_TAIL_S;
  game.chainHeadS = CHAIN_ENTRY_START_HEAD_S;
  game.chainIntro = {
    targetHeadS,
  };
  game.splitState = null;
  game.pendingMatchChecks = [];
  syncChainPositions(game);
}
```

- [ ] **Step 2: Modify `advanceChainBaseline()` to use level config for chain speed**

In `chain.js`, in the `advanceChainBaseline` function, replace:

```javascript
  game.chainHeadS += CHAIN_SPEED * dt * getChainSpeedScale(game);
```

with:

```javascript
  const speed = game.levelConfig?.chainSpeed ?? CHAIN_SPEED;
  game.chainHeadS += speed * dt * getChainSpeedScale(game);
```

- [ ] **Step 3: Verify level 1 plays correctly**

Run: Open browser, play a round. Verify that level 1 starts with 20 balls (not the old 30), moves at speed 52 (noticeably slower than old 72), and uses 3 colors. This confirms the level config is being read.

- [ ] **Step 4: Commit**

```bash
git add chain.js
git commit -m "feat: chain.js reads chainCount, colorCount, chainSpeed from level config"
```

---

## Task 5: Refactor `path.js` to accept pathType and pathParams

**Files:**
- Modify: `path.js`

The current `createPath()` hardcodes spiral parameters. We refactor it to accept `pathType` and `pathParams`, with the current spiral as the `"spiral"` type. New path types (serpentine, rectangular, zigzag) will be added in Task 9.

- [ ] **Step 1: Refactor `createPath()` signature and extract spiral generator**

Replace the entire `createPath` function in `path.js` with:

```javascript
// Build the track geometry. pathType selects the curve family; pathParams
// tunes it. Returns { pathPoints, totalPathLength, cachedTrackPath }.
export function createPath(shooterX, shooterY, pathType = "spiral", pathParams = {}) {
  let sampled;

  switch (pathType) {
    case "spiral":
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
    // Future path types will be added here (serpentine, rectangular, zigzag).
    default:
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
  }

  return finalizePath(sampled);
}

// Shared post-processing: compute cumulative arc lengths and build Path2D cache.
function finalizePath(sampled) {
  let total = 0;
  const pathPoints = sampled.map((point, index) => {
    if (index > 0) {
      const prev = sampled[index - 1];
      total += Math.hypot(point.x - prev.x, point.y - prev.y);
    }
    return { x: point.x, y: point.y, len: total };
  });

  const totalPathLength = total;

  const cachedTrackPath = new Path2D();
  cachedTrackPath.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i += 1) {
    cachedTrackPath.lineTo(pathPoints[i].x, pathPoints[i].y);
  }

  return { pathPoints, totalPathLength, cachedTrackPath };
}

// Archimedean spiral with off-screen entry segment — the original path type.
function generateSpiralPath(shooterX, shooterY, params = {}) {
  const centerX = (params.centerX ?? shooterX) + 11;
  const centerY = (params.centerY ?? shooterY) + 8;
  const outerRadius = params.outerRadius ?? 206;
  const innerRadius = params.innerRadius ?? 84;
  const startAngle = params.startAngle ?? 0.96;
  const turnCount = params.turnCount ?? 2.6;
  const endAngle = startAngle + TAU * turnCount;
  const spiralSampleCount = 560;
  const spiralPoints = [];

  for (let step = 0; step <= spiralSampleCount; step += 1) {
    const t = step / spiralSampleCount;
    const theta = startAngle + (endAngle - startAngle) * t;
    const radius = outerRadius + (innerRadius - outerRadius) * t;
    spiralPoints.push({
      x: centerX + Math.cos(theta) * radius,
      y: centerY + Math.sin(theta) * radius,
    });
  }

  // Off-screen entry segment (cubic Bezier approach joining the spiral tangentially)
  const joinPoint = spiralPoints[0];
  const nextPoint = spiralPoints[1];
  const tangentLength = Math.hypot(
    nextPoint.x - joinPoint.x,
    nextPoint.y - joinPoint.y,
  ) || 1;
  const tangentX = (nextPoint.x - joinPoint.x) / tangentLength;
  const tangentY = (nextPoint.y - joinPoint.y) / tangentLength;

  const entryStart = {
    x: GAME_WIDTH + 96,
    y: joinPoint.y + 22,
  };
  const entryControl1 = {
    x: GAME_WIDTH + 42,
    y: joinPoint.y + 18,
  };
  const entryControl2 = {
    x: joinPoint.x - tangentX * 120,
    y: joinPoint.y - tangentY * 120,
  };

  const sampled = [];
  const entrySampleCount = 56;
  for (let step = 0; step < entrySampleCount; step += 1) {
    const t = step / entrySampleCount;
    const inv = 1 - t;
    sampled.push({
      x:
        inv * inv * inv * entryStart.x +
        3 * inv * inv * t * entryControl1.x +
        3 * inv * t * t * entryControl2.x +
        t * t * t * joinPoint.x,
      y:
        inv * inv * inv * entryStart.y +
        3 * inv * inv * t * entryControl1.y +
        3 * inv * t * t * entryControl2.y +
        t * t * t * joinPoint.y,
    });
  }

  sampled.push(...spiralPoints);
  return sampled;
}
```

- [ ] **Step 2: Verify existing game still works identically**

Run: Open browser, play. The spiral should look and behave exactly the same as before since all default parameter values match the old hardcoded constants.

- [ ] **Step 3: Commit**

```bash
git add path.js
git commit -m "refactor: path.js accepts pathType/pathParams, extract spiral generator"
```

---

## Task 6: Add `"levelSelect"` game state and level-select UI

**Files:**
- Modify: `main.js`
- Modify: `render.js`

This is the largest task. It adds the level-select screen, modifies the game startup to show level-select first, and wires up all the level transition flows (win → next/back, lose → retry/back).

- [ ] **Step 1: Add level-select state and navigation methods to main.js**

In `main.js`, add these methods to ZumaGame after the `loadLevel()` method:

```javascript
  // Enter the level-select screen. Clears gameplay state.
  goToLevelSelect() {
    this.gameState = "levelSelect";
    this.projectile = null;
    this.chain = [];
    this.particles = [];
    this.splitState = null;
    this.pendingMatchChecks = [];
    this.pointer.active = false;
    this.hudPanelCache = null;
  }

  // Called when the player wins a level.
  onLevelWin() {
    recordLevelClear(this.levelProgress, this.currentLevel, this.score);
  }

  // Called when the player loses a level.
  onLevelLose() {
    updateHighScore(this.levelProgress, this.currentLevel, this.score);
  }
```

- [ ] **Step 2: Modify `setGameState()` to call win/lose handlers**

Replace the existing `setGameState()` method with:

```javascript
  setGameState(nextState) {
    this.gameState = nextState;
    if (nextState !== "playing") {
      this.pointer.active = false;
      this.projectile = null;
      this.roundEndTimer = 0;
      if (nextState === "win") {
        this.spawnVictoryParticles();
        this.sfx.playWin();
        this.onLevelWin();
      } else if (nextState === "lose") {
        this.sfx.playLose();
        this.onLevelLose();
      }
    }
  }
```

- [ ] **Step 3: Modify constructor to start at level-select**

In the constructor, replace:

```javascript
    this.createTextures();
    this.resetRound();
```

with:

```javascript
    this.createTextures();
    this.goToLevelSelect();
```

- [ ] **Step 4: Modify `update()` to skip gameplay logic in levelSelect state**

In `main.js`, modify the `update(dt)` method. Add this check at the very top, before `this.updateHudState(dt)`:

```javascript
    if (this.gameState === "levelSelect") {
      return;
    }
```

- [ ] **Step 5: Modify `isRoundPlaying()` to also exclude levelSelect**

No change needed — `isRoundPlaying()` already checks `gameState === "playing"`, which excludes `"levelSelect"`.

- [ ] **Step 6: Add UI rect helpers for level-select and end-card navigation**

Add these methods to `ZumaGame`:

```javascript
  // Level select button rects — 2 columns x 4 rows grid layout
  getLevelButtonRect(levelId) {
    const col = (levelId - 1) % 2;
    const row = Math.floor((levelId - 1) / 2);
    const gridX = 40;
    const gridY = 180;
    const btnW = 164;
    const btnH = 120;
    const gapX = 22;
    const gapY = 18;
    return {
      x: gridX + col * (btnW + gapX),
      y: gridY + row * (btnH + gapY),
      w: btnW,
      h: btnH,
    };
  }

  // "Back to level select" button in the HUD during gameplay
  getHudBackButtonRect() {
    return { x: 16, y: GAME_HEIGHT - 54, w: 80, h: 36 };
  }

  // End card "next level" button (shown on win, except last level)
  getEndCardNextButtonRect() {
    if (this.gameState !== "win" || this.currentLevel >= LEVELS.length) {
      return null;
    }
    return {
      x: GAME_WIDTH * 0.5 - 100,
      y: GAME_HEIGHT * 0.1 + 192,
      w: 200,
      h: 40,
    };
  }

  // End card "back to select" button
  getEndCardBackButtonRect() {
    // Position below the restart/next button
    const baseY = GAME_HEIGHT * 0.1 + 192;
    return {
      x: GAME_WIDTH * 0.5 - 100,
      y: baseY + 50,
      w: 200,
      h: 36,
    };
  }

  // End card restart button — moved up if next-level button exists
  getEndCardRestartButtonRect() {
    if (this.gameState === "playing" || this.gameState === "levelSelect") {
      return null;
    }
    if (this.gameState === "win" && this.currentLevel < LEVELS.length) {
      // "Next level" takes the primary spot; restart moves to secondary
      return {
        x: GAME_WIDTH * 0.5 - 70,
        y: GAME_HEIGHT * 0.1 + 148,
        w: 140,
        h: 34,
      };
    }
    return {
      x: GAME_WIDTH * 0.5 - 100,
      y: GAME_HEIGHT * 0.1 + 192,
      w: 200,
      h: 40,
    };
  }

  // Reset progress button on level select screen
  getResetProgressButtonRect() {
    return { x: GAME_WIDTH * 0.5 - 60, y: GAME_HEIGHT - 60, w: 120, h: 32 };
  }
```

- [ ] **Step 7: Rewrite `getUiActionAt()` to handle all new buttons**

Replace the existing `getUiActionAt()` method:

```javascript
  getUiActionAt(x, y) {
    // Level select screen buttons
    if (this.gameState === "levelSelect") {
      for (const level of LEVELS) {
        const rect = this.getLevelButtonRect(level.id);
        if (this.isPointInsideRect(x, y, rect) && level.id <= this.levelProgress.unlockedLevel) {
          return `selectLevel:${level.id}`;
        }
      }
      if (this.isPointInsideRect(x, y, this.getResetProgressButtonRect())) {
        return "resetProgress";
      }
      return null;
    }

    // End card buttons (win/lose)
    if (this.gameState !== "playing") {
      const nextBtn = this.getEndCardNextButtonRect();
      if (this.isPointInsideRect(x, y, nextBtn)) {
        return "nextLevel";
      }
      const endCardRestart = this.getEndCardRestartButtonRect();
      if (this.isPointInsideRect(x, y, endCardRestart)) {
        return "restart";
      }
      const backBtn = this.getEndCardBackButtonRect();
      if (this.isPointInsideRect(x, y, backBtn)) {
        return "backToSelect";
      }
    }

    // HUD buttons during gameplay
    if (this.isPointInsideRect(x, y, this.getHudBackButtonRect())) {
      return "backToSelect";
    }
    if (this.isPointInsideRect(x, y, this.getHudRestartButtonRect())) {
      return "restart";
    }
    if (this.isPointInsideRect(x, y, this.getHudSoundButtonRect())) {
      return "toggleSound";
    }
    return null;
  }
```

- [ ] **Step 8: Rewrite `triggerUiAction()` to handle all new actions**

Replace the existing `triggerUiAction()` method:

```javascript
  triggerUiAction(action) {
    if (action === "restart") {
      this.resetRound();
    } else if (action === "toggleSound") {
      this.sfx.unlock();
      this.sfx.toggleMute();
    } else if (action === "backToSelect") {
      this.goToLevelSelect();
    } else if (action === "nextLevel") {
      this.loadLevel(this.currentLevel + 1);
    } else if (action === "resetProgress") {
      this.levelProgress = resetProgress();
    } else if (action.startsWith("selectLevel:")) {
      const levelId = parseInt(action.split(":")[1], 10);
      this.loadLevel(levelId);
    }
  }
```

- [ ] **Step 9: Update pointer event handler for levelSelect**

In `bindEvents()`, the `pointerdown` handler currently returns early when `!this.isRoundPlaying()` after checking UI. This needs to also allow interaction during `"levelSelect"`. The existing code already handles this correctly because `getUiActionAt()` is called first and the early return is only for gameplay aiming. No code change needed.

However, the `pointerup` handler calls `this.fireProjectile()` when `isRoundPlaying()`. This is also already correct — it won't fire during `"levelSelect"`. No code change needed.

- [ ] **Step 10: Add level-select screen rendering to render.js**

In `render.js`, add these new drawing functions before the `export function render(game)` function:

```javascript
function drawLevelSelectScreen(game, ctx) {
  // Background — reuse scene background
  const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  bg.addColorStop(0, "#17383e");
  bg.addColorStop(0.3, "#10272d");
  bg.addColorStop(1, "#0a1519");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Stone slab background
  const slab = ctx.createLinearGradient(0, 120, 0, GAME_HEIGHT);
  slab.addColorStop(0, "#7f8990");
  slab.addColorStop(0.48, "#6e7880");
  slab.addColorStop(1, "#5b646d");
  ctx.fillStyle = slab;
  ctx.fillRect(0, 120, GAME_WIDTH, GAME_HEIGHT - 120);

  // Title
  ctx.textAlign = "center";
  ctx.font = "700 34px Georgia";
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillText("祭坛试炼", GAME_WIDTH / 2 + 1, 61);
  ctx.fillStyle = "#f0d57a";
  ctx.fillText("祭坛试炼", GAME_WIDTH / 2, 60);

  // Subtitle
  ctx.fillStyle = "rgba(220, 210, 180, 0.5)";
  ctx.font = "14px Georgia";
  ctx.fillText("选择关卡", GAME_WIDTH / 2, 86);

  // Mayan decorative line
  ctx.strokeStyle = "rgba(200, 170, 50, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(100, 100);
  ctx.lineTo(GAME_WIDTH - 100, 100);
  ctx.stroke();

  // Level buttons
  const LEVELS = game.constructor._LEVELS || [];
  for (const level of LEVELS) {
    drawLevelButton(game, ctx, level);
  }

  // Sound toggle button (top right)
  drawSoundButton(game, ctx);

  // Reset progress button (bottom center)
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

function drawLevelButton(game, ctx, level) {
  const rect = game.getLevelButtonRect(level.id);
  const isUnlocked = level.id <= game.levelProgress.unlockedLevel;
  const levelData = game.levelProgress.levels[level.id];
  const isCleared = levelData?.cleared ?? false;
  const highScore = levelData?.highScore ?? 0;
  const isPressed =
    game.uiPressAction === `selectLevel:${level.id}` &&
    game.isPointInsideRect(game.pointer.x, game.pointer.y, rect);

  // Panel — locked levels are darker and desaturated
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

  // Level number
  ctx.font = "700 28px Georgia";
  ctx.fillStyle = isUnlocked ? "#f0d57a" : "rgba(120, 120, 120, 0.5)";
  ctx.fillText(`${level.id}`, cx, rect.y + 38 + (isPressed ? 1 : 0));

  // Level name
  ctx.font = "600 13px Georgia";
  ctx.fillStyle = isUnlocked ? "rgba(240, 225, 185, 0.85)" : "rgba(120, 120, 120, 0.4)";
  ctx.fillText(level.name, cx, rect.y + 60 + (isPressed ? 1 : 0));

  // Status line
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

  // High score (if any)
  if (highScore > 0) {
    ctx.font = "600 11px Georgia";
    ctx.fillStyle = "#c8bfa8";
    ctx.fillText(`最高分: ${highScore}`, cx, rect.y + 100 + (isPressed ? 1 : 0));
  }

  // Difficulty dots (colorCount indicator)
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
```

- [ ] **Step 11: Store LEVELS reference on game class for render.js access**

In `main.js`, add this static property right after the class closing brace `}` for `ZumaGame`, before `window.addEventListener("load", ...)`:

```javascript
ZumaGame._LEVELS = LEVELS;
```

- [ ] **Step 12: Modify `render()` in render.js to branch on levelSelect**

Replace the existing `render(game)` function in `render.js`:

```javascript
export function render(game) {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Level select screen has its own rendering pipeline
  if (game.gameState === "levelSelect") {
    drawLevelSelectScreen(game, ctx);
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
}
```

- [ ] **Step 13: Add "back to select" button to HUD overlay**

In `render.js`, at the end of the `drawOverlay()` function, after the `drawRestartButton(...)` call, add:

```javascript
  // Back to level select button (bottom-left during gameplay)
  const backRect = game.getHudBackButtonRect();
  const isBackPressed =
    game.uiPressAction === "backToSelect" &&
    game.isPointInsideRect(game.pointer.x, game.pointer.y, backRect);
  drawRestartButton(game, ctx, backRect, "选关", isBackPressed);
```

- [ ] **Step 14: Modify end card to show "next level" and "back to select"**

In `render.js`, in the `drawRoundStateCard()` function, replace the section that draws the restart button (from `// Restart button — larger, with pulse glow` through the `drawRestartButton(...)` call) with:

```javascript
  // --- Action buttons ---
  const isWinWithMore = isWin && game.currentLevel < (game.constructor._LEVELS || []).length;

  if (isWinWithMore) {
    // Primary: Next level button
    const nextRect = game.getEndCardNextButtonRect();
    const pulse = 0.08 + 0.06 * Math.sin(game.roundEndTimer * 2.5);
    ctx.fillStyle = `rgba(244, 217, 100, ${pulse})`;
    fillRoundedRect(ctx, nextRect.x - 4, nextRect.y - 4, nextRect.w + 8, nextRect.h + 8, 22);
    drawRestartButton(
      game, ctx, nextRect, "下一关",
      game.uiPressAction === "nextLevel" &&
        game.isPointInsideRect(game.pointer.x, game.pointer.y, nextRect),
    );

    // Secondary: Restart (smaller)
    const restartRect = game.getEndCardRestartButtonRect();
    drawRestartButton(
      game, ctx, restartRect, "重玩本关",
      game.uiPressAction === "restart" &&
        game.isPointInsideRect(game.pointer.x, game.pointer.y, restartRect),
    );
  } else {
    // Restart button — primary spot
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

  // Back to level select button (always shown)
  const backRect = game.getEndCardBackButtonRect();
  drawRestartButton(
    game, ctx, backRect, "返回选关",
    game.uiPressAction === "backToSelect" &&
      game.isPointInsideRect(game.pointer.x, game.pointer.y, backRect),
  );
```

- [ ] **Step 15: Add level name to HUD title**

In `render.js`, in `drawOverlay()`, replace the hardcoded title and subtitle:

```javascript
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.font = "700 22px Georgia";
  ctx.fillText("祭坛试炼", 29, 41);
  ctx.fillStyle = "#f0d57a";
  ctx.fillText("祭坛试炼", 28, 40);

  ctx.fillStyle = "rgba(220, 210, 180, 0.5)";
  ctx.font = "11px Georgia";
  ctx.fillText("石质祭坛 · 青铜机关", 30, 56);
```

with:

```javascript
  const levelName = game.levelConfig?.name ?? "祭坛试炼";
  const levelNum = game.currentLevel ?? 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.font = "700 22px Georgia";
  ctx.fillText(levelName, 29, 41);
  ctx.fillStyle = "#f0d57a";
  ctx.fillText(levelName, 28, 40);

  ctx.fillStyle = "rgba(220, 210, 180, 0.5)";
  ctx.font = "11px Georgia";
  ctx.fillText(`第 ${levelNum} 关 · 祭坛试炼`, 30, 56);
```

- [ ] **Step 16: Verify the complete level-select flow**

Run: Open browser. You should see the level-select screen with 8 buttons. Level 1 is unlocked. Click it to enter the game. Play and win. You should see a "下一关" button. Click it to go to level 2. Go back to level select. Level 2 should now be unlocked. Lose a level — you should see "重试" and "返回选关". Refresh the page — progress should be preserved.

- [ ] **Step 17: Commit**

```bash
git add main.js render.js
git commit -m "feat: add level-select screen, level transitions, and end-card navigation"
```

---

## Task 7: Add all-clear (全通关) screen

**Files:**
- Modify: `main.js`
- Modify: `render.js`

When the player wins level 8, show a special all-clear celebration screen instead of the normal "next level" card.

- [ ] **Step 1: Add `isAllClear()` helper to ZumaGame**

```javascript
  isAllClear() {
    return this.gameState === "win" && this.currentLevel >= LEVELS.length;
  }
```

- [ ] **Step 2: Add `drawAllClearScreen()` to render.js**

Add this function before `export function render(game)`:

```javascript
function drawAllClearScreen(game, ctx) {
  // Dim overlay
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
  // Adjust position for all-clear screen
  const adjustedRect = { ...backRect, y: panelY + panelH - 50 };
  drawRestartButton(
    game, ctx, adjustedRect, "返回选关",
    game.uiPressAction === "backToSelect" &&
      game.isPointInsideRect(game.pointer.x, game.pointer.y, adjustedRect),
  );

  ctx.textAlign = "start";
}
```

- [ ] **Step 3: Wire all-clear screen into render()**

In `render.js`, in the `render()` function, in the section after `drawRoundStateCard(game, ctx);`, add:

```javascript
  // All-clear overlay replaces the normal end card
  if (game.isAllClear()) {
    drawAllClearScreen(game, ctx);
  }
```

Note: `drawRoundStateCard` is still called but `drawAllClearScreen` draws on top of it.

- [ ] **Step 4: Verify all-clear**

Temporarily set `unlockedLevel: 8` in save.js `createInitialSave()` or via browser console `localStorage.setItem('zuma_save', JSON.stringify({version:1,unlockedLevel:8,levels:{}}))`. Play level 8 and win. Verify the all-clear screen appears with per-level scores and total. Revert any temporary changes.

- [ ] **Step 5: Commit**

```bash
git add main.js render.js
git commit -m "feat: add all-clear celebration screen for completing all 8 levels"
```

---

## Task 8: Tune difficulty curve via playtesting

**Files:**
- Modify: `levels.js`

This task is about playing through all 8 levels and adjusting the parameters in `levels.js` so the difficulty curve feels right. This is iterative — the exact numbers will be refined by playing.

- [ ] **Step 1: Playtest levels 1-3 and adjust**

Play levels 1, 2, and 3 in sequence. Check:
- Level 1 should be clearable in 1-2 tries by a new player
- Level 2 slightly harder but still comfortable
- Level 3 should feel like a step up with the 4th color

Adjust `chainCount`, `chainSpeed`, and `colorCount` in `levels.js` as needed.

- [ ] **Step 2: Playtest levels 4-6 and adjust**

Play levels 4, 5, 6. The mid-game should introduce real challenge. Check that no single level is a wall where the player gets stuck for many attempts.

- [ ] **Step 3: Playtest levels 7-8 and adjust**

The final levels should be the hardest. Check they are challenging but not unfair. Adjust parameters as needed.

- [ ] **Step 4: Commit tuned values**

```bash
git add levels.js
git commit -m "tune: adjust difficulty curve for 8 levels based on playtesting"
```

---

## Task 9: Level transition fade animation

**Files:**
- Modify: `main.js`
- Modify: `render.js`

Add a simple fade-to-black/fade-from-black when transitioning between levels.

- [ ] **Step 1: Add fade state to ZumaGame**

Add these fields to the constructor, after `this.chainIntro = null;`:

```javascript
    this.fadeOverlay = null; // { alpha, direction: "in"|"out", callback }
```

- [ ] **Step 2: Add fade methods**

Add to ZumaGame:

```javascript
  startFade(direction, callback) {
    this.fadeOverlay = { alpha: direction === "out" ? 0 : 1, direction, callback };
  }

  updateFade(dt) {
    if (!this.fadeOverlay) {
      return;
    }
    const speed = 3.0; // ~0.33s fade
    if (this.fadeOverlay.direction === "out") {
      this.fadeOverlay.alpha = Math.min(1, this.fadeOverlay.alpha + speed * dt);
      if (this.fadeOverlay.alpha >= 1) {
        const cb = this.fadeOverlay.callback;
        this.fadeOverlay = null;
        if (cb) cb();
      }
    } else {
      this.fadeOverlay.alpha = Math.max(0, this.fadeOverlay.alpha - speed * dt);
      if (this.fadeOverlay.alpha <= 0) {
        this.fadeOverlay = null;
      }
    }
  }
```

- [ ] **Step 3: Wire fade into update loop**

In `update(dt)`, at the very top (before the `levelSelect` early return), add:

```javascript
    this.updateFade(dt);
```

- [ ] **Step 4: Wire fade into level transitions**

Modify `loadLevel()`:

```javascript
  loadLevel(levelId) {
    const cfg = getLevelById(levelId);
    if (!cfg) {
      return;
    }
    this.startFade("out", () => {
      this.currentLevel = levelId;
      this.levelConfig = cfg;
      this.resetRound();
      this.startFade("in", null);
    });
  }
```

Modify `goToLevelSelect()` similarly:

```javascript
  goToLevelSelect() {
    this.startFade("out", () => {
      this.gameState = "levelSelect";
      this.projectile = null;
      this.chain = [];
      this.particles = [];
      this.splitState = null;
      this.pendingMatchChecks = [];
      this.pointer.active = false;
      this.hudPanelCache = null;
      this.startFade("in", null);
    });
  }
```

- [ ] **Step 5: Draw fade overlay in render.js**

In `render.js`, at the very end of `render()`, add:

```javascript
  // Fade overlay (level transitions)
  if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
    ctx.fillStyle = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
```

- [ ] **Step 6: Verify transitions are smooth**

Run: Play through a level, win, click "next level". There should be a brief fade-to-black, then fade-from-black into the new level. Same when going back to level select.

- [ ] **Step 7: Commit**

```bash
git add main.js render.js
git commit -m "feat: add fade transitions between levels"
```

---

## Task 10: Add serpentine, rectangular, and zigzag path generators

**Files:**
- Modify: `path.js`

This is the core of Work Package Q. We add 3 new path generators that all output the same `sampled[]` point array format as the spiral.

- [ ] **Step 1: Add `generateSerpentinePath()`**

In `path.js`, add after `generateSpiralPath()`:

```javascript
// S-shaped serpentine path — the track weaves horizontally back and forth
// down the screen. Each curve is a half-ellipse. The shooter sits in the
// middle of the snake body.
function generateSerpentinePath(shooterX, shooterY, params = {}) {
  const curves = params.curves ?? 5;
  const amplitude = params.amplitude ?? 140; // horizontal swing
  const verticalSpan = params.verticalSpan ?? 700; // total Y coverage
  const topY = params.topY ?? 100;
  const centerX = params.centerX ?? GAME_WIDTH / 2;
  const samplePerCurve = 80;

  const sampled = [];
  // Entry from off-screen right
  const entryY = topY - 20;
  sampled.push({ x: GAME_WIDTH + 96, y: entryY });
  sampled.push({ x: GAME_WIDTH + 40, y: entryY });
  sampled.push({ x: centerX + amplitude + 20, y: entryY });

  for (let c = 0; c < curves; c++) {
    const startY = topY + (c / curves) * verticalSpan;
    const endY = topY + ((c + 1) / curves) * verticalSpan;
    const direction = c % 2 === 0 ? 1 : -1; // alternating left/right

    for (let s = 0; s <= samplePerCurve; s++) {
      const t = s / samplePerCurve;
      const y = startY + (endY - startY) * t;
      // Half-sine wave for smooth curvature
      const x = centerX + direction * amplitude * Math.sin(t * Math.PI);
      sampled.push({ x, y });
    }
  }

  return sampled;
}
```

- [ ] **Step 2: Add `generateRectangularPath()`**

```javascript
// Rectangular spiral path — the track spirals inward in rounded rectangles.
// Similar to a maze-like concentric rectangular rings.
function generateRectangularPath(shooterX, shooterY, params = {}) {
  const rings = params.rings ?? 3;
  const outerW = params.outerW ?? 360;
  const outerH = params.outerH ?? 700;
  const shrink = params.shrink ?? 60; // how much each ring shrinks
  const cornerRadius = params.cornerRadius ?? 40;
  const topY = params.topY ?? 100;
  const centerX = params.centerX ?? GAME_WIDTH / 2;
  const samplesPerSide = 40;
  const samplesPerCorner = 16;

  const sampled = [];
  // Entry from off-screen
  const startX = centerX + outerW / 2 + 50;
  const startY = topY;
  sampled.push({ x: GAME_WIDTH + 96, y: startY });
  sampled.push({ x: startX, y: startY });

  for (let ring = 0; ring < rings; ring++) {
    const w = outerW - ring * shrink * 2;
    const h = outerH - ring * shrink * 2;
    if (w < 60 || h < 60) break;

    const left = centerX - w / 2;
    const right = centerX + w / 2;
    const top = topY + ring * shrink;
    const bottom = top + h;
    const r = Math.min(cornerRadius, w / 4, h / 4);

    // Direction alternates: even rings go clockwise, odd go counter-clockwise
    const cw = ring % 2 === 0;

    // Define the 4 sides + 4 corners in order
    const segments = cw ? [
      // Top side (right to left)
      { type: "line", from: { x: right - r, y: top }, to: { x: left + r, y: top } },
      // Top-left corner
      { type: "corner", cx: left + r, cy: top + r, startA: -Math.PI / 2, endA: Math.PI, r },
      // Left side (top to bottom)
      { type: "line", from: { x: left, y: top + r }, to: { x: left, y: bottom - r } },
      // Bottom-left corner
      { type: "corner", cx: left + r, cy: bottom - r, startA: Math.PI, endA: Math.PI / 2, r },
      // Bottom side (left to right)
      { type: "line", from: { x: left + r, y: bottom }, to: { x: right - r, y: bottom } },
      // Bottom-right corner
      { type: "corner", cx: right - r, cy: bottom - r, startA: Math.PI / 2, endA: 0, r },
      // Right side (bottom to top, into next ring)
      { type: "line", from: { x: right, y: bottom - r }, to: { x: right, y: top + r + (ring < rings - 1 ? shrink : 0) } },
      // Top-right corner (transition)
      { type: "corner", cx: right - r, cy: top + r + (ring < rings - 1 ? shrink : 0), startA: 0, endA: -Math.PI / 2, r },
    ] : [
      // Reverse direction for odd rings
      { type: "line", from: { x: left + r, y: top }, to: { x: right - r, y: top } },
      { type: "corner", cx: right - r, cy: top + r, startA: -Math.PI / 2, endA: 0, r },
      { type: "line", from: { x: right, y: top + r }, to: { x: right, y: bottom - r } },
      { type: "corner", cx: right - r, cy: bottom - r, startA: 0, endA: Math.PI / 2, r },
      { type: "line", from: { x: right - r, y: bottom }, to: { x: left + r, y: bottom } },
      { type: "corner", cx: left + r, cy: bottom - r, startA: Math.PI / 2, endA: Math.PI, r },
      { type: "line", from: { x: left, y: bottom - r }, to: { x: left, y: top + r + (ring < rings - 1 ? shrink : 0) } },
      { type: "corner", cx: left + r, cy: top + r + (ring < rings - 1 ? shrink : 0), startA: Math.PI, endA: -Math.PI / 2, r: Math.min(r, shrink / 2) },
    ];

    for (const seg of segments) {
      if (seg.type === "line") {
        for (let s = 0; s <= samplesPerSide; s++) {
          const t = s / samplesPerSide;
          sampled.push({
            x: seg.from.x + (seg.to.x - seg.from.x) * t,
            y: seg.from.y + (seg.to.y - seg.from.y) * t,
          });
        }
      } else {
        // Arc corner
        const angSpan = seg.endA - seg.startA;
        for (let s = 0; s <= samplesPerCorner; s++) {
          const t = s / samplesPerCorner;
          const a = seg.startA + angSpan * t;
          sampled.push({
            x: seg.cx + Math.cos(a) * seg.r,
            y: seg.cy + Math.sin(a) * seg.r,
          });
        }
      }
    }
  }

  return sampled;
}
```

- [ ] **Step 3: Add `generateZigzagPath()`**

```javascript
// Zigzag path — the track goes left-right in sharp switchbacks down the
// screen. Each row is a horizontal pass with rounded turnarounds at the edges.
function generateZigzagPath(shooterX, shooterY, params = {}) {
  const rows = params.rows ?? 7;
  const marginX = params.marginX ?? 40;
  const topY = params.topY ?? 80;
  const rowHeight = params.rowHeight ?? 100;
  const turnRadius = params.turnRadius ?? 36;
  const samplesPerRow = 50;
  const samplesPerTurn = 20;

  const left = marginX;
  const right = GAME_WIDTH - marginX;

  const sampled = [];
  // Entry from off-screen
  sampled.push({ x: GAME_WIDTH + 96, y: topY });
  sampled.push({ x: right + 20, y: topY });

  for (let row = 0; row < rows; row++) {
    const y = topY + row * rowHeight;
    const goingLeft = row % 2 === 0; // even rows go right-to-left

    // Horizontal segment
    const fromX = goingLeft ? right : left;
    const toX = goingLeft ? left : right;
    for (let s = 0; s <= samplesPerRow; s++) {
      const t = s / samplesPerRow;
      sampled.push({ x: fromX + (toX - fromX) * t, y });
    }

    // Turnaround (if not last row) — semicircle going down
    if (row < rows - 1) {
      const turnCX = toX;
      const nextY = y + rowHeight;
      const midY = (y + nextY) / 2;
      const turnR = Math.min(turnRadius, rowHeight / 2);

      for (let s = 1; s <= samplesPerTurn; s++) {
        const t = s / samplesPerTurn;
        const angle = goingLeft
          ? -Math.PI / 2 + t * Math.PI  // left turn: down and back right
          : Math.PI / 2 - t * Math.PI;  // right turn: down and back left
        sampled.push({
          x: turnCX + Math.cos(angle) * turnR * (goingLeft ? -1 : 1),
          y: midY + Math.sin(angle) * (rowHeight / 2 - turnR) + Math.sin(t * Math.PI) * turnR,
        });
      }
    }
  }

  return sampled;
}
```

- [ ] **Step 4: Register new path types in the `createPath()` switch**

In `path.js`, in the `createPath()` function, update the switch statement:

```javascript
  switch (pathType) {
    case "spiral":
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
    case "serpentine":
      sampled = generateSerpentinePath(shooterX, shooterY, pathParams);
      break;
    case "rectangular":
      sampled = generateRectangularPath(shooterX, shooterY, pathParams);
      break;
    case "zigzag":
      sampled = generateZigzagPath(shooterX, shooterY, pathParams);
      break;
    default:
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
  }
```

- [ ] **Step 5: Test each path type manually**

Temporarily change a level config in `levels.js` to use `pathType: "serpentine"` and verify it renders and plays correctly. Repeat for `"rectangular"` and `"zigzag"`. Revert after testing.

- [ ] **Step 6: Commit**

```bash
git add path.js
git commit -m "feat: add serpentine, rectangular, and zigzag path generators"
```

---

## Task 11: Assign diverse paths to 8 levels + path thumbnails

**Files:**
- Modify: `levels.js`
- Modify: `render.js`

- [ ] **Step 1: Update level configs with diverse path types**

Update `levels.js` to assign different path types and tuned parameters:

```javascript
export const LEVELS = [
  {
    id: 1,
    name: "石阶祭坛",
    chainCount: 20,
    chainSpeed: 52,
    colorCount: 3,
    pathType: "spiral",
    pathParams: { turnCount: 2.2, outerRadius: 190, innerRadius: 84, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 2,
    name: "密林通道",
    chainCount: 24,
    chainSpeed: 58,
    colorCount: 3,
    pathType: "serpentine",
    pathParams: { curves: 4, amplitude: 130, verticalSpan: 620, topY: 120 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.88 },
  },
  {
    id: 3,
    name: "月牙河谷",
    chainCount: 28,
    chainSpeed: 64,
    colorCount: 4,
    pathType: "spiral",
    pathParams: { turnCount: 2.5, outerRadius: 200, innerRadius: 78, startAngle: 0.7 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 4,
    name: "祭司回廊",
    chainCount: 30,
    chainSpeed: 68,
    colorCount: 4,
    pathType: "zigzag",
    pathParams: { rows: 6, marginX: 44, topY: 90, rowHeight: 110, turnRadius: 38 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.90 },
  },
  {
    id: 5,
    name: "羽蛇阶梯",
    chainCount: 32,
    chainSpeed: 72,
    colorCount: 4,
    pathType: "serpentine",
    pathParams: { curves: 5, amplitude: 150, verticalSpan: 680, topY: 100 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.88 },
  },
  {
    id: 6,
    name: "太阳神殿",
    chainCount: 35,
    chainSpeed: 76,
    colorCount: 5,
    pathType: "rectangular",
    pathParams: { rings: 2, outerW: 350, outerH: 650, shrink: 70, cornerRadius: 40, topY: 110 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
  {
    id: 7,
    name: "星象迷宫",
    chainCount: 38,
    chainSpeed: 80,
    colorCount: 5,
    pathType: "zigzag",
    pathParams: { rows: 7, marginX: 36, topY: 80, rowHeight: 96, turnRadius: 32 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.90 },
  },
  {
    id: 8,
    name: "黄金祭坛",
    chainCount: 42,
    chainSpeed: 86,
    colorCount: 5,
    pathType: "spiral",
    pathParams: { turnCount: 3.2, outerRadius: 212, innerRadius: 74, startAngle: 0.96 },
    shooterPos: { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 },
  },
];
```

- [ ] **Step 2: Add path thumbnail drawing to level buttons**

In `render.js`, add this function before `drawLevelButton`:

```javascript
// Draw a tiny path outline inside a level button for visual preview.
function drawPathThumbnail(ctx, level, rect) {
  // Generate a temporary path just for the thumbnail
  const tempShooter = level.shooterPos || { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.58 };
  // We use createPath from the path module but we only need the points for a mini outline
  // For performance, just draw a simplified placeholder based on pathType
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
  }

  ctx.restore();
}
```

- [ ] **Step 3: Call path thumbnail from drawLevelButton**

In `drawLevelButton()`, after the status line block (after the high score text), add before the difficulty dots:

```javascript
  // Path thumbnail preview (unlocked only)
  if (isUnlocked) {
    drawPathThumbnail(ctx, level, rect);
  }
```

- [ ] **Step 4: Playtest all 8 levels with diverse paths**

Play through all 8 levels. Verify:
- Each path type renders correctly and the ball chain follows it
- Shooter position is appropriate for each path layout
- The game doesn't have collision/detection issues on the new paths
- Difficulty feels progressive

- [ ] **Step 5: Commit**

```bash
git add levels.js render.js
git commit -m "feat: assign diverse path types to 8 levels + add path thumbnails"
```

---

## Task 12: Update CLAUDE.md and ZUMA_PLAN.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `ZUMA_PLAN.md`

- [ ] **Step 1: Update CLAUDE.md**

Add Phase 4 completion notes to CLAUDE.md:
- Update "Current Status" section to reflect Phase 4 complete
- Add `levels.js` and `save.js` to file structure
- Update module dependency graph
- Add notes about the path dispatcher and level config system
- Update "Key Parameters to Tune" to mention per-level overrides

- [ ] **Step 2: Update ZUMA_PLAN.md**

Add a Phase 4 status section (similar to the existing Phase 2/3 status sections):
- Mark Phase 4 as complete
- List all work packages M-R with their status
- Document the Phase 4/5 split decision
- Update "next expected move" to Phase 5

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md ZUMA_PLAN.md
git commit -m "docs: update CLAUDE.md and ZUMA_PLAN.md for Phase 4 completion"
```
