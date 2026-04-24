# Dual-Track Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Level 9 "双蛇祭道" — a dual-path Zuma level with two independent ball chains, one shared shooter, shared combo, and both-must-reach-goal lose condition.

**Architecture:** Minimal-intrusion approach — add parallel `*2` fields on ZumaGame for the second track. A `getTrackState(game, trackIndex)` helper in chain.js provides a uniform interface so internal chain/split/merge functions operate on either track identically. Existing single-track levels are unaffected (all `*2` fields stay null/empty).

**Tech Stack:** Vanilla JS, Canvas 2D, ES modules, Vite dev server

**Spec:** `docs/superpowers/specs/2026-04-25-dual-track-level-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/levels.js` | Modify | Add Level 9 config with `tracks` array |
| `src/main.js` | Modify | `isDualTrack` getter, `*2` field init, dual path creation, dual chain update loop, dual win/lose, `getActivePaletteIndices` merge, `spawnMatchParticles` signature, `resetRound`/`goToLevelSelect` cleanup |
| `src/chain.js` | Modify | `getTrackState` helper, refactor internal functions to use TrackState, export `getTrackState`, move lose-detect out to caller |
| `src/match.js` | Modify | `trackIndex` on `pendingMatchChecks` entries, `resolveMatchesFrom` operates on track-specific chain, `setBallAction`/`queueAdjacentMatchChecks` use track state |
| `src/projectile.js` | Modify | `findChainCollision` scans both chains, `insertProjectile` uses `trackIndex` |
| `src/render/scene.js` | Modify | `drawChain` takes chain param, `createStaticSceneCache` draws dual tracks/goals, new `strokePath2`/`drawGoal` for track 2 |
| `src/render/index.js` | Modify | `render()` calls `drawChain` twice for dual track |
| `src/ui/level-select.js` | Modify | `colorCount` fallback for dual-track levels |

---

### Task 1: Add Level 9 config in levels.js

**Files:**
- Modify: `src/levels.js`

This task adds the Level 9 entry to `DEFAULT_LEVELS` with the new `tracks` array format and hardcoded bezier paths (two opposing S-curves, upper and lower half).

- [ ] **Step 1: Add Level 9 config with dual-track `tracks` array**

Add after the Level 8 entry in `DEFAULT_LEVELS` (after line 154, before the closing `];`):

```js
  {
    id: 9,
    name: "双蛇祭道",
    // Dual-track level: two independent chains on two paths.
    // Top-level chainCount/colorCount are omitted; per-track config lives in tracks[].
    tracks: [
      {
        chainCount: 18,
        chainSpeed: 35,
        colorCount: 4,
        pathType: "bezier",
        pathParams: {
          points: [
            // Upper path: gentle S-curve, right-to-left, y ~240-370
            {x:400, y:260}, {x:330, y:220}, {x:250, y:260},
            {x:250, y:260}, {x:170, y:300}, {x:110, y:260},
            {x:110, y:260}, {x:50, y:220},  {x:30, y:300},
            {x:30, y:300},  {x:10, y:380},  {x:80, y:370},
          ],
        },
      },
      {
        chainCount: 18,
        chainSpeed: 38,
        colorCount: 4,
        pathType: "bezier",
        pathParams: {
          points: [
            // Lower path: gentle S-curve, left-to-right, y ~560-700
            {x:30, y:580},  {x:100, y:540}, {x:180, y:580},
            {x:180, y:580}, {x:260, y:620}, {x:320, y:580},
            {x:320, y:580}, {x:380, y:540}, {x:400, y:620},
            {x:400, y:620}, {x:420, y:700}, {x:350, y:690},
          ],
        },
      },
    ],
    shooterPos: { x: 215, y: 466 },
  },
```

- [ ] **Step 2: Add a top-level `colorCount` fallback for UI compatibility**

The level-select UI reads `level.colorCount` to render color dots. For dual-track levels, add a getter-friendly fallback. In the Level 9 config, add a top-level `colorCount` that equals the max of both tracks:

```js
    colorCount: 4,  // UI fallback (max of both tracks)
```

Add this line right after the `name: "双蛇祭道",` line.

- [ ] **Step 3: Verify the dev server still starts**

Run: `cd /Users/reikjiang/Documents/src/ZUMA && npx vite --host 2>&1 | head -20`

Expected: Vite starts without errors, shows localhost URL.

- [ ] **Step 4: Commit**

```bash
git add src/levels.js
git commit -m "feat: add Level 9 dual-track config with hardcoded bezier paths

Two opposing S-curve paths (upper right-to-left, lower left-to-right)
with per-track chainCount/chainSpeed/colorCount in a tracks[] array.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `isDualTrack` getter and `*2` fields on ZumaGame

**Files:**
- Modify: `src/main.js`

This task initializes all second-track state fields on ZumaGame and adds the `isDualTrack` getter derived from level config.

- [ ] **Step 1: Add `isDualTrack` getter to ZumaGame class**

Add after the `isAllClear()` method (after line 495):

```js
  get isDualTrack() {
    return Array.isArray(this.levelConfig?.tracks) && this.levelConfig.tracks.length > 1;
  }
```

- [ ] **Step 2: Initialize `*2` fields in the constructor**

Add after line 70 (`this.splitState = null;`):

```js
    // --- Track 2 state (dual-track levels only) ---
    this.pathPoints2 = [];
    this.totalPathLength2 = 0;
    this.cachedTrackPath2 = null;
    this.chain2 = [];
    this.chainHeadS2 = 0;
    this.splitState2 = null;
    this.chainIntro2 = null;
    this.mergeSettle2 = null;
    this.track1ReachedGoal = false;
    this.track2ReachedGoal = false;
```

- [ ] **Step 3: Clear `*2` fields in `resetRound()`**

Add after line 514 (`this.splitState = null;`):

```js
    // Track 2 reset
    this.chain2 = [];
    this.chainHeadS2 = 0;
    this.splitState2 = null;
    this.chainIntro2 = null;
    this.mergeSettle2 = null;
    this.track1ReachedGoal = false;
    this.track2ReachedGoal = false;
```

- [ ] **Step 4: Clear `*2` fields in `goToLevelSelect()`**

Add inside the fade callback, after `this.splitState = null;` (around line 576):

```js
      this.chain2 = [];
      this.chainHeadS2 = 0;
      this.splitState2 = null;
      this.chainIntro2 = null;
      this.mergeSettle2 = null;
      this.pathPoints2 = [];
      this.totalPathLength2 = 0;
      this.cachedTrackPath2 = null;
