import { BALL_SPACING, INSERT_MATCH_DELAY } from './config.js';

export function createActionContext(game, source = "shot") {
  const actionId = game.nextActionId++;
  game.actionContexts.set(actionId, {
    id: actionId,
    source,
    combo: 0,
    totalRemoved: 0,
    totalScore: 0,
  });
  trimActionContexts(game);
  return actionId;
}

export function getActionContext(game, actionId) {
  if (actionId === null || actionId === undefined) {
    return null;
  }

  let context = game.actionContexts.get(actionId);
  if (!context) {
    context = {
      id: actionId,
      source: "system",
      combo: 0,
      totalRemoved: 0,
      totalScore: 0,
    };
    game.actionContexts.set(actionId, context);
  }
  return context;
}

// Delayed seam closures mean action contexts must outlive the shot itself,
// but the table should still stay bounded once nothing references old ids.
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

export function recordMatchEvent(game, { actionId, removedCount, trigger }) {
  const context = getActionContext(game, actionId);
  if (!context) {
    return;
  }

  // One shot can produce multiple removal waves. combo therefore belongs to
  // the action context, not to a single queueMatchCheck invocation.
  context.combo += 1;
  context.totalRemoved += removedCount;

  const baseScore = removedCount * 100;
  const sizeBonus = Math.max(0, removedCount - 3) * 40;
  const comboBonus = Math.max(0, context.combo - 1) * 120;
  const triggerBonus = trigger === "seam" ? 90 : 0;
  const awardedScore = baseScore + sizeBonus + comboBonus + triggerBonus;

  context.totalScore += awardedScore;
  game.score += awardedScore;
  game.bestCombo = Math.max(game.bestCombo, context.combo);
  game.sfx.playMatch(context.combo);

  const tags = [];
  if (context.combo > 1) {
    tags.push(`连击 x${context.combo}`);
    game.recentCombo = {
      combo: context.combo,
      timer: 2.6,
    };
  }
  if (trigger === "seam") {
    tags.push("接缝连锁");
  }
  if (removedCount > 3) {
    tags.push(`消除 ${removedCount}`);
  }

  game.matchFeedback = {
    scoreDelta: awardedScore,
    combo: context.combo,
    removedCount,
    label: tags.join(" · "),
    timer: 1.2,
  };
}

// HUD feedback keeps its own timers so score/combo presentation can linger
// for readability without affecting any gameplay state machine.
export function updateHudState(game, dt) {
  if (game.matchFeedback) {
    game.matchFeedback.timer -= dt;
    if (game.matchFeedback.timer <= 0) {
      game.matchFeedback = null;
    }
  }

  if (game.recentCombo) {
    game.recentCombo.timer -= dt;
    if (game.recentCombo.timer <= 0) {
      game.recentCombo = null;
    }
  }
}

export function updatePendingMatchChecks(game, dt) {
  if (game.pendingMatchChecks.length === 0) {
    return;
  }

  const dueChecks = [];

  // 插入和重新并链后延迟一小段时间再做三消判定，避免动画还没成立就瞬间消除。
  game.pendingMatchChecks = game.pendingMatchChecks.filter((check) => {
    check.delay -= dt;
    if (check.delay <= 0) {
      dueChecks.push(check);
      return false;
    }

    return true;
  });

  for (const check of dueChecks) {
    const index = game.chain.findIndex((ball) => ball.id === check.ballId);
    if (index >= 0) {
      // The ball may have shifted to a new index while waiting, so delayed
      // checks always resolve by id instead of by the original array index.
      resolveMatchesFrom(game, index, check.actionId, check.trigger);
    }
  }
}

// Queue a future "start matching from this ball" request. We use this after
// insertion and after seam closure so visuals have a moment to communicate
// what just happened before a group vanishes. actionId keeps later chain
// reactions attached to the original shot for scoring/combo purposes.
export function queueMatchCheck(
  game,
  ballId,
  delay = INSERT_MATCH_DELAY,
  actionId = null,
  trigger = "insert",
) {
  const existing = game.pendingMatchChecks.find(
    (check) =>
      check.ballId === ballId &&
      check.actionId === actionId &&
      check.trigger === trigger,
  );
  if (existing) {
    existing.delay = Math.min(existing.delay, delay);
    return;
  }

  game.pendingMatchChecks.push({ ballId, delay, actionId, trigger });
}

