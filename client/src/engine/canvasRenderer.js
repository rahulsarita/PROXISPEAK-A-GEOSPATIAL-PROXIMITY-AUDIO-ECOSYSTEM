/**
 * 60 FPS HTML5 Canvas Virtual Office Renderer with Camera Panning,
 * Spatial Audio Radar, Obstacle Acoustics, and High-Performance Avatars.
 */

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Main render function called each requestAnimationFrame
   */
  render({
    localPlayer,
    peers,
    officeMap,
    spatialPeers = [],
    isEditorMode = false,
    selectedObstacleId = null,
  }) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Track FPS
    this.updateFps();

    // Smooth camera follow local player
    if (localPlayer) {
      const targetCamX = localPlayer.x - cw / 2;
      const targetCamY = localPlayer.y - ch / 2;
      // Lerp camera
      this.camera.x += (targetCamX - this.camera.x) * 0.12;
      this.camera.y += (targetCamY - this.camera.y) * 0.12;
    }

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    // Translate canvas by camera coordinates
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

    const worldW = officeMap ? officeMap.dimensions.width : 2400;
    const worldH = officeMap ? officeMap.dimensions.height : 1600;

    // 1. Draw Office Floor & Grid
    this.drawFloorAndGrid(ctx, worldW, worldH);

    // 2. Draw Zones (Conference Rooms, Bullpen, Lounge)
    if (officeMap && officeMap.zones) {
      this.drawZones(ctx, officeMap.zones);
    }

    // 3. Draw Sound Obstacles & Furniture (Walls, Glass Partitions, Tables)
    if (officeMap && officeMap.obstacles) {
      this.drawObstacles(ctx, officeMap.obstacles, selectedObstacleId, isEditorMode);
    }

    // 4. Draw Spatial Audio Proximity Rays & Radar
    if (localPlayer) {
      this.drawSpatialRays(ctx, localPlayer, spatialPeers);
      this.drawEarshotRadar(ctx, localPlayer);
    }

    // 5. Draw Peer Avatars
    if (peers) {
      for (const peer of peers) {
        this.drawAvatar(ctx, peer, false);
      }
    }

    // 6. Draw Local Player Avatar
    if (localPlayer) {
      this.drawAvatar(ctx, localPlayer, true);
    }

    ctx.restore();

    // 7. Screen Space UI: Minimap, FPS HUD
    this.drawMinimap(ctx, cw, ch, localPlayer, peers, officeMap);
    this.drawHud(ctx, localPlayer, spatialPeers);
  }

  updateFps() {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  drawFloorAndGrid(ctx, w, h) {
    // Floor boundary
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Subtle parquet tile / grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const gridSize = 40;

    ctx.beginPath();
    for (let x = 0; x <= w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Outer office border
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);
  }

  drawZones(ctx, zones) {
    for (const zone of zones) {
      ctx.fillStyle = zone.color || 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

      // Zone label header
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(zone.name.toUpperCase(), zone.x + 14, zone.y + 24);
    }
  }

  drawObstacles(ctx, obstacles, selectedId, isEditor) {
    for (const obs of obstacles) {
      const isSelected = obs.id === selectedId;

      ctx.save();

      if (obs.type === 'wall') {
        // Solid acoustic block wall
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Wall top bevel
        ctx.fillStyle = '#334155';
        ctx.fillRect(obs.x, obs.y, obs.width, Math.min(obs.height, 4));

        ctx.strokeStyle = isSelected ? '#38bdf8' : '#475569';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      } else if (obs.type === 'glass-wall') {
        // Glass partition with cyan glow
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Glass glare diagonal streak
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x + 4, obs.y + obs.height - 4);
        ctx.lineTo(obs.x + Math.min(obs.width, 30), obs.y + 4);
        ctx.stroke();
      } else if (obs.type === 'conference-table') {
        // Conference Table with rounded corners
        ctx.fillStyle = '#451a03';
        this.roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 12, true, false);

        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        this.roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 12, false, true);

        // Center cable grommet
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(obs.x + obs.width / 2 - 20, obs.y + obs.height / 2 - 6, 40, 12);
      } else if (obs.type === 'desk') {
        // Workstation desk
        ctx.fillStyle = '#334155';
        this.roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 6, true, false);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        this.roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 6, false, true);

        // Dual computer monitors
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(obs.x + 30, obs.y + 12, 80, 14);
        ctx.fillRect(obs.x + 130, obs.y + 12, 80, 14);
      } else if (obs.type === 'couch') {
        // Velvet Couch
        ctx.fillStyle = '#065f46';
        this.roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 10, true, false);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        this.roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 10, false, true);
      } else if (obs.type === 'water-cooler') {
        // Water Cooler
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Editor selection highlight
      if (isSelected && isEditor) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(obs.x - 4, obs.y - 4, obs.width + 8, obs.height + 8);
      }

      ctx.restore();
    }
  }

  drawEarshotRadar(ctx, player) {
    const radius = player.earshotRadius || 180;
    const now = performance.now() * 0.002;

    ctx.save();

    // Subtle radar gradient fill
    const grad = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, radius);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.06)');
    grad.addColorStop(0.8, 'rgba(59, 130, 246, 0.03)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.15)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer radar dashed boundary
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();

    // Rotating subtle radar sweep beam
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(now) * radius, player.y + Math.sin(now) * radius);
    ctx.stroke();

    ctx.restore();
  }

  drawSpatialRays(ctx, localPlayer, spatialPeers) {
    for (const peer of spatialPeers) {
      ctx.save();
      const isOccluded = peer.occlusion && peer.occlusion.isOccluded;

      if (isOccluded) {
        // Red / Orange dashed ray showing acoustic wall muffling
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      } else {
        // Green / Cyan solid ray showing direct open line-of-sight sound
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1.5;
      }

      ctx.beginPath();
      ctx.moveTo(localPlayer.x, localPlayer.y);
      ctx.lineTo(localPlayer.x + (peer.dx || 0), localPlayer.y + (peer.dy || 0));
      ctx.stroke();

      // Midpoint audio label: Volume Gain % & Occlusion
      const midX = localPlayer.x + (peer.dx || 0) * 0.5;
      const midY = localPlayer.y + (peer.dy || 0) * 0.5;

      ctx.fillStyle = isOccluded ? '#ef4444' : '#10b981';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      const label = `${Math.round((peer.gain || 0) * 100)}% vol ${isOccluded ? '[MUFFLED]' : '[CLEAR]'}`;
      ctx.fillText(label, midX - 25, midY - 6);

      ctx.restore();
    }
  }

  drawAvatar(ctx, user, isSelf) {
    const x = user.x;
    const y = user.y;
    const radius = 20;
    const color = user.color || '#3b82f6';
    const isSpeaking = user.isSpeaking;

    ctx.save();

    // Speaking ripple effect (sonic sound waves)
    if (isSpeaking) {
      const pulsePhase = (performance.now() % 1200) / 1200;
      const pulseRadius = radius + pulsePhase * 24;
      const alpha = Math.max(0, 1 - pulsePhase);

      ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Avatar drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Outer circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Border
    ctx.strokeStyle = isSelf ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = isSelf ? 2.5 : 1.5;
    ctx.stroke();

    // Directional nose / arrow
    const angle = user.facingAngle !== undefined ? user.facingAngle : 0;
    const noseDist = radius + 5;
    const noseX = x + Math.cos(angle) * noseDist;
    const noseY = y + Math.sin(angle) * noseDist;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(noseX, noseY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Initials in center of avatar
    const initials = (user.name || 'U')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x, y);

    // Name tag & Status pill above avatar
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    const nameText = isSelf ? `${user.name} (You)` : user.name;
    const textWidth = ctx.measureText(nameText).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.roundRect(ctx, x - textWidth / 2 - 8, y - radius - 24, textWidth + 16, 18, 9, true, false);

    ctx.fillStyle = isSelf ? '#60a5fa' : '#f8fafc';
    ctx.fillText(nameText, x, y - radius - 15);

    // Mic muted badge
    if (user.isMuted) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + radius - 4, y - radius + 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawMinimap(ctx, cw, ch, player, peers, officeMap) {
    if (!officeMap) return;

    const mapW = 160;
    const mapH = 110;
    const pad = 16;
    const mx = cw - mapW - pad;
    const my = ch - mapH - pad - 60; // above bottom control bar

    const worldW = officeMap.dimensions.width;
    const worldH = officeMap.dimensions.height;
    const scaleX = mapW / worldW;
    const scaleY = mapH / worldH;

    ctx.save();

    // Minimap background container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.roundRect(ctx, mx, my, mapW, mapH, 8, true, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, mx, my, mapW, mapH, 8, false, true);

    // Minimap Zones
    if (officeMap.zones) {
      for (const z of officeMap.zones) {
        ctx.fillStyle = z.color || 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(mx + z.x * scaleX, my + z.y * scaleY, z.width * scaleX, z.height * scaleY);
      }
    }

    // Minimap Peer dots
    if (peers) {
      for (const p of peers) {
        ctx.fillStyle = p.color || '#3b82f6';
        ctx.beginPath();
        ctx.arc(mx + p.x * scaleX, my + p.y * scaleY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Local player marker
    if (player) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mx + player.x * scaleX, my + player.y * scaleY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Player view frustum box
      const viewW = (cw / worldW) * mapW;
      const viewH = (ch / worldH) * mapH;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mx + (player.x - cw / 2) * scaleX,
        my + (player.y - ch / 2) * scaleY,
        viewW,
        viewH
      );
    }

    // Minimap Header Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RADAR MINIMAP', mx + 6, my + 12);

    ctx.restore();
  }

  drawHud(ctx, player, spatialPeers) {
    ctx.save();
    // Top-left HUD badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    this.roundRect(ctx, 16, 76, 210, 52, 8, true, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 16, 76, 210, 52, 8, false, true);

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    // FPS Counter (Green if >= 55, Yellow if >= 30, Red if < 30)
    ctx.fillStyle = this.fps >= 55 ? '#10b981' : this.fps >= 30 ? '#f59e0b' : '#ef4444';
    ctx.fillText(`FPS: ${this.fps} (Target 60)`, 28, 94);

    // Coordinates
    ctx.fillStyle = '#94a3b8';
    if (player) {
      ctx.fillText(`POS: X:${Math.round(player.x)} Y:${Math.round(player.y)}`, 28, 110);
    }

    // Peers in earshot
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`EARSHOT: ${spatialPeers.length} active`, 28, 122);

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

export default CanvasRenderer;
