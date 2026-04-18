// Fixed logical resolution. The canvas is CSS-scaled to fit the screen, while
// all gameplay math stays in this coordinate system.
const GAME_WIDTH = 430;
const GAME_HEIGHT = 932;

// Ball geometry and default spacing. BALL_SPACING is intentionally slightly
// smaller than diameter so the chain reads as a continuous packed line.
const BALL_RADIUS = 14;
const BALL_DIAMETER = BALL_RADIUS * 2;
const BALL_SPACING = 27;
const START_CHAIN_COUNT = 30;

// Base movement tuning. CHAIN_SPEED is the normal conveyor speed toward the
// goal. EXIT_GAP lets the whole chain travel a bit past the visible goal before
// the prototype resets.
const CHAIN_SPEED = 72;
const EXIT_GAP = 180;

// Projectile tuning for both mouse and touch play.
const PROJECTILE_SPEED = 820;
const PROJECTILE_MARGIN = 72;
const MUZZLE_OFFSET = 84;
const AIM_GUIDE_LENGTH = 118;

// Transition tuning. INSERT_SETTLE_SPEED controls how quickly an insertion
// "makes room", while GAP_CLOSE_SPEED controls how quickly a broken rear
// segment catches back up after a removal. These are rule-affecting values, not
// just cosmetic easing constants.
const INSERT_SETTLE_SPEED = 180;
const GAP_CLOSE_SPEED = 60;
const SPLIT_CLOSE_SPEED = 84;
const IMPACT_FADE_SPEED = 7;
const INSERT_MATCH_DELAY = 0.11;
const SPLIT_MERGE_EPSILON = 1.2;
const TAU = Math.PI * 2;

// Programmatic palettes used both for initial chain colors and procedural ball
// textures. The texture generator later combines these into stripes, arcs and
// highlights so the balls read as rolling textured objects instead of flat dots.
const BALL_PALETTES = [
  {
    base: "#d85d5d",
    bright: "#ffd0be",
    dark: "#702723",
    accent: "#fff4c8",
    stripeDark: "rgba(101, 26, 23, 0.58)",
    stripeLight: "rgba(255, 244, 200, 0.7)",
  },
  {
    base: "#40a56f",
    bright: "#d1ffd0",
    dark: "#114f34",
    accent: "#dffdb9",
    stripeDark: "rgba(6, 54, 31, 0.58)",
    stripeLight: "rgba(214, 255, 205, 0.64)",
  },
  {
    base: "#4f84df",
    bright: "#dceaff",
    dark: "#1f366e",
    accent: "#f1f5c5",
    stripeDark: "rgba(19, 45, 104, 0.56)",
    stripeLight: "rgba(235, 241, 255, 0.62)",
  },
  {
    base: "#e0bb4d",
    bright: "#fff5c9",
    dark: "#80561c",
    accent: "#fff4d3",
    stripeDark: "rgba(119, 76, 10, 0.48)",
    stripeLight: "rgba(255, 249, 212, 0.62)",
  },
  {
    base: "#9a63d3",
    bright: "#f0ddff",
    dark: "#4d2679",
    accent: "#fff6c7",
    stripeDark: "rgba(67, 20, 100, 0.52)",
    stripeLight: "rgba(245, 225, 255, 0.6)",
  },
];

class ZumaGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.pathPoints = [];
    this.totalPathLength = 0;
    this.ballPatterns = [];
    this.chain = [];
    // chainHeadS is the shared baseline distance for the whole chain. Each
    // ball derives its visible position from:
    //   chainHeadS - index * BALL_SPACING + offset + splitOffset
    // This lets us keep one stable "chain conveyor" value and layer temporary
    // insertion / gap-closing animation on top.
    this.chainHeadS = 0;
    // gameState is the round-level gate for all gameplay simulation. Phase 2
    // starts by introducing this even before win/lose logic is fully wired, so
    // later work can stop updates cleanly instead of scattering booleans.
    this.gameState = "playing";
    // splitState 表示球链被中段消除后，当前临时分成前后两段。
    this.splitState = null;
    this.projectile = null;
    this.nextBallId = 1;
    this.pendingMatchChecks = [];
    this.currentPaletteIndex = 0;
    this.nextPaletteIndex = 0;
    this.shooter = {
      x: GAME_WIDTH * 0.5,
      y: GAME_HEIGHT * 0.58,
      angle: -Math.PI / 2,
    };
    this.pointer = {
      active: false,
      x: GAME_WIDTH * 0.5 + 90,
      y: GAME_HEIGHT * 0.58 - 120,
    };
    this.uiPressAction = null;
    // Score/combo are not derived from chain length deltas. They are driven by
    // explicit match events, each attached to the shot action that caused them.
    this.score = 0;
    this.nextActionId = 1;
    this.actionContexts = new Map();
    this.matchFeedback = null;
    this.recentCombo = null;
    this.bestCombo = 0;
    this.lastTime = 0;

    this.createPath();
    this.createTextures();
    this.resetRound();
    this.bindEvents();
    this.resize();
    requestAnimationFrame((time) => this.loop(time));
  }

  // Build a smooth path from a short list of control points, then resample it
  // into many small segments with cumulative arc length. Gameplay never moves
  // balls by raw x/y velocity on the track; it only changes path distance.
  createPath() {
    const controlPoints = [
      { x: 430, y: 716 },
      { x: 340, y: 750 },
      { x: 196, y: 748 },
      { x: 84, y: 688 },
      { x: 42, y: 554 },
      { x: 58, y: 374 },
      { x: 162, y: 276 },
      { x: 318, y: 274 },
      { x: 390, y: 382 },
      { x: 388, y: 550 },
      { x: 330, y: 676 },
      { x: 228, y: 718 },
      { x: 126, y: 678 },
      { x: 90, y: 580 },
      { x: 110, y: 460 },
      { x: 186, y: 382 },
      { x: 288, y: 392 },
      { x: 338, y: 486 },
      { x: 320, y: 598 },
      { x: 252, y: 648 },
      { x: 172, y: 620 },
      { x: 148, y: 538 },
      { x: 170, y: 456 },
      { x: 238, y: 424 },
      { x: 296, y: 458 },
      { x: 292, y: 530 },
      { x: 248, y: 566 },
      { x: 210, y: 548 },
      { x: 208, y: 496 },
      { x: 246, y: 468 },
    ];

    const sampled = [];
    const segmentsPerPair = 28;

    for (let i = 0; i < controlPoints.length - 1; i += 1) {
      const p0 = controlPoints[Math.max(0, i - 1)];
      const p1 = controlPoints[i];
      const p2 = controlPoints[i + 1];
      const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];

      for (let step = 0; step < segmentsPerPair; step += 1) {
        const t = step / segmentsPerPair;
        sampled.push(this.catmullRom(p0, p1, p2, p3, t));
      }
    }

    sampled.push(controlPoints[controlPoints.length - 1]);

    let total = 0;
    // 预采样路径并记录累计弧长；后续所有轨道运动都通过 len 映射到屏幕坐标。
    this.pathPoints = sampled.map((point, index) => {
      if (index > 0) {
        const prev = sampled[index - 1];
        total += Math.hypot(point.x - prev.x, point.y - prev.y);
      }

      return {
        x: point.x,
        y: point.y,
        len: total,
      };
    });

    this.totalPathLength = total;
  }

  createTextures() {
    this.ballPatterns = BALL_PALETTES.map((palette) =>
      this.createBallPatternCanvas(palette),
    );
  }

  // Reset the chain itself to a packed line of balls. Round-scoped state such
  // as projectile, palettes and gameState is handled by resetRound().
  createChain() {
    this.chain = Array.from({ length: START_CHAIN_COUNT }, (_, index) =>
      this.createChainBall(index % 4),
    );

    this.chainHeadS = (this.chain.length - 1) * BALL_SPACING + 36;
    this.splitState = null;
    this.pendingMatchChecks = [];
    this.syncChainPositions();
  }

  // All round-end side effects funnel through this setter so update/input code
  // only needs to ask whether the round is still in the "playing" state.
  setGameState(nextState) {
    this.gameState = nextState;
    if (nextState !== "playing") {
      this.pointer.active = false;
      this.projectile = null;
    }
  }

  isRoundPlaying() {
    return this.gameState === "playing";
  }

  // A round reset must clear every transient gameplay structure that can leak
  // across attempts: projectile, seam state, delayed match checks, palettes and
  // id allocation. This is the single restart path used by the constructor, the
  // prototype tail escape, and future restart UI.
  resetRound() {
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
    this.score = 0;
    this.currentPaletteIndex = this.getRandomPaletteIndex();
    this.nextPaletteIndex = this.getRandomPaletteIndex();
    this.shooter.angle = -Math.PI / 2;
    this.pointer.active = false;
    this.pointer.x = this.shooter.x + 90;
    this.pointer.y = this.shooter.y - 120;
    this.createChain();
  }

  createChainBall(paletteIndex) {
    return {
      id: this.nextBallId++,
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

  // Pointer events are used for both touch and mouse. The current prototype
  // fires on pointerup so players can drag to aim, then release to shoot.
  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      this.updatePointer(event);
      const uiAction = this.getUiActionAt(this.pointer.x, this.pointer.y);
      if (uiAction) {
        this.uiPressAction = uiAction;
        this.canvas.setPointerCapture?.(event.pointerId);
        return;
      }

      if (!this.isRoundPlaying()) {
        return;
      }

      this.pointer.active = true;
      this.canvas.setPointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.uiPressAction) {
        this.updatePointer(event);
        return;
      }

      if (!this.pointer.active && event.pointerType === "mouse") {
        this.updatePointer(event);
        return;
      }

      if (this.pointer.active) {
        this.updatePointer(event);
      }
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      this.updatePointer(event);
      if (this.uiPressAction) {
        const action = this.uiPressAction;
        this.uiPressAction = null;
        this.canvas.releasePointerCapture?.(event.pointerId);
        if (this.getUiActionAt(this.pointer.x, this.pointer.y) === action) {
          this.triggerUiAction(action);
        }
        return;
      }

      this.pointer.active = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
      if (this.isRoundPlaying()) {
        this.fireProjectile();
      }
    });

    this.canvas.addEventListener("pointercancel", (event) => {
      this.uiPressAction = null;
      this.pointer.active = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointerleave", () => {
      if (!this.pointer.active && !this.uiPressAction) {
        this.pointer.x = this.shooter.x + 90;
        this.pointer.y = this.shooter.y - 120;
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (this.isRoundPlaying()) {
          this.fireProjectile();
        }
      }

      if (event.code === "KeyR") {
        event.preventDefault();
        this.resetRound();
      }
    });
  }

  resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.canvas.width = GAME_WIDTH * dpr;
    this.canvas.height = GAME_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Convert screen coordinates back into the fixed logical canvas space.
  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    this.pointer.x = (event.clientX - rect.left) * scaleX;
    this.pointer.y = (event.clientY - rect.top) * scaleY;
  }

  isPointInsideRect(x, y, rect) {
    return (
      !!rect &&
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    );
  }

  getHudRestartButtonRect() {
    return { x: GAME_WIDTH - 108, y: 18, w: 84, h: 42 };
  }

  getHudNextPreviewRect() {
    return { x: GAME_WIDTH - 180, y: 16, w: 56, h: 56 };
  }

  // HUD and modal buttons share the same source rects for drawing and hit
  // testing, which keeps mobile touch targets aligned with their visuals.
  getEndCardRestartButtonRect() {
    if (this.gameState === "playing") {
      return null;
    }

    return {
      x: GAME_WIDTH * 0.5 - 84,
      y: GAME_HEIGHT * 0.12 + 114,
      w: 168,
      h: 34,
    };
  }

  // Button hit testing must run before gameplay input so tapping UI on phone
  // does not accidentally start an aiming / firing gesture on the canvas.
  getUiActionAt(x, y) {
    const endCardRestart = this.getEndCardRestartButtonRect();
    if (this.isPointInsideRect(x, y, endCardRestart)) {
      return "restart";
    }

    if (this.isPointInsideRect(x, y, this.getHudRestartButtonRect())) {
      return "restart";
    }

    return null;
  }

  // Centralize HUD actions so future buttons can reuse one dispatch path.
  triggerUiAction(action) {
    if (action === "restart") {
      this.resetRound();
    }
  }

  // One fired shot owns an action context. Later seam closures and follow-up
  // removals point back to it so scoring/combo logic can treat them as a
  // single player action instead of isolated events.
  createActionContext(source = "shot") {
    const actionId = this.nextActionId++;
    this.actionContexts.set(actionId, {
      id: actionId,
      source,
      combo: 0,
      totalRemoved: 0,
      totalScore: 0,
    });
    this.trimActionContexts();
    return actionId;
  }

  getActionContext(actionId) {
    if (actionId === null || actionId === undefined) {
      return null;
    }

    let context = this.actionContexts.get(actionId);
    if (!context) {
      context = {
        id: actionId,
        source: "system",
        combo: 0,
        totalRemoved: 0,
        totalScore: 0,
      };
      this.actionContexts.set(actionId, context);
    }
    return context;
  }

  // Delayed seam closures mean action contexts must outlive the shot itself,
  // but the table should still stay bounded once nothing references old ids.
  trimActionContexts() {
    if (this.actionContexts.size <= 64) {
      return;
    }

    const protectedIds = new Set();
    if (this.projectile?.actionId) {
      protectedIds.add(this.projectile.actionId);
    }
    if (this.splitState?.actionId) {
      protectedIds.add(this.splitState.actionId);
    }
    for (const check of this.pendingMatchChecks) {
      if (check.actionId) {
        protectedIds.add(check.actionId);
      }
    }

    for (const actionId of this.actionContexts.keys()) {
      if (this.actionContexts.size <= 64) {
        break;
      }
      if (!protectedIds.has(actionId)) {
        this.actionContexts.delete(actionId);
      }
    }
  }

  recordMatchEvent({ actionId, removedCount, trigger }) {
    const context = this.getActionContext(actionId);
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
    this.score += awardedScore;
    this.bestCombo = Math.max(this.bestCombo, context.combo);

    const tags = [];
    if (context.combo > 1) {
      tags.push(`连击 x${context.combo}`);
      this.recentCombo = {
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

    this.matchFeedback = {
      scoreDelta: awardedScore,
      combo: context.combo,
      removedCount,
      label: tags.join(" · "),
      timer: 1.2,
    };
  }

  // HUD feedback keeps its own timers so score/combo presentation can linger
  // for readability without affecting any gameplay state machine.
  updateHudState(dt) {
    if (this.matchFeedback) {
      this.matchFeedback.timer -= dt;
      if (this.matchFeedback.timer <= 0) {
        this.matchFeedback = null;
      }
    }

    if (this.recentCombo) {
      this.recentCombo.timer -= dt;
      if (this.recentCombo.timer <= 0) {
        this.recentCombo = null;
      }
    }
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    this.updateHudState(dt);
    if (!this.isRoundPlaying()) {
      return;
    }

    // Order matters:
    // 1. Aim updates the shooter direction.
    // 2. Chain state advances and may consume delayed match checks.
    // 3. Projectile moves last so collisions are evaluated against the latest
    //    chain layout for this frame.
    this.updateAim(dt);
    this.updateChain(dt);
    if (!this.isRoundPlaying()) {
      return;
    }
    this.updateProjectile(dt);
    this.updateRoundOutcome();
  }

  // Smooth aim toward the current pointer. With the shooter in the middle of
  // the board we need near-360-degree rotation, so interpolation follows the
  // shortest angular path instead of clamping to an upper arc.
  updateAim(dt) {
    const targetAngle = Math.atan2(
      this.pointer.y - this.shooter.y,
      this.pointer.x - this.shooter.x,
    );
    const delta = Math.atan2(
      Math.sin(targetAngle - this.shooter.angle),
      Math.cos(targetAngle - this.shooter.angle),
    );
    this.shooter.angle += delta * Math.min(1, dt * 12);
  }

  updateChain(dt) {
    if (this.chain.length === 0) {
      return;
    }

    if (!this.splitState) {
      this.chainHeadS += CHAIN_SPEED * dt;
    }
    // Once the chain is broken, keep the shared baseline still and let the rear
    // segment close the gap only through its own "close" offsets. This avoids
    // the old behavior where rear balls advanced at CHAIN_SPEED + GAP_CLOSE_SPEED
    // and visibly sprinted into the frozen front segment.
    // Transition updates happen before positions are recomputed so the current
    // frame already reflects insertion / closure progress.
    this.updateBallTransitions(dt);
    this.updatePendingMatchChecks(dt);
    this.resolveSplitClosure();
    this.syncChainPositions();

    const tailS = this.chain[this.chain.length - 1].s;
    if (tailS > this.totalPathLength + EXIT_GAP) {
      this.setGameState("lose");
    }
  }

  // Win/loss evaluation runs after both chain and projectile updates so a
  // frame cannot simultaneously consume a match, move a projectile, and then
  // misreport the round result from stale intermediate state.
  updateRoundOutcome() {
    if (!this.isRoundPlaying()) {
      return;
    }

    if (
      this.chain.length === 0 &&
      !this.projectile &&
      this.pendingMatchChecks.length === 0
    ) {
      this.setGameState("win");
    }
  }

  syncChainPositions() {
    this.chain.forEach((ball, index) => {
      // Final position = shared chain baseline + this ball's temporary offset.
      // During a split, chainHeadS stays frozen, so the front segment remains
      // still while the rear segment advances only by closing its negative gap
      // offsets back toward zero.
      ball.s = this.chainHeadS - index * BALL_SPACING + ball.offset;
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
  updateBallTransitions(dt) {
    for (const [index, ball] of this.chain.entries()) {
      // offset 只负责过渡动画，不直接决定球链基础前进。
      const speed =
        ball.offsetMode === "close"
          ? this.splitState && index >= this.splitState.index
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

  updatePendingMatchChecks(dt) {
    if (this.pendingMatchChecks.length === 0) {
      return;
    }

    const dueChecks = [];

    // 插入和重新并链后延迟一小段时间再做三消判定，避免动画还没成立就瞬间消除。
    this.pendingMatchChecks = this.pendingMatchChecks.filter((check) => {
      check.delay -= dt;
      if (check.delay <= 0) {
        dueChecks.push(check);
        return false;
      }

      return true;
    });

    for (const check of dueChecks) {
      const index = this.chain.findIndex((ball) => ball.id === check.ballId);
      if (index >= 0) {
        // The ball may have shifted to a new index while waiting, so delayed
        // checks always resolve by id instead of by the original array index.
        this.resolveMatchesFrom(index, check.actionId, check.trigger);
      }
    }
  }

  // Queue a future "start matching from this ball" request. We use this after
  // insertion and after seam closure so visuals have a moment to communicate
  // what just happened before a group vanishes. actionId keeps later chain
  // reactions attached to the original shot for scoring/combo purposes.
  queueMatchCheck(
    ballId,
    delay = INSERT_MATCH_DELAY,
    actionId = null,
    trigger = "insert",
  ) {
    const existing = this.pendingMatchChecks.find(
      (check) =>
        check.ballId === ballId &&
        check.actionId === actionId &&
        check.trigger === trigger,
    );
    if (existing) {
      existing.delay = Math.min(existing.delay, delay);
      return;
    }

    this.pendingMatchChecks.push({ ballId, delay, actionId, trigger });
  }

  setBallAction(index, actionId) {
    if (
      actionId === null ||
      actionId === undefined ||
      index < 0 ||
      index >= this.chain.length
    ) {
      return;
    }

    this.chain[index].lastActionId = actionId;
  }

  // A closure-triggered re-check must consider both sides of the seam. If we
  // only re-check the left ball, we miss cases where the new removable run
  // starts on the right side after closure.
  queueAdjacentMatchChecks(
    leftIndex,
    rightIndex,
    actionId,
    delay = INSERT_MATCH_DELAY,
    trigger = "chain",
  ) {
    this.setBallAction(leftIndex, actionId);
    this.setBallAction(rightIndex, actionId);

    const queuedIds = new Set();
    const candidates = [leftIndex, rightIndex];
    for (const index of candidates) {
      if (index < 0 || index >= this.chain.length) {
        continue;
      }

      const ballId = this.chain[index].id;
      if (queuedIds.has(ballId)) {
        continue;
      }

      queuedIds.add(ballId);
      this.queueMatchCheck(ballId, delay, actionId, trigger);
    }
  }

  // There is only ever one gameplay gap in the prototype: the break created
  // when a middle group disappears. Matching and chain logic must treat that
  // seam as non-adjacent until the rear segment has physically caught up.
  hasGapBetween(leftIndex, rightIndex) {
    return (
      !!this.splitState &&
      leftIndex === this.splitState.index - 1 &&
      rightIndex === this.splitState.index
    );
  }

  resolveSplitClosure() {
    if (
      !this.splitState ||
      this.splitState.index <= 0 ||
      this.splitState.index >= this.chain.length
    ) {
      this.splitState = null;
      return;
    }

    const frontTail = this.chain[this.splitState.index - 1];
    const rearHead = this.chain[this.splitState.index];
    // In the current split model the whole chain baseline is frozen, so seam
    // closure is purely about the rear head catching up to the front tail's
    // temporary offset at the break.
    const frontExtra = frontTail.offset;

    // 后半段真正追上前半段后，才允许重新并成一条链并触发跨接缝连锁判定。
    if (rearHead.offset < frontExtra - SPLIT_MERGE_EPSILON) {
      return;
    }

    rearHead.offset = frontExtra;
    if (Math.abs(rearHead.offset) < 0.04) {
      rearHead.offset = 0;
      rearHead.offsetMode = "idle";
    }

    const seamIndex = this.splitState.index - 1;
    const seamActionId = this.splitState.actionId;
    this.absorbSplitState();
    this.addImpact(seamIndex, 0.78);
    this.addImpact(seamIndex + 1, 0.78);
    this.queueAdjacentMatchChecks(seamIndex, seamIndex + 1, seamActionId, 0.03, "seam");
  }

  absorbSplitState() {
    if (!this.splitState) {
      return;
    }

    // With the current split model there is no extra segment delta to absorb:
    // the shared chain baseline stayed frozen while the seam was open, and the
    // rear segment used only per-ball offsets to close the gap.
    this.splitState = null;
  }

  addImpact(index, amount) {
    if (index < 0 || index >= this.chain.length) {
      return;
    }

    this.chain[index].impact = Math.max(this.chain[index].impact, amount);
  }

  updateProjectile(dt) {
    if (!this.projectile) {
      return;
    }

    this.projectile.x += this.projectile.vx * dt;
    this.projectile.y += this.projectile.vy * dt;
    this.projectile.rotation += this.projectile.spin * dt;

    const collision = this.findChainCollision();
    if (collision) {
      // Once the projectile is converted into a chain ball, the airborne object
      // disappears and all further motion is handled by the chain system.
      this.insertProjectile(collision);
      this.projectile = null;
      return;
    }

    if (
      this.projectile.x < -PROJECTILE_MARGIN ||
      this.projectile.x > GAME_WIDTH + PROJECTILE_MARGIN ||
      this.projectile.y < -PROJECTILE_MARGIN ||
      this.projectile.y > GAME_HEIGHT + PROJECTILE_MARGIN
    ) {
      this.projectile = null;
    }
  }

  fireProjectile() {
    if (!this.isRoundPlaying() || this.projectile) {
      return;
    }

    const actionId = this.createActionContext("shot");
    const angle = this.shooter.angle;
    const startX = this.shooter.x + Math.cos(angle) * MUZZLE_OFFSET;
    const startY = this.shooter.y + Math.sin(angle) * MUZZLE_OFFSET;

    // Airborne projectiles use free x/y motion. They only convert back into a
    // path-based coordinate once they collide with the chain.
    this.projectile = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      radius: BALL_RADIUS,
      paletteIndex: this.currentPaletteIndex,
      actionId,
      rotation: 0,
      spin: 7.2,
    };

    this.currentPaletteIndex = this.nextPaletteIndex;
    this.nextPaletteIndex = this.getRandomPaletteIndex();
  }

  findChainCollision() {
    if (!this.projectile || this.chain.length === 0) {
      return null;
    }

    let best = null;

    // The first prototype uses a simple nearest-ball hit test against current
    // chain positions. That is good enough to validate insertion flow before
    // moving to a more exact along-track insertion model.
    for (let index = 0; index < this.chain.length; index += 1) {
      const ball = this.chain[index];
      if (ball.s < 0 || ball.s > this.totalPathLength) {
        continue;
      }

      const point = this.getPointAtDistance(ball.s);
      const distance = Math.hypot(
        this.projectile.x - point.x,
        this.projectile.y - point.y,
      );

      if (distance <= BALL_DIAMETER - 4 && (!best || distance < best.distance)) {
        best = {
          hitIndex: index,
          hitS: ball.s,
          // projectileS is the nearest location on the sampled path to the hit
          // point. We later compare it with hitS to decide whether the new ball
          // lands on the start-side or goal-side of the struck ball.
          projectileS: this.getClosestPathDistance(
            this.projectile.x,
            this.projectile.y,
          ),
          distance,
        };
      }
    }

    return best;
  }

  // Keep the original one-step insertion model, but open a small local pocket
  // around the new ball immediately so the first frame reads less like overlap
  // and more like the chain yielding at the impact point.
  applyInsertSpacingWave(insertIndex) {
    const frontNudgeProfile = [6, 3];
    const rearOpenProfile = [8, 5, 2, 0];

    for (let offsetIndex = 0; offsetIndex < frontNudgeProfile.length; offsetIndex += 1) {
      const chainIndex = insertIndex - 1 - offsetIndex;
      if (chainIndex < 0) {
        break;
      }

      this.chain[chainIndex].offset += frontNudgeProfile[offsetIndex];
      this.chain[chainIndex].offsetMode = "insert";
    }

    for (let offsetIndex = 0; insertIndex + 1 + offsetIndex < this.chain.length; offsetIndex += 1) {
      const chainIndex = insertIndex + 1 + offsetIndex;
      const immediateClearance = rearOpenProfile[offsetIndex] ?? 0;

      this.chain[chainIndex].offset += BALL_SPACING - immediateClearance;
      this.chain[chainIndex].offsetMode = "insert";
    }
  }

  insertProjectile({ hitIndex, hitS, projectileS }) {
    const insertIndex = projectileS > hitS ? hitIndex : hitIndex + 1;
    const safeIndex = Math.max(0, Math.min(this.chain.length, insertIndex));
    const insertedBall = this.createChainBall(this.projectile.paletteIndex);
    // targetS is where the new ball would sit in a perfectly packed chain.
    // insertionOffset then preserves some of the projectile's actual impact
    // position so the ball appears to slide into place instead of teleporting.
    const targetS = this.chainHeadS - safeIndex * BALL_SPACING;
    const insertionOffset = Math.max(
      -BALL_SPACING * 1.25,
      Math.min(BALL_SPACING * 1.25, projectileS - targetS),
    );

    insertedBall.offset = insertionOffset;
    insertedBall.offsetMode = "insert";
    insertedBall.impact = 1;
    // Once the projectile becomes part of the chain, later delayed checks need
    // to preserve its scoring/combo ownership across seam closures.
    insertedBall.lastActionId = this.projectile.actionId ?? null;

    if (this.splitState && safeIndex < this.splitState.index) {
      // Inserting before an existing seam shifts the seam one slot to the right.
      this.splitState.index += 1;
    }

    this.chain.splice(safeIndex, 0, insertedBall);

    this.applyInsertSpacingWave(safeIndex);

    this.addImpact(safeIndex - 1, 0.72);
    this.addImpact(safeIndex + 1, 0.72);
    this.queueMatchCheck(insertedBall.id, INSERT_MATCH_DELAY, this.projectile.actionId, "insert");
    this.syncChainPositions();
  }

  // Expand a same-color run from a given seed index. This function is also
  // responsible for deciding whether a removal creates a split segment or
  // simply shortens an already contiguous chain.
  resolveMatchesFrom(index, actionId = null, trigger = "insert") {
    if (index < 0 || index >= this.chain.length) {
      return;
    }

    const resolvedActionId =
      actionId ?? this.chain[index].lastActionId ?? this.createActionContext("chain");

    // If a split already exists, array indices to the right of the removal may
    // shift and the seam index needs to be corrected after the splice.
    const splitIndexBeforeRemoval = this.splitState ? this.splitState.index : null;
    const color = this.chain[index].paletteIndex;
    let start = index;
    let end = index;

    while (
      start > 0 &&
      // 断链尚未闭合时，匹配搜索不能跨越断口。
      !this.hasGapBetween(start - 1, start) &&
      this.chain[start - 1].paletteIndex === color
    ) {
      start -= 1;
    }

    while (
      end < this.chain.length - 1 &&
      !this.hasGapBetween(end, end + 1) &&
      this.chain[end + 1].paletteIndex === color
    ) {
      end += 1;
    }

    if (end - start + 1 < 3) {
      return;
    }

    const removedCount = end - start + 1;
    this.recordMatchEvent({ actionId: resolvedActionId, removedCount, trigger });
    this.chain.splice(start, removedCount);

    // Every ball behind the removed group needs temporary negative offset so it
    // can visually travel forward into the new empty space.
    for (let index = start; index < this.chain.length; index += 1) {
      this.chain[index].offset -= removedCount * BALL_SPACING;
      this.chain[index].offsetMode = "close";
      this.chain[index].lastActionId = resolvedActionId;
    }

    if (this.chain.length === 0) {
      this.splitState = null;
      this.pendingMatchChecks = [];
      return;
    }

    const seamIndex = Math.max(0, start - 1);
    this.addImpact(seamIndex, 0.82);
    this.addImpact(Math.min(this.chain.length - 1, seamIndex + 1), 0.82);

    if (splitIndexBeforeRemoval !== null) {
      if (end < splitIndexBeforeRemoval) {
        this.splitState.index = Math.max(0, splitIndexBeforeRemoval - removedCount);
      }

      if (
        this.splitState &&
        (this.splitState.index <= 0 || this.splitState.index >= this.chain.length)
      ) {
        this.splitState = null;
      }
    } else if (start > 0 && start < this.chain.length) {
      this.splitState = {
        index: start,
        actionId: resolvedActionId,
      };
      // Once a fresh split is created, cross-gap matching is invalid until the
      // rear segment physically reconnects, so we stop here.
      return;
    }

    if (
      seamIndex < this.chain.length - 1 &&
      !this.hasGapBetween(seamIndex, seamIndex + 1)
    ) {
      this.queueAdjacentMatchChecks(
        seamIndex,
        seamIndex + 1,
        resolvedActionId,
        INSERT_MATCH_DELAY * 1.15,
        "chain",
      );
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawBackground(ctx);
    this.drawTrack(ctx);
    this.drawGoal(ctx);
    this.drawChain(ctx);
    this.drawProjectile(ctx);
    this.drawAimGuide(ctx);
    this.drawShooter(ctx);
    this.drawOverlay(ctx);
    this.drawMatchFeedback(ctx);
    this.drawRoundStateCard(ctx);
  }

  drawBackground(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    sky.addColorStop(0, "#21595c");
    sky.addColorStop(0.5, "#123639");
    sky.addColorStop(1, "#081112");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const glow = ctx.createRadialGradient(
      GAME_WIDTH * 0.38,
      160,
      10,
      GAME_WIDTH * 0.38,
      160,
      280,
    );
    glow.addColorStop(0, "rgba(255, 217, 122, 0.26)");
    glow.addColorStop(1, "rgba(255, 217, 122, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = "rgba(238, 225, 192, 0.035)";
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.arc(46 + i * 54, 60 + (i % 2) * 22, 18 + (i % 3) * 8, 0, TAU);
      ctx.fill();
    }

    const altarGlow = ctx.createRadialGradient(
      this.shooter.x,
      this.shooter.y - 10,
      18,
      this.shooter.x,
      this.shooter.y - 10,
      138,
    );
    altarGlow.addColorStop(0, "rgba(244, 217, 129, 0.18)");
    altarGlow.addColorStop(1, "rgba(244, 217, 129, 0)");
    ctx.fillStyle = altarGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = "#102628";
    ctx.beginPath();
    ctx.ellipse(this.shooter.x, this.shooter.y + 30, 118, 84, 0, 0, TAU);
    ctx.fill();

    const altar = ctx.createRadialGradient(
      this.shooter.x - 24,
      this.shooter.y - 34,
      16,
      this.shooter.x,
      this.shooter.y + 18,
      112,
    );
    altar.addColorStop(0, "#2a5a5d");
    altar.addColorStop(0.48, "#153739");
    altar.addColorStop(1, "#0b191b");
    ctx.fillStyle = altar;
    ctx.beginPath();
    ctx.ellipse(this.shooter.x, this.shooter.y + 16, 94, 64, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(244, 225, 168, 0.14)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(this.shooter.x, this.shooter.y + 16, 84, 56, 0, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(7, 18, 19, 0.76)";
    ctx.beginPath();
    ctx.ellipse(this.shooter.x, this.shooter.y + 58, 72, 22, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(8, 20, 21, 0.55)";
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);
    ctx.lineTo(0, GAME_HEIGHT - 88);
    ctx.quadraticCurveTo(88, GAME_HEIGHT - 134, 170, GAME_HEIGHT - 112);
    ctx.quadraticCurveTo(280, GAME_HEIGHT - 84, GAME_WIDTH, GAME_HEIGHT - 124);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  drawTrack(ctx) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(34, 43, 58, 0.82)";
    ctx.lineWidth = 36;
    this.strokePath(ctx);

    ctx.strokeStyle = "rgba(92, 103, 124, 0.96)";
    ctx.lineWidth = 26;
    this.strokePath(ctx);

    ctx.strokeStyle = "rgba(198, 210, 228, 0.24)";
    ctx.lineWidth = 6;
    this.strokePath(ctx);

    ctx.restore();
  }

  drawGoal(ctx) {
    const goal = this.pathPoints[this.pathPoints.length - 1];
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

  drawChain(ctx) {
    // Only draw balls that are currently on the playable portion of the path.
    for (const ball of this.chain) {
      if (ball.s < 0 || ball.s > this.totalPathLength) {
        continue;
      }

      const point = this.getPointAtDistance(ball.s);
      this.drawBall(
        ctx,
        point.x,
        point.y,
        ball.radius,
        ball.paletteIndex,
        ball.rotation,
        ball.impact,
      );
    }
  }

  drawProjectile(ctx) {
    if (!this.projectile) {
      return;
    }

    this.drawBall(
      ctx,
      this.projectile.x,
      this.projectile.y,
      this.projectile.radius,
      this.projectile.paletteIndex,
      this.projectile.rotation,
      0,
    );
  }

  drawAimGuide(ctx) {
    const startX = this.shooter.x + Math.cos(this.shooter.angle) * 60;
    const startY = this.shooter.y + Math.sin(this.shooter.angle) * 60;
    const endX = startX + Math.cos(this.shooter.angle) * AIM_GUIDE_LENGTH;
    const endY = startY + Math.sin(this.shooter.angle) * AIM_GUIDE_LENGTH;

    ctx.save();
    ctx.setLineDash([9, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(251, 233, 179, 0.42)";
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  drawShooter(ctx) {
    const { x, y, angle } = this.shooter;

    ctx.save();
    ctx.translate(x, y);

    const base = ctx.createRadialGradient(0, -10, 6, 0, 0, 44);
    base.addColorStop(0, "#ecd992");
    base.addColorStop(0.45, "#9f7a3d");
    base.addColorStop(1, "#3c2411");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 8, 4, 0.5)";
    ctx.beginPath();
    ctx.arc(0, 6, 27, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = "#6f4d28";
    this.fillRoundedRect(ctx, -14, -70, 28, 72, 12);

    const barrel = ctx.createLinearGradient(0, -72, 0, 2);
    barrel.addColorStop(0, "#f6dc8a");
    barrel.addColorStop(0.6, "#a57e45");
    barrel.addColorStop(1, "#43270f");
    ctx.fillStyle = barrel;
    this.fillRoundedRect(ctx, -9, -82, 18, 80, 10);
    ctx.restore();

    this.drawBall(ctx, 0, -10, BALL_RADIUS + 1, this.currentPaletteIndex, angle * 2.2);
    this.drawBall(
      ctx,
      46,
      10,
      BALL_RADIUS - 1,
      this.nextPaletteIndex,
      -angle * 1.5,
    );

    ctx.restore();
  }

  // The top overlay is now a real HUD layer: state, score/combo, next ball and
  // touch-friendly restart all live here instead of temporary prototype text.
  drawOverlay(ctx) {
    ctx.fillStyle = "rgba(4, 8, 9, 0.18)";
    ctx.fillRect(0, 0, GAME_WIDTH, 108);

    ctx.fillStyle = "#f4e5bd";
    ctx.font = "600 18px Trebuchet MS";
    ctx.fillText("中央发射口原型", 24, 34);

    ctx.fillStyle = "rgba(244, 229, 189, 0.74)";
    ctx.font = "14px Trebuchet MS";
    ctx.fillText("拖动瞄准，松开发射", 24, 54);
    ctx.fillText(`状态: ${this.getGameStateLabel()}  |  链长: ${this.chain.length}`, 24, 76);
    ctx.fillText(`分数: ${this.score}  |  ${this.getComboHudText()}`, 24, 96);
    this.drawHudNextPreview(ctx);
    this.drawRestartButton(
      ctx,
      this.getHudRestartButtonRect(),
      "重开",
      this.uiPressAction === "restart" &&
        this.isPointInsideRect(this.pointer.x, this.pointer.y, this.getHudRestartButtonRect()),
    );
  }

  getGameStateLabel() {
    if (this.gameState === "win") {
      return "胜利";
    }

    if (this.gameState === "lose") {
      return "失败";
    }

    return "进行中";
  }

  // Keep combo feedback readable for longer than the floating +score bubble so
  // players can still confirm a combo happened after the popup fades.
  getComboHudText() {
    if (this.recentCombo) {
      return `连击: x${this.recentCombo.combo}`;
    }

    if (this.bestCombo > 1) {
      return `最高连击: x${this.bestCombo}`;
    }

    return "连击: -";
  }

  // The round-end card doubles as the phone-friendly restart surface until a
  // fuller post-game menu exists.
  drawRoundStateCard(ctx) {
    if (this.gameState === "playing") {
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(4, 8, 10, 0.42)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const panelWidth = 252;
    const panelHeight = 146;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = GAME_HEIGHT * 0.12;

    const panel = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panel.addColorStop(0, "rgba(14, 26, 30, 0.94)");
    panel.addColorStop(1, "rgba(8, 17, 20, 0.94)");
    ctx.fillStyle = panel;
    this.fillRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);

    ctx.strokeStyle =
      this.gameState === "win"
        ? "rgba(244, 220, 137, 0.72)"
        : "rgba(220, 133, 115, 0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(panelX + 24, panelY);
    ctx.lineTo(panelX + panelWidth - 24, panelY);
    ctx.quadraticCurveTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + 24);
    ctx.lineTo(panelX + panelWidth, panelY + panelHeight - 24);
    ctx.quadraticCurveTo(
      panelX + panelWidth,
      panelY + panelHeight,
      panelX + panelWidth - 24,
      panelY + panelHeight,
    );
    ctx.lineTo(panelX + 24, panelY + panelHeight);
    ctx.quadraticCurveTo(panelX, panelY + panelHeight, panelX, panelY + panelHeight - 24);
    ctx.lineTo(panelX, panelY + 24);
    ctx.quadraticCurveTo(panelX, panelY, panelX + 24, panelY);
    ctx.stroke();

    ctx.fillStyle = "#f4e5bd";
    ctx.textAlign = "center";
    ctx.font = "600 28px Trebuchet MS";
    ctx.fillText(this.gameState === "win" ? "胜利" : "失败", GAME_WIDTH / 2, panelY + 52);

    ctx.fillStyle = "rgba(244, 229, 189, 0.78)";
    ctx.font = "15px Trebuchet MS";
    ctx.fillText(
      this.gameState === "win"
        ? `当前球链已清空，本局得分 ${this.score}`
        : `球链抵达终点，本局得分 ${this.score}`,
      GAME_WIDTH / 2,
      panelY + 88,
    );
    ctx.fillText(
      this.bestCombo > 1 ? `最高连击 x${this.bestCombo}` : "本局未触发连击",
      GAME_WIDTH / 2,
      panelY + 108,
    );
    const restartRect = this.getEndCardRestartButtonRect();
    this.drawRestartButton(
      ctx,
      restartRect,
      "重新开始",
      this.uiPressAction === "restart" &&
        this.isPointInsideRect(this.pointer.x, this.pointer.y, restartRect),
    );
    ctx.textAlign = "start";
    ctx.restore();
  }

  // Floating score feedback stays brief, while the persistent HUD keeps the
  // actual score and combo summary visible for longer inspection.
  drawMatchFeedback(ctx) {
    if (!this.matchFeedback) {
      return;
    }

    const fadeWindow = 0.25;
    const alpha =
      this.matchFeedback.timer > fadeWindow
        ? 1
        : Math.max(0, this.matchFeedback.timer / fadeWindow);
    const rise = (1 - Math.min(1, this.matchFeedback.timer / 1.2)) * 18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";

    ctx.fillStyle = "rgba(8, 17, 19, 0.46)";
    this.fillRoundedRect(ctx, GAME_WIDTH * 0.5 - 92, 118 - rise, 184, 56, 18);

    ctx.fillStyle = "#ffe9a9";
    ctx.font = "600 22px Trebuchet MS";
    ctx.fillText(`+${this.matchFeedback.scoreDelta}`, GAME_WIDTH * 0.5, 141 - rise);

    ctx.fillStyle = "rgba(244, 229, 189, 0.88)";
    ctx.font = "13px Trebuchet MS";
    const detail =
      this.matchFeedback.label || `消除 ${this.matchFeedback.removedCount} 颗`;
    ctx.fillText(detail, GAME_WIDTH * 0.5, 161 - rise);

    ctx.textAlign = "start";
    ctx.restore();
  }

  drawHudNextPreview(ctx) {
    const rect = this.getHudNextPreviewRect();

    ctx.save();
    ctx.fillStyle = "rgba(10, 20, 23, 0.72)";
    this.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    ctx.strokeStyle = "rgba(244, 229, 189, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rect.x + 18, rect.y);
    ctx.lineTo(rect.x + rect.w - 18, rect.y);
    ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + 18);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 18);
    ctx.quadraticCurveTo(
      rect.x + rect.w,
      rect.y + rect.h,
      rect.x + rect.w - 18,
      rect.y + rect.h,
    );
    ctx.lineTo(rect.x + 18, rect.y + rect.h);
    ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - 18);
    ctx.lineTo(rect.x, rect.y + 18);
    ctx.quadraticCurveTo(rect.x, rect.y, rect.x + 18, rect.y);
    ctx.stroke();

    ctx.fillStyle = "rgba(244, 229, 189, 0.72)";
    ctx.font = "11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("下一个", rect.x + rect.w / 2, rect.y + rect.h - 8);
    this.drawBall(
      ctx,
      rect.x + rect.w / 2,
      rect.y + 23,
      BALL_RADIUS - 1,
      this.nextPaletteIndex,
      -this.shooter.angle * 1.5,
    );
    ctx.textAlign = "start";
    ctx.restore();
  }

  drawRestartButton(ctx, rect, label, isPressed = false) {
    ctx.save();

    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    if (isPressed) {
      fill.addColorStop(0, "rgba(177, 108, 60, 0.96)");
      fill.addColorStop(1, "rgba(104, 56, 30, 0.96)");
    } else {
      fill.addColorStop(0, "rgba(209, 141, 78, 0.94)");
      fill.addColorStop(1, "rgba(121, 67, 37, 0.94)");
    }
    ctx.fillStyle = fill;
    this.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);

    ctx.strokeStyle = "rgba(251, 229, 182, 0.56)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rect.x + 18, rect.y);
    ctx.lineTo(rect.x + rect.w - 18, rect.y);
    ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + 18);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 18);
    ctx.quadraticCurveTo(
      rect.x + rect.w,
      rect.y + rect.h,
      rect.x + rect.w - 18,
      rect.y + rect.h,
    );
    ctx.lineTo(rect.x + 18, rect.y + rect.h);
    ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - 18);
    ctx.lineTo(rect.x, rect.y + 18);
    ctx.quadraticCurveTo(rect.x, rect.y, rect.x + 18, rect.y);
    ctx.stroke();

    ctx.fillStyle = "#fff3d2";
    ctx.font = "600 15px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  drawBall(ctx, x, y, radius, paletteIndex, rotation, impact = 0) {
    const palette = BALL_PALETTES[paletteIndex];
    const pattern = this.ballPatterns[paletteIndex];
    // impact slightly enlarges the ball and adds an aura so collision / seam
    // events read even before we introduce particles.
    const scale = 1 + impact * 0.08;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (impact > 0.02) {
      const aura = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.55);
      aura.addColorStop(0, "rgba(255, 249, 214, 0)");
      aura.addColorStop(0.55, "rgba(255, 241, 187, 0.18)");
      aura.addColorStop(1, "rgba(255, 241, 187, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.55, 0, TAU);
      ctx.fill();
    }

    const body = ctx.createRadialGradient(
      -radius * 0.32,
      -radius * 0.4,
      radius * 0.28,
      0,
      0,
      radius,
    );
    body.addColorStop(0, palette.bright);
    body.addColorStop(0.46, palette.base);
    body.addColorStop(1, palette.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.clip();
    ctx.rotate(rotation);
    ctx.drawImage(pattern, -radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 248, 227, 0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, TAU);
    ctx.stroke();

    const highlight = ctx.createRadialGradient(
      -radius * 0.45,
      -radius * 0.5,
      1,
      -radius * 0.45,
      -radius * 0.5,
      radius * 0.8,
    );
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.62)");
    highlight.addColorStop(0.4, "rgba(255, 255, 255, 0.16)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  fillRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  strokePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);

    for (let i = 1; i < this.pathPoints.length; i += 1) {
      ctx.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
    }

    ctx.stroke();
  }

  getPointAtDistance(s) {
    if (s <= 0) {
      return this.pathPoints[0];
    }

    if (s >= this.totalPathLength) {
      return this.pathPoints[this.pathPoints.length - 1];
    }

    let low = 0;
    let high = this.pathPoints.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.pathPoints[mid].len < s) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const next = this.pathPoints[low];
    const prev = this.pathPoints[Math.max(0, low - 1)];
    const span = next.len - prev.len || 1;
    const t = (s - prev.len) / span;

    // Linear interpolation between neighboring sampled points is enough because
    // the original curve was already oversampled in createPath().
    return {
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t,
    };
  }

  getClosestPathDistance(x, y) {
    let closest = this.pathPoints[0];
    let bestDistance = Infinity;

    // 采样点数量不大，这里直接线性扫描即可，后续只有路径复杂很多时才需要优化。
    for (const point of this.pathPoints) {
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = point;
      }
    }

    return closest.len;
  }

  getRandomPaletteIndex() {
    // The prototype currently limits itself to the first four colors to keep
    // match density readable while the rules are still being tuned.
    return Math.floor(Math.random() * 4);
  }

  // Catmull-Rom gives us a smooth track through the authored control points
  // without manually defining Bézier tangents.
  catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x:
        0.5 *
        ((2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        ((2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  }

  createBallPatternCanvas(palette) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // The texture is intentionally directional: stripes plus arcs make the
    // rotation of the ball visible when the sprite is spun around its center.
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(-size / 2, -size / 2, size, size);

    ctx.rotate(-Math.PI / 7);
    for (let i = -4; i <= 4; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? palette.stripeDark : palette.stripeLight;
      ctx.fillRect(-size * 0.8, i * 14 - 4, size * 1.6, 10);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(size / 2, size / 2);
    ctx.lineWidth = 12;
    ctx.strokeStyle = `${palette.accent}88`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.22, -Math.PI * 0.85, Math.PI * 0.22);
    ctx.stroke();

    ctx.strokeStyle = `${palette.dark}bb`;
    ctx.beginPath();
    ctx.arc(10, -8, size * 0.34, Math.PI * 0.14, Math.PI * 1.16);
    ctx.stroke();

    return canvas;
  }
}

window.addEventListener("load", () => {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    return;
  }

  new ZumaGame(canvas);
});
