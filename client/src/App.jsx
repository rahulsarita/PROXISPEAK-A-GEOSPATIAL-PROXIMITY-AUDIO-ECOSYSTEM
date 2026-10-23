import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import config from './config.js';
import audioManager from './audio/audioManager.js';
import PeerConnectionManager from './webrtc/peerConnectionManager.js';

import TopNavigation from './components/TopNavigation.jsx';
import ControlBar from './components/ControlBar.jsx';
import OfficeCanvas from './components/OfficeCanvas.jsx';
import PeerRadarPanel from './components/PeerRadarPanel.jsx';
import SpatialAuditModal from './components/SpatialAuditModal.jsx';
import MapEditorModal from './components/MapEditorModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import DashboardView from './components/DashboardView.jsx';

export function App() {
  // Navigation View Tab: 'map' or 'dashboard'
  const [activeTab, setActiveTab] = useState('map');

  // Socket & Connection state
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const pcmRef = useRef(null);

  // Local User State
  const [currentUser, setCurrentUser] = useState(() => {
    const savedName = localStorage.getItem('proxispeak_name') || `Infotact Peer ${Math.floor(Math.random() * 900 + 100)}`;
    const savedColor = localStorage.getItem('proxispeak_color') || '#3B82F6';
    const userId = localStorage.getItem('proxispeak_userId') || `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    localStorage.setItem('proxispeak_userId', userId);

    return {
      userId,
      name: savedName,
      color: savedColor,
      x: 500 + Math.floor(Math.random() * 300),
      y: 450 + Math.floor(Math.random() * 200),
      facingAngle: 0,
      earshotRadius: config.AUDIO.DEFAULT_EARSHOT_RADIUS,
      isMuted: false,
      isSpeaking: false,
      roomId: config.DEFAULT_ROOM_ID,
    };
  });

  // Remote Peers & Spatial Map State
  const [peers, setPeers] = useState([]);
  const [officeMap, setOfficeMap] = useState(null);
  const [spatialPeers, setSpatialPeers] = useState([]);
  const [peerConnectionStates, setPeerConnectionStates] = useState(new Map());

  // Audio & Mic States
  const [isMuted, setIsMuted] = useState(false);
  const [isTestAudioActive, setIsTestAudioActive] = useState(false);
  const [speakingLevel, setSpeakingLevel] = useState(0);
  const currentUserRef = useRef(currentUser);
  const isMutedRef = useRef(isMuted);
  const isTestAudioActiveRef = useRef(isTestAudioActive);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isTestAudioActiveRef.current = isTestAudioActive;
  }, [isTestAudioActive]);

  // Modals & Drawers
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Bot Count
  const [botCount, setBotCount] = useState(0);

  // Initialize Socket.io and WebRTC Peer Connection Manager
  useEffect(() => {
    const socket = io(config.SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    const pcm = new PeerConnectionManager(socket);
    pcm.setCallback((peerId, state) => {
      setPeerConnectionStates((prev) => new Map(prev).set(peerId, state));
    });
    pcmRef.current = pcm;

    socket.on('connect', () => {
      setSocketConnected(true);

      // Join room
      socket.emit('join-room', currentUser, (response) => {
        if (response && response.status === 'ok') {
          if (response.officeMap) setOfficeMap(response.officeMap);
          if (response.users) {
            const otherPeers = response.users.filter((u) => u.userId !== currentUser.userId);
            setPeers(otherPeers);
            setBotCount(otherPeers.filter((u) => u.isBot).length);
          }
        }
      });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // New user joined room
    socket.on('user-joined', (newUser) => {
      if (newUser.userId === currentUser.userId) return;
      setPeers((prev) => {
        const filtered = prev.filter((u) => u.userId !== newUser.userId);
        const updated = [...filtered, newUser];
        setBotCount(updated.filter((u) => u.isBot).length);
        return updated;
      });
    });

    // Remote user moved
    socket.on('user-moved', ({ userId, x, y, facingAngle }) => {
      setPeers((prev) =>
        prev.map((peer) => (peer.userId === userId ? { ...peer, x, y, facingAngle } : peer))
      );
    });

    // Remote user left
    socket.on('user-left', ({ userId }) => {
      setPeers((prev) => {
        const updated = prev.filter((u) => u.userId !== userId);
        setBotCount(updated.filter((u) => u.isBot).length);
        return updated;
      });
      pcm.closePeerConnection(userId);
    });

    // Remote user voice/mute status change
    socket.on('user-voice-status', ({ userId, isSpeaking, isMuted }) => {
      setPeers((prev) =>
        prev.map((p) => (p.userId === userId ? { ...p, isSpeaking, isMuted } : p))
      );
    });

    // WebRTC Proximity Handshake Triggers (Week 2 selective mesh)
    socket.on('peer-enter-earshot', ({ peerUserId, isInitiator }) => {
      pcm.handlePeerEnterEarshot(peerUserId, isInitiator);
    });

    socket.on('peer-leave-earshot', ({ peerUserId }) => {
      pcm.handlePeerLeaveEarshot(peerUserId);
    });

    socket.on('webrtc-offer', ({ callerUserId, sdp }) => {
      pcm.handleOffer(callerUserId, sdp);
    });

    socket.on('webrtc-answer', ({ responderUserId, sdp }) => {
      pcm.handleAnswer(responderUserId, sdp);
    });

    socket.on('webrtc-ice-candidate', ({ fromUserId, candidate }) => {
      pcm.handleIceCandidate(fromUserId, candidate);
    });

    // Spatial Audio Mixer updates from server
    socket.on('spatial-proximity-update', ({ peers: proxPeers }) => {
      setSpatialPeers(proxPeers || []);
    });

    // Mic activity polling loop for visual ripples & socket voice status
    const micInterval = setInterval(() => {
      const level = audioManager.getLocalSpeakingLevel();
      setSpeakingLevel(level);

      const user = currentUserRef.current;
      const currentlySpeaking = level > 0.05 || isTestAudioActiveRef.current;
      if (currentlySpeaking !== user.isSpeaking) {
        const updatedUser = { ...user, isSpeaking: currentlySpeaking };
        currentUserRef.current = updatedUser;
        setCurrentUser(updatedUser);
        socket.emit('voice-status', {
          isSpeaking: currentlySpeaking,
          isMuted: isMutedRef.current,
          roomId: user.roomId,
        });
      }
    }, 150);

    // Bot wandering AI simulation loop (for 50+ user demonstration)
    const botAiInterval = setInterval(() => {
      setPeers((prev) => {
        const bots = prev.filter((p) => p.isBot);
        if (bots.length === 0) return prev;

        // Randomly move 1-3 bots per tick
        return prev.map((p) => {
          if (!p.isBot || Math.random() > 0.3) return p;

          const angle = Math.random() * Math.PI * 2;
          const step = 8 + Math.random() * 15;
          const nextX = Math.max(100, Math.min(2300, p.x + Math.cos(angle) * step));
          const nextY = Math.max(100, Math.min(1500, p.y + Math.sin(angle) * step));

          return {
            ...p,
            x: Math.round(nextX),
            y: Math.round(nextY),
            facingAngle: angle,
            // Randomly simulate bot talking occasionally
            isSpeaking: Math.random() > 0.7,
          };
        });
      });
    }, 800);

    return () => {
      clearInterval(micInterval);
      clearInterval(botAiInterval);
      pcm.cleanup();
      socket.disconnect();
    };
  }, []);

  // Broadcast movement to socket
  const handleLocalMove = (pos) => {
    const updatedUser = { ...currentUserRef.current, ...pos };
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);

    if (socketRef.current?.connected) {
      socketRef.current.emit('move', {
        x: pos.x,
        y: pos.y,
        facingAngle: pos.facingAngle,
        earshotRadius: updatedUser.earshotRadius,
        roomId: updatedUser.roomId,
      });
    }
  };

  // Toggle Microphone
  const handleToggleMute = async () => {
    if (!audioManager.localStream) {
      await audioManager.startMicrophone();
    }
    const newMuted = audioManager.toggleMute();
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
    const updatedUser = { ...currentUserRef.current, isMuted: newMuted };
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);

    if (socketRef.current) {
      socketRef.current.emit('voice-status', {
        isSpeaking: false,
        isMuted: newMuted,
        roomId: currentUser.roomId,
      });
    }
  };

  // Toggle Synthetic Voice Test Audio
  const handleToggleTestAudio = () => {
    const active = audioManager.toggleTestAudio();
    isTestAudioActiveRef.current = active;
    setIsTestAudioActive(active);
    const updatedUser = { ...currentUserRef.current, isSpeaking: active };
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);

    if (socketRef.current) {
      socketRef.current.emit('voice-status', {
        isSpeaking: active,
        isMuted: false,
        roomId: currentUser.roomId,
      });
    }
  };

  // Change Earshot Radius
  const handleChangeEarshot = (radius) => {
    const updatedUser = { ...currentUserRef.current, earshotRadius: radius };
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);
    handleLocalMove({
      x: updatedUser.x,
      y: updatedUser.y,
      facingAngle: updatedUser.facingAngle,
    });
  };

  // Spawn Bots
  const handleSpawnBots = (count) => {
    if (socketRef.current) {
      socketRef.current.emit('spawn-bots', { count, roomId: currentUser.roomId });
    }
  };

  // Clear Bots
  const handleClearBots = () => {
    if (socketRef.current) {
      socketRef.current.emit('clear-bots', { roomId: currentUser.roomId });
    }
  };

  // Update Profile
  const handleUpdateProfile = ({ name, color }) => {
    localStorage.setItem('proxispeak_name', name);
    localStorage.setItem('proxispeak_color', color);
    setCurrentUser((prev) => ({ ...prev, name, color }));

    if (socketRef.current) {
      socketRef.current.emit('move', {
        x: currentUser.x,
        y: currentUser.y,
        facingAngle: currentUser.facingAngle,
        name,
        color,
        roomId: currentUser.roomId,
      });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* 1. Header Navigation Bar */}
      <TopNavigation
        socketConnected={socketConnected}
        peerCount={peers.length}
        earshotCount={spatialPeers.length}
        onOpenAudit={() => setIsAuditOpen(true)}
        onToggleEditor={() => setIsEditorOpen(!isEditorOpen)}
        isEditorOpen={isEditorOpen}
        onToggleRadar={() => setIsRadarOpen(!isRadarOpen)}
        isRadarOpen={isRadarOpen}
        onOpenProfile={() => setIsProfileOpen(true)}
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* 2. View Mode Rendering */}
      {activeTab === 'dashboard' && (
        <DashboardView
          peers={peers}
          currentUser={currentUser}
          officeMap={officeMap}
          spatialPeers={spatialPeers}
          onSwitchToMap={() => setActiveTab('map')}
          onOpenAudit={() => setIsAuditOpen(true)}
          onSpawnBots={handleSpawnBots}
          onClearBots={handleClearBots}
          botCount={botCount}
        />
      )}

      {/* 3. 60 FPS HTML5 Canvas Office Engine */}
      <OfficeCanvas
        localPlayer={currentUser}
        peers={peers}
        officeMap={officeMap}
        spatialPeers={spatialPeers}
        onLocalMove={handleLocalMove}
        isEditorMode={isEditorOpen}
      />

      {/* 3. Floating Bottom Control Dock */}
      <ControlBar
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isTestAudioActive={isTestAudioActive}
        onToggleTestAudio={handleToggleTestAudio}
        earshotRadius={currentUser.earshotRadius}
        onChangeEarshotRadius={handleChangeEarshot}
        onSpawnBots={handleSpawnBots}
        onClearBots={handleClearBots}
        speakingLevel={speakingLevel}
        botCount={botCount}
      />

      {/* 4. Peer Radar Side Drawer */}
      <PeerRadarPanel
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        spatialPeers={spatialPeers}
        peerConnectionStates={peerConnectionStates}
        earshotRadius={currentUser.earshotRadius}
      />

      {/* 5. Modals */}
      <SpatialAuditModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      <MapEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        officeMap={officeMap}
        onUpdateMap={(newMap) => setOfficeMap(newMap)}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        onSave={handleUpdateProfile}
      />
    </div>
  );
}

export default App;
