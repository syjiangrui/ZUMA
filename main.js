// Fixed logical resolution. The canvas is CSS-scaled to fit the screen, while
// all gameplay math stays in this coordinate system.
const GAME_WIDTH = 430;
const GAME_HEIGHT = 932;

// Ball geometry and default spacing. BALL_SPACING is intentionally slightly
// smaller than diameter so the chain reads as a continuous packed line.
const BALL_RADIUS = 18;
const BALL_DIAMETER = BALL_RADIUS * 2;
const BALL_SPACING = 34;
const START_CHAIN_COUNT = 22;

// Base movement tuning. CHAIN_SPEED is the normal conveyor speed toward the
// goal. EXIT_GAP lets the whole chain travel a bit past the visible goal before
// the prototype resets.
const CHAIN_SPEED = 72;
const EXIT_GAP = 180;

// Projectile tuning for both mouse and touch play.
const PROJECTILE_SPEED = 820;
const PROJECTILE_MARGIN = 72;
const MUZZLE_OFFSET = 96;
const AIM_GUIDE_LENGTH = 132;

// Transition tuning. INSERT_SETTLE_SPEED controls how quickly an insertion
// "makes room", while GAP_CLOSE_SPEED controls how quickly a broken rear
// segment catches back up after a removal. These are rule-affecting values, not
// just cosmetic easing constants.
const INSERT_SETTLE_SPEED = 180;
const GAP_CLOSE_SPEED = 60;
const IMPACT_FADE_SPEED = 7;
const INSERT_MATCH_DELAY = 0.11;
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
    // splitState 表示球链被中段消除后，当前临时分成前后两段。
    this.splitState = null;
    this.projectile = null;
    this.nextBallId = 1;
    this.pendingMatchChecks = [];
    this.currentPaletteIndex = 0;
    this.nextPaletteIndex = 0;
    this.shooter = {
      x: GAME_WIDTH * 0.5,
      y: GAME_HEIGHT - 118,
      angle: -Math.PI / 2,
    };
    this.pointer = {
      active: false,
      x: GAME_WIDTH * 0.5,
      y: GAME_HEIGHT * 0.35,
    };
    this.lastTime = 0;

    this.createPath();
    this.createTextures();
    this.createChain();
    this.currentPaletteIndex = this.getRandomPaletteIndex();
    this.nextPaletteIndex = this.getRandomPaletteIndex();
    this.bindEvents();
    this.resize();
    requestAnimationFrame((time) => this.loop(time));
  }

  // Build a smooth path from a short list of control points, then resample it
  // into many small segments with cumulative arc length. Gameplay never moves
  // balls by raw x/y velocity on the track; it only changes path distance.
  createPath() {
    const controlPoints = [
      { x: 64, y: 122 },
      { x: 132, y: 142 },
      { x: 338, y: 228 },
      { x: 322, y: 342 },
      { x: 88, y: 430 },
      { x: 118, y: 594 },
      { x: 344, y: 652 },
      { x: 316, y: 784 },
      { x: 172, y: 846 },
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

  // Reset the prototype chain to a packed line of balls. This is also used as
  // the "restart" path once the tail reaches the goal in the current prototype.
  createChain() {
    this.chain = Array.from({ length: START_CHAIN_COUNT }, (_, index) =>
      this.createChainBall(index % 4),
    );

    this.chainHeadS = (this.chain.length - 1) * BALL_SPACING + 36;
    this.splitState = null;
    this.pendingMatchChecks = [];
    this.syncChainPositions();
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

      this.pointer.active = true;
      this.updatePointer(event);
      this.canvas.setPointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
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
      this.pointer.active = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
      this.fireProjectile();
    });

    this.canvas.addEventListener("pointercancel", (event) => {
      this.pointer.active = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointerleave", () => {
      if (!this.pointer.active) {
        this.pointer.x = this.shooter.x;
        this.pointer.y = this.shooter.y - 200;
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        this.fireProjectile();
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

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    // Order matters:
    // 1. Aim updates the shooter direction.
    // 2. Chain state advances and may consume delayed match checks.
    // 3. Projectile moves last so collisions are evaluated against the latest
    //    chain layout for this frame.
    this.updateAim(dt);
    this.updateChain(dt);
    this.updateProjectile(dt);
  }

  // Smooth aim toward the current pointer. Clamping prevents the turret from
  // rotating through the floor behind the shooter base.
  updateAim(dt) {
    const aimAngle = Math.atan2(
      this.pointer.y - this.shooter.y,
      this.pointer.x - this.shooter.x,
    );
    const clamped = Math.min(-0.15, Math.max(-Math.PI + 0.15, aimAngle));
    this.shooter.angle += (clamped - this.shooter.angle) * Math.min(1, dt * 10);
  }

  updateChain(dt) {
    if (this.chain.length === 0) {
      return;
    }

    this.chainHeadS += CHAIN_SPEED * dt;
    if (this.splitState) {
      // 前半段停住的做法不是暂停整条链，而是给前半段施加一个反向位移抵消基础推进。
      this.splitState.frontOffset -= CHAIN_SPEED * dt;
    }
    // Transition updates happen before positions are recomputed so the current
    // frame already reflects insertion / closure progress.
    this.updateBallTransitions(dt);
    this.updatePendingMatchChecks(dt);
    this.resolveSplitClosure();
    this.syncChainPositions();

    const tailS = this.chain[this.chain.length - 1].s;
    if (tailS > this.totalPathLength + EXIT_GAP) {
      this.createChain();
    }
  }

  syncChainPositions() {
    this.chain.forEach((ball, index) => {
      // 最终位置 = 整条链基础推进 + 单球过渡位移 + 断链时前半段的冻结位移。
      const splitOffset =
        this.splitState && index < this.splitState.index
          ? this.splitState.frontOffset
          : 0;
      ball.s = this.chainHeadS - index * BALL_SPACING + ball.offset + splitOffset;
      // Rotation is tied to traveled path distance so textured balls look like
      // they are rolling along the track instead of merely sliding.
      ball.rotation = ball.s / ball.radius;
    });
  }

  // Ease per-ball temporary offsets back toward zero. The key point here is
  // that different gameplay situations use different speed caps:
  // - insert: make room for a new ball
  // - close:  rear segment catches up after a removal
  // This function should stay purely about offset settling, not about chain
  // topology or match logic.
  updateBallTransitions(dt) {
    for (const ball of this.chain) {
      // offset 只负责过渡动画，不直接决定球链基础前进。
      const speed =
        ball.offsetMode === "close"
          ? GAP_CLOSE_SPEED
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

    const dueBallIds = [];

    // 插入和重新并链后延迟一小段时间再做三消判定，避免动画还没成立就瞬间消除。
    this.pendingMatchChecks = this.pendingMatchChecks.filter((check) => {
      check.delay -= dt;
      if (check.delay <= 0) {
        dueBallIds.push(check.ballId);
        return false;
      }

      return true;
    });

    for (const ballId of dueBallIds) {
      const index = this.chain.findIndex((ball) => ball.id === ballId);
      if (index >= 0) {
        // The ball may have shifted to a new index while waiting, so delayed
        // checks always resolve by id instead of by the original array index.
        this.resolveMatchesFrom(index);
      }
    }
  }

  // Queue a future "start matching from this ball" request. We use this after
  // insertion and after seam closure so visuals have a moment to communicate
  // what just happened before a group vanishes.
  queueMatchCheck(ballId, delay = INSERT_MATCH_DELAY) {
    this.pendingMatchChecks.push({ ballId, delay });
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
    // frontExtra is the front segment's extra "frozen" displacement at the
    // seam. The rear head must at least reach that amount before we can say the
    // two segments are touching again.
    const frontExtra = this.splitState.frontOffset + frontTail.offset;

    // 后半段真正追上前半段后，才允许重新并成一条链并触发跨接缝连锁判定。
    if (rearHead.offset < frontExtra) {
      return;
    }

    const seamIndex = this.splitState.index - 1;
    this.absorbSplitState();
    this.addImpact(seamIndex, 0.78);
    this.addImpact(seamIndex + 1, 0.78);
    this.queueMatchCheck(this.chain[seamIndex].id, 0.03);
  }

  absorbSplitState() {
    if (!this.splitState) {
      return;
    }

    const { frontOffset, index } = this.splitState;
    // 并链时把断链期间积累的段间偏移吸收回基准坐标，避免下一帧出现整体跳变。
    this.chainHeadS += frontOffset;

    for (let ballIndex = index; ballIndex < this.chain.length; ballIndex += 1) {
      // Rear balls were being simulated relative to the unsplit baseline. Once
      // the seam closes, fold the segment delta back into their per-ball offset
      // so there is no visible snap on the next sync.
      this.chain[ballIndex].offset -= frontOffset;
    }

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
    if (this.projectile) {
      return;
    }

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

    if (this.splitState && safeIndex < this.splitState.index) {
      // Inserting before an existing seam shifts the seam one slot to the right.
      this.splitState.index += 1;
    }

    this.chain.splice(safeIndex, 0, insertedBall);

    this.applyInsertSpacingWave(safeIndex);

    this.addImpact(safeIndex - 1, 0.72);
    this.addImpact(safeIndex + 1, 0.72);
    this.queueMatchCheck(insertedBall.id);
    this.syncChainPositions();
  }

  // Expand a same-color run from a given seed index. This function is also
  // responsible for deciding whether a removal creates a split segment or
  // simply shortens an already contiguous chain.
  resolveMatchesFrom(index) {
    if (index < 0 || index >= this.chain.length) {
      return;
    }

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
    this.chain.splice(start, removedCount);

    // Every ball behind the removed group needs temporary negative offset so it
    // can visually travel forward into the new empty space.
    for (let index = start; index < this.chain.length; index += 1) {
      this.chain[index].offset -= removedCount * BALL_SPACING;
      this.chain[index].offsetMode = "close";
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
        frontOffset: 0,
      };
      // Once a fresh split is created, cross-gap matching is invalid until the
      // rear segment physically reconnects, so we stop here.
      return;
    }

    if (
      seamIndex < this.chain.length - 1 &&
      !this.hasGapBetween(seamIndex, seamIndex + 1)
    ) {
      this.queueMatchCheck(this.chain[seamIndex].id, INSERT_MATCH_DELAY * 1.15);
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

    ctx.fillStyle = "#102628";
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);
    ctx.lineTo(0, GAME_HEIGHT - 206);
    ctx.quadraticCurveTo(110, GAME_HEIGHT - 256, 210, GAME_HEIGHT - 198);
    ctx.quadraticCurveTo(302, GAME_HEIGHT - 138, GAME_WIDTH, GAME_HEIGHT - 176);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  drawTrack(ctx) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(26, 17, 12, 0.72)";
    ctx.lineWidth = 54;
    this.strokePath(ctx);

    ctx.strokeStyle = "rgba(147, 121, 72, 0.94)";
    ctx.lineWidth = 42;
    this.strokePath(ctx);

    ctx.strokeStyle = "rgba(230, 209, 150, 0.32)";
    ctx.lineWidth = 12;
    this.strokePath(ctx);

    ctx.restore();
  }

  drawGoal(ctx) {
    const goal = this.pathPoints[this.pathPoints.length - 1];
    ctx.save();
    ctx.translate(goal.x, goal.y);

    const aura = ctx.createRadialGradient(0, 0, 12, 0, 0, 54);
    aura.addColorStop(0, "rgba(255, 220, 128, 0.34)");
    aura.addColorStop(1, "rgba(255, 220, 128, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#3f2514";
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, TAU);
    ctx.fill();

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#d2a85c";
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
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
    const startX = this.shooter.x + Math.cos(this.shooter.angle) * 74;
    const startY = this.shooter.y + Math.sin(this.shooter.angle) * 74;
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

    const base = ctx.createRadialGradient(0, -12, 8, 0, 0, 54);
    base.addColorStop(0, "#ecd992");
    base.addColorStop(0.45, "#9f7a3d");
    base.addColorStop(1, "#3c2411");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 8, 4, 0.5)";
    ctx.beginPath();
    ctx.arc(0, 8, 34, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = "#6f4d28";
    this.fillRoundedRect(ctx, -16, -84, 32, 88, 14);

    const barrel = ctx.createLinearGradient(0, -84, 0, 4);
    barrel.addColorStop(0, "#f6dc8a");
    barrel.addColorStop(0.6, "#a57e45");
    barrel.addColorStop(1, "#43270f");
    ctx.fillStyle = barrel;
    this.fillRoundedRect(ctx, -11, -96, 22, 92, 12);
    ctx.restore();

    this.drawBall(ctx, 0, -12, BALL_RADIUS + 2, this.currentPaletteIndex, angle * 2.2);
    this.drawBall(
      ctx,
      58,
      12,
      BALL_RADIUS - 2,
      this.nextPaletteIndex,
      -angle * 1.5,
    );

    ctx.restore();
  }

  drawOverlay(ctx) {
    ctx.fillStyle = "rgba(4, 8, 9, 0.18)";
    ctx.fillRect(0, 0, GAME_WIDTH, 92);

    ctx.fillStyle = "#f4e5bd";
    ctx.font = "600 18px Trebuchet MS";
    ctx.fillText("桌面测试：拖动瞄准，松开鼠标发射", 24, 38);

    ctx.fillStyle = "rgba(244, 229, 189, 0.74)";
    ctx.font = "14px Trebuchet MS";
    ctx.fillText("插入会先让位再并入轨道，消除后也会缓动合拢", 24, 60);
    ctx.fillText(`当前球链数量: ${this.chain.length}`, 24, 81);
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
