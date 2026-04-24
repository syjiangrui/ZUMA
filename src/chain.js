import {
  BALL_RADIUS, BALL_SPACING, START_CHAIN_COUNT, CHAIN_SPEED,
  CHAIN_ENTRY_SPEED, CHAIN_ENTRY_TAIL_S, CHAIN_ENTRY_START_HEAD_S,
  EXIT_GAP, INSERT_SETTLE_SPEED, GAP_CLOSE_SPEED, SPLIT_CLOSE_SPEED,
  IMPACT_FADE_SPEED, SPLIT_FRONT_PULL_RATIO, SPLIT_FRONT_PULL_MAX,
  SPLIT_FRONT_PULL_SPEED, SPLIT_MERGE_EPSILON, MERGE_SETTLE_DURATION,
  MERGE_SETTLE_MIN_SPEED_SCALE,
} from './config.js';

// getPointAtDistance is needed by syncChainPositions to resolve each ball's
// screen position from its arc-length distance, without going through the
// game.getPointAtDistance() wrapper. This keeps chain.js self-contained
// when operating on either track's pathPoints.
import { getPointAtDistance as getPointAtDistanceFn } from './path.js';

// ---------------------------------------------------------------------------
// TrackState — A lightweight accessor object that abstracts which track
// (primary or secondary) a chain function operates on. Instead of every
// function reading `game.chain` / `game.chainHeadS` / `game.splitState`
// directly, they receive a TrackState from `getTrackState(game, trackIndex)`.
//
// For single-track levels (trackIndex === 0) the accessors point at the
// original `game.chain`, `game.chainHeadS`, etc. For dual-track levels
// (trackIndex === 1) they redirect to `game.chain2`, `game.chainHeadS2`,
// etc. This avoids duplicating every chain function for the second track.
//
// The object uses getter/setter pairs for scalar state (chainHeadS,
// splitState, chainIntro, mergeSettle) because those fields are reassigned
// on the game instance — a plain property copy would lose the binding.
// `chain` and `pathPoints` are arrays (reference types), so a direct
// reference is fine: mutations to the array contents are visible through
// the shared reference.
// ---------------------------------------------------------------------------
export function getTrackState(game, trackIndex = 0) {
  if (trackIndex === 1) {
    return {
      // The ball array for track 2. Mutations (push, splice, property
      // writes on elements) are visible on game.chain2 directly.
      chain: game.chain2,
      // Scalar accessors — must be getter/setter because the game instance
      // field is replaced (not mutated) when the value changes.
      getChainHeadS: () => game.chainHeadS2,
      setChainHeadS: (v) => { game.chainHeadS2 = v; },
      getSplitState: () => game.splitState2,
      setSplitState: (v) => { game.splitState2 = v; },
      getChainIntro: () => game.chainIntro2,
      setChainIntro: (v) => { game.chainIntro2 = v; },
      getMergeSettle: () => game.mergeSettle2,
      setMergeSettle: (v) => { game.mergeSettle2 = v; },
      // Path geometry for the second track. Read-only arrays — the path is
      // rebuilt once per level load and never mutated during gameplay.
      pathPoints: game.pathPoints2,
      totalPathLength: game.totalPathLength2,
      // Which track this state represents. Used by lose-detection and
      // anywhere a function needs to branch on track identity.
      trackIndex: 1,
    };
  }
  // Default: primary track (trackIndex === 0). This is the only track in
  // single-track levels and the first track in dual-track levels.
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

// ---------------------------------------------------------------------------
// createChain — Populate a track's ball chain for a new round.
// Reads per-track config from `levelConfig.tracks[trackIndex]` when
// available (dual-track levels); falls back to top-level levelConfig fields
// for single-track levels.
// ---------------------------------------------------------------------------
export function createChain(game, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);

  // Per-track config lives in levelConfig.tracks[trackIndex] for dual-track
  // levels. Single-track levels store chainCount/colorCount at the top level.
  const trackCfg = game.levelConfig?.tracks?.[trackIndex];
  const chainCount = trackCfg?.chainCount ?? game.levelConfig?.chainCount ?? START_CHAIN_COUNT;
  const colorCount = trackCfg?.colorCount ?? game.levelConfig?.colorCount ?? 4;

  // Replace the chain array contents in-place so the TrackState reference
  // (which points to the same array object) stays valid.
  ts.chain.length = 0;
  const newBalls = Array.from({ length: chainCount }, (_, index) =>
    createChainBall(game, index % colorCount),
  );
  for (const ball of newBalls) {
    ts.chain.push(ball);
  }

  // Zuma-style rounds should begin with the chain still fully outside the
  // visible track, then roll in quickly to the normal opening state. The
  // target still leaves a small portion of the tail off-screen so the chain
  // does not look artificially "pre-laid" on the path.
  const targetHeadS =
    (ts.chain.length - 1) * BALL_SPACING + CHAIN_ENTRY_TAIL_S;
  ts.setChainHeadS(CHAIN_ENTRY_START_HEAD_S);
  ts.setChainIntro({ targetHeadS });
  ts.setSplitState(null);

  // pendingMatchChecks is a shared queue living on the game instance. Only
  // reset it when initialising the primary track (trackIndex === 0) to avoid
  // wiping checks queued for track 0 when track 1 is created afterwards.
  if (trackIndex === 0) {
    game.pendingMatchChecks = [];
  }

  syncChainPositions(game, trackIndex);
}

