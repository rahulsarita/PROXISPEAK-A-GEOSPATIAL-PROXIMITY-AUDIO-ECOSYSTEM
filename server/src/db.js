import mongoose from 'mongoose';
import config from './config.js';

export async function connectDB() {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully.`);

    // Ensure models are registered and indexes are created
    return mongoose.connection;
  } catch (err) {
    console.error(`[MongoDB] Connection error:`, err.message);
    throw err;
  }
}

export default connectDB;
