# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ZUMA HTML Prototype** is a mobile-first Zuma puzzle game built with vanilla HTML/CSS/JavaScript and Canvas 2D. The project is in Phase 3 (visual & audio polish) of a phased development plan. It features a central spiral track with ball chains, projectile firing mechanics, three-in-a-row matches, chain-breaking/re-merging behavior, and a scoring system.

**Repository**: https://github.com/syjiangrui/ZUMA.git

**Current Status**: Phase 3 (Visual Direction & Material Unification) in progress. Core gameplay rules are stable; ongoing work focuses on rendering quality and visual feedback.

## Development Commands

Since this is a single-page HTML game with no build system, development is straightforward:

### Run the game
- Open `index.html` directly in a web browser
- No build, transpilation, or server required
- All development can happen by editing files and refreshing the browser

### Testing gameplay
- Use desktop browser with keyboard shortcuts:
  - **Space**: Fire projectile
  - **R**: Restart round
  - **Mouse/Touch**: Drag to aim, release to fire
- Test on mobile device/browser (iOS Safari, Chrome Mobile) by opening the HTML file

### No linting or testing infrastructure
- Project currently has no formal test suite, linter, or build tooling
- Code validation is manual during development
- Future phases may introduce modularization and tooling

## Architecture & Code Organization

### High-Level System Design

The entire game logic and rendering is contained in a single `main.js` file (2,527 lines) within a `ZumaGame` class. While currently monolithic, the code is logically organized into 8 clear subsystems:

1. **Configuration & Constants** (top of file)
   - Fixed logical resolution: `430 x 932` (portrait mobile)
   - Ball physics: radius, spacing, speed tuning
   - Color palettes and temple glyph variants
   - All tunable parameters in one place

2. **Core Game Loop** (`constructor`, `loop()`, `update()`, `render()`)
   - `constructor()`: Initialize canvas, path, textures, state, event listeners
   - `loop()`: requestAnimationFrame entry point; calls `update()` then `render()`
   - `update(dt)`: Advances game logic by delta time
   - `render()`: Draws current state to canvas

3. **State Management** (`setGameState()`, `resetRound()`, `gameState`)
   - Three states: `playing`, `win`, `lose`
   - `resetRound()` is the sole entry point for cleanup and restarts
   - Clears chain, projectile, split state, action contexts, and HUD feedback

4. **Path & Geometry** (`createPath()`, `getPointAtDistance()`, `getClosestPathDistance()`, `catmullRom()`)
   - Path is an Archimedean spiral with off-screen entry/exit
   - Uses arc-length parameterization (not parametric `t`)
   - Pre-sampled into `pathPoints[]` with cumulative `len` for O(log n) distance lookups
   - Critical for stable ball movement along track

5. **Ball Chain System** (`chain[]`, `chainHeadS`, `updateChain()`, `syncChainPositions()`)
   - All balls on track share a single base position: `chainHeadS`
   - Each ball's actual position: `s = chainHeadS - (index * BALL_SPACING) + offset + splitOffset`
   - No per-ball velocity; movement is driven by advancing `chainHeadS`
   - Enables stable insertion, removal, and re-linking

6. **Split State (Chain Breaking)** (`splitState`, `resolveSplitClosure()`, `absorbSplitState()`)
   - When middle of chain is eliminated, front and rear segments split
   - Front segment freezes; rear segment chases with `close` offset
   - Tracks: `index` (split point), `frontPull` (animation), `initialGap`, `actionId`
   - Closes when rear reaches animated front position; then re-merges
   - Single split constraint: only one active `splitState` at a time

7. **Match Detection & Scoring** (`resolveMatchesFrom()`, `recordMatchEvent()`, `actionContexts[]`)
   - Three-or-more consecutive same-color balls = match
   - Delayed checking via `pendingMatchChecks` queue (not instant on insert)
   - Scoring tied to **action context** (one per projectile), not raw ball count
   - Each action accumulates: combo (match rounds), totalRemoved, totalScore
   - Scoring formula: base (100/ball) + large-group bonus + combo bonus + seam bonus

8. **Rendering** (`render()`, `drawBall()`, `drawChain()`, `drawBackground()`, etc.)
   - Layered draw order: background → track → goal → chain → projectile → aim guide → shooter → HUD → end card
   - **Shooter is a classic Zuma stone frog** (`drawShooter()` → `drawFrogBody()`, `drawFrogHead()`, `drawFrogEyes()`, `drawFrogBellyBall()`). Entire frog rotates with aim angle; ground shadow stays flat. Current ball is held in the frog's mouth (upper jaw overlaps ball top); next ball sits in a belly socket.
   - Ball textures: procedurally generated with stone body + rolling equatorial band
   - Temple glyphs: scarab, eye, sun, mask, ankh (one per color palette)
   - No external image assets; all visuals are Canvas 2D primitives or generated textures

