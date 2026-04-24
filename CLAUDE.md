# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ZUMA HTML Prototype** is a mobile-first Zuma puzzle game built with vanilla HTML/CSS/JavaScript and Canvas 2D. The project is in Phase 3 (visual & audio polish) of a phased development plan. It features a central spiral track with ball chains, projectile firing mechanics, three-in-a-row matches, chain-breaking/re-merging behavior, and a scoring system.

**Repository**: https://github.com/syjiangrui/ZUMA.git

**Current Status**: Phase 4 complete. ES module refactoring complete (10 modules). 8-level game with level selection, multiple path types, difficulty curve, local save/load, and fade transitions.

## Development Commands

Since this is a single-page HTML game with no build system, development is straightforward:

### Run the game
- Dev server: `npx vite` then open the URL shown (default `http://localhost:5173`)
- Build: `npx vite build` (output to `dist/`)
- Preview build: `npx vite preview`
- ES modules require HTTP — `file://` URLs will not work (CORS restriction)
- All development can happen by editing files and refreshing the browser

### Testing gameplay
- Use desktop browser with keyboard shortcuts:
  - **Space**: Fire projectile
  - **R**: Restart round
  - **Mouse/Touch**: Drag to aim, release to fire
- Test on mobile device/browser (iOS Safari, Chrome Mobile) by opening the HTML file

### Build tooling
- Vite 5.4.x for dev server and production builds
- Multi-entry: main game + path editor (`tools/path-editor/`)
- No formal test suite or linter yet

## Architecture & Code Organization

### High-Level System Design

The game logic and rendering is organized as ES modules within a `ZumaGame` orchestrator class in `main.js`, plus 7 focused module files. The code is logically organized into 10 clear subsystems:

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
   - Path system is a pluggable dispatcher with 7 generators (spiral, serpentine, rectangular, zigzag, openArc, quadratic Bezier, cubic Bezier)
   - Bezier levels are authored in `tools/path-editor/index.html` and persisted to `public/level-paths.json`
   - Uses arc-length parameterization (not parametric `t`)
   - Pre-sampled into `pathPoints[]` with cumulative `len` for O(log n) distance lookups
   - `cachedTrackPath` (Path2D) is built by the generators themselves so the renderer strokes the original curve, not the resampled polyline
   - See `docs/path-editor-and-bezier-paths.md` for data formats, editor interaction, and the pen-tool cubic Bezier workflow

5. **Ball Chain System** (`chain[]`, `chainHeadS`, `updateChain()`, `syncChainPositions()`)
   - All balls on track share a single base position: `chainHeadS`
   - Each ball's actual position: `s = chainHeadS - (index * BALL_SPACING) + offset + splitOffset`
   - No per-ball velocity; movement is driven by advancing `chainHeadS`
   - If a removal consumes the current visible head, exited leader balls are trimmed and `chainHeadS` is re-based so the surviving visible chain keeps its current pose instead of sprinting toward an old packed target
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
   - Layered draw order: background → (optional per-level background image) → track → goal → chain → projectile → aim guide → shooter → HUD → end card
   - Per-level background image: when `level.background.src` is set, the image is painted over the procedural gradient (clipped to the play area) and the procedural `drawTrack()` is skipped — the image itself is expected to carry the track artwork. `drawGoal()` and `drawBackground()` (gradient fallback) always run.
   - **Shooter is a classic Zuma stone frog** (`drawShooter()` → `drawFrogBody()`, `drawFrogJawBehind()`, `drawFrogJawFront()`, `drawFrogEyes()`, `drawFrogBellySocket()`). Entire frog rotates with aim angle; ground shadow stays flat. Current ball is held in the frog's mouth (upper jaw overlaps ball top); next ball sits in a belly socket. Frog geometry is pre-rendered to two offscreen layers (behind/front of ball) for performance.
   - Ball textures: procedurally generated with stone body + rolling equatorial band
   - Temple glyphs: scarab, eye, sun, mask, ankh (one per color palette)
   - No external image assets; all visuals are Canvas 2D primitives or generated textures

9. **Input & UI** (`bindEvents()`, `getUiActionAt()`, `triggerUiAction()`)
   - Pointer events (mouse + touch): `pointerdown`, `pointermove`, `pointerup`
   - UI hit-tests first (restart button, sound toggle, next preview, end card) before game input
   - No DOM buttons; all UI drawn on canvas

10. **Audio** (`SfxEngine` class, before `ZumaGame`)
    - All sounds procedurally synthesized via Web Audio API — no external audio files
    - `AudioContext` created lazily on first user gesture (mobile autoplay policy)
    - Effects: shoot (pop+puff), hit (noise burst), match (dual-tone chime, pitch rises with combo), win (ascending arpeggio), lose (low rumble)
    - Default muted; player toggles via HUD sound button

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

