import config from '../config.js';
import audioManager from '../audio/audioManager.js';

export class PeerConnectionManager {
  constructor(socket) {
    this.socket = socket;
    this.peerConnections = new Map(); // peerUserId -> RTCPeerConnection
    this.pendingCandidates = new Map(); // peerUserId -> RTCIceCandidate[]
    this.connectionStates = new Map(); // peerUserId -> string ('connecting', 'connected', etc.)
    this.onStateChangeCallback = null;
  }

  setCallback(cb) {
    this.onStateChangeCallback = cb;
  }

  notifyState(peerUserId, state) {
    this.connectionStates.set(peerUserId, state);
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(peerUserId, state);
    }
  }

  /**
   * Called when a peer enters earshot radius.
   * If isInitiator is true, starts the WebRTC offer handshake.
   */
  async handlePeerEnterEarshot(peerUserId, isInitiator) {
    if (this.peerConnections.has(peerUserId)) {
      console.log(`[WebRTC] Peer ${peerUserId} already connected or negotiating.`);
      return;
    }

    console.log(`[WebRTC] Peer entered earshot: ${peerUserId} (Initiator: ${isInitiator})`);
    const pc = this.createPeerConnection(peerUserId);

    if (isInitiator) {
      try {
        this.notifyState(peerUserId, 'offering');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        this.socket.emit('webrtc-offer', {
          targetUserId: peerUserId,
          sdp: offer,
        });
      } catch (err) {
        console.error(`[WebRTC] Error creating offer for ${peerUserId}:`, err);
        this.notifyState(peerUserId, 'error');
      }
    } else {
      this.notifyState(peerUserId, 'waiting-for-offer');
    }
  }

  /**
   * Called when a peer leaves earshot radius.
   * Cleans up RTCPeerConnection and audio stream.
   */
  handlePeerLeaveEarshot(peerUserId) {
    console.log(`[WebRTC] Peer left earshot: ${peerUserId}. Teardown connection.`);
    this.closePeerConnection(peerUserId);
  }

  createPeerConnection(peerUserId) {
    const pc = new RTCPeerConnection({
      iceServers: config.WEBRTC.ICE_SERVERS,
    });

    this.peerConnections.set(peerUserId, pc);

    // 1. Add local audio tracks if available
    if (audioManager.localStream) {
      audioManager.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, audioManager.localStream);
      });
    }

    // 2. ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-ice-candidate', {
          targetUserId: peerUserId,
          candidate: event.candidate,
        });
      }
    };

    // 3. Remote Audio Track Reception
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote audio stream from peer: ${peerUserId}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      audioManager.addPeerStream(peerUserId, remoteStream);
      this.notifyState(peerUserId, 'connected');
    };

    // 4. Connection lifecycle states
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state [${peerUserId}]:`, pc.connectionState);
      this.notifyState(peerUserId, pc.connectionState);

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeerConnection(peerUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.notifyState(peerUserId, 'connected');
      }
    };

    return pc;
  }

  /**
   * Handle incoming WebRTC SDP Offer
   */
  async handleOffer(callerUserId, sdp) {
    console.log(`[WebRTC] Handling offer from ${callerUserId}`);
    let pc = this.peerConnections.get(callerUserId);
    if (!pc) {
      pc = this.createPeerConnection(callerUserId);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this.notifyState(callerUserId, 'answering');

      // Flush any queued ICE candidates
      if (this.pendingCandidates.has(callerUserId)) {
        const queue = this.pendingCandidates.get(callerUserId);
        for (const candidate of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(callerUserId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('webrtc-answer', {
        targetUserId: callerUserId,
        sdp: answer,
      });
    } catch (err) {
      console.error(`[WebRTC] Error handling offer from ${callerUserId}:`, err);
      this.notifyState(callerUserId, 'error');
    }
  }

  /**
   * Handle incoming WebRTC SDP Answer
   */
  async handleAnswer(responderUserId, sdp) {
    console.log(`[WebRTC] Handling answer from ${responderUserId}`);
    const pc = this.peerConnections.get(responderUserId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this.notifyState(responderUserId, 'connected');

      // Flush any queued ICE candidates
      if (this.pendingCandidates.has(responderUserId)) {
        const queue = this.pendingCandidates.get(responderUserId);
        for (const candidate of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(responderUserId);
      }
    } catch (err) {
      console.error(`[WebRTC] Error setting answer from ${responderUserId}:`, err);
      this.notifyState(responderUserId, 'error');
    }
  }

  /**
   * Handle incoming ICE Candidate
   */
  async handleIceCandidate(fromUserId, candidate) {
    const pc = this.peerConnections.get(fromUserId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[WebRTC] Error adding ICE candidate:`, err);
      }
    } else {
      // Queue candidate until remote description is set
      if (!this.pendingCandidates.has(fromUserId)) {
        this.pendingCandidates.set(fromUserId, []);
      }
      this.pendingCandidates.get(fromUserId).push(candidate);
    }
  }

  /**
   * Closes connection with a peer
   */
  closePeerConnection(peerUserId) {
    const pc = this.peerConnections.get(peerUserId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.peerConnections.delete(peerUserId);
    }
    this.pendingCandidates.delete(peerUserId);
    this.notifyState(peerUserId, 'disconnected');
    audioManager.removePeerStream(peerUserId);
  }

  /**
   * Close all active peer connections
   */
  cleanup() {
    this.peerConnections.forEach((pc, peerUserId) => {
      this.closePeerConnection(peerUserId);
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();
  }
}

export default PeerConnectionManager;
