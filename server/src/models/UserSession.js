import mongoose from 'mongoose';

const UserSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    socketId: { type: String, required: true, index: true },
    name: { type: String, required: true, default: 'Infotact Teammate' },
    color: { type: String, default: '#3B82F6' },
    avatar: { type: String, default: 'user-default' },
    // 2D planar coordinate [x, y] for fast Euclidean spatial indexing
    location: {
      type: [Number], // [x, y]
      required: true,
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    facingAngle: { type: Number, default: 0 }, // radians or degrees for directional audio/facing
    roomId: { type: String, default: 'default-office', index: true },
    isMuted: { type: Boolean, default: false },
    isSpeaking: { type: Boolean, default: false },
    earshotRadius: { type: Number, default: 160 },
    isBot: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  }
);

// Define 2D Cartesian spatial index with boundaries supporting the 2D canvas world
UserSessionSchema.index({ location: '2d' }, { min: -10000, max: 10000 });

// Helpful virtual getter
UserSessionSchema.virtual('coords').get(function () {
  return { x: this.location[0], y: this.location[1] };
});

export const UserSession = mongoose.model('UserSession', UserSessionSchema);
export default UserSession;
