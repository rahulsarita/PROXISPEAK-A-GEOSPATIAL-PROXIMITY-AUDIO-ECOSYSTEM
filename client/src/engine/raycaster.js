/**
 * Raycasting and Line-of-sight collision checks for audio occlusion & wall collisions
 */

function ccw(p1, p2, p3) {
  return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
}

export function lineSegmentsIntersect(p1, p2, p3, p4) {
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

export function lineIntersectsRect(p1, p2, rect) {
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.width;
  const rh = rect.height;

  const top = [{ x: rx, y: ry }, { x: rx + rw, y: ry }];
  const bottom = [{ x: rx, y: ry + rh }, { x: rx + rw, y: ry + rh }];
  const left = [{ x: rx, y: ry }, { x: rx, y: ry + rh }];
  const right = [{ x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }];

  return (
    lineSegmentsIntersect(p1, p2, top[0], top[1]) ||
    lineSegmentsIntersect(p1, p2, bottom[0], bottom[1]) ||
    lineSegmentsIntersect(p1, p2, left[0], left[1]) ||
    lineSegmentsIntersect(p1, p2, right[0], right[1])
  );
}

/**
 * Checks circle collision with rectangular obstacles (for avatar movement physics)
 */
export function checkCircleRectCollision(cx, cy, radius, rect) {
  // Find closest point on rect to circle center
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));

  const distanceX = cx - closestX;
  const distanceY = cy - closestY;
  const distanceSquared = distanceX * distanceX + distanceY * distanceY;

  return distanceSquared < radius * radius;
}

/**
 * Calculates acoustic line-of-sight occlusion between two avatars
 */
export function checkAudioOcclusion(p1, p2, obstacles = []) {
  let hitCount = 0;
  let totalAbsorption = 0;
  const hitObstacles = [];

  for (const obs of obstacles) {
    if (!obs.soundAbsorption || obs.soundAbsorption <= 0) continue;

    if (lineIntersectsRect(p1, p2, obs)) {
      hitCount++;
      totalAbsorption += obs.soundAbsorption;
      hitObstacles.push(obs);
    }
  }

  const effectiveAbsorption = Math.min(0.95, totalAbsorption);
  const isOccluded = hitCount > 0;

  // Filter frequency: open air = 20000 Hz, muffled = ~400 Hz
  const filterCutoff = isOccluded
    ? Math.max(350, Math.round(20000 * Math.pow(1 - effectiveAbsorption, 2.5)))
    : 20000;

  return {
    isOccluded,
    hitCount,
    absorption: effectiveAbsorption,
    filterCutoff,
    hitObstacles,
  };
}
