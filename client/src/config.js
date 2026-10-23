export const config = {
  SERVER_URL: window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://proxispeak-a-geospatial-proximity-audio-ydgn.onrender.com',
  DEFAULT_ROOM_ID: 'default-office',
  CANVAS: {
    WIDTH: 2400,
    HEIGHT: 1600,
    GRID_SIZE: 40,
    FPS_TARGET: 60,
  },
  AUDIO: {
    DEFAULT_EARSHOT_RADIUS: 180, // pixels
    MIN_EARSHOT_RADIUS: 80,
    MAX_EARSHOT_RADIUS: 300,
    ROLLOFF_FACTOR: 1.5,
    OCCLUDED_LOWPASS_MIN_HZ: 350,
    MAX_FREQ_HZ: 20000,
  },
  WEBRTC: {
    ICE_SERVERS: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
};

export default config;
