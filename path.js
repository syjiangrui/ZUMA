import { GAME_WIDTH, TAU } from './config.js';

// Build the track as an Archimedean spiral around the central shooter altar.
// Gameplay still only moves balls by path distance; the spiral is just a more
// faithful geometric source for the sampled path points.
//
// Returns { pathPoints, totalPathLength, cachedTrackPath }.
export function createPath(shooterX, shooterY) {
  // Spiral tuning notes:
  // - centerX / centerY move the whole spiral on screen
  // - outerRadius controls the outermost ring footprint; if the track clips
  //   the screen edges, reduce this first
  // - innerRadius controls how close the spiral comes to the shooter altar
  // - startAngle rotates the whole spiral and therefore changes where the
  //   incoming outer ring first becomes visible
  // - turnCount controls how many coils the path makes before reaching the
  //   goal; larger values create a denser Zuma-like spiral
  // These constants are intentionally kept together so future path tuning can
  // happen here without touching collision, insertion or render code.
  const centerX = shooterX + 11;
  const centerY = shooterY + 8;
  const outerRadius = 206;
  const innerRadius = 84;
  const startAngle = 0.96;
  const turnCount = 2.6;
  const endAngle = startAngle + TAU * turnCount;
  const spiralSampleCount = 560;
  const spiralPoints = [];

  for (let step = 0; step <= spiralSampleCount; step += 1) {
    const t = step / spiralSampleCount;
    const theta = startAngle + (endAngle - startAngle) * t;
    const radius = outerRadius + (innerRadius - outerRadius) * t;

    spiralPoints.push({
      x: centerX + Math.cos(theta) * radius,
      y: centerY + Math.sin(theta) * radius,
    });
  }

  // Classical Zuma-style paths do not simply "start on the board"; they
  // enter from off-screen and then wrap around the central altar. We prepend
  // a short cubic approach segment that joins the outer spiral tangentially
  // so the first visible track feels like an incoming lane rather than an
  // abruptly cut curve.
  const joinPoint = spiralPoints[0];
  const nextPoint = spiralPoints[1];
  const tangentLength = Math.hypot(
    nextPoint.x - joinPoint.x,
    nextPoint.y - joinPoint.y,
  ) || 1;
  const tangentX = (nextPoint.x - joinPoint.x) / tangentLength;
  const tangentY = (nextPoint.y - joinPoint.y) / tangentLength;

  // Entry segment tuning notes:
  // - entryStart must stay outside the screen so balls visibly enter from
  //   off-board instead of spawning on the first visible arc
  // - entryControl1 controls how long the approach stays near the outer edge
  // - entryControl2 controls how softly the approach bends into the spiral;
  //   it is derived from the spiral tangent so the join does not kink
  // If the first visible segment feels too abrupt, increase the control
  // distances before changing the spiral itself.
  const entryStart = {
    x: GAME_WIDTH + 96,
    y: joinPoint.y + 22,
  };
  const entryControl1 = {
    x: GAME_WIDTH + 42,
    y: joinPoint.y + 18,
  };
  const entryControl2 = {
    x: joinPoint.x - tangentX * 120,
    y: joinPoint.y - tangentY * 120,
  };

  const sampled = [];
  // Sample the entry Bézier separately, then append the spiral samples. The
  // rest of the game only sees one continuous polyline in pathPoints.
  const entrySampleCount = 56;
  for (let step = 0; step < entrySampleCount; step += 1) {
    const t = step / entrySampleCount;
    const inv = 1 - t;
    sampled.push({
      x:
        inv * inv * inv * entryStart.x +
        3 * inv * inv * t * entryControl1.x +
        3 * inv * t * t * entryControl2.x +
        t * t * t * joinPoint.x,
      y:
        inv * inv * inv * entryStart.y +
        3 * inv * inv * t * entryControl1.y +
        3 * inv * t * t * entryControl2.y +
        t * t * t * joinPoint.y,
    });
  }

  sampled.push(...spiralPoints);

  let total = 0;
  // 预采样路径并记录累计弧长；后续所有轨道运动都通过 len 映射到屏幕坐标。
  const pathPoints = sampled.map((point, index) => {
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

  const totalPathLength = total;

  // Pre-build a Path2D so drawTrack() can stroke it without rebuilding
  // 616 lineTo calls three times per frame.
  const cachedTrackPath = new Path2D();
  cachedTrackPath.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i += 1) {
    cachedTrackPath.lineTo(pathPoints[i].x, pathPoints[i].y);
  }

  return { pathPoints, totalPathLength, cachedTrackPath };
}

export function getPointAtDistance(pathPoints, totalPathLength, s) {
  if (s <= 0) {
    return pathPoints[0];
  }

  if (s >= totalPathLength) {
    return pathPoints[pathPoints.length - 1];
  }

  let low = 0;
  let high = pathPoints.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (pathPoints[mid].len < s) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const next = pathPoints[low];
  const prev = pathPoints[Math.max(0, low - 1)];
  const span = next.len - prev.len || 1;
  const t = (s - prev.len) / span;

  // Linear interpolation between neighboring sampled points is enough because
  // the original curve was already oversampled in createPath().
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
  };
}

export function getClosestPathDistance(pathPoints, x, y) {
  let closest = pathPoints[0];
  let bestDistance = Infinity;

  // 采样点数量不大，这里直接线性扫描即可，后续只有路径复杂很多时才需要优化。
  for (const point of pathPoints) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = point;
    }
  }

  return closest.len;
}

// Catmull-Rom gives us a smooth track through the authored control points
// without manually defining Bézier tangents.
export function catmullRom(p0, p1, p2, p3, t) {
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
