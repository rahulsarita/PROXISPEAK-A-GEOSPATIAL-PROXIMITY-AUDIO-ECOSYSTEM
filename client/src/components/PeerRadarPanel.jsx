import React from 'react';
import { Radio, X, Volume2, ShieldAlert, Headphones, Wifi } from 'lucide-react';

export function PeerRadarPanel({
  isOpen,
  onClose,
  spatialPeers = [],
  peerConnectionStates = new Map(),
  earshotRadius = 180,
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-20 right-4 w-80 max-h-[calc(100vh-140px)] glass-panel rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden border border-white/10 pointer-events-auto">
      {/* Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h2 className="font-bold text-xs text-white uppercase tracking-wider">Spatial Audio Radar</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content list */}
      <div className="p-3 overflow-y-auto space-y-2.5 flex-1 text-xs">
        {spatialPeers.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="font-medium text-slate-300">No peers in earshot</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Walk closer to colleagues within {earshotRadius}px to automatically trigger WebRTC audio crossfade.
            </p>
          </div>
        ) : (
          spatialPeers.map((peer) => {
            const webrtcState = peerConnectionStates.get(peer.peerUserId) || 'connected';
            const isOccluded = peer.occlusion && peer.occlusion.isOccluded;
            const panPercent = Math.round(peer.pan * 100);
            const panText =
              panPercent < -10
                ? `${Math.abs(panPercent)}% Left`
                : panPercent > 10
                ? `${panPercent}% Right`
                : 'Center';

            return (
              <div
                key={peer.peerUserId}
                className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-2"
              >
                {/* Peer Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                    <span className="font-semibold text-slate-200">{peer.peerName}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{peer.distance} px</span>
                </div>

                {/* Spatial Audio Attenuation Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-cyan-400" />
                      Dynamic Gain:
                    </span>
                    <span className="font-mono font-bold text-cyan-300">
                      {Math.round(peer.gain * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all duration-150"
                      style={{ width: `${Math.min(100, peer.gain * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stereo Pan & Filter Status */}
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Headphones className="w-3 h-3 text-purple-400" />
                    <span>Pan: {panText}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="capitalize">Mesh: {webrtcState}</span>
                  </div>
                </div>

                {/* Wall Acoustic Occlusion Badge */}
                {isOccluded ? (
                  <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>Sound Occluded (Wall)</span>
                    </div>
                    <span className="font-mono text-rose-400">
                      LPF: {peer.occlusion.filterCutoff}Hz
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Direct line-of-sight acoustics</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-slate-950/60 border-t border-white/5 text-[10px] text-slate-400 text-center font-mono">
        Active P2P Earshot Radius: {earshotRadius}px
      </div>
    </div>
  );
}

export default PeerRadarPanel;