export function createChainBall(game, paletteIndex) {
  return {
    id: game.nextBallId++,
    paletteIndex,
    radius: BALL_RADIUS,
    s: 0,
    rotation: 0,
    // offset is a temporary distance correction layered on top of the base
    // chain position. Positive offset pushes a ball toward the goal, negative
    // offset pulls it back toward the start.
    offset: 0,
    // offsetMode selects which speed rule is used when offset settles back to
    // zero. "insert" and "close" are gameplay-relevant states.
    offsetMode: "idle",
    // impact is purely visual: a short pulse used on collisions, merges and
    // seam closures so state transitions are easier to read.
    impact: 0,
    // Screen position and path tangent cached during syncChainPositions so
    // the renderer does not need to call getPointAtDistance a second time.
    screenX: 0,
    screenY: 0,
    pathAngle: 0,
    // Keep a fallback link from later delayed checks back to the originating
    // shot action so combo scoring does not silently disappear if an explicit
    // action id is missing further down the chain reaction.
    lastActionId: null,
  };
}

// ---------------------------------------------------------------------------
// updateChain — Advance one track's chain by dt. Sets per-track reached-goal
// flags instead of calling game.setGameState("lose") directly, so the main
// loop can combine both tracks' results for dual-track lose detection.
//
// Key detail: pendingMatchChecks is a single shared queue. It is only
// processed during the trackIndex === 0 call to avoid double-ticking.
// ---------------------------------------------------------------------------
export function updateChain(game, dt, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);

  if (ts.chain.length === 0) {
    return;
  }

  // Merge settle is evaluated before baseline motion. This way a freshly
  // rejoined chain can briefly "land" and then ramp back into normal
  // conveyor motion without fighting the split closure math.
  updateMergeSettle(dt, ts);
  if (!ts.getSplitState()) {
    advanceChainBaseline(game, dt, ts);
  }
  // Once the chain is broken, keep the shared baseline still and let the rear
  // segment close the gap only through its own "close" offsets. This avoids
  // the old behavior where rear balls advanced at CHAIN_SPEED + GAP_CLOSE_SPEED
  // and visibly sprinted into the frozen front segment.
  // Transition updates happen before positions are recomputed so the current
  // frame already reflects insertion / closure progress.
  updateBallTransitions(game, dt, ts);
  updateSplitFrontPull(game, dt, getSplitGap(game, trackIndex), ts);

  // pendingMatchChecks is shared across both tracks. Only tick it during the
  // track-0 update pass to avoid double-processing the same delay timers.
  if (trackIndex === 0) {
    game.updatePendingMatchChecks(dt);
  }

  resolveSplitClosure(game, ts);
  syncChainPositions(game, trackIndex);

  if (ts.chain.length === 0) {
    return;
  }

  // Lose detection: check whether the tail ball has exited the track end.
  // Instead of calling game.setGameState("lose") directly, set a per-track
  // flag so the main loop can decide the overall round outcome. In single-
  // track levels only track1ReachedGoal matters; in dual-track levels the
  // main loop may require BOTH tracks to reach the goal before declaring a
  // loss (or use any-track-loses semantics — that policy lives in main.js).
  const tailS = ts.chain[ts.chain.length - 1].s;
  if (tailS > ts.totalPathLength + EXIT_GAP) {
    if (trackIndex === 0) {
      game.track1ReachedGoal = true;
    } else {
      game.track2ReachedGoal = true;
    }
    game.screenShake = 1; // trigger screen shake on defeat
  }
}

