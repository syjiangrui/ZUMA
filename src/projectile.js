import {
  GAME_WIDTH, GAME_HEIGHT, BALL_RADIUS, BALL_DIAMETER, BALL_SPACING,
  PROJECTILE_SPEED, PROJECTILE_MARGIN, MUZZLE_OFFSET, INSERT_MATCH_DELAY,
} from './config.js';
// 双轨支持：导入 getTrackState 用于按 trackIndex 访问正确的链/路径
import { getTrackState } from './chain.js';
// 双轨支持：导入 getClosestPathDistance 用于在不同轨道的 pathPoints 上做投影
import { getClosestPathDistance as getClosestPathDistanceFn } from './path.js';

export function updateProjectile(game, dt) {
  if (!game.projectile) {
    return;
  }

  game.projectile.x += game.projectile.vx * dt;
  game.projectile.y += game.projectile.vy * dt;
  game.projectile.rotation += game.projectile.spin * dt;

  const collision = findChainCollision(game);
  if (collision) {
    // Once the projectile is converted into a chain ball, the airborne object
    // disappears and all further motion is handled by the chain system.
    game.sfx.playHit();
    insertProjectile(game, collision);
    game.projectile = null;
    return;
  }

  if (
    game.projectile.x < -PROJECTILE_MARGIN ||
    game.projectile.x > GAME_WIDTH + PROJECTILE_MARGIN ||
    game.projectile.y < -PROJECTILE_MARGIN ||
    game.projectile.y > GAME_HEIGHT + PROJECTILE_MARGIN
  ) {
    game.projectile = null;
  }
}

export function fireProjectile(game) {
  if (!game.isRoundPlaying() || game.projectile) {
    return;
  }

  game.sfx.playShoot();
  const actionId = game.createActionContext("shot");
  const angle = game.shooter.angle;
  const startX = game.shooter.x + Math.cos(angle) * MUZZLE_OFFSET;
  const startY = game.shooter.y + Math.sin(angle) * MUZZLE_OFFSET;

  // Airborne projectiles use free x/y motion. They only convert back into a
  // path-based coordinate once they collide with the chain.
  game.projectile = {
    x: startX,
    y: startY,
    vx: Math.cos(angle) * PROJECTILE_SPEED,
    vy: Math.sin(angle) * PROJECTILE_SPEED,
    radius: BALL_RADIUS,
    paletteIndex: game.currentPaletteIndex,
    actionId,
    rotation: 0,
    spin: 7.2,
  };

  game.currentPaletteIndex = game.nextPaletteIndex;
  game.nextPaletteIndex = game.getRandomPaletteIndex();
  game.syncShooterPalettes();
}

// ---------------------------------------------------------------------------
// findChainCollision — 在所有活跃轨道中扫描最近碰撞球。
// 双轨支持：扫描 trackIndex 从 0 到 (isDualTrack ? 1 : 0)，
// 对每条轨道使用 getTrackState 获取 ts.chain / ts.pathPoints 等，
// 并用 getClosestPathDistanceFn(ts.pathPoints, ...) 计算 projectileS。
// 返回结果包含新增的 trackIndex 字段。
// ---------------------------------------------------------------------------
export function findChainCollision(game) {
  if (!game.projectile) {
    return null;
  }

  let best = null;
  // 确定需要扫描的轨道数（单轨=1，双轨=2）
  const trackCount = game.isDualTrack ? 2 : 1;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    const ts = getTrackState(game, trackIndex);

    // 跳过空链
    if (ts.chain.length === 0) {
      continue;
    }

    // The first prototype uses a simple nearest-ball hit test against current
    // chain positions. That is good enough to validate insertion flow before
    // moving to a more exact along-track insertion model.
    for (let index = 0; index < ts.chain.length; index += 1) {
      const ball = ts.chain[index];
      // 只检测在路径可见范围内的球
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
          // projectileS is the nearest location on the sampled path to the hit
          // point. We later compare it with hitS to decide whether the new ball
          // lands on the start-side or goal-side of the struck ball.
          // 双轨支持：使用该轨道的 pathPoints 做投影
          projectileS: getClosestPathDistanceFn(
            ts.pathPoints,
            game.projectile.x,
            game.projectile.y,
          ),
          distance,
          // 双轨支持：记录碰撞发生在哪条轨道
          trackIndex,
        };
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// insertProjectile — 将弹丸插入到指定轨道的链中。
// 双轨支持：从碰撞结果中读取 trackIndex，使用 getTrackState 访问
// 正确轨道的 chain / splitState / chainHeadS。所有需要 trackIndex 的
// game 方法调用均转发该参数。
// ---------------------------------------------------------------------------
export function insertProjectile(game, { hitIndex, hitS, projectileS, trackIndex = 0 }) {
  const ts = getTrackState(game, trackIndex);

  const insertIndex = projectileS > hitS ? hitIndex : hitIndex + 1;
  const safeIndex = Math.max(0, Math.min(ts.chain.length, insertIndex));
  const insertedBall = game.createChainBall(game.projectile.paletteIndex);
  // targetS is where the new ball would sit in a perfectly packed chain.
  // insertionOffset then preserves some of the projectile's actual impact
  // position so the ball appears to slide into place instead of teleporting.
  // 双轨支持：使用 ts 的 chainHeadS 访问器而不是 game.chainHeadS
  const targetS = ts.getChainHeadS() - safeIndex * BALL_SPACING;
  const insertionOffset = Math.max(
    -BALL_SPACING * 1.25,
    Math.min(BALL_SPACING * 1.25, projectileS - targetS),
  );

  insertedBall.offset = insertionOffset;
  insertedBall.offsetMode = "insert";
  insertedBall.impact = 1;
  // Once the projectile becomes part of the chain, later delayed checks need
  // to preserve its scoring/combo ownership across seam closures.
  insertedBall.lastActionId = game.projectile.actionId ?? null;

  // 双轨支持：使用 ts 的 splitState 访问器
  const splitState = ts.getSplitState();
  if (splitState && safeIndex < splitState.index) {
    // Inserting before an existing seam shifts the seam one slot to the right.
    splitState.index += 1;
  }

  ts.chain.splice(safeIndex, 0, insertedBall);

  // 双轨支持：所有后续操作都传递 trackIndex
  game.applyInsertSpacingWave(safeIndex, trackIndex);

  game.addImpact(safeIndex - 1, 0.72, trackIndex);
  game.addImpact(safeIndex + 1, 0.72, trackIndex);
  game.queueMatchCheck(insertedBall.id, INSERT_MATCH_DELAY, game.projectile.actionId, "insert", trackIndex);
  game.syncChainPositions(trackIndex);
}
