import mongoose from 'mongoose';

const SpatialAuditLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    queryType: { type: String, required: true }, // '$near', '$geoWithin_center', '$geoWithin_box'
    userCount: { type: Number, required: true },
    sampleCount: { type: Number, default: 50 },
    avgLatencyMs: { type: Number, required: true },
    p95LatencyMs: { type: Number, required: true },
    minLatencyMs: { type: Number, required: true },
    maxLatencyMs: { type: Number, required: true },
    isUnder20ms: { type: Boolean, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SpatialAuditLog = mongoose.model('SpatialAuditLog', SpatialAuditLogSchema);
export default SpatialAuditLog;
