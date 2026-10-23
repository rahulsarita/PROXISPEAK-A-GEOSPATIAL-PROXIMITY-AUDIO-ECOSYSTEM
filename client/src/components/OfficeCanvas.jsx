import React, { useRef, useEffect } from 'react';
import { CanvasRenderer } from '../engine/canvasRenderer.js';
import { InputManager } from '../engine/inputManager.js';
import audioManager from '../audio/audioManager.js';

export function OfficeCanvas({
  localPlayer,
  peers,
  officeMap,
  spatialPeers,
  onLocalMove,
  isEditorMode,
}) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const inputRef = useRef(null);
  const localPlayerRef = useRef(localPlayer);
  const peersRef = useRef(peers);
  const spatialPeersRef = useRef(spatialPeers);
  const officeMapRef = useRef(officeMap);

  // Sync refs for 60 FPS render loop without re-instantiating loop
  useEffect(() => {
    localPlayerRef.current = localPlayer;
  }, [localPlayer]);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    spatialPeersRef.current = spatialPeers;
  }, [spatialPeers]);

  useEffect(() => {
    officeMapRef.current = officeMap;
  }, [officeMap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize Canvas Renderer
    const renderer = new CanvasRenderer(canvas);
    rendererRef.current = renderer;

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize Input Manager
    const input = new InputManager(canvas, (pos) => {
      if (onLocalMove) onLocalMove(pos);
    });
    inputRef.current = input;

    // Mouse click-to-move handler
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      // Convert screen coords to world coords via camera
      const worldX = clickScreenX + renderer.camera.x;
      const worldY = clickScreenY + renderer.camera.y;

      input.setMouseDestination(worldX, worldY);
    };
    canvas.addEventListener('click', handleCanvasClick);

    // 60 FPS Animation Loop
    let animationFrameId;

    const gameLoop = () => {
      const currentLocal = localPlayerRef.current;
      const currentPeers = peersRef.current;
      const currentMap = officeMapRef.current;
      const currentSpatial = spatialPeersRef.current;

      if (currentLocal && currentMap) {
        // 1. Process physics and player movement
        const updatedPos = input.update(
          currentLocal,
          currentMap.obstacles || [],
          currentMap.dimensions || { width: 2400, height: 1600 }
        );

        if (updatedPos.moved) {
          localPlayerRef.current = {
            ...currentLocal,
            x: updatedPos.x,
            y: updatedPos.y,
            facingAngle: updatedPos.facingAngle,
          };
        }

        // 2. Real-time Web Audio API Spatial Parameters update
        if (currentSpatial && currentSpatial.length > 0) {
          for (const sp of currentSpatial) {
            audioManager.updatePeerSpatial(
              sp.peerUserId,
              sp.distance,
              currentLocal.earshotRadius || 180,
              sp.dx,
              sp.occlusion
            );
          }
        }
      }

      // 3. Render Canvas frame
      renderer.render({
        localPlayer: currentLocal,
        peers: currentPeers,
        officeMap: currentMap,
        spatialPeers: currentSpatial,
        isEditorMode,
      });

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handleCanvasClick);
      input.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="interactive-canvas absolute inset-0 w-full h-full block"
    />
  );
}

export default OfficeCanvas;