```

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: add isDualTrack getter and track-2 state fields

Initialize, reset, and cleanup all *2 fields (chain2, chainHeadS2,
splitState2, pathPoints2, etc.) on ZumaGame. isDualTrack derived from
levelConfig.tracks presence.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Dual path creation in `resetRound()`

**Files:**
- Modify: `src/main.js`

This task extends `createPath()` and `resetRound()` to build the second track's path when `isDualTrack`.

- [ ] **Step 1: Extend `createPath()` to handle dual tracks**

Replace the existing `createPath()` method (lines 172-181) with:

```js
  createPath() {
    const cfg = this.levelConfig;
    if (cfg?.tracks && cfg.tracks.length > 1) {
      // Dual-track: build both paths from per-track config.
      const t0 = cfg.tracks[0];
      const pathData0 = createPathFn(this.shooter.x, this.shooter.y, t0.pathType, t0.pathParams);
      this.pathPoints = pathData0.pathPoints;
      this.totalPathLength = pathData0.totalPathLength;
      this.cachedTrackPath = pathData0.cachedTrackPath;

      const t1 = cfg.tracks[1];
      const pathData1 = createPathFn(this.shooter.x, this.shooter.y, t1.pathType, t1.pathParams);
      this.pathPoints2 = pathData1.pathPoints;
      this.totalPathLength2 = pathData1.totalPathLength;
      this.cachedTrackPath2 = pathData1.cachedTrackPath;
    } else {
      // Single-track: existing logic.
      const pathType = cfg?.pathType ?? "spiral";
      const pathParams = cfg?.pathParams ?? {};
      const pathData = createPathFn(this.shooter.x, this.shooter.y, pathType, pathParams);
      this.pathPoints = pathData.pathPoints;
      this.totalPathLength = pathData.totalPathLength;
      this.cachedTrackPath = pathData.cachedTrackPath;
      // Clear track 2
      this.pathPoints2 = [];
      this.totalPathLength2 = 0;
      this.cachedTrackPath2 = null;
    }
    if (this.canvas) this.resize();
  }
```

- [ ] **Step 2: Verify the game loads correctly for existing levels**

Open the dev server in the browser, play through Level 1 to confirm no regressions. Level 9 should appear in the level select but will crash when loaded (chain2 not yet populated) — that's expected.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: build dual paths from tracks[] config in createPath()

Dual-track levels create pathPoints2/totalPathLength2/cachedTrackPath2
from tracks[1]. Single-track levels clear track-2 path data.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Refactor chain.js with `getTrackState` helper

**Files:**
- Modify: `src/chain.js`

This is the biggest refactor. All internal chain.js functions switch from reading `game.chain` / `game.chainHeadS` / `game.splitState` directly to using a `TrackState` object. The public API adds an optional `trackIndex` parameter (default 0).

- [ ] **Step 1: Add `getTrackState` helper and export it**

Add at the top of `chain.js`, after the imports:

```js
// Uniform interface to either track's state. trackIndex 0 = primary,
// trackIndex 1 = secondary (dual-track levels only).
export function getTrackState(game, trackIndex = 0) {
  if (trackIndex === 1) {
    return {
      chain: game.chain2,
      getChainHeadS: () => game.chainHeadS2,
      setChainHeadS: (v) => { game.chainHeadS2 = v; },
      getSplitState: () => game.splitState2,
      setSplitState: (v) => { game.splitState2 = v; },
      getChainIntro: () => game.chainIntro2,
      setChainIntro: (v) => { game.chainIntro2 = v; },
      getMergeSettle: () => game.mergeSettle2,
      setMergeSettle: (v) => { game.mergeSettle2 = v; },
      pathPoints: game.pathPoints2,
      totalPathLength: game.totalPathLength2,
      trackIndex: 1,
    };
  }
  return {
    chain: game.chain,
    getChainHeadS: () => game.chainHeadS,
    setChainHeadS: (v) => { game.chainHeadS = v; },
    getSplitState: () => game.splitState,
    setSplitState: (v) => { game.splitState = v; },
    getChainIntro: () => game.chainIntro,
    setChainIntro: (v) => { game.chainIntro = v; },
    getMergeSettle: () => game.mergeSettle,
    setMergeSettle: (v) => { game.mergeSettle = v; },
    pathPoints: game.pathPoints,
    totalPathLength: game.totalPathLength,
    trackIndex: 0,
  };
}
```

- [ ] **Step 2: Refactor `createChain` to accept `trackIndex`**

Replace the existing `createChain` function:

```js
export function createChain(game, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  const cfg = game.levelConfig;
  let chainCount, colorCount;
  if (cfg?.tracks && cfg.tracks[trackIndex]) {
    chainCount = cfg.tracks[trackIndex].chainCount ?? START_CHAIN_COUNT;
    colorCount = cfg.tracks[trackIndex].colorCount ?? 4;
  } else {
    chainCount = cfg?.chainCount ?? START_CHAIN_COUNT;
    colorCount = cfg?.colorCount ?? 4;
  }

  ts.chain.length = 0;
  for (let i = 0; i < chainCount; i++) {
    ts.chain.push(createChainBall(game, i % colorCount));
  }

  const targetHeadS =
    (ts.chain.length - 1) * BALL_SPACING + CHAIN_ENTRY_TAIL_S;
  ts.setChainHeadS(CHAIN_ENTRY_START_HEAD_S);
  ts.setChainIntro({ targetHeadS });
  ts.setSplitState(null);
  if (trackIndex === 0) {
    game.pendingMatchChecks = [];
  }
  syncChainPositions(game, trackIndex);
}
```

- [ ] **Step 3: Refactor `updateChain` to accept `trackIndex`**

Replace the existing `updateChain` function. The key change: instead of calling `game.setGameState("lose")` directly, set a per-track flag and let the caller decide:

```js
export function updateChain(game, dt, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  if (ts.chain.length === 0) {
    return;
  }

  updateMergeSettle(game, ts);
  if (!ts.getSplitState()) {
    advanceChainBaseline(game, dt, ts);
  }
  updateBallTransitions(game, dt, ts);
  updateSplitFrontPull(game, dt, getSplitGap(game, trackIndex), ts);
  if (trackIndex === 0) {
    game.updatePendingMatchChecks(dt);
  } else {
    // Track 1 match checks are also in the shared queue — processed in track 0 call
  }
  resolveSplitClosure(game, ts);
  syncChainPositions(game, trackIndex);

  if (ts.chain.length === 0) {
    return;
  }

  const tailS = ts.chain[ts.chain.length - 1].s;
  if (tailS > ts.totalPathLength + EXIT_GAP) {
    if (trackIndex === 0) {
      game.track1ReachedGoal = true;
    } else {
      game.track2ReachedGoal = true;
    }
  }
}
```

- [ ] **Step 4: Refactor internal functions to use TrackState**

Refactor `advanceChainBaseline`:

```js
function advanceChainBaseline(game, dt, ts) {
  const intro = ts.getChainIntro();
  if (intro) {
    ts.setChainHeadS(ts.getChainHeadS() + CHAIN_ENTRY_SPEED * dt);
    if (ts.getChainHeadS() >= intro.targetHeadS) {
      ts.setChainHeadS(intro.targetHeadS);
      ts.setChainIntro(null);
    }
    return;
  }

  const cfg = game.levelConfig;
  let speed;
  if (cfg?.tracks && cfg.tracks[ts.trackIndex]) {
    speed = cfg.tracks[ts.trackIndex].chainSpeed ?? CHAIN_SPEED;
  } else {
    speed = cfg?.chainSpeed ?? CHAIN_SPEED;
  }
  ts.setChainHeadS(ts.getChainHeadS() + speed * dt * getChainSpeedScale(ts));
}
```

Refactor `getChainSpeedScale`:

```js
function getChainSpeedScale(ts) {
  const mergeSettle = ts.getMergeSettle();
  if (!mergeSettle) {
    return 1;
  }
  const progress = 1 - mergeSettle.timer / mergeSettle.duration;
  const eased = progress * progress * (3 - 2 * progress);
  return MERGE_SETTLE_MIN_SPEED_SCALE + (1 - MERGE_SETTLE_MIN_SPEED_SCALE) * eased;
}
```

Refactor `updateMergeSettle`:

```js
function updateMergeSettle(game, ts) {
  const mergeSettle = ts.getMergeSettle();
  if (!mergeSettle) {
    return;
  }
  mergeSettle.timer = Math.max(0, mergeSettle.timer - arguments[1] || 0);
  // Note: dt is not passed here — it was already consumed by the caller.
  // Actually we need dt. Let's fix this.
}
```

Wait — `updateMergeSettle` needs `dt`. Looking at the current call: `updateMergeSettle(game, dt)`. We need to keep `dt` accessible. Let me restructure the signature:

```js
function updateMergeSettle(dt, ts) {
  const mergeSettle = ts.getMergeSettle();
  if (!mergeSettle) {
    return;
  }
  mergeSettle.timer = Math.max(0, mergeSettle.timer - dt);
  if (mergeSettle.timer <= 0) {
    ts.setMergeSettle(null);
  }
}
```

And in `updateChain`:
```js
  updateMergeSettle(dt, ts);
