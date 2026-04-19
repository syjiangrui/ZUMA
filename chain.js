import {
  BALL_RADIUS, BALL_SPACING, START_CHAIN_COUNT, CHAIN_SPEED,
  CHAIN_ENTRY_SPEED, CHAIN_ENTRY_TAIL_S, CHAIN_ENTRY_START_HEAD_S,
  EXIT_GAP, INSERT_SETTLE_SPEED, GAP_CLOSE_SPEED, SPLIT_CLOSE_SPEED,
  IMPACT_FADE_SPEED, SPLIT_FRONT_PULL_RATIO, SPLIT_FRONT_PULL_MAX,
  SPLIT_FRONT_PULL_SPEED, SPLIT_MERGE_EPSILON, MERGE_SETTLE_DURATION,
  MERGE_SETTLE_MIN_SPEED_SCALE,
} from './config.js';

export function createChain(game) {
  const chainCount = game.levelConfig?.chainCount ?? START_CHAIN_COUNT;
  const colorCount = game.levelConfig?.colorCount ?? 4;
  game.chain = Array.from({ length: chainCount }, (_, index) =>
    createChainBall(game, index % colorCount),
  );

  // Zuma-style rounds should begin with the chain still fully outside the
  // visible track, then roll in quickly to the normal opening state. The
  // target still leaves a small portion of the tail off-screen so the chain
  // does not look artificially "pre-laid" on the path.
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
    // Keep a fallback link from later delayed checks back to the originating
    // shot action so combo scoring does not silently disappear if an explicit
    // action id is missing further down the chain reaction.
    lastActionId: null,
  };
}

export function updateChain(game, dt) {
  if (game.chain.length === 0) {
    return;
  }

  // Merge settle is evaluated before baseline motion. This way a freshly
  // rejoined chain can briefly "land" and then ramp back into normal
  // conveyor motion without fighting the split closure math.
  updateMergeSettle(game, dt);
  if (!game.splitState) {
    advanceChainBaseline(game, dt);
  }
  // Once the chain is broken, keep the shared baseline still and let the rear
  // segment close the gap only through its own "close" offsets. This avoids
  // the old behavior where rear balls advanced at CHAIN_SPEED + GAP_CLOSE_SPEED
  // and visibly sprinted into the frozen front segment.
  // Transition updates happen before positions are recomputed so the current
  // frame already reflects insertion / closure progress.
  updateBallTransitions(game, dt);
  updateSplitFrontPull(game, dt, getSplitGap(game));
  game.updatePendingMatchChecks(dt);
  resolveSplitClosure(game);
  syncChainPositions(game);

  const tailS = game.chain[game.chain.length - 1].s;
  if (tailS > game.totalPathLength + EXIT_GAP) {
    game.setGameState("lose");
    game.screenShake = 1; // trigger screen shake on defeat
  }
}

function advanceChainBaseline(game, dt) {
  if (game.chainIntro) {
    // The first few seconds of a round are a dedicated entrance phase: the
    // chain should visibly roll in from off-board before it settles into the
    // normal conveyor pace.
    game.chainHeadS += CHAIN_ENTRY_SPEED * dt;
    if (game.chainHeadS >= game.chainIntro.targetHeadS) {
      game.chainHeadS = game.chainIntro.targetHeadS;
      game.chainIntro = null;
    }
    return;
  }

  const speed = game.levelConfig?.chainSpeed ?? CHAIN_SPEED;
  game.chainHeadS += speed * dt * getChainSpeedScale(game);
}

// After a seam rejoins, briefly hold back the shared conveyor so the merge
// reads as contact/settle rather than an immediate full-speed carry-on.
function getChainSpeedScale(game) {
  if (!game.mergeSettle) {
    return 1;
  }

  const progress =
    1 - game.mergeSettle.timer / game.mergeSettle.duration;
  const eased = progress * progress * (3 - 2 * progress);
  return (
    MERGE_SETTLE_MIN_SPEED_SCALE +
    (1 - MERGE_SETTLE_MIN_SPEED_SCALE) * eased
  );
}

function updateMergeSettle(game, dt) {
  if (!game.mergeSettle) {
    return;
  }

  game.mergeSettle.timer = Math.max(0, game.mergeSettle.timer - dt);
  if (game.mergeSettle.timer <= 0) {
    game.mergeSettle = null;
  }
}

