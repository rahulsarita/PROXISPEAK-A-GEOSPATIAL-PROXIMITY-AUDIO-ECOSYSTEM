import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/proxispeak',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  defaultEarshotRadius: 160, // pixels
  maxEarshotRadius: 280, // pixels
  world: {
    width: 2400,
    height: 1800,
  },
  spatialQueryThrottleMs: 50, // server proximity re-evaluation window
};

export default config;
