import {
  GAME_WIDTH, GAME_HEIGHT, BALL_RADIUS, BALL_DIAMETER, BALL_SPACING,
  PROJECTILE_SPEED, PROJECTILE_MARGIN, MUZZLE_OFFSET, INSERT_MATCH_DELAY,
} from './config.js';

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
}

export function findChainCollision(game) {
  if (!game.projectile || game.chain.length === 0) {
    return null;
  }

  let best = null;

  // The first prototype uses a simple nearest-ball hit test against current
  // chain positions. That is good enough to validate insertion flow before
  // moving to a more exact along-track insertion model.
  for (let index = 0; index < game.chain.length; index += 1) {
    const ball = game.chain[index];
    if (ball.s < 0 || ball.s > game.totalPathLength) {
      continue;
    }

    const point = game.getPointAtDistance(ball.s);
    const distance = Math.hypot(
      game.projectile.x - point.x,
      game.projectile.y - point.y,
    );

    if (distance <= BALL_DIAMETER - 4 && (!best || distance < best.distance)) {
      best = {
        hitIndex: index,
        hitS: ball.s,
        // projectileS is the nearest location on the sampled path to the hit
        // point. We later compare it with hitS to decide whether the new ball
        // lands on the start-side or goal-side of the struck ball.
        projectileS: game.getClosestPathDistance(
          game.projectile.x,
          game.projectile.y,
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
export function insertProjectile(game, { hitIndex, hitS, projectileS }) {
  const insertIndex = projectileS > hitS ? hitIndex : hitIndex + 1;
  const safeIndex = Math.max(0, Math.min(game.chain.length, insertIndex));
  const insertedBall = game.createChainBall(game.projectile.paletteIndex);
  // targetS is where the new ball would sit in a perfectly packed chain.
  // insertionOffset then preserves some of the projectile's actual impact
  // position so the ball appears to slide into place instead of teleporting.
  const targetS = game.chainHeadS - safeIndex * BALL_SPACING;
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

  if (game.splitState && safeIndex < game.splitState.index) {
    // Inserting before an existing seam shifts the seam one slot to the right.
    game.splitState.index += 1;
  }

  game.chain.splice(safeIndex, 0, insertedBall);

  game.applyInsertSpacingWave(safeIndex);

  game.addImpact(safeIndex - 1, 0.72);
  game.addImpact(safeIndex + 1, 0.72);
  game.queueMatchCheck(insertedBall.id, INSERT_MATCH_DELAY, game.projectile.actionId, "insert");
  game.syncChainPositions();
}
