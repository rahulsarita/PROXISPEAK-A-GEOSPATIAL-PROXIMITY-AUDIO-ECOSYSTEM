import { checkCircleRectCollision } from './raycaster.js';

export class InputManager {
  constructor(canvasElement, onMoveCallback) {
    this.canvas = canvasElement;
    this.onMoveCallback = onMoveCallback;

    // Movement state
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
    };

    // Velocity physics
    this.vx = 0;
    this.vy = 0;
    this.speed = 4.5; // pixels per frame
    this.friction = 0.82;

    // Mouse target position
    this.mouseTarget = null; // { x, y }

    // Avatar collision radius
    this.avatarRadius = 22;

    // Broadcast throttle
    this.lastBroadcastTime = 0;
    this.broadcastIntervalMs = 45; // ~22 updates/sec broadcast is optimal for WebSockets

    this.bindEvents();
  }

  bindEvents() {
    this.keydownHandler = (e) => {
      // Don't capture when typing in text inputs / modals
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key) || e.key.startsWith('Arrow')) {
        this.keys[key] = true;
        this.keys[e.key] = true;
        this.mouseTarget = null; // Cancel mouse destination on keyboard input
      }
    };

    this.keyupHandler = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key) || e.key.startsWith('Arrow')) {
        this.keys[key] = false;
        this.keys[e.key] = false;
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  setMouseDestination(worldX, worldY) {
    this.mouseTarget = { x: worldX, y: worldY };
  }

  /**
   * Updates player position with physics, obstacle collision, and boundaries
   * Returns: { x, y, facingAngle, moved: boolean }
   */
  update(currentPos, obstacles, worldDimensions) {
    let { x, y, facingAngle } = currentPos;
    let inputDx = 0;
    let inputDy = 0;

    // 1. Keyboard input
    if (this.keys.w || this.keys.ArrowUp) inputDy -= 1;
    if (this.keys.s || this.keys.ArrowDown) inputDy += 1;
    if (this.keys.a || this.keys.ArrowLeft) inputDx -= 1;
    if (this.keys.d || this.keys.ArrowRight) inputDx += 1;

    // 2. Mouse click-to-move
    if (this.mouseTarget) {
      const targetDx = this.mouseTarget.x - x;
      const targetDy = this.mouseTarget.y - y;
      const dist = Math.hypot(targetDx, targetDy);

      if (dist > 8) {
        inputDx = targetDx / dist;
        inputDy = targetDy / dist;
      } else {
        this.mouseTarget = null;
      }
    }

    // Normalize diagonal velocity
    if (inputDx !== 0 && inputDy !== 0) {
      const len = Math.hypot(inputDx, inputDy);
      inputDx /= len;
      inputDy /= len;
    }

    // Accelerate
    this.vx = this.vx * this.friction + inputDx * this.speed * (1 - this.friction);
    this.vy = this.vy * this.friction + inputDy * this.speed * (1 - this.friction);

    const moved = Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05;

    if (moved) {
      // Calculate target facing angle
      facingAngle = Math.atan2(this.vy, this.vx);

      // Candidate new coordinates
      let nextX = x + this.vx;
      let nextY = y + this.vy;

      // World boundary clamping
      nextX = Math.max(this.avatarRadius + 10, Math.min(worldDimensions.width - this.avatarRadius - 10, nextX));
      nextY = Math.max(this.avatarRadius + 10, Math.min(worldDimensions.height - this.avatarRadius - 10, nextY));

      // Obstacle collision check (Slide along walls on collision)
      const solidObstacles = obstacles.filter((obs) => obs.blocksMovement !== false);

      // Check X movement
      let collideX = false;
      for (const obs of solidObstacles) {
        if (checkCircleRectCollision(nextX, y, this.avatarRadius, obs)) {
          collideX = true;
          break;
        }
      }
      if (!collideX) x = nextX;

      // Check Y movement
      let collideY = false;
      for (const obs of solidObstacles) {
        if (checkCircleRectCollision(x, nextY, this.avatarRadius, obs)) {
          collideY = true;
          break;
        }
      }
      if (!collideY) y = nextY;

      // Throttle network broadcasting
      const now = performance.now();
      if (now - this.lastBroadcastTime >= this.broadcastIntervalMs) {
        this.lastBroadcastTime = now;
        if (this.onMoveCallback) {
          this.onMoveCallback({ x: Math.round(x), y: Math.round(y), facingAngle });
        }
      }
    }

    return { x, y, facingAngle, moved };
  }

  destroy() {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
  }
}

export default InputManager;
