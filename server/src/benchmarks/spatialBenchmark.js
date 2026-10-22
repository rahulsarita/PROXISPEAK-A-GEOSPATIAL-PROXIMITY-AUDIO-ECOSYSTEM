import { performance } from 'perf_hooks';
import connectDB from '../db.js';
import UserSession from '../models/UserSession.js';
import SpatialAuditLog from '../models/SpatialAuditLog.js';
import { spatialEngine } from '../services/spatialEngine.js';

export async function runSpatialAudit({ userCount = 100, iterations = 100, radius = 160 } = {}) {
  console.log(`\n======================================================`);
  console.log(` PROXISPEAK SPATIAL CLUSTER & GEOSPATIAL AUDIT (under 20ms) `);
  console.log(`======================================================`);
  console.log(`Simulating ${userCount} active users, running ${iterations} geospatial queries...\n`);

  const benchmarkRoomId = `audit-room-${Date.now()}`;

  // 1. Seed users into MongoDB with 2D indexed coordinates
  const seedUsers = [];
  for (let i = 0; i < userCount; i++) {
    const x = Math.floor(Math.random() * 2400);
    const y = Math.floor(Math.random() * 1600);
    seedUsers.push({
      userId: `audit-user-${i}`,
      socketId: `audit-sock-${i}`,
      name: `Colleague ${i}`,
      location: [x, y],
      x,
      y,
      roomId: benchmarkRoomId,
      earshotRadius: radius,
      isBot: true,
      lastActive: new Date(),
    });
  }

  // Ensure 2d index is built with proper planar boundaries
  try {
    await UserSession.collection.dropIndex('location_2d');
  } catch (e) {
    // ignore if doesn't exist
  }
  await UserSession.syncIndexes();
  await UserSession.insertMany(seedUsers);
  console.log(`[Seed] Seeded ${userCount} users with 2D coordinates in room "${benchmarkRoomId}"`);

  // 2. Run $near benchmark queries
  const nearLatencies = [];
  let nearMatchCounts = [];

  for (let i = 0; i < iterations; i++) {
    const qx = Math.floor(Math.random() * 2400);
    const qy = Math.floor(Math.random() * 1600);

    const t0 = performance.now();
    const result = await spatialEngine.findPeersNear(qx, qy, radius, null, benchmarkRoomId);
    const t1 = performance.now();

    nearLatencies.push(t1 - t0);
    nearMatchCounts.push(result.peers.length);
  }

  // 3. Run $geoWithin box queries
  const boxLatencies = [];
  for (let i = 0; i < iterations; i++) {
    const qx = Math.floor(Math.random() * 1800);
    const qy = Math.floor(Math.random() * 1000);
    const box = { x: qx, y: qy, width: 400, height: 400 };

    const t0 = performance.now();
    await spatialEngine.findPeersInBox(box, benchmarkRoomId);
    const t1 = performance.now();

    boxLatencies.push(t1 - t0);
  }

  // 4. Test organic spatial clustering
  const allUsersInRoom = await UserSession.find({ roomId: benchmarkRoomId }).lean();
  const clusterStart = performance.now();
  const clusters = spatialEngine.calculateClusters(allUsersInRoom, 140);
  const clusterTimeMs = performance.now() - clusterStart;

  // Cleanup benchmark data
  await UserSession.deleteMany({ roomId: benchmarkRoomId });

  // Calculate statistics
  const calcStats = (arr) => {
    arr.sort((a, b) => a - b);
    const min = arr[0];
    const max = arr[arr.length - 1];
    const avg = arr.reduce((acc, v) => acc + v, 0) / arr.length;
    const p50 = arr[Math.floor(arr.length * 0.5)];
    const p95 = arr[Math.floor(arr.length * 0.95)];
    const p99 = arr[Math.floor(arr.length * 0.99)];
    return { min, max, avg, p50, p95, p99 };
  };

  const nearStats = calcStats(nearLatencies);
  const boxStats = calcStats(boxLatencies);
  const isUnder20ms = nearStats.p95 < 20.0;

  console.log(`\n--- [RESULTS: MongoDB $near Geospatial Query] ---`);
  console.log(`Average Latency : ${nearStats.avg.toFixed(3)} ms`);
  console.log(`p50 Latency     : ${nearStats.p50.toFixed(3)} ms`);
  console.log(`p95 Latency     : ${nearStats.p95.toFixed(3)} ms`);
  console.log(`p99 Latency     : ${nearStats.p99.toFixed(3)} ms`);
  console.log(`Min / Max       : ${nearStats.min.toFixed(3)} ms / ${nearStats.max.toFixed(3)} ms`);
  console.log(`Avg Peers Found : ${(nearMatchCounts.reduce((a, b) => a + b, 0) / iterations).toFixed(1)} peers`);

  console.log(`\n--- [RESULTS: MongoDB $geoWithin Bounding Box] ---`);
  console.log(`Average Latency : ${boxStats.avg.toFixed(3)} ms`);
  console.log(`p95 Latency     : ${boxStats.p95.toFixed(3)} ms`);

  console.log(`\n--- [RESULTS: Organic Conversation Clustering] ---`);
  console.log(`Clusters Formed : ${clusters.length} pods`);
  console.log(`Calculation Time: ${clusterTimeMs.toFixed(3)} ms`);

  console.log(`\n------------------------------------------------------`);
  if (isUnder20ms) {
    console.log(`>>> STATUS: [PASS] p95 LATENCY IS UNDER 20ms REQUIREMENT! (${nearStats.p95.toFixed(2)}ms < 20.0ms)`);
  } else {
    console.log(`>>> STATUS: [WARNING] p95 Latency exceeded 20ms (${nearStats.p95.toFixed(2)}ms)`);
  }
  console.log(`------------------------------------------------------\n`);

  const report = {
    timestamp: new Date(),
    userCount,
    iterations,
    nearStats,
    boxStats,
    clusterTimeMs,
    clusterCount: clusters.length,
    isUnder20ms,
    status: isUnder20ms ? 'PASSED_UNDER_20MS' : 'LATENCY_EXCEEDED',
  };

  try {
    await SpatialAuditLog.create({
      queryType: '$near',
      userCount,
      sampleCount: iterations,
      avgLatencyMs: nearStats.avg,
      p95LatencyMs: nearStats.p95,
      minLatencyMs: nearStats.min,
      maxLatencyMs: nearStats.max,
      isUnder20ms,
      details: report,
    });
  } catch (e) {
    console.warn('Could not save audit log to DB:', e.message);
  }

  return report;
}

// If executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('spatialBenchmark.js')) {
  (async () => {
    try {
      await connectDB();
      await runSpatialAudit({ userCount: 100, iterations: 100 });
      process.exit(0);
    } catch (err) {
      console.error('Audit run failed:', err);
      process.exit(1);
    }
  })();
}
