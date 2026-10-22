import express from 'express';
import OfficeMap from '../models/OfficeMap.js';
import { getDefaultOfficeMap } from '../services/signalingManager.js';

const router = express.Router();

// GET map for room
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    let map = await OfficeMap.findOne({ roomId });
    if (!map) {
      map = await OfficeMap.create(getDefaultOfficeMap(roomId));
    }
    res.json({ success: true, map });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE map (save furniture/obstacles)
router.put('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { obstacles, zones, name, dimensions } = req.body;

    const map = await OfficeMap.findOneAndUpdate(
      { roomId },
      {
        roomId,
        name: name || 'Infotact Headquarters',
        obstacles: obstacles || [],
        zones: zones || [],
        dimensions: dimensions || { width: 2400, height: 1600 },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, map });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// RESET map to factory default
router.post('/:roomId/reset', async (req, res) => {
  try {
    const { roomId } = req.params;
    await OfficeMap.deleteOne({ roomId });
    const freshMap = await OfficeMap.create(getDefaultOfficeMap(roomId));
    res.json({ success: true, map: freshMap });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
