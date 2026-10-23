import { EventEmitter } from 'events';
import Redis from 'ioredis';
import config from '../config.js';

class RedisPubSubService extends EventEmitter {
  constructor() {
    super();
    this.pubClient = null;
    this.subClient = null;
    this.isConnected = false;
    this.fallbackEmitter = new EventEmitter();
  }

  async initialize() {
    try {
      this.pubClient = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't infinite loop if not running
        connectTimeout: 1000,
      });
      this.pubClient.on('error', () => {}); // swallow unhandled event

      this.subClient = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        connectTimeout: 1000,
      });
      this.subClient.on('error', () => {}); // swallow unhandled event

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.isConnected = true;
      console.log('[Redis] Connected successfully for horizontal scaling.');

      await this.subClient.subscribe('proxispeak:spatial-events', 'proxispeak:signaling');
      this.subClient.on('message', (channel, message) => {
        try {
          const parsed = JSON.parse(message);
          this.emit(channel, parsed);
        } catch (e) {
          console.error('[Redis] Failed to parse message', e);
        }
      });
    } catch (err) {
      this.isConnected = false;
      console.warn('[Redis] Optional service unavailable. Operating in in-memory pub/sub mode.');
    }
  }

  publish(channel, data) {
    if (this.isConnected && this.pubClient) {
      this.pubClient.publish(channel, JSON.stringify(data)).catch((e) => {
        console.warn('[Redis] Publish error, falling back to in-memory:', e.message);
        this.fallbackEmitter.emit(channel, data);
      });
    } else {
      this.fallbackEmitter.emit(channel, data);
    }
  }

  subscribe(channel, handler) {
    if (this.isConnected) {
      this.on(channel, handler);
    }
    this.fallbackEmitter.on(channel, handler);
  }

  getPubSubClients() {
    return {
      pubClient: this.pubClient,
      subClient: this.subClient,
      isConnected: this.isConnected,
    };
  }
}

export const redisPubSub = new RedisPubSubService();
export default redisPubSub;
