/**
 * SpatialAudioNode manages the Web Audio API processing chain for a single peer:
 * MediaStreamSource -> BiquadFilter (Wall Occlusion) -> GainNode (Distance Dropoff) -> StereoPannerNode -> Master Output
 */
export class SpatialAudioNode {
  constructor(audioContext, peerId, stream) {
    this.audioContext = audioContext;
    this.peerId = peerId;
    this.stream = stream;

    // 1. Media Stream Source
    this.source = this.audioContext.createMediaStreamSource(stream);

    // 2. Acoustic Filter Node (simulates wall / obstacle muffling)
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(20000, this.audioContext.currentTime);
    this.filterNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);

    // 3. Distance Attenuation Gain Node
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    // 4. 3D Stereo Panner Node (-1.0 left ear to +1.0 right ear)
    // Fallback gracefully if StereoPanner is not supported in some older environments
    if (typeof this.audioContext.createStereoPanner === 'function') {
      this.pannerNode = this.audioContext.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0, this.audioContext.currentTime);
    } else {
      // Create unity dummy node
      this.pannerNode = this.audioContext.createGain();
    }

    // 5. Analyser for speech volume visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

    // Connect pipeline:
    // Source -> Filter -> Gain -> Panner -> Analyser -> Destination
    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.currentGain = 1.0;
    this.currentPan = 0;
    this.currentCutoff = 20000;
  }

  /**
   * Update spatial audio parameters dynamically based on relative position & obstacles
   * @param {number} distance - Euclidean distance in pixels
   * @param {number} earshotRadius - maximum audible distance in pixels
   * @param {number} relativeDeltaX - peer.x - listener.x (for stereo left/right separation)
   * @param {object} occlusion - { isOccluded: boolean, absorption: number, filterCutoff: number }
   */
  updateSpatialParameters(distance, earshotRadius, relativeDeltaX, occlusion) {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const now = this.audioContext.currentTime;
    const rampTime = 0.05; // 50ms smooth exponential ramp to prevent audio clicks/pops

    // 1. Distance Attenuation Calculation (Cosine smoothstep / inverse roll-off)
    let targetGain = 0;
    if (distance <= earshotRadius) {
      // Normalize distance: 0 (right next to user) to 1.0 (edge of earshot circle)
      const normDist = Math.max(0, Math.min(1.0, distance / earshotRadius));
      // Cosine dropoff curve: full volume at center, organic fade-out towards perimeter
      targetGain = Math.cos((normDist * Math.PI) / 2);
    }

    // Apply obstacle dampening if blocked by walls
    if (occlusion && occlusion.isOccluded) {
      targetGain *= Math.max(0.1, 1 - (occlusion.absorption || 0.8) * 0.75);
    }

    // Smooth gain change
    this.currentGain = targetGain;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + rampTime);

    // 2. 3D Stereo Panning
    // Map relative X (-earshot to +earshot) to pan value (-1.0 to +1.0)
    let targetPan = 0;
    if (earshotRadius > 0) {
      const panSpread = earshotRadius * 0.8;
      targetPan = Math.max(-1.0, Math.min(1.0, relativeDeltaX / panSpread));
    }
    this.currentPan = targetPan;

    if (this.pannerNode.pan) {
      this.pannerNode.pan.cancelScheduledValues(now);
      this.pannerNode.pan.linearRampToValueAtTime(targetPan, now + rampTime);
    }

    // 3. Acoustic Wall Occlusion Low-pass Filter
    const targetCutoff = occlusion && occlusion.isOccluded ? occlusion.filterCutoff : 20000;
    this.currentCutoff = targetCutoff;

    this.filterNode.frequency.cancelScheduledValues(now);
    this.filterNode.frequency.exponentialRampToValueAtTime(
      Math.max(200, Math.min(20000, targetCutoff)),
      now + rampTime
    );
  }

  /**
   * Returns current audio activity level (0.0 to 1.0) for visualizer
   */
  getAudioLevel() {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.analyserData);
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      sum += this.analyserData[i];
    }
    const avg = sum / this.analyserData.length;
    return avg / 255;
  }

  /**
   * Clean up and disconnect all Web Audio nodes
   */
  destroy() {
    try {
      this.source.disconnect();
      this.filterNode.disconnect();
      this.gainNode.disconnect();
      this.pannerNode.disconnect();
      this.analyser.disconnect();
    } catch (e) {
      console.warn('Error disconnecting spatial node:', e);
    }
  }
}
