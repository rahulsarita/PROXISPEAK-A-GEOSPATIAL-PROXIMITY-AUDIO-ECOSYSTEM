import { SpatialAudioNode } from './spatialNode.js';

export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.localStream = null;
    this.localAnalyser = null;
    this.localAnalyserData = null;
    this.spatialNodes = new Map(); // peerId -> SpatialAudioNode
    this.isMuted = false;
    this.isTestToneActive = false;
    this.testOscillator = null;
    this.testGain = null;
    this.mockDestinationStream = null;
  }

  /**
   * Initializes the browser AudioContext on user interaction
   */
  ensureContext() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Capture user's microphone stream
   */
  async startMicrophone() {
    this.ensureContext();
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Setup local mic analyzer
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 64;
      this.localAnalyserData = new Uint8Array(this.localAnalyser.frequencyBinCount);
      source.connect(this.localAnalyser);
      // NOTE: Do not connect local mic to destination (prevents hearing self echo)

      return this.localStream;
    } catch (err) {
      console.warn('Microphone access denied or unavailable. Generating fallback audio stream.', err);
      return this.getOrCreateMockStream();
    }
  }

  /**
   * Creates a synthetic audio stream (for testing without microphone or bot simulation)
   */
  getOrCreateMockStream() {
    this.ensureContext();
    if (this.mockDestinationStream) return this.mockDestinationStream;

    // Use Web Audio MediaStreamDestination to create a valid MediaStream
    const dest = this.audioContext.createMediaStreamDestination();

    // Create a gentle harmonic voice-like drone or subtle pulse generator
    const osc = this.audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.audioContext.currentTime); // A3 note

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.001, this.audioContext.currentTime); // start silent until test tone enabled

    // Modulator for organic pitch wobble (speech-like vibrato)
    const lfo = this.audioContext.createOscillator();
    lfo.frequency.setValueAtTime(4, this.audioContext.currentTime);
    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.setValueAtTime(15, this.audioContext.currentTime);
    lfo.connect(osc.frequency);
    lfo.start();

    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    this.testOscillator = osc;
    this.testGain = gain;
    this.mockDestinationStream = dest.stream;
    this.localStream = dest.stream;

    return dest.stream;
  }

  /**
   * Toggle synthetic voice test audio
   */
  toggleTestAudio(active) {
    this.ensureContext();
    if (!this.testGain) {
      this.getOrCreateMockStream();
    }

    this.isTestToneActive = active !== undefined ? active : !this.isTestToneActive;
    const now = this.audioContext.currentTime;

    if (this.testGain) {
      this.testGain.gain.cancelScheduledValues(now);
      this.testGain.gain.linearRampToValueAtTime(this.isTestToneActive ? 0.35 : 0.0001, now + 0.05);
    }

    return this.isTestToneActive;
  }

  /**
   * Mute or unmute the local audio track
   */
  toggleMute(muteState) {
    this.isMuted = muteState !== undefined ? muteState : !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  /**
   * Check if local user is currently speaking (for UI ripples)
   */
  getLocalSpeakingLevel() {
    if (this.isMuted) return 0;
    if (this.isTestToneActive) return 0.6;
    if (!this.localAnalyser || !this.localAnalyserData) return 0;

    this.localAnalyser.getByteFrequencyData(this.localAnalyserData);
    let sum = 0;
    for (let i = 0; i < this.localAnalyserData.length; i++) {
      sum += this.localAnalyserData[i];
    }
    const level = sum / (this.localAnalyserData.length * 255);
    return level > 0.08 ? level : 0; // threshold noise floor
  }

  /**
   * Register a remote peer's WebRTC audio stream into the spatial mixer
   */
  addPeerStream(peerId, stream) {
    this.ensureContext();
    if (this.spatialNodes.has(peerId)) {
      this.spatialNodes.get(peerId).destroy();
    }

    const node = new SpatialAudioNode(this.audioContext, peerId, stream);
    this.spatialNodes.set(peerId, node);
    return node;
  }

  /**
   * Update spatial audio positioning for a peer
   */
  updatePeerSpatial(peerId, distance, earshotRadius, relativeDeltaX, occlusion) {
    const node = this.spatialNodes.get(peerId);
    if (node) {
      node.updateSpatialParameters(distance, earshotRadius, relativeDeltaX, occlusion);
    }
  }

  /**
   * Remove peer from spatial mixer
   */
  removePeerStream(peerId) {
    if (this.spatialNodes.has(peerId)) {
      this.spatialNodes.get(peerId).destroy();
      this.spatialNodes.delete(peerId);
    }
  }

  /**
   * Get active peer spatial parameters for diagnostic radar display
   */
  getPeerAudioStats(peerId) {
    const node = this.spatialNodes.get(peerId);
    if (!node) return null;
    return {
      gain: node.currentGain,
      pan: node.currentPan,
      cutoff: node.currentCutoff,
      level: node.getAudioLevel(),
    };
  }

  cleanup() {
    this.spatialNodes.forEach((node) => node.destroy());
    this.spatialNodes.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
    }
  }
}

export const audioManager = new AudioManager();
export default audioManager;
