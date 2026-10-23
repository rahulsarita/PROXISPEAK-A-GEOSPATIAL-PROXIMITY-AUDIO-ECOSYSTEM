import UserSession from '../models/UserSession.js';

// Line intersection algorithm for sound occlusion through obstacles
function lineIntersectsSegment(p1, p2, p3, p4) {
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function lineIntersectsRect(p1, p2, rect) {
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.width;
  const rh = rect.height;

  // 4 bounding edges of the rectangle
  const top = [{ x: rx, y: ry }, { x: rx + rw, y: ry }];
  const bottom = [{ x: rx, y: ry + rh }, { x: rx + rw, y: ry + rh }];
  const left = [{ x: rx, y: ry }, { x: rx, y: ry + rh }];
  const right = [{ x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }];

  return (
    lineIntersectsSegment(p1, p2, top[0], top[1]) ||
    lineIntersectsSegment(p1, p2, bottom[0], bottom[1]) ||
    lineIntersectsSegment(p1, p2, left[0], left[1]) ||
    lineIntersectsSegment(p1, p2, right[0], right[1])
  );
}

export class SpatialEngine {
  constructor() {
    // In-memory hot cache for instant frame-to-frame interpolation
    this.activeUserLocations = new Map();
  }

  /**
   * Update a user's location in memory and in MongoDB.
   */
  async updateUserPosition(
    userId,
    socketId,
    {
      x,
      y,
      facingAngle,
      name,
      color,
      isSpeaking,
      isMuted,
      roomId = 'default-office',
      earshotRadius = 160,
      isBot = false,
      persist = true,
    }
  ) {
    this.activeUserLocations.set(userId, {
      userId,
      socketId,
      name,
      color,
      x,
      y,
      facingAngle: facingAngle || 0,
      isSpeaking: !!isSpeaking,
      isMuted: !!isMuted,
      roomId,
      earshotRadius,
      isBot,
      updatedAt: Date.now(),
    });

    if (!persist) {
      return this.activeUserLocations.get(userId);
    }

    // Upsert into MongoDB with 2D coordinates [x, y]
    return UserSession.findOneAndUpdate(
      { userId },
      {
        userId,
        socketId,
        name: name || 'Infotact Teammate',
        color: color || '#3B82F6',
        location: [x, y],
        x,
        y,
        facingAngle: facingAngle || 0,
        roomId,
        isMuted: !!isMuted,
        isSpeaking: !!isSpeaking,
        earshotRadius,
        isBot,
        lastActive: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  /**
   * Query peers within radius using MongoDB $near geospatial query.
   */
  async findPeersNear(x, y, radius, excludeUserId, roomId = 'default-office') {
    const startTime = performance.now();
    const query = {
      roomId,
      location: {
        $near: [x, y],
        $maxDistance: radius,
      },
    };

    if (excludeUserId) {
      query.userId = { $ne: excludeUserId };
    }

    const peers = await UserSession.find(query).lean().limit(100);
    const durationMs = performance.now() - startTime;

    return {
      peers: peers.map((p) => ({
        userId: p.userId,
        socketId: p.socketId,
        name: p.name,
        color: p.color,
        x: p.location[0],
        y: p.location[1],
        isSpeaking: p.isSpeaking,
        isMuted: p.isMuted,
        earshotRadius: p.earshotRadius,
        distance: Math.hypot(p.location[0] - x, p.location[1] - y),
      })),
      queryTimeMs: durationMs,
    };
  }

  /**
   * Query peers in bounding box using MongoDB $geoWithin $box.
   */
  async findPeersInBox(boxBounds, roomId = 'default-office') {
    const startTime = performance.now();
    // box: [[bottomLeftX, bottomLeftY], [topRightX, topRightY]]
    const x1 = boxBounds.x;
    const y1 = boxBounds.y;
    const x2 = boxBounds.x + boxBounds.width;
    const y2 = boxBounds.y + boxBounds.height;

    const peers = await UserSession.find({
      roomId,
      location: {
        $geoWithin: {
          $box: [
            [Math.min(x1, x2), Math.min(y1, y2)],
            [Math.max(x1, x2), Math.max(y1, y2)],
          ],
        },
      },
    }).lean();

    const durationMs = performance.now() - startTime;
    return { peers, queryTimeMs: durationMs };
  }

  /**
   * Calculate clusters/pods of conversation using proximity grouping.
   * Groups users who are within clusterThreshold (e.g. 140px) of each other.
   */
  calculateClusters(users, clusterThreshold = 140) {
    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (visited.has(u.userId)) continue;

      const cluster = [u];
      visited.add(u.userId);

      const queue = [u];
      while (queue.length > 0) {
        const curr = queue.shift();
        const currX = curr.x !== undefined ? curr.x : curr.location[0];
        const currY = curr.y !== undefined ? curr.y : curr.location[1];

        for (let j = 0; j < users.length; j++) {
          const candidate = users[j];
          if (visited.has(candidate.userId)) continue;

          const candX = candidate.x !== undefined ? candidate.x : candidate.location[0];
          const candY = candidate.y !== undefined ? candidate.y : candidate.location[1];
          const dist = Math.hypot(currX - candX, currY - candY);

          if (dist <= clusterThreshold) {
            visited.add(candidate.userId);
            cluster.push(candidate);
            queue.push(candidate);
          }
        }
      }

      if (cluster.length >= 2) {
        // Compute center of mass
        const avgX = cluster.reduce((sum, item) => sum + (item.x ?? item.location[0]), 0) / cluster.length;
        const avgY = cluster.reduce((sum, item) => sum + (item.y ?? item.location[1]), 0) / cluster.length;

        clusters.push({
          id: `cluster-${clusters.length + 1}`,
          centerX: Math.round(avgX),
          centerY: Math.round(avgY),
          memberCount: cluster.length,
          members: cluster.map((m) => ({ userId: m.userId, name: m.name, color: m.color })),
        });
      }
    }

    return clusters;
  }

  /**
   * Check sound occlusion between two points through a set of obstacles.
   * Returns:
   * - occluded: boolean
   * - absorption: number (0.0 to 1.0)
   * - filterCutoff: frequency in Hz for lowpass filter
   */
  calculateOcclusion(p1, p2, obstacles = []) {
    let totalAbsorption = 0;
    let hitCount = 0;

    for (const obs of obstacles) {
      if (!obs.soundAbsorption || obs.soundAbsorption <= 0) continue;

      if (lineIntersectsRect(p1, p2, obs)) {
        hitCount++;
        totalAbsorption += obs.soundAbsorption;
      }
    }

    // Clamp absorption to max 0.95 (still allows muffled bass sound to pass through)
    const effectiveAbsorption = Math.min(0.95, totalAbsorption);
    const isOccluded = hitCount > 0;

    // Filter frequency: open air = 20,000 Hz, fully occluded wall = 400 Hz
    // Acoustic lowpass curve: freq = 20000 * (1 - absorption)^2 + 400
    const filterCutoff = isOccluded
      ? Math.max(350, Math.round(20000 * Math.pow(1 - effectiveAbsorption, 2.5)))
      : 20000;

    return {
      isOccluded,
      hitCount,
      absorption: effectiveAbsorption,
      filterCutoff,
    };
  }

  /**
   * Remove user session on disconnect.
   */
  async removeUser(userId) {
    this.activeUserLocations.delete(userId);
    return await UserSession.deleteOne({ userId });
  }

  /**
   * Remove stale sessions (e.g. older than 10 minutes)
   */
  async cleanupStaleSessions(maxAgeMs = 10 * 60 * 1000) {
    const threshold = new Date(Date.now() - maxAgeMs);
    return await UserSession.deleteMany({ lastActive: { $lt: threshold }, isBot: { $ne: true } });
  }
}

export const spatialEngine = new SpatialEngine();
export default spatialEngine;