// ---------------------------------------------------------------------------
// advanceChainBaseline — Move the chain's shared head-of-chain distance
// forward by dt. During the intro phase the chain rolls in at a faster
// speed; afterwards it settles to the level's configured conveyor speed.
// Reads per-track speed from tracks[trackIndex] config if available.
// ---------------------------------------------------------------------------
function advanceChainBaseline(game, dt, ts) {
  const chainIntro = ts.getChainIntro();
  if (chainIntro) {
    // The first few seconds of a round are a dedicated entrance phase: the
    // chain should visibly roll in from off-board before it settles into the
    // normal conveyor pace.
    ts.setChainHeadS(ts.getChainHeadS() + CHAIN_ENTRY_SPEED * dt);
    if (ts.getChainHeadS() >= chainIntro.targetHeadS) {
      ts.setChainHeadS(chainIntro.targetHeadS);
      ts.setChainIntro(null);
    }
    return;
  }

  // Per-track speed override: dual-track levels store chainSpeed in
  // levelConfig.tracks[trackIndex]; single-track levels use the top-level
  // levelConfig.chainSpeed field (or the global CHAIN_SPEED default).
  const trackCfg = game.levelConfig?.tracks?.[ts.trackIndex];
  const speed = trackCfg?.chainSpeed ?? game.levelConfig?.chainSpeed ?? CHAIN_SPEED;
  ts.setChainHeadS(ts.getChainHeadS() + speed * dt * getChainSpeedScale(ts));
}

// After a seam rejoins, briefly hold back the shared conveyor so the merge
// reads as contact/settle rather than an immediate full-speed carry-on.
// Uses the TrackState's mergeSettle instead of game.mergeSettle directly.
function getChainSpeedScale(ts) {
  const mergeSettle = ts.getMergeSettle();
  if (!mergeSettle) {
    return 1;
  }

  // Smooth-step easing from MERGE_SETTLE_MIN_SPEED_SCALE back to 1.0 over
  // the settle duration. progress=0 at start, progress=1 when done.
  const progress = 1 - mergeSettle.timer / mergeSettle.duration;
  const eased = progress * progress * (3 - 2 * progress);
  return (
    MERGE_SETTLE_MIN_SPEED_SCALE +
    (1 - MERGE_SETTLE_MIN_SPEED_SCALE) * eased
  );
}

// Tick down the merge-settle timer for this track. When it expires, clear
// the settle state so the chain returns to full conveyor speed.
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

// ---------------------------------------------------------------------------
// syncChainPositions — Recompute every ball's screen position from its
// arc-length distance along this track's path. Uses getPointAtDistanceFn
// directly (imported from path.js) with the TrackState's pathPoints, so it
// does not depend on game.getPointAtDistance() which is always bound to
// the primary track.
// ---------------------------------------------------------------------------
export function syncChainPositions(game, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);

  ts.chain.forEach((ball, index) => {
    // Final position = shared chain baseline + this ball's temporary offset.
    // During a split, chainHeadS stays frozen and the front segment receives
    // a distributed pullback based on overall seam-closing progress, not just
    // the last few pixels before merge.
    const splitOffset = getSplitLocalOffset(ts, index);
    ball.s = ts.getChainHeadS() - index * BALL_SPACING + ball.offset + splitOffset;
    // Rotation is tied to traveled path distance so textured balls look like
    // they are rolling along the track instead of merely sliding.
    ball.rotation = ball.s / ball.radius;
    // Cache the screen position and path tangent angle so the renderer
    // can use them directly without calling getPointAtDistance again.
    // Uses this track's own pathPoints/totalPathLength, NOT game.getPointAtDistance().
    if (ball.s >= 0 && ball.s <= ts.totalPathLength) {
      const pt = getPointAtDistanceFn(ts.pathPoints, ts.totalPathLength, ball.s);
      ball.screenX = pt.x;
      ball.screenY = pt.y;
      ball.pathAngle = pt.angle;
    }
  });
}

