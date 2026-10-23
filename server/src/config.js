import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI?.trim();
const isProduction = process.env.NODE_ENV === 'production';
const isLocalMongoUri = mongoUri && /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]+@)?(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(mongoUri);

if (isProduction && !mongoUri) {
  throw new Error('MONGO_URI is required in production. Set it in your Render service environment.');
}

if (isProduction && isLocalMongoUri) {
  throw new Error('MONGO_URI points to localhost in production. Use a reachable MongoDB connection string, such as MongoDB Atlas.');
}

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: mongoUri || 'mongodb://127.0.0.1:27017/proxispeak',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  spatialQueryThrottleMs: 150, // Persist location and recalculate proximity at most every 150 ms.
};

export default config;
