import { BALL_SPACING, INSERT_MATCH_DELAY } from './config.js';
// 双轨支持：从 chain.js 导入 TrackState 访问器，按 trackIndex 访问正确的链
import { getTrackState } from './chain.js';

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
// 双轨支持：同时保护 splitState2 的 actionId，避免被清理
export function trimActionContexts(game) {
  if (game.actionContexts.size <= 64) {
    return;
  }

  const protectedIds = new Set();
  if (game.projectile?.actionId) {
    protectedIds.add(game.projectile.actionId);
  }
  // 保护两条轨道的 splitState actionId
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

// 延迟匹配检查的主更新函数。每帧从队列中取出到期的检查项，
// 根据 check.trackIndex 找到对应轨道的链，再按球 ID 定位当前索引，
// 最后调用 resolveMatchesFrom 执行三消判定。
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
    // 双轨支持：从 check 对象中读取 trackIndex，默认为 0（兼容旧的单轨逻辑）
    const trackIndex = check.trackIndex ?? 0;
    const ts = getTrackState(game, trackIndex);
    // The ball may have shifted to a new index while waiting, so delayed
    // checks always resolve by id instead of by the original array index.
    const index = ts.chain.findIndex((ball) => ball.id === check.ballId);
    if (index >= 0) {
      resolveMatchesFrom(game, index, check.actionId, check.trigger, trackIndex);
    }
  }
}

// Queue a future "start matching from this ball" request. We use this after
// insertion and after seam closure so visuals have a moment to communicate
// what just happened before a group vanishes. actionId keeps later chain
// reactions attached to the original shot for scoring/combo purposes.
// 双轨支持：新增 trackIndex 参数，记录到 check 对象中，去重时也匹配 trackIndex。
export function queueMatchCheck(
  game,
  ballId,
  delay = INSERT_MATCH_DELAY,
  actionId = null,
  trigger = "insert",
  trackIndex = 0,
) {
  // 去重：相同 ballId + actionId + trigger + trackIndex 的检查只保留一个
  const existing = game.pendingMatchChecks.find(
    (check) =>
      check.ballId === ballId &&
      check.actionId === actionId &&
      check.trigger === trigger &&
      (check.trackIndex ?? 0) === trackIndex,
  );
  if (existing) {
    existing.delay = Math.min(existing.delay, delay);
    return;
  }

  // 记录 trackIndex 到 check 对象，以便 updatePendingMatchChecks 使用
  game.pendingMatchChecks.push({ ballId, delay, actionId, trigger, trackIndex });
}

// 设置球的 lastActionId，用于延迟匹配检查追踪射击来源。
// 双轨支持：使用 getTrackState 访问正确轨道的 chain。
export function setBallAction(game, index, actionId, trackIndex = 0) {
  if (
    actionId === null ||
    actionId === undefined ||
    index < 0
  ) {
    return;
  }

  const ts = getTrackState(game, trackIndex);
  if (index >= ts.chain.length) {
    return;
  }

  ts.chain[index].lastActionId = actionId;
}

// ---------------------------------------------------------------------------
// 辅助函数：操作 TrackState 而不是直接操作 game 上的字段
// ---------------------------------------------------------------------------

// 可见头部被消除时，将被删除球的等效基线距离吸收进 chainHeadS，
// 避免后续球在旧的 packed 目标下产生追赶突变。
function absorbHeadRemovalIntoBaseline(ts, removedCount) {
  if (removedCount <= 0) {
    return;
  }

  const baselineShift = removedCount * BALL_SPACING;
  shiftChainBaseline(ts, -baselineShift);
}

// 平移 chainHeadS 基线，同时保持入场动画的目标距离不变。
function shiftChainBaseline(ts, deltaS) {
  if (!deltaS) {
    return;
  }

  ts.setChainHeadS(ts.getChainHeadS() + deltaS);

  // During the intro roll-in, keep the remaining entrance distance unchanged.
  const chainIntro = ts.getChainIntro();
  if (chainIntro) {
    chainIntro.targetHeadS += deltaS;
  }
}

// 将可见头部锚定到指定的路径距离，用于消除可见头部后保持后续球的位置稳定。
// 需要调用 game.syncChainPositions(trackIndex) 来更新链的实际位置。
function alignVisibleHeadToAnchor(ts, anchorS, game, trackIndex) {
  if (anchorS === null || anchorS === undefined || ts.chain.length === 0) {
    return;
  }

  game.syncChainPositions(trackIndex);
  // A visible-head removal may also shrink the front split segment, which
  // changes getSplitLocalOffset() distribution. Correct the shared baseline so
  // the first surviving ball stays exactly where it was before the splice.
  shiftChainBaseline(ts, anchorS - ts.chain[0].s);
}

// 如果链中所有球都有相同的 close 偏移量，将该共享偏移吸收进基线，
// 避免整条链做一次人为的追赶冲刺。
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

  // If the surviving chain keeps a shared offset after the visible head is
  // removed (for example when an old front segment has already exited), absorb
  // that common displacement into the baseline so the whole chain does not
  // perform one last artificial catch-up sprint.
  shiftChainBaseline(ts, sharedOffset);
  for (const ball of ts.chain) {
    ball.offset -= sharedOffset;
    if (Math.abs(ball.offset) < 0.04) {
      ball.offset = 0;
      ball.offsetMode = "idle";
    }
  }
}

// A closure-triggered re-check must consider both sides of the seam. If we
// only re-check the left ball, we miss cases where the new removable run
// starts on the right side after closure.
// 双轨支持：新增 trackIndex 参数，传递给 setBallAction 和 queueMatchCheck。
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