// Ease per-ball temporary offsets back toward zero. The key point here is
// that different gameplay situations use different speed caps:
// - insert: make room for a new ball
// - close:  gap closes after a removal
//   - ordinary closure keeps the calmer GAP_CLOSE_SPEED
//   - split rear chase uses SPLIT_CLOSE_SPEED so it does not feel slower
//     than the chain's normal conveyor motion
// This function should stay purely about offset settling, not about chain
// topology or match logic.
// Uses the TrackState's splitState and chain to determine per-ball speed.
function updateBallTransitions(game, dt, ts) {
  const splitState = ts.getSplitState();
  for (const [index, ball] of ts.chain.entries()) {
    // offset 只负责过渡动画，不直接决定球链基础前进。
    // Speed selection: split-rear balls use SPLIT_CLOSE_SPEED for faster
    // catch-up; other "close" mode balls use the gentler GAP_CLOSE_SPEED;
    // "insert" mode always uses INSERT_SETTLE_SPEED.
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

// There is only ever one gameplay gap per track in the prototype: the break
// created when a middle group disappears. Matching and chain logic must
// treat that seam as non-adjacent until the rear segment has physically
// caught up. Uses TrackState to check the correct track's splitState.
export function hasGapBetween(game, leftIndex, rightIndex, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  const splitState = ts.getSplitState();
  return (
    !!splitState &&
    leftIndex === splitState.index - 1 &&
    rightIndex === splitState.index
  );
}

// Compute the current distance between the front-tail and rear-head balls
// at the split seam. Returns null if there is no active split or the split
// indices are out of range. Uses TrackState for the correct track's state.
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
  // A split gap is represented entirely in offset space while chainHeadS is
  // frozen. Once the front tail offset and rear head offset meet, the seam is
  // logically ready to rejoin.
  return Math.max(0, frontTail.offset - rearHead.offset);
}

// Compute the target front-pull distance based on how much of the original
// gap has been closed. Drives the front segment's visible retreat animation.
// Takes a TrackState so it reads the correct track's splitState.
function getSplitFrontPullTarget(ts, gap) {
  const splitState = ts.getSplitState();
  const initialGap = splitState?.initialGap ?? 0;
  if (gap === null || initialGap <= 0) {
    return 0;
  }

  // Drive front pull by total closure progress across the whole break, not
  // just by the final proximity window. This lets the front segment visibly
  // retreat while the rear segment is still covering most of the original
  // gap, which matches the intended "roughly 50/50" merge feel better.
  const closedDistance = Math.max(0, initialGap - gap);
  return Math.min(SPLIT_FRONT_PULL_MAX, closedDistance * SPLIT_FRONT_PULL_RATIO);
}

// Animate the front-pull value toward its target. The front segment appears
// to be drawn back by chain tension rather than teleporting when the seam
// nears closure. Takes TrackState for the correct track's splitState.
function updateSplitFrontPull(game, dt, gap, ts) {
  const splitState = ts.getSplitState();
  if (!splitState) {
    return;
  }

  // frontPull is animated toward its target instead of snapping so the whole
  // front segment appears to get drawn back by chain tension, rather than
  // teleporting into a new pose when the seam nears closure.
  const targetPull = getSplitFrontPullTarget(ts, gap);
  const currentPull = splitState.frontPull ?? 0;
  const step = SPLIT_FRONT_PULL_SPEED * dt;

  if (currentPull < targetPull) {
    splitState.frontPull = Math.min(targetPull, currentPull + step);
  } else {
    splitState.frontPull = Math.max(targetPull, currentPull - step);
  }
}

// Compute the per-ball offset contribution from the front-pull animation.
// Every ball in the front segment (index < splitState.index) receives the
// same rigid pullback so the chain reads as a solid body retreating toward
// the break. Takes TrackState for the correct track's splitState.
function getSplitLocalOffset(ts, index) {
  const splitState = ts.getSplitState();
  if (
    !splitState ||
    index >= splitState.index ||
    !splitState.frontPull
  ) {
    return 0;
  }

  // Rigid pullback: every ball in the front segment receives the same offset
  // so the chain reads as a solid body retreating toward the break. This
  // preserves the 1px ball-to-ball overlap at all times and avoids visible
  // seam-lightening on the spiral track.
  return -splitState.frontPull;
}

// ---------------------------------------------------------------------------
// resolveSplitClosure — Check whether the split seam has closed enough to
// rejoin the chain. When the rear head meets the animated front position
// (within SPLIT_MERGE_EPSILON), absorb the split state, trigger a merge
// settle, and queue cross-seam match checks. Uses TrackState and passes
// ts.trackIndex to queueAdjacentMatchChecks so match checks target the
// correct track.
// ---------------------------------------------------------------------------
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
  // Use the animated front pull for closure so the seam only resolves once
  // the visible bidirectional merge has substantially played out.
  const frontExtra =
    frontTail.offset + getSplitLocalOffset(ts, splitState.index - 1);

  // The seam should not rejoin the moment the nominal gap is gone. We wait
  // until the rear head has actually met the animated front seam position,
  // otherwise the front pullback would be cut off visually.
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
  // Pass ts.trackIndex so the match queue entries know which track's chain
  // to check. The shared pendingMatchChecks queue stores trackIndex per entry.
  game.queueAdjacentMatchChecks(seamIndex, seamIndex + 1, seamActionId, 0.03, "seam");
}