export function setBallAction(game, index, actionId) {
  if (
    actionId === null ||
    actionId === undefined ||
    index < 0 ||
    index >= game.chain.length
  ) {
    return;
  }

  game.chain[index].lastActionId = actionId;
}

function absorbHeadRemovalIntoBaseline(game, removedCount) {
  if (removedCount <= 0) {
    return;
  }

  const baselineShift = removedCount * BALL_SPACING;
  shiftChainBaseline(game, -baselineShift);
}

function shiftChainBaseline(game, deltaS) {
  if (!deltaS) {
    return;
  }

  game.chainHeadS += deltaS;

  // During the intro roll-in, keep the remaining entrance distance unchanged.
  if (game.chainIntro) {
    game.chainIntro.targetHeadS += deltaS;
  }
}

function alignVisibleHeadToAnchor(game, anchorS) {
  if (anchorS === null || anchorS === undefined || game.chain.length === 0) {
    return;
  }

  game.syncChainPositions();
  // A visible-head removal may also shrink the front split segment, which
  // changes getSplitLocalOffset() distribution. Correct the shared baseline so
  // the first surviving ball stays exactly where it was before the splice.
  shiftChainBaseline(game, anchorS - game.chain[0].s);
}

function absorbLeadingBallOffsetIntoBaseline(game) {
  if (game.chain.length === 0) {
    return;
  }

  const sharedOffset = game.chain[0].offset;
  if (!sharedOffset) {
    return;
  }

  const canAbsorbSharedOffset = game.chain.every(
    (ball) =>
      ball.offsetMode === "close" &&
      Math.abs(ball.offset - sharedOffset) < 0.04,
  );
  if (!canAbsorbSharedOffset) {
    return;
  }

  // If the surviving chain keeps a shared offset after the visible head is
  // removed (for example when an old front segment has already exited), absorb
  // that common displacement into the baseline so the whole chain does not
  // perform one last artificial catch-up sprint.
  shiftChainBaseline(game, sharedOffset);
  for (const ball of game.chain) {
    ball.offset -= sharedOffset;
    if (Math.abs(ball.offset) < 0.04) {
      ball.offset = 0;
      ball.offsetMode = "idle";
    }
  }
}

function getFirstVisibleBallIndex(game) {
  return game.chain.findIndex(
    (ball) => ball.s >= 0 && ball.s <= game.totalPathLength,
  );
}

// A closure-triggered re-check must consider both sides of the seam. If we
// only re-check the left ball, we miss cases where the new removable run
// starts on the right side after closure.
export function queueAdjacentMatchChecks(
  game,
  leftIndex,
  rightIndex,
  actionId,
  delay = INSERT_MATCH_DELAY,
  trigger = "chain",
) {
  setBallAction(game, leftIndex, actionId);
  setBallAction(game, rightIndex, actionId);

  const queuedIds = new Set();
  const candidates = [leftIndex, rightIndex];
  for (const index of candidates) {
    if (index < 0 || index >= game.chain.length) {
      continue;
    }

    const ballId = game.chain[index].id;
    if (queuedIds.has(ballId)) {
      continue;
    }

    queuedIds.add(ballId);
    queueMatchCheck(game, ballId, delay, actionId, trigger);
  }
}