```

Refactor `updateBallTransitions`:

```js
function updateBallTransitions(game, dt, ts) {
  const splitState = ts.getSplitState();
  for (const [index, ball] of ts.chain.entries()) {
    const speed =
      ball.offsetMode === "close"
        ? splitState && index >= splitState.index
          ? SPLIT_CLOSE_SPEED
          : GAP_CLOSE_SPEED
        : ball.offsetMode === "insert"
          ? INSERT_SETTLE_SPEED
          : INSERT_SETTLE_SPEED;
    const step = speed * dt;

    if (ball.offset > 0) {
      ball.offset = Math.max(0, ball.offset - step);
    } else if (ball.offset < 0) {
      ball.offset = Math.min(0, ball.offset + step);
    }

    if (Math.abs(ball.offset) < 0.04) {
      ball.offset = 0;
      ball.offsetMode = "idle";
    }

    ball.impact = Math.max(0, ball.impact - dt * IMPACT_FADE_SPEED);
  }
}
```

- [ ] **Step 5: Refactor `syncChainPositions` to accept `trackIndex`**

```js
export function syncChainPositions(game, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  ts.chain.forEach((ball, index) => {
    const splitOffset = getSplitLocalOffset(ts, index);
    ball.s = ts.getChainHeadS() - index * BALL_SPACING + ball.offset + splitOffset;
    ball.rotation = ball.s / ball.radius;
    if (ball.s >= 0 && ball.s <= ts.totalPathLength) {
      const pt = getPointAtDistanceFn(ts.pathPoints, ts.totalPathLength, ball.s);
      ball.screenX = pt.x;
      ball.screenY = pt.y;
      ball.pathAngle = pt.angle;
    }
  });
}
```

This requires importing `getPointAtDistanceFn` from `path.js`. Add to the imports at the top of `chain.js`:

```js
import { getPointAtDistance as getPointAtDistanceFn } from './path.js';
```

- [ ] **Step 6: Refactor `hasGapBetween` and `getSplitGap` to accept `trackIndex`**

```js
export function hasGapBetween(game, leftIndex, rightIndex, trackIndex = 0) {
  const splitState = getTrackState(game, trackIndex).getSplitState();
  return (
    !!splitState &&
    leftIndex === splitState.index - 1 &&
    rightIndex === splitState.index
  );
}

