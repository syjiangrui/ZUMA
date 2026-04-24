# Dual-Track Level Design Spec

**Date**: 2026-04-25
**Status**: Draft
**Scope**: Add a single dual-path level (Level 9) to the Zuma game. Two independent ball chains run on two separate paths simultaneously; one shared shooter (frog) fires at both.

---

## 1. Gameplay Rules

| Rule | Decision |
|------|----------|
| Lose condition | Both chains reach their respective goals (not just one) |
| Win condition | Both chains fully cleared |
| Shooter | Single frog, free aim at both paths |
| Combo | Shared across paths (same `actionContexts` Map) |
| Path layout | Top/bottom split (upper path + lower path, frog in the middle) |
| Path data | Hardcoded bezier points for now; path editor support deferred |
| Scope | Only Level 9 uses dual-track; existing 8 levels unchanged |

---

## 2. Level Config Extension

### 2.1 New `tracks` field

Dual-track levels declare a `tracks` array instead of top-level `chainCount` / `chainSpeed` / `colorCount` / `pathType` / `pathParams`:

```js
{
  id: 9,
  name: "双蛇祭道",
  tracks: [
    {
      chainCount: 18,
      chainSpeed: 35,
      colorCount: 4,
      pathType: "bezier",
      pathParams: { points: [...] },  // upper half
    },
    {
      chainCount: 18,
      chainSpeed: 38,
      colorCount: 4,
      pathType: "bezier",
      pathParams: { points: [...] },  // lower half
    },
  ],
  shooterPos: { x: 215, y: 466 },
}
```

Single-track levels do **not** have a `tracks` field. All existing level configs remain untouched.

### 2.2 Backward compatibility

Code checks `levelConfig.tracks` presence to branch:
- **Present**: dual-track mode, read per-track config from `tracks[0]` / `tracks[1]`
- **Absent**: single-track mode, read top-level `chainCount` / `pathType` / etc. (current behavior)

---

## 3. ZumaGame State Duplication

When dual-track is active, ZumaGame carries a parallel set of fields for the second track:

| Track 0 (existing) | Track 1 (new) | Type |
|---------------------|---------------|------|
| `pathPoints` | `pathPoints2` | `Array<{x,y,len}>` |
| `totalPathLength` | `totalPathLength2` | `number` |
| `cachedTrackPath` | `cachedTrackPath2` | `Path2D` |
| `chain` | `chain2` | `Array<Ball>` |
| `chainHeadS` | `chainHeadS2` | `number` |
| `splitState` | `splitState2` | `object \| null` |
| `chainIntro` | `chainIntro2` | `object \| null` |
| `mergeSettle` | `mergeSettle2` | `object \| null` |

In single-track mode, all `*2` fields are `null` / `[]` / `0`. No runtime cost.

### 3.1 `isDualTrack` accessor

```js
get isDualTrack() {
  return Array.isArray(this.levelConfig?.tracks) && this.levelConfig.tracks.length > 1;
}
```

Derived from level config, not from runtime chain state. Stable throughout a round.

### 3.2 Fields that remain global (shared across tracks)

- `projectile` — one projectile in flight at a time
- `actionContexts` — combo/score accumulation (enables cross-track shared combo)
- `pendingMatchChecks` — unified queue; each entry carries a `trackIndex`
- `score`, `bestCombo`, `recentCombo` — global
- `particles` — shared particle pool
- `shooter`, `pointer` — single frog
- `currentPaletteIndex`, `nextPaletteIndex` — derived from merged color pool

---

## 4. Core Logic Changes

### 4.1 Track state accessor (`chain.js`)

A helper function provides a uniform interface to either track's state:

```js
function getTrackState(game, trackIndex) {
  if (trackIndex === 1) {
    return {
      chain: game.chain2,
      getChainHeadS: () => game.chainHeadS2,
      setChainHeadS: (v) => { game.chainHeadS2 = v; },
      getSplitState: () => game.splitState2,
      setSplitState: (v) => { game.splitState2 = v; },
      pathPoints: game.pathPoints2,
      totalPathLength: game.totalPathLength2,
      getChainIntro: () => game.chainIntro2,
      setChainIntro: (v) => { game.chainIntro2 = v; },
      getMergeSettle: () => game.mergeSettle2,
      setMergeSettle: (v) => { game.mergeSettle2 = v; },
    };
  }
  // trackIndex === 0: return existing fields with same interface
  return {
    chain: game.chain,
    getChainHeadS: () => game.chainHeadS,
    setChainHeadS: (v) => { game.chainHeadS = v; },
    getSplitState: () => game.splitState,
    setSplitState: (v) => { game.splitState = v; },
    pathPoints: game.pathPoints,
    totalPathLength: game.totalPathLength,
    getChainIntro: () => game.chainIntro,
    setChainIntro: (v) => { game.chainIntro = v; },
    getMergeSettle: () => game.mergeSettle,
    setMergeSettle: (v) => { game.mergeSettle = v; },
  };
}
```

All chain.js internal functions (`advanceChainBaseline`, `updateBallTransitions`, `resolveSplitClosure`, `syncChainPositions`) are refactored to operate on a `TrackState` object instead of reaching directly into `game.*` fields. Their core algorithms remain identical.

### 4.2 Path lookup delegation

`ZumaGame.getPointAtDistance(s)` and `getClosestPathDistance(x, y)` currently hardcode `this.pathPoints` / `this.totalPathLength`. For dual-track, the `TrackState` object carries its own `pathPoints` / `totalPathLength`, and chain.js / projectile.js / match.js call the pure functions (`getPointAtDistanceFn`, `getClosestPathDistanceFn`) directly with the track-specific arrays instead of going through the ZumaGame wrapper. The wrapper remains unchanged for single-track callers.

### 4.3 Path creation

`resetRound()` detects `levelConfig.tracks`:
- **Dual-track**: calls `createPathFn()` twice with each track's `pathType` / `pathParams`. Stores results in `pathPoints` + `pathPoints2`, etc.
- **Single-track**: existing logic, clears all `*2` fields.

### 4.4 Chain creation and update

`createChain(game)` is extended to also populate `chain2` / `chainHeadS2` / `splitState2` / `chainIntro2` when `isDualTrack`. Uses track-specific `chainCount` / `colorCount` / `chainSpeed` from `tracks[1]`.

`updateChain(game, dt)` is called for track 0. In `main.js update()`, if `isDualTrack`, a second call `updateChain(game, dt, 1)` runs the same logic for track 1.

### 4.5 Collision detection (`projectile.js`)

`findChainCollision` scans both chains, returns the nearest hit with an added `trackIndex` field:

```js
// Scan chain (trackIndex=0)
// Scan chain2 (trackIndex=1) — uses pathPoints2/totalPathLength2 for getClosestPathDistance
// Return whichever hit is closest, with { hitIndex, hitS, projectileS, distance, trackIndex }
```

`insertProjectile` uses `trackIndex` to operate on the correct chain / splitState.

### 4.6 Match detection (`match.js`)

Each `pendingMatchChecks` entry gains a `trackIndex` field (default `0`).

`resolveMatchesFrom(game, index, actionId, trigger, trackIndex)` uses `getTrackState(game, trackIndex)` to operate on the correct chain.

`actionContexts` remains the single global Map — combo naturally accumulates across tracks.

### 4.7 Win/lose conditions

**Win** (in `updateRoundOutcome`):

```js
const chain1Empty = this.chain.length === 0;
const chain2Empty = !this.isDualTrack || this.chain2.length === 0;
const noInFlight = !this.projectile && this.pendingMatchChecks.length === 0;
if (chain1Empty && chain2Empty && noInFlight) {
  this.setGameState("win");
}
```

**Lose** (in `updateChain` end-of-track check):

The tail-past-goal check is evaluated per track. A per-track boolean `trackNReachedGoal` is set. Only when **both** tracks have reached their goals does the game trigger `setGameState("lose")`.

Implementation: add `track1ReachedGoal` / `track2ReachedGoal` transient flags on `game`. Each `updateChain` call sets its flag. After both chain updates complete, `update()` checks:

```js
if (this.track1ReachedGoal && (!this.isDualTrack || this.track2ReachedGoal)) {
  this.setGameState("lose");
  this.screenShake = 1;
}
```