// ---------------------------------------------------------------------------
// absorbSplitState — Hand off the merge pose into the regular chain state
// without creating a short burst of extra forward speed. The seam-side pull
// becomes a shared baseline shift on chainHeadS, while only the per-ball
// differences remain as ordinary offsets. Uses TrackState for the correct
// track's chain, chainHeadS and splitState.
// ---------------------------------------------------------------------------
function absorbSplitState(game, ts) {
  const splitState = ts.getSplitState();
  if (!splitState) {
    return;
  }

  // Hand off the merge pose into the regular chain state without creating a
  // short burst of extra forward speed. The seam-side pull becomes a shared
  // baseline shift on chainHeadS, while only the per-ball differences remain
  // as ordinary offsets. That preserves the visible "pulled back" pose and
  // avoids a frame where the front segment jumps or surges forward.
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

// ---------------------------------------------------------------------------
// triggerMergeSettle — Start a brief post-merge dampening window on this
// track and apply impact pulses to balls near the seam. Uses TrackState to
// set the correct track's mergeSettle and to access its chain for impacts.
// ---------------------------------------------------------------------------
function triggerMergeSettle(ts, seamIndex) {
  // This is intentionally tiny. It is not a new simulation state; it only
  // dampens the first few frames after a seam rejoins so the contact reads as
  // impact/settle instead of an abrupt return to full conveyor speed.
  ts.setMergeSettle({
    timer: MERGE_SETTLE_DURATION,
    duration: MERGE_SETTLE_DURATION,
  });

  // The merge should read as a local impact, not a visible bounce. Spread a
  // stronger hit to the seam pair and a much softer falloff to nearby balls.
  // Uses addImpactToChain helper to write directly to the TrackState's chain
  // array, avoiding the exported addImpact which would create a new TrackState.
  const impactProfile = [0.88, 0.58, 0.34];
  for (let distance = 0; distance < impactProfile.length; distance += 1) {
    const frontIndex = seamIndex - distance;
    const rearIndex = seamIndex + 1 + distance;
    const amount = impactProfile[distance];
    addImpactToChain(ts.chain, frontIndex, amount);
    addImpactToChain(ts.chain, rearIndex, amount);
  }
}

// Internal helper: apply impact directly to a chain array element.
// Avoids the overhead of creating a new TrackState via the exported
// addImpact function when we already have the chain reference.
function addImpactToChain(chain, index, amount) {
  if (index < 0 || index >= chain.length) {
    return;
  }
  chain[index].impact = Math.max(chain[index].impact, amount);
}

// ---------------------------------------------------------------------------
// addImpact — Public API for setting impact on a ball in a specific track's
// chain. Uses TrackState to access the correct chain array.
// ---------------------------------------------------------------------------
export function addImpact(game, index, amount, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);
  if (index < 0 || index >= ts.chain.length) {
    return;
  }

  ts.chain[index].impact = Math.max(ts.chain[index].impact, amount);
}

// ---------------------------------------------------------------------------
// applyInsertSpacingWave — After a ball is inserted into the chain, nudge
// nearby balls to create a smooth spacing wave. The front neighbours get a
// small forward push; the rear neighbours get a larger backward offset equal
// to BALL_SPACING minus a tapering clearance profile. Uses TrackState to
// access the correct track's chain array.
// ---------------------------------------------------------------------------
export function applyInsertSpacingWave(game, insertIndex, trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);

  // Tuning profiles for the spacing wave. frontNudgeProfile pushes the few
  // balls ahead of the insertion point slightly forward; rearOpenProfile
  // pushes the balls behind it backward by BALL_SPACING minus a tapering
  // amount so they progressively settle into their new positions.
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
