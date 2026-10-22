import mongoose from 'mongoose';

const ObstacleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: 'Obstacle' },
  type: {
    type: String,
    enum: ['wall', 'glass-wall', 'desk', 'couch', 'plant', 'door', 'conference-table', 'water-cooler'],
    default: 'wall',
  },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  // soundAbsorption: 0.0 (no blockage) to 1.0 (complete sound block)
  soundAbsorption: { type: Number, default: 0.8 },
  blocksMovement: { type: Boolean, default: true },
  color: { type: String, default: '#475569' },
});

const ZoneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['room', 'lounge', 'quiet-zone', 'open-office'], default: 'room' },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  color: { type: String, default: 'rgba(59, 130, 246, 0.08)' },
  isQuietZone: { type: Boolean, default: false },
});

const OfficeMapSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, default: 'Infotact Headquarters' },
    dimensions: {
      width: { type: Number, default: 2400 },
      height: { type: Number, default: 1800 },
    },
    obstacles: [ObstacleSchema],
    zones: [ZoneSchema],
    gridSize: { type: Number, default: 40 },
  },
  { timestamps: true }
);

export const OfficeMap = mongoose.model('OfficeMap', OfficeMapSchema);
export default OfficeMap;
