import express from 'express';
import SpatialAuditLog from '../models/SpatialAuditLog.js';
import { runSpatialAudit } from '../benchmarks/spatialBenchmark.js';

const router = express.Router();
let auditInProgress = false;

// GET latest audit logs
router.get('/history', async (req, res) => {
  try {
    const logs = await SpatialAuditLog.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST run on-demand audit
router.post('/run', async (req, res) => {
  if (auditInProgress) {
    return res.status(409).json({ success: false, error: 'A spatial audit is already running.' });
  }

  const { userCount = 50, iterations = 50, radius = 160 } = req.body || {};
  const validUserCount = Number.isInteger(userCount) && userCount >= 1 && userCount <= 500;
  const validIterations = Number.isInteger(iterations) && iterations >= 1 && iterations <= 100;
  const validRadius = typeof radius === 'number' && Number.isFinite(radius) && radius > 0 && radius <= 1000;

  if (!validUserCount || !validIterations || !validRadius) {
    return res.status(400).json({
      success: false,
      error: 'userCount (1–500), iterations (1–100), and radius (0–1000] are required within those limits.',
    });
  }

  auditInProgress = true;
  try {
    const report = await runSpatialAudit({ userCount, iterations, radius });
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    auditInProgress = false;
  }
});

export default router;
