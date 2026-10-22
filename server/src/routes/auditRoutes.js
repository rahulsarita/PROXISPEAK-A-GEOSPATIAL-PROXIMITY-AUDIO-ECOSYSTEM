import express from 'express';
import SpatialAuditLog from '../models/SpatialAuditLog.js';
import { runSpatialAudit } from '../benchmarks/spatialBenchmark.js';

const router = express.Router();

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
  try {
    const { userCount = 50, iterations = 50, radius = 160 } = req.body;
    const report = await runSpatialAudit({ userCount, iterations, radius });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