9. **Input & UI** (`bindEvents()`, `getUiActionAt()`, `triggerUiAction()`)
   - Pointer events (mouse + touch): `pointerdown`, `pointermove`, `pointerup`
   - UI hit-tests first (restart button, next preview, end card) before game input
   - No DOM buttons; all UI drawn on canvas

### Key Data Models

#### Ball on Track (`chain[i]`)
```
{
  id: <unique>,
  paletteIndex: <0-4>,
  radius: 14,
  s: <arc-length distance>,
  rotation: <texture angle>,
  offset: <temporary displacement>,
  offsetMode: "idle" | "insert" | "close",
  impact: <visual shock magnitude>,
  lastActionId: <action that touched this ball>
}
```

#### Split State (when chain breaks)
```
{
  index: <first ball of rear segment>,
  frontPull: <front-segment pullback animation value>,
  initialGap: <size of break when created>,
  actionId: <action that caused the split>
}
```

#### Projectile (in flight)
```
{
  x, y: <screen coords>,
  vx, vy: <velocity>,
  radius: 14,
  paletteIndex: <0-4>,
  actionId: <associated action>,
  rotation, spin: <texture animation>
}
```

#### Action Context (per projectile fired)
```
{
  id: <unique>,
  source: "shot",
  combo: <number of match rounds triggered by this action>,
  totalRemoved: <cumulative balls deleted>,
  totalScore: <cumulative points>
}
```

### Critical Update Order (in `update(dt)`)

The sequence matters. Violations cause simultaneous insertion/split errors:

1. `updateHudState(dt)` — UI feedback timing
2. **Return early if not `playing`**
3. `updateAim(dt)` — Shooter aim direction
4. `updateChain(dt)` — Chain baseline + split pursuit
5. **Return early if state changed to win/lose**
6. `updateProjectile(dt)` — Projectile flight + collision
7. `updateRoundOutcome()` — Check win/lose conditions

### Position Formula (The Core Model)

Every ball on track uses this single equation:

```javascript
finalS = chainHeadS - (index * BALL_SPACING) + offset + getSplitLocalOffset(index)
```

This is **not** a per-ball velocity system. Movement is unified by advancing `chainHeadS`, then applying **temporary displacements** (`offset`) for transitions. This design avoids compound floating-point errors and makes insertion/removal deterministic.

### Offset States

The `offset` field handles all temporary position changes:
- **`idle`**: Return to 0 at `GAP_CLOSE_SPEED` (normal gap closure after removal)
- **`insert`**: Return to 0 at `INSERT_SETTLE_SPEED` (new ball settling into chain)
- **`close`**: Return to 0 at `SPLIT_CLOSE_SPEED` (rear segment chasing during split)

The speed difference is cosmetic handfeel, not a rule difference.

### Collision Detection

`findChainCollision()` finds the closest ball on track to the projectile. Simple O(n) scan; acceptable for small chains. Collision is registered when distance ≤ `projectile.radius + ball.radius`.

### Ball Color & Palette

- 5 color palettes (red, green, blue, yellow, purple)
- Currently only 4 used during play (index 0–3) to keep match density readable
- Each palette paired with one temple glyph variant for visual identity
- Procedural texture generated per palette on startup

## Important Implementation Notes

### Why Arc-Length Parameterization?

Without it, the chain would move at non-uniform speed along the curve. Arc-length sampling ensures `s` represents actual distance traveled, not parametric `t`. This is essential for predicable physics and player expectations.

### Why Delayed Matching?

Instant matching on insertion can cause mid-frame inconsistencies (e.g., a ball is both in the chain and already deleted). Queuing matches via `pendingMatchChecks` with a small delay (`INSERT_MATCH_DELAY = 0.11s`) decouples insertion animation from consumption, making the system stable.

### Why Action Context?

A single projectile can trigger:
- Initial match
- Chain break + front-segment pullback
- Rear segment catches up and re-merges
- Cross-seam re-match after merge

Naively tracking score as `delta(chain.length)` fails here. Action contexts tie all downstream events to the original shot, enabling correct combo counting and per-action scoring.

### Why Single Split State?

Current rules only allow one chain break at a time. This simplifies collision detection (`hasGapBetween()` checks only one `splitState.index`). If future phases add simultaneous multi-breaks, this architecture will need extension.

### Ball Rendering Strategy

After experiments with full-sphere UV projection (which caused center stretching and "sticker on ball" reads), the current approach uses a **rolling equatorial band**:
- Stone-colored radial gradient as ball body
- Horizontal tileable band texture scrolling around the center
- Matte shading layers to push the band back into perceived volume
- Warm wear highlight (not glass-like specular)
- Result: readable at mobile scale; avoids uncanny distortions

## Known Technical Debt

1. **Monolithic File**: `main.js` is 2,527 lines in one class. Future modularization candidates:
   - `config.js` — Constants and palettes
   - `path.js` — Path sampling and geometry
   - `chain-system.js` — Ball insertion, removal, splitting
   - `score-system.js` — Action contexts and scoring
   - `render.js` — All drawing functions
   