When a match removes the **frontmost visible** ball, `resolveMatchesFrom()` first refreshes `s`, detects that visible head, trims any already-exited leaders ahead of it, and re-bases `chainHeadS` instead of leaving a shared `close` offset behind. That special case keeps the next surviving visible ball anchored in place, so the chain continues at conveyor speed rather than doing a last-frame catch-up burst.

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
- Each level caps the palette pool with `levelConfig.colorCount` (3–5 colors)
- Shooter balls use a Zuma-style active-color rule: colors are sampled from the currently visible chain first, then fall back to the remaining off-screen chain only if nothing is visible yet
- After a color disappears from the visible board state, current/next shooter balls are re-rolled if needed so the player is not handed a dead color
- Each palette paired with one temple glyph variant for visual identity
- Procedural texture generated per palette on startup

### Shooter Color Strategy

Classic Zuma does not keep feeding fully random colors from the full level palette once some colors are gone. The practical rule is: the shooter samples from the colors still alive in the board state that the player is actively solving. In this prototype, that means the visible chain is authoritative during play, which avoids impossible cleanup states like a lone blue shot when the screen only contains red and yellow. Both the current ball and the next-ball preview follow that rule.

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

1. **~~Monolithic File~~**: ✅ Resolved — `main.js` has been split into 8 ES modules (config, sfx, path, chain, match, projectile, render, main). ZumaGame remains the orchestrator with delegation wrappers.
   
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
- **Completed**: Material unification (stone body, rolling band, temple glyphs), green-stone frog redesign, debris particle system, victory/defeat full-screen effects, procedural audio (Web Audio API synthesis), sound toggle button, HUD/end-card/button skin upgrade (stone texture panels, Mayan zigzag trim, text hierarchy, button press feedback, rotating next-ball halo, expanded end card with altar badge and pulsing restart button), performance caching (all `shadowBlur` removed, replaced with manual offset shadows)
- **Not Yet**: Multi-level, special ball types, difficulty curves, save/load (Phase 4)

When working on Phase 3 tasks:
- **Do not** casually change `chainHeadS` / offset / match rules; the visible-head-removal rebase path is now part of the stable baseline behavior
- **Do** improve ball rendering, add visual feedback, and refine hand-feel within current constraints
- Split/merge hand-feel optimization is welcome but should not alter rule correctness

## Phase 3 → Phase 4 Transition

**Phase 3** (completed) established visual polish, audio, particles, HUD skin, and performance caching.

**Phase 4** (completed) is the multi-level game loop:
- 8 levels with level selection UI (Mayan-themed stone buttons)
- Pluggable path system with 7 generators: spiral, serpentine, rectangular, zigzag, openArc, quadratic Bezier, cubic Bezier
- Quadratic/cubic Bezier levels are authored in `tools/path-editor/index.html` (Waypoint fit / 笔刷 freehand / ✒ pen tool) and persisted to `public/level-paths.json`
- Per-level difficulty curve (ball count, speed, color count)
- localStorage save/load for progress
- Fade transitions between levels
- All-clear celebration screen
- Path system refactored into dispatcher + pluggable generators

When working on Phase 5 tasks:
- **Do not** change the path generator interface (`{ sampled, renderPath }` → `finalizePath` → `pathPoints[]`)
- **Do not** change the level config schema without updating all 8 level definitions
- **Do not** silently downgrade cubic Bezier levels to quadratic; the editor enforces "one kind per level" and the pen tool keeps a snapshot so users can cancel the upgrade
- **Do** add new path types by implementing generators and registering in `createPath()` switch
- **Do** add special ball types by extending the ball data model, not the chain rules

## Completed Refactoring

The modularization described below has been completed. The codebase is now split into 8 ES modules:

1. **Path system** (`path.js`) — Pure math; zero coupling to game state ✅
2. **Scoring system** (`match.js`) — Clear boundaries; action contexts + match detection ✅
3. **Chain/Split system** (`chain.js`) — Highest coupling, but cleanly extracted ✅
4. **Projectile system** (`projectile.js`) — Flight, collision, insertion ✅
5. **Rendering** (`src/render/`) — split into draw-utils / ball-textures / scene / hud / screens; `index.js` exports the public `render()` + `createTextures()` ✅
6. **Audio** (`sfx.js`) — Self-contained SfxEngine class ✅
7. **Config** (`config.js`) — Constants and palettes ✅

## Debugging Tips

