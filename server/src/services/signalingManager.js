import { spatialEngine } from './spatialEngine.js';
import { redisPubSub } from './redisPubSub.js';
import OfficeMap from '../models/OfficeMap.js';

export class SignalingManager {
  constructor(io) {
    this.io = io;
    // Map of userId -> Set of userIds currently in earshot
    this.userEarshotMap = new Map();
    // Map of socketId -> userId
    this.socketToUser = new Map();
    // Map of userId -> socketId
    this.userToSocket = new Map();
    // Cache of active office maps by roomId
    this.mapCache = new Map();
  }

  async initialize() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Listen for cross-node Redis pub/sub events if active
    redisPubSub.subscribe('proxispeak:signaling', (msg) => {
      if (msg.targetSocketId && this.io.sockets.sockets.get(msg.targetSocketId)) {
        this.io.to(msg.targetSocketId).emit(msg.event, msg.payload);
      }
    });

    // Clean up stale sessions on startup and periodically
    await spatialEngine.cleanupStaleSessions();
    setInterval(() => spatialEngine.cleanupStaleSessions(), 60000);
  }

  async getMapForRoom(roomId) {
    if (this.mapCache.has(roomId)) {
      return this.mapCache.get(roomId);
    }
    let map = await OfficeMap.findOne({ roomId }).lean();
    if (!map) {
      // Create default office layout if not existing
      map = await OfficeMap.create(getDefaultOfficeMap(roomId));
    }
    this.mapCache.set(roomId, map);
    return map;
  }

  handleConnection(socket) {
    console.log(`[Socket] New connection: ${socket.id}`);

    // 1. Join Room
    socket.on('join-room', async (userData, callback) => {
      try {
        const {
          userId,
          name = 'Infotact Teammate',
          color = '#3B82F6',
          avatar = 'default',
          x = 400 + Math.random() * 200,
          y = 300 + Math.random() * 200,
          roomId = 'default-office',
          earshotRadius = 160,
          isBot = false,
        } = userData;

        this.socketToUser.set(socket.id, userId);
        this.userToSocket.set(userId, socket.id);
        socket.join(roomId);

        // Save position in MongoDB & Spatial Engine
        await spatialEngine.updateUserPosition(userId, socket.id, {
          x,
          y,
          name,
          color,
          avatar,
          roomId,
          earshotRadius,
          isBot,
        });

        // Initialize empty earshot set
        this.userEarshotMap.set(userId, new Set());

        // Get map layout
        const officeMap = await this.getMapForRoom(roomId);

        // Fetch all current room participants
        const allUsers = Array.from(spatialEngine.activeUserLocations.values()).filter(
          (u) => u.roomId === roomId
        );

        // Acknowledge joiner with full initial state
        if (typeof callback === 'function') {
          callback({
            status: 'ok',
            self: { userId, socketId: socket.id, x, y, name, color, roomId, earshotRadius },
            users: allUsers,
            officeMap,
          });
        }

        // Broadcast to others in the room
        socket.to(roomId).emit('user-joined', {
          userId,
          socketId: socket.id,
          name,
          color,
          avatar,
          x,
          y,
          roomId,
          earshotRadius,
          isBot,
        });

        // Evaluate initial earshot peers for this user
        await this.evaluateProximity(userId, roomId, officeMap);
      } catch (err) {
        console.error('[Signaling] Join error:', err);
        if (typeof callback === 'function') callback({ status: 'error', message: err.message });
      }
    });

    // 2. Movement broadcast & proximity calculation
    socket.on('move', async (data) => {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) return;

      const { x, y, facingAngle, roomId = 'default-office' } = data;
      const cached = spatialEngine.activeUserLocations.get(userId);
      const earshotRadius = data.earshotRadius || (cached ? cached.earshotRadius : 160);

      // Update in spatialEngine
      await spatialEngine.updateUserPosition(userId, socket.id, {
        x,
        y,
        facingAngle,
        name: cached ? cached.name : 'User',
        color: cached ? cached.color : '#3B82F6',
        isSpeaking: cached ? cached.isSpeaking : false,
        isMuted: cached ? cached.isMuted : false,
        roomId,
        earshotRadius,
        isBot: cached ? cached.isBot : false,
      });

      // Broadcast coordinate update to room at high frequency for smooth Canvas animation
      socket.to(roomId).emit('user-moved', {
        userId,
        x,
        y,
        facingAngle,
      });

      // Recalculate proximity earshot graph
      const officeMap = await this.getMapForRoom(roomId);
      await this.evaluateProximity(userId, roomId, officeMap);
    });

    // 3. Selective WebRTC Signaling Handshake
    // Offer (Only forwarded if peers are in earshot)
    socket.on('webrtc-offer', ({ targetUserId, sdp }) => {
      const senderUserId = this.socketToUser.get(socket.id);
      const targetSocketId = this.userToSocket.get(targetUserId);

      if (!targetSocketId) return;

      this.io.to(targetSocketId).emit('webrtc-offer', {
        callerUserId: senderUserId,
        sdp,
      });
    });

    // Answer
    socket.on('webrtc-answer', ({ targetUserId, sdp }) => {
      const senderUserId = this.socketToUser.get(socket.id);
      const targetSocketId = this.userToSocket.get(targetUserId);

      if (!targetSocketId) return;

      this.io.to(targetSocketId).emit('webrtc-answer', {
        responderUserId: senderUserId,
        sdp,
      });
    });

    // ICE Candidate
    socket.on('webrtc-ice-candidate', ({ targetUserId, candidate }) => {
      const senderUserId = this.socketToUser.get(socket.id);
      const targetSocketId = this.userToSocket.get(targetUserId);

      if (!targetSocketId) return;

      this.io.to(targetSocketId).emit('webrtc-ice-candidate', {
        fromUserId: senderUserId,
        candidate,
      });
    });

    // 4. Voice indicators
    socket.on('voice-status', ({ isSpeaking, isMuted, roomId = 'default-office' }) => {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) return;

      const cached = spatialEngine.activeUserLocations.get(userId);
      if (cached) {
        cached.isSpeaking = !!isSpeaking;
        cached.isMuted = !!isMuted;
      }

      socket.to(roomId).emit('user-voice-status', {
        userId,
        isSpeaking: !!isSpeaking,
        isMuted: !!isMuted,
      });
    });

    // 5. Spawn AI Coworker Bots for 50+ Concurrent User Mesh Demonstration
    socket.on('spawn-bots', async ({ count = 5, roomId = 'default-office' }, callback) => {
      try {
        const spawned = [];
        const botNames = [
          'Aarav Patel', 'Priya Sharma', 'Vikram Rao', 'Ananya Gupta',
          'David Miller', 'Elena Rostova', 'Kenji Sato', 'Fatima Al-Sayed',
          'Marcus Johnson', 'Chloe Dupont', 'Rohan Mehta', 'Zoe Chen',
          'Liam Smith', 'Maya Lin', 'Carlos Santos', 'Sara Connor',
          'Rahul Verma', 'Natasha Roman', 'Amir Khan', 'Devin Vance'
        ];
        const colors = [
          '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
          '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6'
        ];

        const officeMap = await this.getMapForRoom(roomId);
        const spawnCount = Math.min(count, 40);

        for (let i = 0; i < spawnCount; i++) {
          const botId = `bot-${Date.now().toString(36)}-${i}`;
          const name = botNames[i % botNames.length] + ` [Bot ${i + 1}]`;
          const color = colors[i % colors.length];
          const x = 300 + Math.floor(Math.random() * (officeMap.dimensions.width - 600));
          const y = 250 + Math.floor(Math.random() * (officeMap.dimensions.height - 500));

          await spatialEngine.updateUserPosition(botId, `socket-${botId}`, {
            x,
            y,
            name,
            color,
            roomId,
            isBot: true,
            earshotRadius: 160,
          });

          const botUser = {
            userId: botId,
            socketId: `socket-${botId}`,
            name,
            color,
            x,
            y,
            roomId,
            isBot: true,
            earshotRadius: 160,
          };
          spawned.push(botUser);

          this.io.to(roomId).emit('user-joined', botUser);
        }

        if (typeof callback === 'function') {
          callback({ status: 'ok', count: spawned.length, bots: spawned });
        }
      } catch (err) {
        console.error('Spawn bots error:', err);
        if (typeof callback === 'function') callback({ status: 'error', message: err.message });
      }
    });

    // Clear bots
    socket.on('clear-bots', async ({ roomId = 'default-office' }, callback) => {
      try {
        const bots = Array.from(spatialEngine.activeUserLocations.values()).filter(
          (u) => u.roomId === roomId && u.isBot
        );
        for (const bot of bots) {
          await spatialEngine.removeUser(bot.userId);
          this.io.to(roomId).emit('user-left', { userId: bot.userId });
        }
        if (typeof callback === 'function') callback({ status: 'ok', cleared: bots.length });
      } catch (err) {
        if (typeof callback === 'function') callback({ status: 'error', message: err.message });
      }
    });

    // 6. Disconnect
    socket.on('disconnect', async () => {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) return;

      console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);
      const user = spatialEngine.activeUserLocations.get(userId);
      const roomId = user ? user.roomId : 'default-office';

      // Notify earshot peers that connection is closing
      const currentEarshots = this.userEarshotMap.get(userId) || new Set();
      for (const peerId of currentEarshots) {
        const peerSocketId = this.userToSocket.get(peerId);
        if (peerSocketId) {
          this.io.to(peerSocketId).emit('peer-leave-earshot', { peerUserId: userId });
        }
        const peerSet = this.userEarshotMap.get(peerId);
        if (peerSet) peerSet.delete(userId);
      }

      this.userEarshotMap.delete(userId);
      this.socketToUser.delete(socket.id);
      this.userToSocket.delete(userId);

      await spatialEngine.removeUser(userId);
      this.io.to(roomId).emit('user-left', { userId });
    });
  }

  /**
   * Evaluates proximity for a user using MongoDB $near,
   * detects entering/leaving earshot range, and fires WebRTC handshake triggers.
   */
  async evaluateProximity(userId, roomId, officeMap) {
    const user = spatialEngine.activeUserLocations.get(userId);
    if (!user) return;

    const userSocketId = this.userToSocket.get(userId);
    const earshotRadius = user.earshotRadius || 160;

    // 1. Query MongoDB $near for peers within earshot
    const { peers: nearbyPeers, queryTimeMs } = await spatialEngine.findPeersNear(
      user.x,
      user.y,
      earshotRadius,
      userId,
      roomId
    );

    const prevEarshot = this.userEarshotMap.get(userId) || new Set();
    const nextEarshot = new Set();
    const obstacles = officeMap ? officeMap.obstacles : [];

    // Detailed proximity metadata for spatial audio mixer & radar
    const proximityDetails = [];

    for (const peer of nearbyPeers) {
      nextEarshot.add(peer.userId);

      // Check acoustic obstacle occlusion (walls / glass partitions)
      const occlusion = spatialEngine.calculateOcclusion(
        { x: user.x, y: user.y },
        { x: peer.x, y: peer.y },
        obstacles
      );

      // Relative audio panning angle
      const dx = peer.x - user.x;
      const dy = peer.y - user.y;
      const distance = Math.hypot(dx, dy);

      // Gain calculation (inverse distance / linear crossfade dropoff)
      // distance 0 -> gain 1.0; distance earshotRadius -> gain 0.0
      let normalizedDistance = Math.min(1.0, distance / earshotRadius);
      // Smooth cosine or smoothstep dropoff
      let gain = Math.cos((normalizedDistance * Math.PI) / 2);
      if (occlusion.isOccluded) {
        gain *= (1 - occlusion.absorption * 0.7); // occluded attenuation
      }

      // Stereo pan: -1.0 (hard left) to +1.0 (hard right)
      // Normalize dx relative to earshot radius
      const pan = Math.max(-1, Math.min(1, dx / (earshotRadius * 0.8)));

      proximityDetails.push({
        peerUserId: peer.userId,
        peerName: peer.name,
        distance: Math.round(distance),
        gain: Math.round(gain * 100) / 100,
        pan: Math.round(pan * 100) / 100,
        occlusion,
        dx,
        dy,
      });
    }

    // Determine newly entered peers (In nextEarshot but not in prevEarshot)
    for (const peerId of nextEarshot) {
      if (!prevEarshot.has(peerId)) {
        // Peer entered earshot!
        const peerSocketId = this.userToSocket.get(peerId);

        // Tell current user about new peer in earshot
        if (userSocketId) {
          this.io.to(userSocketId).emit('peer-enter-earshot', {
            peerUserId: peerId,
            isInitiator: userId < peerId, // Deterministic initiator assignment
          });
        }

        // Tell the other peer about current user
        if (peerSocketId) {
          this.io.to(peerSocketId).emit('peer-enter-earshot', {
            peerUserId: userId,
            isInitiator: peerId < userId,
          });
          const peerSet = this.userEarshotMap.get(peerId);
          if (peerSet) peerSet.add(userId);
        }
      }
    }

    // Determine peers that left earshot (In prevEarshot but not in nextEarshot)
    for (const peerId of prevEarshot) {
      if (!nextEarshot.has(peerId)) {
        // Peer left earshot!
        const peerSocketId = this.userToSocket.get(peerId);

        if (userSocketId) {
          this.io.to(userSocketId).emit('peer-leave-earshot', {
            peerUserId: peerId,
          });
        }

        if (peerSocketId) {
          this.io.to(peerSocketId).emit('peer-leave-earshot', {
            peerUserId: userId,
          });
          const peerSet = this.userEarshotMap.get(peerId);
          if (peerSet) peerSet.delete(userId);
        }
      }
    }

    // Update user's active earshot cache
    this.userEarshotMap.set(userId, nextEarshot);

    // Send spatial audio mixer updates (gain, panning, occlusion filter) to user
    if (userSocketId) {
      this.io.to(userSocketId).emit('spatial-proximity-update', {
        earshotCount: nextEarshot.size,
        peers: proximityDetails,
        queryLatencyMs: queryTimeMs,
      });
    }
  }
}