export function getSplitGap(game, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  const splitState = ts.getSplitState();
  if (
    !splitState ||
    splitState.index <= 0 ||
    splitState.index >= ts.chain.length
  ) {
    return null;
  }

  const frontTail = ts.chain[splitState.index - 1];
  const rearHead = ts.chain[splitState.index];
  return Math.max(0, frontTail.offset - rearHead.offset);
}
```

- [ ] **Step 7: Refactor split-related internal functions to use TrackState**

`getSplitFrontPullTarget`:
```js
function getSplitFrontPullTarget(ts, gap) {
  const splitState = ts.getSplitState();
  const initialGap = splitState?.initialGap ?? 0;
  if (gap === null || initialGap <= 0) {
    return 0;
  }
  const closedDistance = Math.max(0, initialGap - gap);
  return Math.min(SPLIT_FRONT_PULL_MAX, closedDistance * SPLIT_FRONT_PULL_RATIO);
}
```

`updateSplitFrontPull`:
```js
function updateSplitFrontPull(game, dt, gap, ts) {
  const splitState = ts.getSplitState();
  if (!splitState) {
    return;
  }
  const targetPull = getSplitFrontPullTarget(ts, gap);
  const currentPull = splitState.frontPull ?? 0;
  const step = SPLIT_FRONT_PULL_SPEED * dt;

  if (currentPull < targetPull) {
    splitState.frontPull = Math.min(targetPull, currentPull + step);
  } else {
    splitState.frontPull = Math.max(targetPull, currentPull - step);
  }
}
```

`getSplitLocalOffset`:
```js
function getSplitLocalOffset(ts, index) {
  const splitState = ts.getSplitState();
  if (
    !splitState ||
    index >= splitState.index ||
    !splitState.frontPull
  ) {
    return 0;
  }
  return -splitState.frontPull;
}
```

`resolveSplitClosure`:
```js
function resolveSplitClosure(game, ts) {
  const splitState = ts.getSplitState();
  if (
    !splitState ||
    splitState.index <= 0 ||
    splitState.index >= ts.chain.length
  ) {
    ts.setSplitState(null);
    return;
  }

  const frontTail = ts.chain[splitState.index - 1];
  const rearHead = ts.chain[splitState.index];
  const frontExtra =
    frontTail.offset + getSplitLocalOffset(ts, splitState.index - 1);

  if (rearHead.offset < frontExtra - SPLIT_MERGE_EPSILON) {
    return;
  }

  rearHead.offset = frontExtra;
  if (Math.abs(rearHead.offset) < 0.04) {
    rearHead.offset = 0;
    rearHead.offsetMode = "idle";
  }

  const seamIndex = splitState.index - 1;
  const seamActionId = splitState.actionId;
  absorbSplitState(game, ts);
  triggerMergeSettle(ts, seamIndex);
  game.queueAdjacentMatchChecks(seamIndex, seamIndex + 1, seamActionId, 0.03, "seam", ts.trackIndex);
}
```

`absorbSplitState`:
```js
function absorbSplitState(game, ts) {
  const splitState = ts.getSplitState();
  if (!splitState) {
    return;
  }

  const absorbedBaseline = getSplitLocalOffset(ts, splitState.index - 1);
  ts.setChainHeadS(ts.getChainHeadS() + absorbedBaseline);

  for (let index = 0; index < ts.chain.length; index += 1) {
    const localOffset =
      index < splitState.index ? getSplitLocalOffset(ts, index) : 0;
    const residualOffset = localOffset - absorbedBaseline;
    if (!residualOffset) {
      continue;
    }
    ts.chain[index].offset += residualOffset;
    ts.chain[index].offsetMode = "close";
  }

  ts.setSplitState(null);
}
```

`triggerMergeSettle`:
```js
function triggerMergeSettle(ts, seamIndex) {
  ts.setMergeSettle({
    timer: MERGE_SETTLE_DURATION,
    duration: MERGE_SETTLE_DURATION,
  });

  const impactProfile = [0.88, 0.58, 0.34];
  for (let distance = 0; distance < impactProfile.length; distance += 1) {
    const frontIndex = seamIndex - distance;
    const rearIndex = seamIndex + 1 + distance;
    const amount = impactProfile[distance];
    addImpactToChain(ts.chain, frontIndex, amount);
    addImpactToChain(ts.chain, rearIndex, amount);
  }
}