- **Ball position wrong?** Check `chainHeadS`, `offset`, and `getSplitLocalOffset()` in sequence. Do not assume per-ball velocity.
- **Visible head disappears and survivors sprint forward?** Inspect the visible-head path in `resolveMatchesFrom()` and confirm exited leaders were absorbed into `chainHeadS` instead of being left as shared `close` offsets.
- **Match not triggering?** Verify `pendingMatchChecks` queue is processing and `hasGapBetween()` is not blocking across a split.
- **Projectile missing collision?** Check `findChainCollision()` distance threshold and confirm projectile velocity is not skipping frames (see `dt` clamping at 0.033).
- **Split not merging?** Inspect `resolveSplitClosure()` epsilon and confirm rear offset has caught the animated front position.
- **Stuttering on mobile?** Check if new rendering code is creating gradients per frame instead of using cached offscreen canvases. Profile `render()` draw calls; see Performance Architecture section above.

## File Structure

```
.
├── index.html              # Main game entry (Vite root)
├── package.json            # npm deps (Vite)
├── vite.config.js          # Build config — multi-entry (main + path-editor)
├── README.md               # Dev/build instructions
├── public/
│   ├── level-paths.json    # Bezier level data + optional per-level background metadata (served at site root)
│   └── backgrounds/        # Per-level background images referenced by level-paths.json (optional)
├── src/
│   ├── main.js             # ZumaGame orchestrator, input, particles, loop
│   ├── config.js           # Constants, palettes, tuning params
│   ├── sfx.js              # SfxEngine class — procedural audio
│   ├── path.js             # Path dispatcher + 7 generators
│   ├── path-fit.js         # Quadratic & cubic Bezier sampling + adaptive fit
│   ├── chain.js            # Chain + split/merge + ball transitions
│   ├── match.js            # Match detection, scoring, action contexts
│   ├── projectile.js       # Projectile flight, collision, insertion
│   ├── levels.js           # 8-level configuration array + Bezier loader
│   ├── save.js             # localStorage save/load for level progress
│   ├── style.css           # Canvas sizing, page layout, color scheme
│   └── render/             # Render layer (split from former 2198-line render.js)
│       ├── index.js            # Public API: render(), createTextures()
│       ├── draw-utils.js       # Rounded rects, stone panel, seamless texture
│       ├── ball-textures.js    # Frog body, glyphs, ball patterns, drawBall, caches
│       ├── scene.js            # Background, track, goal, chain, projectile, shooter, particles
│       ├── hud.js              # HUD overlay, next preview, sound/restart buttons, feedback
│       └── screens.js          # Round-end card, all-clear, level select
├── tools/
│   └── path-editor/
│       └── index.html      # Bezier path editor (Waypoint / Brush / Pen tools) + AI bg export (PNG/SVG)
├── CLAUDE.md               # This file
├── TECHNICAL_ARCHITECTURE.md  # Implementation deep-dive (reference docs)
└── ZUMA_PLAN.md            # Phase 1/2/3 planning and history
```

### Module Dependency Graph (acyclic)

```
src/config.js   src/sfx.js (no deps)
   ↑
   ├── src/path.js
   ├── src/chain.js
   ├── src/match.js
   ├── src/projectile.js
   ├── src/render/ (index.js → ball-textures/scene/hud/screens → draw-utils)
   ├── src/levels.js
   └── src/main.js ← imports from ALL modules (including levels.js, save.js)

src/save.js has no deps (standalone localStorage utility)
```

No module imports from a sibling module (except config.js). All cross-subsystem calls flow through `game.*` method wrappers on ZumaGame, preventing circular dependencies.

### ES Module Architecture

- Uses `<script type="module">` — must be served via HTTP (not `file://`)
- `ZumaGame` class in main.js is the central orchestrator owning all state
- Extracted functions take `game` (the ZumaGame instance) as first parameter
- ZumaGame has thin delegation wrappers routing to module functions
- Development: `python3 -m http.server 8000` then open `http://localhost:8000`

## Mobile Viewport Notes

- Logical canvas: `430 x 932` (portrait, 9:19.6 ratio)
- **Mobile full-screen mode**: On mobile (`pointer: coarse` AND `innerWidth < 700`), the phone-frame container is removed and the canvas fills the full viewport (`100vw × 100dvh`)
- **Scaling**: Uniform `scale = vw / GAME_WIDTH` fills width with no side gutters. No distortion (non-uniform scaling is never used).
- **Vertical overflow**: When `GAME_HEIGHT × scale > vh` (phone is shorter than 430:932), the game overflows at the bottom. `cropBottom` (game-coord pixels) tracks the hidden portion. HUD is always pinned to screen top; bottom buttons ("选关") shift up by `cropBottom + safeBottom/scale` to stay visible.
- **HUD notch avoidance**: `hudShift` pushes HUD interactive elements (buttons, preview ball) below the safe-area top. HUD panel background stays at y=0 so its color extends behind the notch. A canopy gradient fill covers the notch zone.
- **Safe-area insets**: Read via CSS `env(safe-area-inset-*)` and custom properties `--raw-sat/sab/sal/sar`. Top inset drives `hudShift`; bottom inset adjusts the back button position.
- **Bottom gap fill**: On tall phones where the game doesn't fill the viewport, a slab gradient fills the gap below the game canvas.
- Touch-action disabled on canvas to prevent browser pan/zoom
- Portrait only (landscape shows a rotate-hint overlay)