2. **Offset/Impact Overload**: Fields like `impact`, `offset`, `offsetMode` conflate rule state with animation state. Cleaner refactor would separate:
   - Rule state (e.g., "is in split?")
   - Animation state (e.g., "offset-return speed")
   - Cosmetic state (e.g., "visual shock intensity")

3. **No Test Suite**: Manual testing only. Phase 3+ should add unit tests for:
   - Path arc-length math
   - Match detection edge cases (seams, large gaps)
   - Action context lifecycle
   - Split/merge timing

## Phase 2 → Phase 3 Transition

**Phase 2** (completed) established the full gameplay loop: single-round lifecycle, win/lose conditions, combo tracking, cross-seam matching, and split/merge mechanics. The system is rule-stable.

**Phase 3** (in progress) is visual and audio polish:
- **Completed**: Material unification (stone body, rolling band, temple glyphs)
- **In Progress**: Particle effects, UI skin, sound effects, performance tuning
- **Not Yet**: Multi-level, special ball types, difficulty curves, save/load

When working on Phase 3 tasks:
- **Do not** change `chainHeadS` logic, offset speed tuning, or match detection rules (they are stable)
- **Do** improve ball rendering, add visual feedback, and refine hand-feel within current constraints
- Split/merge hand-feel optimization is welcome but should not alter rule correctness

## Recommended Future Refactoring Cuts

When/if modularization begins, prioritize in this order:

1. **Path system first** (lowest risk)
   - Pure math; minimal coupling to other subsystems
   
2. **Scoring system second** (clear boundaries)
   - Already logically separate; natural module boundary
   
3. **Split-state system last** (most fragile)
   - Highest coupling to chain movement; defer until you have high confidence in the rules

## Debugging Tips

- **Ball position wrong?** Check `chainHeadS`, `offset`, and `getSplitLocalOffset()` in sequence. Do not assume per-ball velocity.
- **Match not triggering?** Verify `pendingMatchChecks` queue is processing and `hasGapBetween()` is not blocking across a split.
- **Projectile missing collision?** Check `findChainCollision()` distance threshold and confirm projectile velocity is not skipping frames (see `dt` clamping at 0.033).
- **Split not merging?** Inspect `resolveSplitClosure()` epsilon and confirm rear offset has caught the animated front position.
- **Stuttering on mobile?** Profile `render()` draw calls; simplify gradient complexity or reduce particle counts if applicable.

## File Structure

```
.
├── index.html              # Single HTML entry point (minimal)
├── style.css               # Canvas sizing, page layout, color scheme
├── main.js                 # Entire game (2,527 lines; single ZumaGame class)
├── CLAUDE.md               # This file
├── TECHNICAL_ARCHITECTURE.md  # Implementation deep-dive (reference docs)
└── ZUMA_PLAN.md            # Phase 1/2/3 planning and history
```

## Mobile Viewport Notes

- Logical canvas: `430 x 932` (portrait, 9:19.6 ratio)
- CSS scales to fit viewport while preserving aspect ratio
- Safe-area insets (`env(safe-area-inset-*)`) handled for notch/dynamic island
- Touch-action disabled on canvas to prevent browser pan/zoom
- No horizontal orientation support (portrait only)

## Performance Considerations

- **Ball chain updates**: O(n) per frame (n = ball count, ~30 typical)
- **Collision detection**: O(n) linear scan; adequate for current scale
- **Path lookup**: O(log n) binary search on `pathPoints[]`
- **Particle effects** (Phase 3): Monitor frame rate on low-end phones; implement simple disable/downgrade flags if needed
- **Canvas clear + redraw**: Full-canvas repaint each frame; acceptable for this scale

## Key Parameters to Tune (all in constants section)

- `CHAIN_SPEED`: How fast the ball train advances (72 default)
- `PROJECTILE_SPEED`: How fast fired balls travel (820 default)
- `MUZZLE_OFFSET`: Projectile spawn distance from shooter center (68, matched to frog snout tip)
- `INSERT_SETTLE_SPEED` / `GAP_CLOSE_SPEED` / `SPLIT_CLOSE_SPEED`: Transition speeds
- `SPLIT_FRONT_PULL_RATIO`, `SPLIT_FRONT_PULL_MAX`: How much front chain retracts during break
- `SPLIT_MERGE_EPSILON`: Distance threshold for considering split closed
- `MERGE_SETTLE_DURATION`: Brief speed reduction after re-merge (hand-feel, not rule)

Changing these does not require code restructuring; they are all at the top of `main.js`.

## External Resources & References

- **TECHNICAL_ARCHITECTURE.md**: Detailed explanation of current implementation, data models, and rendering pipeline
- **ZUMA_PLAN.md**: Development phases, task breakdown, risk analysis, and historical progress log
- Original Zuma game mechanics: PopCap's "Zuma" (2003) — centerpiece spiral track, three-in-a-row matches, chain break/relink