/**
 * Default Office Floor Plan with sound-blocking walls, meeting rooms, and furniture
 */
export function getDefaultOfficeMap(roomId = 'default-office') {
  return {
    roomId,
    name: 'Infotact Headquarters - Virtual Floor',
    dimensions: { width: 2400, height: 1600 },
    gridSize: 40,
    zones: [
      {
        id: 'zone-conf-a',
        name: 'Conference Room Alpha',
        type: 'room',
        x: 100,
        y: 100,
        width: 500,
        height: 380,
        color: 'rgba(59, 130, 246, 0.12)',
        isQuietZone: false,
      },
      {
        id: 'zone-conf-b',
        name: 'Executive Boardroom',
        type: 'room',
        x: 660,
        y: 100,
        width: 500,
        height: 380,
        color: 'rgba(139, 92, 246, 0.12)',
        isQuietZone: false,
      },
      {
        id: 'zone-lounge',
        name: 'Cafeteria & Lounge',
        type: 'lounge',
        x: 1300,
        y: 100,
        width: 600,
        height: 480,
        color: 'rgba(234, 179, 8, 0.10)',
        isQuietZone: false,
      },
      {
        id: 'zone-open-office',
        name: 'Open Collaboration Bullpen',
        type: 'open-office',
        x: 100,
        y: 600,
        width: 1100,
        height: 700,
        color: 'rgba(16, 185, 129, 0.08)',
        isQuietZone: false,
      },
      {
        id: 'zone-focus',
        name: 'Deep Focus Library',
        type: 'quiet-zone',
        x: 1300,
        y: 700,
        width: 600,
        height: 600,
        color: 'rgba(99, 102, 241, 0.10)',
        isQuietZone: true,
      },
    ],
    obstacles: [
      // Conference Room Alpha Walls
      {
        id: 'obs-wall-conf-top',
        name: 'Alpha North Wall',
        type: 'wall',
        x: 100,
        y: 100,
        width: 500,
        height: 16,
        soundAbsorption: 0.85,
        blocksMovement: true,
        color: '#334155',
      },
      {
        id: 'obs-wall-conf-left',
        name: 'Alpha West Wall',
        type: 'wall',
        x: 100,
        y: 100,
        width: 16,
        height: 380,
        soundAbsorption: 0.85,
        blocksMovement: true,
        color: '#334155',
      },
      {
        id: 'obs-wall-conf-right',
        name: 'Alpha East Wall',
        type: 'wall',
        x: 584,
        y: 100,
        width: 16,
        height: 380,
        soundAbsorption: 0.85,
        blocksMovement: true,
        color: '#334155',
      },
      {
        id: 'obs-wall-conf-bot-1',
        name: 'Alpha South Wall Left',
        type: 'glass-wall',
        x: 100,
        y: 464,
        width: 200,
        height: 16,
        soundAbsorption: 0.5,
        blocksMovement: true,
        color: '#38BDF8',
      },
      {
        id: 'obs-wall-conf-bot-2',
        name: 'Alpha South Wall Right',
        type: 'glass-wall',
        x: 380,
        y: 464,
        width: 220,
        height: 16,
        soundAbsorption: 0.5,
        blocksMovement: true,
        color: '#38BDF8',
      }, // Door gap between x=300 and x=380

      // Executive Boardroom Glass Partition
      {
        id: 'obs-glass-board-top',
        name: 'Boardroom Glass North',
        type: 'glass-wall',
        x: 660,
        y: 100,
        width: 500,
        height: 16,
        soundAbsorption: 0.45,
        blocksMovement: true,
        color: '#38BDF8',
      },
      {
        id: 'obs-glass-board-right',
        name: 'Boardroom Glass East',
        type: 'glass-wall',
        x: 1144,
        y: 100,
        width: 16,
        height: 380,
        soundAbsorption: 0.45,
        blocksMovement: true,
        color: '#38BDF8',
      },
      {
        id: 'obs-glass-board-bot',
        name: 'Boardroom Glass South',
        type: 'glass-wall',
        x: 660,
        y: 464,
        width: 380,
        height: 16,
        soundAbsorption: 0.45,
        blocksMovement: true,
        color: '#38BDF8',
      },

      // Conference Tables
      {
        id: 'obs-table-alpha',
        name: 'Mahogany Conference Table',
        type: 'conference-table',
        x: 230,
        y: 220,
        width: 240,
        height: 120,
        soundAbsorption: 0.2,
        blocksMovement: true,
        color: '#78350F',
      },
      {
        id: 'obs-table-board',
        name: 'Boardroom Oval Table',
        type: 'conference-table',
        x: 790,
        y: 220,
        width: 240,
        height: 120,
        soundAbsorption: 0.2,
        blocksMovement: true,
        color: '#78350F',
      },

      // Bullpen Workstations / Desks
      {
        id: 'obs-desk-row-1',
        name: 'Developer Desk Pod 1',
        type: 'desk',
        x: 220,
        y: 720,
        width: 280,
        height: 100,
        soundAbsorption: 0.25,
        blocksMovement: true,
        color: '#64748B',
      },
      {
        id: 'obs-desk-row-2',
        name: 'Developer Desk Pod 2',
        type: 'desk',
        x: 620,
        y: 720,
        width: 280,
        height: 100,
        soundAbsorption: 0.25,
        blocksMovement: true,
        color: '#64748B',
      },
      {
        id: 'obs-desk-row-3',
        name: 'Product & Design Desks',
        type: 'desk',
        x: 220,
        y: 960,
        width: 280,
        height: 100,
        soundAbsorption: 0.25,
        blocksMovement: true,
        color: '#64748B',
      },
      {
        id: 'obs-desk-row-4',
        name: 'QA & DevOps Desks',
        type: 'desk',
        x: 620,
        y: 960,
        width: 280,
        height: 100,
        soundAbsorption: 0.25,
        blocksMovement: true,
        color: '#64748B',
      },

      // Lounge Furniture & Coffee Bar
      {
        id: 'obs-couch-1',
        name: 'Velvet Lounge Sofa',
        type: 'couch',
        x: 1450,
        y: 240,
        width: 220,
        height: 90,
        soundAbsorption: 0.3,
        blocksMovement: true,
        color: '#047857',
      },
      {
        id: 'obs-water-cooler',
        name: 'Social Water Cooler Station',
        type: 'water-cooler',
        x: 1350,
        y: 180,
        width: 60,
        height: 60,
        soundAbsorption: 0.15,
        blocksMovement: true,
        color: '#0284C7',
      },

      // Partition separating Focus Library
      {
        id: 'obs-library-wall-left',
        name: 'Library Acoustic Baffle Wall',
        type: 'wall',
        x: 1280,
        y: 700,
        width: 16,
        height: 600,
        soundAbsorption: 0.9,
        blocksMovement: true,
        color: '#1E293B',
      },
    ],
  };
}