## Performance Architecture

The rendering pipeline uses aggressive offscreen-canvas caching to avoid creating gradients and rebuilding paths every frame:

- **`staticSceneCache`**: Procedural gradient background + optional per-level background image + goal pre-rendered once to a full-screen offscreen canvas. `render()` blits it with a single `drawImage`. Invalidated (set to `null`) when the level changes or when an async-loaded background image finishes loading. Track artwork is either drawn procedurally here (no background image) or assumed to be part of the background image (procedural `drawTrack()` is skipped in that case).
- **`cachedTrackPath`** (`Path2D`): Track polyline (~616 points) built once; `strokePath()` uses `ctx.stroke(path2d)` instead of per-frame `lineTo` loops.
- **`ballBaseCache[palette]`**: Per-palette body gradient pre-rendered to offscreen canvases. `drawBall()` uses `drawImage` for the base layer.
- **`ballOverCache`**: Shared matte shade + worn bloom overlay (radius-dependent, palette-independent) pre-rendered once.
- **`bandShadeCache`**: Top/bottom + side shading for rolling band texture, pre-rendered once.
- **`frogCacheBehind` / `frogCacheFront`**: Stone frog split into two layers (body+lower jaw vs. upper jaw+eyes) so the held ball can be drawn between them at runtime.
- **`hudPanelCache`**: HUD stone panel backgrounds with speckle texture, Mayan zigzag trim, and sun icon — rendered once on first draw. Text (score, combo, status) drawn live each frame with gold/grey color hierarchy and manual offset text shadows (no `shadowBlur` for performance).
- **`traceRoundedRect()`**: Path-only rounded-rect helper for `clip()` / `stroke()` use sites. Added after a HUD regression where `fillRoundedRect()` was reused as a path builder and pre-filled the cached title slab with the default black fill.

When modifying rendering code, always check whether a gradient or path can be moved into one of these caches. Only rolling band textures (rotation-dependent) and dynamic text/scores need per-frame rendering. If a rounded rectangle is only needed for `clip()` or `stroke()`, use `traceRoundedRect()` instead of `fillRoundedRect()`.

## Performance Considerations

- **Per-frame gradient creates**: ~8 (down from ~190 before caching). Only conditional panels (match feedback, round card), round-end effects, and non-standard-radius preview balls still create live gradients. Zero `ctx.shadowBlur` calls — all text shadows use manual offset rendering (draw dark text at +1px, then draw light text at original position).
- **Ball chain updates**: O(n) per frame (n = ball count, ~30 typical)
- **Collision detection**: O(n) linear scan; adequate for current scale
- **Path lookup**: O(log n) binary search on `pathPoints[]`
- **Particle system**: Debris on elimination (6/ball) + victory celebration particles. Hard cap at 120 total. Simple position+velocity+gravity integration per frame; negligible cost. Tuning constants: `PARTICLE_COUNT_PER_BALL`, `PARTICLE_LIFETIME`, `PARTICLE_MAX_TOTAL`.

## Key Parameters to Tune (all in constants section)

- `CHAIN_SPEED`: How fast the ball train advances (72 default)
- `PROJECTILE_SPEED`: How fast fired balls travel (820 default)
- `MUZZLE_OFFSET`: Projectile spawn distance from shooter center (68, matched to frog snout tip)
- `INSERT_SETTLE_SPEED` / `GAP_CLOSE_SPEED` / `SPLIT_CLOSE_SPEED`: Transition speeds
- `SPLIT_FRONT_PULL_RATIO`, `SPLIT_FRONT_PULL_MAX`: How much front chain retracts during break
- `SPLIT_MERGE_EPSILON`: Distance threshold for considering split closed
- `MERGE_SETTLE_DURATION`: Brief speed reduction after re-merge (hand-feel, not rule)

Changing these does not require code restructuring; they are all at the top of `main.js`.

Per-level overrides for chainCount, chainSpeed, and colorCount are in `levels.js`. Global defaults in config.js serve as fallbacks.

## External Resources & References

- **TECHNICAL_ARCHITECTURE.md**: Detailed explanation of current implementation, data models, and rendering pipeline
- **ZUMA_PLAN.md**: Development phases, task breakdown, risk analysis, and historical progress log
- Original Zuma game mechanics: PopCap's "Zuma" (2003) — centerpiece spiral track, three-in-a-row matches, chain break/relink