// ---------------------------------------------------------------------------
// resolveMatchesFrom — 核心三消判定函数
// 从给定的种子 index 向两侧扩展同色连续段，若长度 >= 3 则消除。
// 同时处理断链（split）的创建、已有 split 索引的修正、可见头部消除后
// 的基线重设，以及消除后接缝处的二次匹配检查。
//
// 双轨支持：新增 trackIndex 参数。所有对 chain / totalPathLength /
// splitState 的访问通过 getTrackState(game, trackIndex) 获取 ts，
// 所有需要 trackIndex 的 game 方法调用均转发该参数。
// ---------------------------------------------------------------------------
export function resolveMatchesFrom(game, index, actionId = null, trigger = "insert", trackIndex = 0) {
  const ts = getTrackState(game, trackIndex);

  if (index < 0 || index >= ts.chain.length) {
    return;
  }

  // Match checks can fire mid-update before the usual end-of-frame sync, so
  // refresh the current path distances before deciding whether the frontmost
  // visible ball is part of this removal.
  game.syncChainPositions(trackIndex);

  const resolvedActionId =
    actionId ?? ts.chain[index].lastActionId ?? createActionContext(game, "chain");

  // If a split already exists, array indices to the right of the removal may
  // shift and the seam index needs to be corrected after the splice.
  // 使用 ts 的 splitState 访问器，而不是直接读 game.splitState
  const splitState = ts.getSplitState();
  const splitIndexBeforeRemoval = splitState ? splitState.index : null;
  const color = ts.chain[index].paletteIndex;
  let start = index;
  let end = index;

  // 向左扩展同色段。断链尚未闭合时，匹配搜索不能跨越断口。
  while (
    start > 0 &&
    !game.hasGapBetween(start - 1, start, trackIndex) &&
    ts.chain[start - 1].paletteIndex === color
  ) {
    start -= 1;
  }

  // 向右扩展同色段
  while (
    end < ts.chain.length - 1 &&
    !game.hasGapBetween(end, end + 1, trackIndex) &&
    ts.chain[end + 1].paletteIndex === color
  ) {
    end += 1;
  }

  // 不足三个不消除
  if (end - start + 1 < 3) {
    return;
  }

  const removedCount = end - start + 1;

  // 查找当前可见的头部球（s 在 [0, totalPathLength] 范围内）
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

  // Spawn debris particles at each eliminated ball's position BEFORE the
  // splice removes them from the chain array.
  // 双轨支持：传递 ts.chain 引用，让粒子系统从正确的链数组读取球的位置
  game.spawnMatchParticles(ts.chain, start, removedCount, color);

  ts.chain.splice(start, removedCount);

  if (leadingTrimCount > 0) {
    ts.chain.splice(0, leadingTrimCount);
  }

  const effectiveStart = start - leadingTrimCount;

  if (removesVisibleHead) {
    // If the matched group consumes the current visible head, any already
    // exited balls before it should not keep dragging the remaining visible
    // segment toward an off-screen packed target.
    absorbHeadRemovalIntoBaseline(ts, removedCount + leadingTrimCount);
  } else {
    // Every ball behind the removed group needs temporary negative offset so it
    // can visually travel forward into the new empty space.
    for (let i = effectiveStart; i < ts.chain.length; i += 1) {
      ts.chain[i].offset -= removedCount * BALL_SPACING;
      ts.chain[i].offsetMode = "close";
      ts.chain[i].lastActionId = resolvedActionId;
    }
  }

  if (ts.chain.length === 0) {
    ts.setSplitState(null);
    // 清除属于本轨道的所有待处理匹配检查（不影响另一条轨道的检查）
    game.pendingMatchChecks = game.pendingMatchChecks.filter(
      (check) => (check.trackIndex ?? 0) !== trackIndex,
    );
    return;
  }

  game.syncShooterPalettes();

  const seamIndex = Math.max(0, effectiveStart - 1);
  game.addImpact(seamIndex, 0.82, trackIndex);
  game.addImpact(Math.min(ts.chain.length - 1, seamIndex + 1), 0.82, trackIndex);

  if (splitIndexBeforeRemoval !== null) {
    // 已有 split 的索引校正：减去消除/修剪掉的球数
    const trimmedBeforeSplit = Math.min(leadingTrimCount, splitIndexBeforeRemoval);
    const removedBeforeSplit = end < splitIndexBeforeRemoval ? removedCount : 0;
    const newSplitIndex = Math.max(
      0,
      splitIndexBeforeRemoval - trimmedBeforeSplit - removedBeforeSplit,
    );

    // 通过 ts 的访问器获取当前 splitState（可能被上面的 setSplitState 改变）
    const currentSplit = ts.getSplitState();
    if (currentSplit) {
      currentSplit.index = newSplitIndex;
    }

    if (
      currentSplit &&
      (currentSplit.index <= 0 || currentSplit.index >= ts.chain.length)
    ) {
      ts.setSplitState(null);
    }
  } else if (effectiveStart > 0 && effectiveStart < ts.chain.length) {
    // 消除产生了新的断链
    ts.setSplitState({
      index: effectiveStart,
      frontPull: 0,
      initialGap: 0,
      actionId: resolvedActionId,
    });
    const newSplit = ts.getSplitState();
    newSplit.initialGap =
      game.getSplitGap(trackIndex) ?? removedCount * BALL_SPACING;
    // Once a fresh split is created, cross-gap matching is invalid until the
    // rear segment physically reconnects, so we stop here.
    return;
  }

  if (removesVisibleHead) {
    alignVisibleHeadToAnchor(ts, visibleHeadAnchorS, game, trackIndex);
    if (!ts.getSplitState()) {
      absorbLeadingBallOffsetIntoBaseline(ts);
    }
  }

  // 消除后检查接缝处是否可以触发二次消除（连锁）
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
