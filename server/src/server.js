import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import config from './config.js';
import connectDB from './db.js';
import mapRoutes from './routes/mapRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { redisPubSub } from './services/redisPubSub.js';
import { SignalingManager } from './services/signalingManager.js';
import UserSession from './models/UserSession.js';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Middlewares
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // Connect to MongoDB
  await connectDB();
  // Add indexes declared by the schema without dropping existing production indexes.
  await UserSession.createIndexes();

  // Initialize Redis Pub/Sub (with in-memory fallback)
  await redisPubSub.initialize();

  // Socket.io setup
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // REST Routes
  app.use('/api/maps', mapRoutes);
  app.use('/api/audit', auditRoutes);

  // Healthcheck & status
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'ProxiSpeak Spatial Signaling Server',
      timestamp: new Date().toISOString(),
      redisPubSubActive: redisPubSub.isConnected,
    });
  });

  // Initialize Signaling Manager
  const signalingManager = new SignalingManager(io);
  await signalingManager.initialize();

  // Start HTTP & Socket server
  server.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(` PROXISPEAK SERVER RUNNING ON PORT ${config.port}`);
    console.log(` Healthcheck: http://localhost:${config.port}/api/health`);
    console.log(` WebSocket Signaling: ws://localhost:${config.port}`);
    console.log(`======================================================\n`);
  });

  return { app, server, io };
}

startServer().catch((err) => {
  console.error('[Fatal] Server failed to start:', err);
  process.exit(1);
});