export function syncChainPositions(game) {
  game.chain.forEach((ball, index) => {
    // Final position = shared chain baseline + this ball's temporary offset.
    // During a split, chainHeadS stays frozen and the front segment receives
    // a distributed pullback based on overall seam-closing progress, not just
    // the last few pixels before merge.
    const splitOffset = getSplitLocalOffset(game, index);
    ball.s = game.chainHeadS - index * BALL_SPACING + ball.offset + splitOffset;
    // Rotation is tied to traveled path distance so textured balls look like
    // they are rolling along the track instead of merely sliding.
    ball.rotation = ball.s / ball.radius;
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
function updateBallTransitions(game, dt) {
  for (const [index, ball] of game.chain.entries()) {
    // offset 只负责过渡动画，不直接决定球链基础前进。
    const speed =
      ball.offsetMode === "close"
        ? game.splitState && index >= game.splitState.index
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

// There is only ever one gameplay gap in the prototype: the break created
// when a middle group disappears. Matching and chain logic must treat that
// seam as non-adjacent until the rear segment has physically caught up.
export function hasGapBetween(game, leftIndex, rightIndex) {
  return (
    !!game.splitState &&
    leftIndex === game.splitState.index - 1 &&
    rightIndex === game.splitState.index
  );
}

export function getSplitGap(game) {
  if (
    !game.splitState ||
    game.splitState.index <= 0 ||
    game.splitState.index >= game.chain.length
  ) {
    return null;
  }

  const frontTail = game.chain[game.splitState.index - 1];
  const rearHead = game.chain[game.splitState.index];
  // A split gap is represented entirely in offset space while chainHeadS is
  // frozen. Once the front tail offset and rear head offset meet, the seam is
  // logically ready to rejoin.
  return Math.max(0, frontTail.offset - rearHead.offset);
}

function getSplitFrontPullTarget(game, gap) {
  const initialGap = game.splitState?.initialGap ?? 0;
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

function updateSplitFrontPull(game, dt, gap) {
  if (!game.splitState) {
    return;
  }

  // frontPull is animated toward its target instead of snapping so the whole
  // front segment appears to get drawn back by chain tension, rather than
  // teleporting into a new pose when the seam nears closure.
  const targetPull = getSplitFrontPullTarget(game, gap);
  const currentPull = game.splitState.frontPull ?? 0;
  const step = SPLIT_FRONT_PULL_SPEED * dt;

  if (currentPull < targetPull) {
    game.splitState.frontPull = Math.min(targetPull, currentPull + step);
  } else {
    game.splitState.frontPull = Math.max(targetPull, currentPull - step);
  }
}

function getSplitLocalOffset(game, index) {
  if (
    !game.splitState ||
    index >= game.splitState.index ||
    !game.splitState.frontPull
  ) {
    return 0;
  }

  // Rigid pullback: every ball in the front segment receives the same offset
  // so the chain reads as a solid body retreating toward the break. This
  // preserves the 1px ball-to-ball overlap at all times and avoids visible
  // seam-lightening on the spiral track.
  return -game.splitState.frontPull;
}

function resolveSplitClosure(game) {
  if (
    !game.splitState ||
    game.splitState.index <= 0 ||
    game.splitState.index >= game.chain.length
  ) {
    game.splitState = null;
    return;
  }

  const frontTail = game.chain[game.splitState.index - 1];
  const rearHead = game.chain[game.splitState.index];
  // Use the animated front pull for closure so the seam only resolves once
  // the visible bidirectional merge has substantially played out.
  const frontExtra =
    frontTail.offset + getSplitLocalOffset(game, game.splitState.index - 1);

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

  const seamIndex = game.splitState.index - 1;
  const seamActionId = game.splitState.actionId;
  absorbSplitState(game);
  triggerMergeSettle(game, seamIndex);
  game.queueAdjacentMatchChecks(seamIndex, seamIndex + 1, seamActionId, 0.03, "seam");
}

function absorbSplitState(game) {
  if (!game.splitState) {
    return;
  }

  // Hand off the merge pose into the regular chain state without creating a
  // short burst of extra forward speed. The seam-side pull becomes a shared
  // baseline shift on chainHeadS, while only the per-ball differences remain
  // as ordinary offsets. That preserves the visible "pulled back" pose and
  // avoids a frame where the front segment jumps or surges forward.
  const absorbedBaseline = getSplitLocalOffset(game, game.splitState.index - 1);
  game.chainHeadS += absorbedBaseline;

  for (let index = 0; index < game.chain.length; index += 1) {
    const localOffset =
      index < game.splitState.index ? getSplitLocalOffset(game, index) : 0;
    const residualOffset = localOffset - absorbedBaseline;
    if (!residualOffset) {
      continue;
    }

    game.chain[index].offset += residualOffset;
    game.chain[index].offsetMode = "close";
  }

  game.splitState = null;
}

function triggerMergeSettle(game, seamIndex) {
  // This is intentionally tiny. It is not a new simulation state; it only
  // dampens the first few frames after a seam rejoins so the contact reads as
  // impact/settle instead of an abrupt return to full conveyor speed.
  game.mergeSettle = {
    timer: MERGE_SETTLE_DURATION,
    duration: MERGE_SETTLE_DURATION,
  };

  // The merge should read as a local impact, not a visible bounce. Spread a
  // stronger hit to the seam pair and a much softer falloff to nearby balls.
  const impactProfile = [0.88, 0.58, 0.34];
  for (let distance = 0; distance < impactProfile.length; distance += 1) {
    const frontIndex = seamIndex - distance;
    const rearIndex = seamIndex + 1 + distance;
    const amount = impactProfile[distance];
    addImpact(game, frontIndex, amount);
    addImpact(game, rearIndex, amount);
  }
}

export function addImpact(game, index, amount) {
  if (index < 0 || index >= game.chain.length) {
    return;
  }

  game.chain[index].impact = Math.max(game.chain[index].impact, amount);
}

export function applyInsertSpacingWave(game, insertIndex) {
  const frontNudgeProfile = [6, 3];
  const rearOpenProfile = [8, 5, 2, 0];

  for (let offsetIndex = 0; offsetIndex < frontNudgeProfile.length; offsetIndex += 1) {
    const chainIndex = insertIndex - 1 - offsetIndex;
    if (chainIndex < 0) {
      break;
    }

    game.chain[chainIndex].offset += frontNudgeProfile[offsetIndex];
    game.chain[chainIndex].offsetMode = "insert";
  }

  for (let offsetIndex = 0; insertIndex + 1 + offsetIndex < game.chain.length; offsetIndex += 1) {
    const chainIndex = insertIndex + 1 + offsetIndex;
    const immediateClearance = rearOpenProfile[offsetIndex] ?? 0;

    game.chain[chainIndex].offset += BALL_SPACING - immediateClearance;
    game.chain[chainIndex].offsetMode = "insert";
  }
}