Flags reset at the start of each `update()` frame.

---

## 5. Rendering Changes

### 5.1 Static scene cache

`createStaticSceneCache` draws background + track(s) + goal(s). Dual-track: draw `cachedTrackPath` and `cachedTrackPath2`. Draw two goal markers at respective path endpoints.

Cache invalidation unchanged (nulled on level change / background load).

### 5.2 Chain drawing

`drawChain(ctx, game)` refactored to `drawChain(ctx, game, chain)`:

```js
drawChain(ctx, game, game.chain);
if (game.isDualTrack) {
  drawChain(ctx, game, game.chain2);
}
```

Single-track call sites pass `game.chain` explicitly. Minimal signature change.

### 5.3 Projectile & shooter

No change. One projectile, one frog — already position-independent.

### 5.4 Aim guide

The aim guide line extends from the frog. No change needed — it naturally points at whichever path the player aims toward.

---

## 6. Shooter Palette (Color Selection)

`getActivePaletteIndices()` merges colors from both chains:

```js
const chains = this.isDualTrack
  ? [{ chain: this.chain, totalPathLength: this.totalPathLength },
     { chain: this.chain2, totalPathLength: this.totalPathLength2 }]
  : [{ chain: this.chain, totalPathLength: this.totalPathLength }];

for (const { chain, totalPathLength } of chains) {
  for (const ball of chain) {
    // visible check uses the track's own totalPathLength
    if (ball.s >= 0 && ball.s <= totalPathLength && !visibleSeen.has(ball.paletteIndex)) {
      visibleSeen.add(ball.paletteIndex);
      visiblePalettes.push(ball.paletteIndex);
    }
    // ... allChainPalettes similar
  }
}
```

Ensures the shooter never offers a dead color that exists on neither chain.

---

## 7. Particles

`spawnMatchParticles(chain, startIndex, count, paletteIndex)` — takes the chain array as a parameter instead of always reading `this.chain`. Caller passes the correct chain based on `trackIndex`.

Particle pool (`this.particles`) stays global. Explosions from both tracks mix naturally.

---

## 8. Hardcoded Path Layout (Level 9)

Two opposing bezier paths, upper and lower:

```
  ┌─────────────────────────┐
  │  ● ← ← ← ← ← ← ← ●  │  Path 1: y ~250-380, flows right-to-left
  │                         │
  │         🐸 (215,466)    │  Frog centered between paths
  │                         │
  │  ● → → → → → → → → ●  │  Path 2: y ~550-700, flows left-to-right
  └─────────────────────────┘
```

Opposing directions add visual variety and strategic depth — the player must switch aim direction frequently.

Exact bezier control points to be defined during implementation (simple S-curves or gentle arcs that stay within their half of the screen).

---

## 9. Reset & Cleanup

`resetRound()`:
- Clears all `*2` fields (`chain2 = []`, `chainHeadS2 = 0`, `splitState2 = null`, etc.)
- If `isDualTrack`, creates path2 and chain2
- Resets `track1ReachedGoal` / `track2ReachedGoal` flags

`goToLevelSelect()`:
- Clears `chain2`, `splitState2`, `pathPoints2`, etc. alongside existing cleanup

---

## 10. What Is NOT In Scope

- Path editor multi-track support (deferred)
- `level-paths.json` dual-track format (deferred — hardcoded only)
- Three or more tracks (not needed; architecture is intentionally non-generic)
- Per-track independent combo (rejected — shared combo chosen)
- Multiple shooters / frog switching (rejected — single frog chosen)
- Special ball types interacting across tracks

---

## 11. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `game.chain` 40+ references may be missed | All existing refs stay for track 0; only new dual-track code paths use `chain2`. Grep for `game.chain` to audit. |
| `pendingMatchChecks` mixing up track indices | Every queue entry explicitly carries `trackIndex`. Default `0` ensures single-track backward compat. |
| Lose condition race (one track triggers lose before both checked) | Move lose check out of `updateChain` into `update()` after both chains processed. |
| Performance (two chains, double scan) | Chains are small (~18 balls each). O(n) scan doubled is negligible. |
| Existing 8 levels regression | `isDualTrack` is `false` for all existing levels; all new code paths gated behind it. |