// Expand a same-color run from a given seed index. This function is also
// responsible for deciding whether a removal creates a split segment or
// simply shortens an already contiguous chain.
export function resolveMatchesFrom(game, index, actionId = null, trigger = "insert") {
  if (index < 0 || index >= game.chain.length) {
    return;
  }

  // Match checks can fire mid-update before the usual end-of-frame sync, so
  // refresh the current path distances before deciding whether the frontmost
  // visible ball is part of this removal.
  game.syncChainPositions();

  const resolvedActionId =
    actionId ?? game.chain[index].lastActionId ?? createActionContext(game, "chain");

  // If a split already exists, array indices to the right of the removal may
  // shift and the seam index needs to be corrected after the splice.
  const splitIndexBeforeRemoval = game.splitState ? game.splitState.index : null;
  const color = game.chain[index].paletteIndex;
  let start = index;
  let end = index;

  while (
    start > 0 &&
    // 断链尚未闭合时，匹配搜索不能跨越断口。
    !game.hasGapBetween(start - 1, start) &&
    game.chain[start - 1].paletteIndex === color
  ) {
    start -= 1;
  }

  while (
    end < game.chain.length - 1 &&
    !game.hasGapBetween(end, end + 1) &&
    game.chain[end + 1].paletteIndex === color
  ) {
    end += 1;
  }

  if (end - start + 1 < 3) {
    return;
  }

  const removedCount = end - start + 1;
  const firstVisibleIndex = getFirstVisibleBallIndex(game);
  const removesVisibleHead =
    firstVisibleIndex >= 0 &&
    start <= firstVisibleIndex &&
    end >= firstVisibleIndex;
  const visibleHeadAnchorS =
    removesVisibleHead && end + 1 < game.chain.length
      ? game.chain[end + 1].s
      : null;
  const leadingTrimCount = removesVisibleHead ? start : 0;
  recordMatchEvent(game, { actionId: resolvedActionId, removedCount, trigger });

  // Spawn debris particles at each eliminated ball's position BEFORE the
  // splice removes them from the chain array.
  game.spawnMatchParticles(start, removedCount, color);

  game.chain.splice(start, removedCount);

  if (leadingTrimCount > 0) {
    game.chain.splice(0, leadingTrimCount);
  }

  const effectiveStart = start - leadingTrimCount;

  if (removesVisibleHead) {
    // If the matched group consumes the current visible head, any already
    // exited balls before it should not keep dragging the remaining visible
    // segment toward an off-screen packed target.
    absorbHeadRemovalIntoBaseline(game, removedCount + leadingTrimCount);
  } else {
    // Every ball behind the removed group needs temporary negative offset so it
    // can visually travel forward into the new empty space.
    for (let index = effectiveStart; index < game.chain.length; index += 1) {
      game.chain[index].offset -= removedCount * BALL_SPACING;
      game.chain[index].offsetMode = "close";
      game.chain[index].lastActionId = resolvedActionId;
    }
  }

  if (game.chain.length === 0) {
    game.splitState = null;
    game.pendingMatchChecks = [];
    return;
  }

  game.syncShooterPalettes();

  const seamIndex = Math.max(0, effectiveStart - 1);
  game.addImpact(seamIndex, 0.82);
  game.addImpact(Math.min(game.chain.length - 1, seamIndex + 1), 0.82);

  if (splitIndexBeforeRemoval !== null) {
    const trimmedBeforeSplit = Math.min(leadingTrimCount, splitIndexBeforeRemoval);
    const removedBeforeSplit = end < splitIndexBeforeRemoval ? removedCount : 0;
    game.splitState.index = Math.max(
      0,
      splitIndexBeforeRemoval - trimmedBeforeSplit - removedBeforeSplit,
    );

    if (
      game.splitState &&
      (game.splitState.index <= 0 || game.splitState.index >= game.chain.length)
    ) {
      game.splitState = null;
    }
  } else if (effectiveStart > 0 && effectiveStart < game.chain.length) {
    game.splitState = {
      index: effectiveStart,
      frontPull: 0,
      initialGap: 0,
      actionId: resolvedActionId,
    };
    game.splitState.initialGap =
      game.getSplitGap() ?? removedCount * BALL_SPACING;
    // Once a fresh split is created, cross-gap matching is invalid until the
    // rear segment physically reconnects, so we stop here.
    return;
  }

  if (removesVisibleHead) {
    alignVisibleHeadToAnchor(game, visibleHeadAnchorS);
    if (!game.splitState) {
      absorbLeadingBallOffsetIntoBaseline(game);
    }
  }

  if (
    seamIndex < game.chain.length - 1 &&
    !game.hasGapBetween(seamIndex, seamIndex + 1)
  ) {
    queueAdjacentMatchChecks(
      game,
      seamIndex,
      seamIndex + 1,
      resolvedActionId,
      INSERT_MATCH_DELAY * 1.15,
      "chain",
    );
  }
}