function addImpactToChain(chain, index, amount) {
  if (index < 0 || index >= chain.length) {
    return;
  }
  chain[index].impact = Math.max(chain[index].impact, amount);
}
```

Keep the existing `addImpact` export for external callers:
```js
export function addImpact(game, index, amount, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  addImpactToChain(ts.chain, index, amount);
}
```

- [ ] **Step 8: Refactor `applyInsertSpacingWave` to accept `trackIndex`**

```js
export function applyInsertSpacingWave(game, insertIndex, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  const frontNudgeProfile = [6, 3];
  const rearOpenProfile = [8, 5, 2, 0];

  for (let offsetIndex = 0; offsetIndex < frontNudgeProfile.length; offsetIndex += 1) {
    const chainIndex = insertIndex - 1 - offsetIndex;
    if (chainIndex < 0) {
      break;
    }
    ts.chain[chainIndex].offset += frontNudgeProfile[offsetIndex];
    ts.chain[chainIndex].offsetMode = "insert";
  }

  for (let offsetIndex = 0; insertIndex + 1 + offsetIndex < ts.chain.length; offsetIndex += 1) {
    const chainIndex = insertIndex + 1 + offsetIndex;
    const immediateClearance = rearOpenProfile[offsetIndex] ?? 0;
    ts.chain[chainIndex].offset += BALL_SPACING - immediateClearance;
    ts.chain[chainIndex].offsetMode = "insert";
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add src/chain.js
git commit -m "refactor: chain.js uses getTrackState for dual-track support

All internal functions now operate on a TrackState object instead of
reading game.chain/chainHeadS/splitState directly. Public API gains
optional trackIndex parameter (default 0). Lose detection moved to
per-track flags instead of direct setGameState call.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Update main.js delegation wrappers for `trackIndex`

**Files:**
- Modify: `src/main.js`

The ZumaGame delegation wrappers need to pass `trackIndex` through to the refactored chain.js functions.

- [ ] **Step 1: Update chain delegation wrappers**

Update these methods on ZumaGame to accept and forward `trackIndex`:

```js
  createChain(trackIndex = 0) {
    createChainFn(this, trackIndex);
  }

  updateChain(dt, trackIndex = 0) {
    updateChainFn(this, dt, trackIndex);
  }

  syncChainPositions(trackIndex = 0) {
    syncChainPositionsFn(this, trackIndex);
  }

  hasGapBetween(leftIndex, rightIndex, trackIndex = 0) {
    return hasGapBetweenFn(this, leftIndex, rightIndex, trackIndex);
  }

  getSplitGap(trackIndex = 0) {
    return getSplitGapFn(this, trackIndex);
  }

  addImpact(index, amount, trackIndex = 0) {
    addImpactFn(this, index, amount, trackIndex);
  }

  applyInsertSpacingWave(insertIndex, trackIndex = 0) {
    applyInsertSpacingWaveFn(this, insertIndex, trackIndex);
  }
```

- [ ] **Step 2: Import `getTrackState` in main.js**

Add to the chain.js import line:

```js
import {
  createChain as createChainFn,
  createChainBall as createChainBallFn,
  updateChain as updateChainFn,
  syncChainPositions as syncChainPositionsFn,
  hasGapBetween as hasGapBetweenFn,
  getSplitGap as getSplitGapFn,
  addImpact as addImpactFn,
  applyInsertSpacingWave as applyInsertSpacingWaveFn,
  getTrackState as getTrackStateFn,
} from './chain.js';
```

- [ ] **Step 3: Update `resetRound()` to create both chains**

After the existing `this.createChain();` call, add:

```js
    if (this.isDualTrack) {
      this.createChain(1);
    }
```

- [ ] **Step 4: Update `update()` to run both chains and check lose condition**

Replace the chain update + round outcome section in `update()`:

```js
    // Reset per-frame lose flags
    this.track1ReachedGoal = false;
    this.track2ReachedGoal = false;

    this.updateAim(dt);
    this.updateChain(dt, 0);
    if (this.isDualTrack) {
      this.updateChain(dt, 1);
    }
    // Check lose: both tracks must have reached goal
    if (this.track1ReachedGoal && (!this.isDualTrack || this.track2ReachedGoal)) {
      this.setGameState("lose");
      this.screenShake = 1;
    }
    if (!this.isRoundPlaying()) {
      return;
    }
    this.syncShooterPalettes();
    this.updateProjectile(dt);
    this.updateRoundOutcome();
```

- [ ] **Step 5: Update `updateRoundOutcome()` for dual win condition**

Replace the existing method:

```js
  updateRoundOutcome() {
    if (!this.isRoundPlaying()) {
      return;
    }

    const chain1Empty = this.chain.length === 0;
    const chain2Empty = !this.isDualTrack || this.chain2.length === 0;
    if (
      chain1Empty && chain2Empty &&
      !this.projectile &&
      this.pendingMatchChecks.length === 0
    ) {
      this.setGameState("win");
    }
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: main.js wrappers forward trackIndex, dual chain update loop

Delegation wrappers pass trackIndex to chain.js. update() runs both
chains, checks dual lose condition. Win requires both chains empty.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Refactor match.js for dual-track support

**Files:**
- Modify: `src/match.js`

Add `trackIndex` to pending match checks and make `resolveMatchesFrom` operate on the correct chain via `getTrackState`.

- [ ] **Step 1: Import `getTrackState` and path functions**

Add to the imports at the top of `match.js`:

```js
import { getTrackState } from './chain.js';
import { getPointAtDistance as getPointAtDistanceFn } from './path.js';
```

- [ ] **Step 2: Add `trackIndex` to `queueMatchCheck`**

Update the signature and the pending check object:

```js
export function queueMatchCheck(
  game,
  ballId,
  delay = INSERT_MATCH_DELAY,
  actionId = null,
  trigger = "insert",
  trackIndex = 0,
) {
  const existing = game.pendingMatchChecks.find(
    (check) =>
      check.ballId === ballId &&
      check.actionId === actionId &&
      check.trigger === trigger &&
      check.trackIndex === trackIndex,
  );
  if (existing) {
    existing.delay = Math.min(existing.delay, delay);
    return;
  }

  game.pendingMatchChecks.push({ ballId, delay, actionId, trigger, trackIndex });
}
```

- [ ] **Step 3: Update `updatePendingMatchChecks` to use track-aware chain lookup**

```js
export function updatePendingMatchChecks(game, dt) {
  if (game.pendingMatchChecks.length === 0) {
    return;
  }

  const dueChecks = [];

  game.pendingMatchChecks = game.pendingMatchChecks.filter((check) => {
    check.delay -= dt;
    if (check.delay <= 0) {
      dueChecks.push(check);
      return false;
    }
    return true;
  });

  for (const check of dueChecks) {
    const trackIndex = check.trackIndex ?? 0;
    const ts = getTrackState(game, trackIndex);
    const index = ts.chain.findIndex((ball) => ball.id === check.ballId);
    if (index >= 0) {
      resolveMatchesFrom(game, index, check.actionId, check.trigger, trackIndex);
    }
  }
}
```

- [ ] **Step 4: Add `trackIndex` to `setBallAction` and `queueAdjacentMatchChecks`**

```js
export function setBallAction(game, index, actionId, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  if (
    actionId === null ||
    actionId === undefined ||
    index < 0 ||
    index >= ts.chain.length
  ) {
    return;
  }
  ts.chain[index].lastActionId = actionId;
}

export function queueAdjacentMatchChecks(
  game,
  leftIndex,
  rightIndex,
  actionId,
  delay = INSERT_MATCH_DELAY,
  trigger = "chain",
  trackIndex = 0,
) {
  setBallAction(game, leftIndex, actionId, trackIndex);
  setBallAction(game, rightIndex, actionId, trackIndex);

  const ts = getTrackState(game, trackIndex);
  const queuedIds = new Set();
  const candidates = [leftIndex, rightIndex];
  for (const index of candidates) {
    if (index < 0 || index >= ts.chain.length) {
      continue;
    }

    const ballId = ts.chain[index].id;
    if (queuedIds.has(ballId)) {
      continue;
    }

    queuedIds.add(ballId);
    queueMatchCheck(game, ballId, delay, actionId, trigger, trackIndex);
  }
}
```

- [ ] **Step 5: Add `trackIndex` to `trimActionContexts`**

Update to also protect `splitState2.actionId`:

```js
export function trimActionContexts(game) {
  if (game.actionContexts.size <= 64) {
    return;
  }

  const protectedIds = new Set();
  if (game.projectile?.actionId) {
    protectedIds.add(game.projectile.actionId);
  }
  if (game.splitState?.actionId) {
    protectedIds.add(game.splitState.actionId);
  }
  if (game.splitState2?.actionId) {
    protectedIds.add(game.splitState2.actionId);
  }
  for (const check of game.pendingMatchChecks) {
    if (check.actionId) {
      protectedIds.add(check.actionId);
    }
  }

  for (const actionId of game.actionContexts.keys()) {
    if (game.actionContexts.size <= 64) {
      break;
    }
    if (!protectedIds.has(actionId)) {
      game.actionContexts.delete(actionId);
    }
  }
}
```

- [ ] **Step 6: Refactor `resolveMatchesFrom` to use TrackState**

This is the longest change. Replace the entire function. Key changes: use `ts.chain` instead of `game.chain`, use `game.hasGapBetween(..., trackIndex)`, call `game.syncChainPositions(trackIndex)`, use track-aware helpers. The algorithm stays identical:

```js
export function resolveMatchesFrom(game, index, actionId = null, trigger = "insert", trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  if (index < 0 || index >= ts.chain.length) {
    return;
  }

  game.syncChainPositions(trackIndex);

  const resolvedActionId =
    actionId ?? ts.chain[index].lastActionId ?? createActionContext(game, "chain");

  const splitState = ts.getSplitState();
  const splitIndexBeforeRemoval = splitState ? splitState.index : null;
  const color = ts.chain[index].paletteIndex;
  let start = index;
  let end = index;

  while (
    start > 0 &&
    !game.hasGapBetween(start - 1, start, trackIndex) &&
    ts.chain[start - 1].paletteIndex === color
  ) {
    start -= 1;
  }

  while (
    end < ts.chain.length - 1 &&
    !game.hasGapBetween(end, end + 1, trackIndex) &&
    ts.chain[end + 1].paletteIndex === color
  ) {
    end += 1;
  }

  if (end - start + 1 < 3) {
    return;
  }

  const removedCount = end - start + 1;
  const firstVisibleIndex = ts.chain.findIndex(
    (ball) => ball.s >= 0 && ball.s <= ts.totalPathLength,
  );
  const removesVisibleHead =
    firstVisibleIndex >= 0 &&
    start <= firstVisibleIndex &&
    end >= firstVisibleIndex;
  const visibleHeadAnchorS =
    removesVisibleHead && end + 1 < ts.chain.length
      ? ts.chain[end + 1].s
      : null;
  const leadingTrimCount = removesVisibleHead ? start : 0;
  recordMatchEvent(game, { actionId: resolvedActionId, removedCount, trigger });

  game.spawnMatchParticles(ts.chain, start, removedCount, color);

  ts.chain.splice(start, removedCount);

  if (leadingTrimCount > 0) {
    ts.chain.splice(0, leadingTrimCount);
  }

  const effectiveStart = start - leadingTrimCount;

  if (removesVisibleHead) {
    absorbHeadRemovalIntoBaseline(ts, removedCount + leadingTrimCount);
  } else {
    for (let i = effectiveStart; i < ts.chain.length; i += 1) {
      ts.chain[i].offset -= removedCount * BALL_SPACING;
      ts.chain[i].offsetMode = "close";
      ts.chain[i].lastActionId = resolvedActionId;
    }
  }

  if (ts.chain.length === 0) {
    ts.setSplitState(null);
    // Remove pending checks for this track only
    game.pendingMatchChecks = game.pendingMatchChecks.filter(
      (c) => (c.trackIndex ?? 0) !== trackIndex,
    );
    return;
  }

  game.syncShooterPalettes();

  const seamIndex = Math.max(0, effectiveStart - 1);
  game.addImpact(seamIndex, 0.82, trackIndex);
  game.addImpact(Math.min(ts.chain.length - 1, seamIndex + 1), 0.82, trackIndex);

  if (splitIndexBeforeRemoval !== null) {
    const currentSplit = ts.getSplitState();
    if (currentSplit) {
      const trimmedBeforeSplit = Math.min(leadingTrimCount, splitIndexBeforeRemoval);
      const removedBeforeSplit = end < splitIndexBeforeRemoval ? removedCount : 0;
      currentSplit.index = Math.max(
        0,
        splitIndexBeforeRemoval - trimmedBeforeSplit - removedBeforeSplit,
      );

      if (currentSplit.index <= 0 || currentSplit.index >= ts.chain.length) {
        ts.setSplitState(null);
      }
    }
  } else if (effectiveStart > 0 && effectiveStart < ts.chain.length) {
    ts.setSplitState({
      index: effectiveStart,
      frontPull: 0,
      initialGap: 0,
      actionId: resolvedActionId,
    });
    const newSplit = ts.getSplitState();
    newSplit.initialGap = game.getSplitGap(trackIndex) ?? removedCount * BALL_SPACING;
    return;
  }

  if (removesVisibleHead) {
    alignVisibleHeadToAnchor(ts, visibleHeadAnchorS, game, trackIndex);
    if (!ts.getSplitState()) {
      absorbLeadingBallOffsetIntoBaseline(ts);
    }
  }

  if (
    seamIndex < ts.chain.length - 1 &&
    !game.hasGapBetween(seamIndex, seamIndex + 1, trackIndex)
  ) {
    queueAdjacentMatchChecks(
      game,
      seamIndex,
      seamIndex + 1,
      resolvedActionId,
      INSERT_MATCH_DELAY * 1.15,
      "chain",
      trackIndex,
    );
  }
}
```

Also refactor the helper functions in match.js to use TrackState:

```js
function absorbHeadRemovalIntoBaseline(ts, removedCount) {
  if (removedCount <= 0) {
    return;
  }
  const baselineShift = removedCount * BALL_SPACING;
  shiftChainBaseline(ts, -baselineShift);
}

function shiftChainBaseline(ts, deltaS) {
  if (!deltaS) {
    return;
  }
  ts.setChainHeadS(ts.getChainHeadS() + deltaS);
  const intro = ts.getChainIntro();
  if (intro) {
    intro.targetHeadS += deltaS;
  }
}

function alignVisibleHeadToAnchor(ts, anchorS, game, trackIndex) {
  if (anchorS === null || anchorS === undefined || ts.chain.length === 0) {
    return;
  }
  game.syncChainPositions(trackIndex);
  shiftChainBaseline(ts, anchorS - ts.chain[0].s);
}

function absorbLeadingBallOffsetIntoBaseline(ts) {
  if (ts.chain.length === 0) {
    return;
  }
  const sharedOffset = ts.chain[0].offset;
  if (!sharedOffset) {
    return;
  }
  const canAbsorbSharedOffset = ts.chain.every(
    (ball) =>
      ball.offsetMode === "close" &&
      Math.abs(ball.offset - sharedOffset) < 0.04,
  );
  if (!canAbsorbSharedOffset) {
    return;
  }
  shiftChainBaseline(ts, sharedOffset);
  for (const ball of ts.chain) {
    ball.offset -= sharedOffset;
    if (Math.abs(ball.offset) < 0.04) {
      ball.offset = 0;
      ball.offsetMode = "idle";
    }
  }
}
```

- [ ] **Step 7: Update main.js delegation wrappers for match.js**

Update these wrappers on ZumaGame:

```js
  queueMatchCheck(ballId, delay, actionId, trigger, trackIndex = 0) {
    queueMatchCheckFn(this, ballId, delay, actionId, trigger, trackIndex);
  }

  setBallAction(index, actionId, trackIndex = 0) {
    setBallActionFn(this, index, actionId, trackIndex);
  }

  queueAdjacentMatchChecks(leftIndex, rightIndex, actionId, delay, trigger, trackIndex = 0) {
    queueAdjacentMatchChecksFn(this, leftIndex, rightIndex, actionId, delay, trigger, trackIndex);
  }

  resolveMatchesFrom(index, actionId = null, trigger = "insert", trackIndex = 0) {
    resolveMatchesFromFn(this, index, actionId, trigger, trackIndex);
  }
```

- [ ] **Step 8: Commit**

```bash
git add src/match.js src/main.js
git commit -m "feat: match.js uses trackIndex for dual-track chain operations

pendingMatchChecks entries carry trackIndex. resolveMatchesFrom,
queueAdjacentMatchChecks, setBallAction all operate on the correct
chain via getTrackState. actionContexts remain shared for cross-track
combo accumulation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Update projectile.js for dual-track collision

**Files:**
- Modify: `src/projectile.js`
- Modify: `src/main.js` (minor wrapper update)

- [ ] **Step 1: Import `getTrackState` and path functions**

Add to imports in `projectile.js`:

```js
import { getTrackState } from './chain.js';
import { getClosestPathDistance as getClosestPathDistanceFn } from './path.js';
```

- [ ] **Step 2: Refactor `findChainCollision` to scan both chains**

Replace the existing function:

```js
export function findChainCollision(game) {
  if (!game.projectile) {
    return null;
  }

  let best = null;

  // Scan both tracks (track 0 always, track 1 only if dual-track)
  const trackCount = game.isDualTrack ? 2 : 1;
  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    const ts = getTrackState(game, trackIndex);
    if (ts.chain.length === 0) {
      continue;
    }

    for (let index = 0; index < ts.chain.length; index += 1) {
      const ball = ts.chain[index];
      if (ball.s < 0 || ball.s > ts.totalPathLength) {
        continue;
      }

      const distance = Math.hypot(
        game.projectile.x - ball.screenX,
        game.projectile.y - ball.screenY,
      );

      if (distance <= BALL_DIAMETER - 4 && (!best || distance < best.distance)) {
        best = {
          hitIndex: index,
          hitS: ball.s,
          projectileS: getClosestPathDistanceFn(
            ts.pathPoints,
            game.projectile.x,
            game.projectile.y,
          ),
          distance,
          trackIndex,
        };
      }
    }
  }

  return best;
}
```

- [ ] **Step 3: Refactor `insertProjectile` to use trackIndex**

Replace the existing function:

```js
export function insertProjectile(game, { hitIndex, hitS, projectileS, trackIndex = 0 }) {
  const ts = getTrackState(game, trackIndex);
  const insertIndex = projectileS > hitS ? hitIndex : hitIndex + 1;
  const safeIndex = Math.max(0, Math.min(ts.chain.length, insertIndex));
  const insertedBall = game.createChainBall(game.projectile.paletteIndex);
  const targetS = ts.getChainHeadS() - safeIndex * BALL_SPACING;
  const insertionOffset = Math.max(
    -BALL_SPACING * 1.25,
    Math.min(BALL_SPACING * 1.25, projectileS - targetS),
  );

  insertedBall.offset = insertionOffset;
  insertedBall.offsetMode = "insert";
  insertedBall.impact = 1;
  insertedBall.lastActionId = game.projectile.actionId ?? null;

  const splitState = ts.getSplitState();
  if (splitState && safeIndex < splitState.index) {
    splitState.index += 1;
  }

  ts.chain.splice(safeIndex, 0, insertedBall);

  game.applyInsertSpacingWave(safeIndex, trackIndex);

  game.addImpact(safeIndex - 1, 0.72, trackIndex);
  game.addImpact(safeIndex + 1, 0.72, trackIndex);
  game.queueMatchCheck(insertedBall.id, INSERT_MATCH_DELAY, game.projectile.actionId, "insert", trackIndex);
  game.syncChainPositions(trackIndex);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/projectile.js
git commit -m "feat: projectile scans both chains, inserts into correct track

findChainCollision scans chain and chain2, returns nearest hit with
trackIndex. insertProjectile uses trackIndex for chain splice, impact,
spacing wave, and match queue.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Rendering — dual track, goal, and chain drawing

**Files:**
- Modify: `src/render/scene.js`
- Modify: `src/render/index.js`

- [ ] **Step 1: Refactor `drawChain` to accept a chain array parameter**

In `scene.js`, replace the existing `drawChain`:

```js
export function drawChain(game, ctx, chain, totalPathLength) {
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
```

- [ ] **Step 2: Refactor `drawTrack` and `strokePath` to accept a Path2D**

Replace `strokePath`:

```js
function strokePath(ctx, trackPath) {
  ctx.stroke(trackPath);
}
```

Replace `drawTrack`:

```js
export function drawTrack(game, ctx, trackPath) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(18, 22, 28, 0.14)";
  ctx.lineWidth = 16;
  strokePath(ctx, trackPath);

  ctx.strokeStyle = "rgba(111, 121, 130, 0.92)";
  ctx.lineWidth = 10;
  strokePath(ctx, trackPath);

  ctx.strokeStyle = "rgba(60, 70, 78, 0.34)";
  ctx.lineWidth = 4;
  strokePath(ctx, trackPath);

  ctx.restore();
}
```

- [ ] **Step 3: Refactor `drawGoal` to accept pathPoints**

```js
export function drawGoal(game, ctx, pathPoints) {
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
```

- [ ] **Step 4: Update `createStaticSceneCache` for dual tracks**

Replace the track/goal drawing section (the clipped section near the end):

```js
  cCtx.save();
  cCtx.beginPath();
  cCtx.rect(0, clipTop, GAME_WIDTH, clipH);
  cCtx.clip();
  if (!(bgCfg && bgImg)) {
    drawTrack(game, cCtx, game.cachedTrackPath);
    if (game.cachedTrackPath2) {
      drawTrack(game, cCtx, game.cachedTrackPath2);
    }
  }
  drawGoal(game, cCtx, game.pathPoints);
  if (game.pathPoints2 && game.pathPoints2.length > 0) {
    drawGoal(game, cCtx, game.pathPoints2);
  }
  cCtx.restore();
  game.staticSceneCache = cache;
```

- [ ] **Step 5: Update `render/index.js` to call `drawChain` with parameters**

In `render()`, replace the `drawChain(game, ctx)` call:

```js
  drawChain(game, ctx, game.chain, game.totalPathLength);
  if (game.isDualTrack) {
    drawChain(game, ctx, game.chain2, game.totalPathLength2);
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/render/scene.js src/render/index.js
git commit -m "feat: rendering supports dual tracks, goals, and chains

drawChain, drawTrack, drawGoal, strokePath all parameterized to accept
track-specific data. createStaticSceneCache draws both tracks/goals.
render() calls drawChain twice for dual-track levels.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Shooter palette merging and particle signature update

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Update `getActivePaletteIndices` to merge both chains**

Replace the existing method:

```js
  getActivePaletteIndices() {
    const trackInfos = this.isDualTrack
      ? [
          { chain: this.chain, totalPathLength: this.totalPathLength },
          { chain: this.chain2, totalPathLength: this.totalPathLength2 },
        ]
      : [{ chain: this.chain, totalPathLength: this.totalPathLength }];

    const visiblePalettes = [];
    const allChainPalettes = [];
    const visibleSeen = new Set();
    const allSeen = new Set();

    for (const { chain, totalPathLength } of trackInfos) {
      for (const ball of chain) {
        if (!allSeen.has(ball.paletteIndex)) {
          allSeen.add(ball.paletteIndex);
          allChainPalettes.push(ball.paletteIndex);
        }

        if (
          ball.s >= 0 &&
          ball.s <= totalPathLength &&
          !visibleSeen.has(ball.paletteIndex)
        ) {
          visibleSeen.add(ball.paletteIndex);
          visiblePalettes.push(ball.paletteIndex);
        }
      }
    }

    if (visiblePalettes.length > 0) {
      return visiblePalettes;
    }

    if (allChainPalettes.length > 0) {
      return allChainPalettes;
    }

    const colorCount = this.levelConfig?.colorCount ?? 4;
    return Array.from({ length: colorCount }, (_, index) => index);
  }
```

- [ ] **Step 2: Update `syncShooterPalettes` to check both chains**

Replace the existing method:

```js
  syncShooterPalettes() {
    const totalBalls = this.chain.length + (this.isDualTrack ? this.chain2.length : 0);
    if (totalBalls === 0) {
      return;
    }

    const activePalettes = this.getActivePaletteIndices();
    const activeSet = new Set(activePalettes);

    if (!activeSet.has(this.currentPaletteIndex)) {
      this.currentPaletteIndex = this.getRandomPaletteIndex();
    }

    if (!activeSet.has(this.nextPaletteIndex)) {
      this.nextPaletteIndex = this.getRandomPaletteIndex();
    }
  }
```

- [ ] **Step 3: Update `spawnMatchParticles` to accept chain as parameter**

Replace the existing method:

```js
  spawnMatchParticles(chain, startIndex, count, paletteIndex) {
    const palette = BALL_PALETTES[paletteIndex];
    const colors = [palette.base, palette.bright, palette.accent];

    for (let i = 0; i < count; i++) {
      const ball = chain[startIndex + i];

      for (let j = 0; j < PARTICLE_COUNT_PER_BALL; j++) {
        if (this.particles.length >= PARTICLE_MAX_TOTAL) {
          this.particles.shift();
        }
        const angle = Math.random() * TAU;
        const speed =
          PARTICLE_SPEED_MIN +
          Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
        this.particles.push({
          x: ball.screenX,
          y: ball.screenY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          age: 0,
          lifetime: PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6),
          size: 2.5 + Math.random() * 3,
          color: colors[(j + i) % colors.length],
        });
      }
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: shooter palette merges both chains, particles take chain param

getActivePaletteIndices scans both chains for color availability.
spawnMatchParticles accepts chain array parameter instead of reading
this.chain directly.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Manual integration test and polish

**Files:**
- Possibly minor fixes across any modified file

- [ ] **Step 1: Start the dev server and load Level 9**

Run: `cd /Users/reikjiang/Documents/src/ZUMA && npx vite`

Open the browser, go to Level 9 "双蛇祭道". Verify:
- Two tracks are visible (upper and lower S-curves)
- Two ball chains roll in from off-screen
- Frog sits in the middle at (215, 466)
- Two goal markers visible at path endpoints

- [ ] **Step 2: Test firing at both paths**

- Aim up and fire at the upper chain — ball inserts correctly
- Aim down and fire at the lower chain — ball inserts correctly
- Projectile always hits the nearest ball across both chains

- [ ] **Step 3: Test match mechanics**

- Create a 3-in-a-row match on the upper chain — balls eliminated, particles spawn
- Create a 3-in-a-row match on the lower chain — same behavior
- Combo counter increments across paths (hit upper, then lower = combo x2)

- [ ] **Step 4: Test split/merge on both chains**

- Create a middle-chain match on upper path — chain splits, rear chases front
- While upper chain is split, fire at lower chain — both chains operate independently
- Verify seam closure triggers cross-seam re-match correctly

- [ ] **Step 5: Test win condition**

- Clear both chains completely → "胜利" end card appears
- Clear only one chain, wait for the other to reach goal → game continues (not instant win)

- [ ] **Step 6: Test lose condition**

- Let both chains reach their goals → "失败" screen + screen shake
- Let only one chain reach goal, other still active → game continues (not instant lose)

- [ ] **Step 7: Test existing levels (regression)**

- Play through Level 1 and Level 8 briefly
- Verify no visual or gameplay differences
- Verify Level 9 appears unlocked after Level 8 is beaten (or unlock manually via console)

- [ ] **Step 8: Fix any issues found during testing**

Address any bugs discovered in the previous steps.

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix: address integration test issues for dual-track Level 9

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Final cleanup and documentation

**Files:**
- Modify: `CLAUDE.md` (update project status and architecture notes)

- [ ] **Step 1: Update CLAUDE.md**

Add dual-track notes to the Architecture section. Under "Known Technical Debt" or a new section, note that the dual-track implementation uses field duplication (`*2` fields) and would benefit from a generic multi-track array if more than 2 tracks are ever needed.

Update "Current Status" to mention Level 9 dual-track.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with dual-track architecture notes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
