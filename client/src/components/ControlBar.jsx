import React, { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Bot, Trash2, Sliders, Navigation, UserPlus } from 'lucide-react';

export function ControlBar({
  isMuted,
  onToggleMute,
  isTestAudioActive,
  onToggleTestAudio,
  earshotRadius,
  onChangeEarshotRadius,
  onSpawnBots,
  onClearBots,
  speakingLevel,
  botCount,
}) {
  const [showBotMenu, setShowBotMenu] = useState(false);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 pointer-events-auto">
      {/* Main Glass Control Dock */}
      <div className="glass-panel px-4 py-2.5 rounded-2xl flex items-center gap-3.5 shadow-2xl border border-white/10">
        {/* 1. Mic Mute / Unmute Toggle */}
        <button
          onClick={onToggleMute}
          className={`relative px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2.5 transition-all duration-200 ${
            isMuted
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
          <span>{isMuted ? 'Muted' : 'Speaking'}</span>

          {/* Dynamic Mic Level Visualizer Pip */}
          {!isMuted && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 transition-transform"
              style={{
                transform: `scale(${1 + Math.min(speakingLevel * 3, 2)})`,
                opacity: 0.4 + Math.min(speakingLevel * 2, 0.6),
              }}
            />
          )}
        </button>

        {/* 2. Synthetic Voice / Test Audio Check Toggle */}
        <button
          onClick={onToggleTestAudio}
          className={`px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
            isTestAudioActive
              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)] animate-pulse-subtle'
              : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-white/10'
          }`}
          title="Play continuous harmonic voice tone to test 3D spatial audio & distance attenuation without a microphone"
        >
          {isTestAudioActive ? (
            <Volume2 className="w-4 h-4 text-purple-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-400" />
          )}
          <span>{isTestAudioActive ? 'Test Voice: ON' : 'Test Voice: OFF'}</span>
        </button>

        <div className="w-px h-6 bg-white/10" />

        {/* 3. Earshot Radius Slider */}
        <div className="flex items-center gap-2 px-1">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex flex-col">
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
              <span>Earshot Radar</span>
              <span className="font-mono text-cyan-300 font-semibold">{earshotRadius}px</span>
            </div>
            <input
              type="range"
              min="100"
              max="280"
              step="10"
              value={earshotRadius}
              onChange={(e) => onChangeEarshotRadius(Number(e.target.value))}
              className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              title="Set maximum audio hearing radius"
            />
          </div>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* 4. Coworker Bot Spawner Menu (50+ User Scaling Test) */}
        <div className="relative">
          <button
            onClick={() => setShowBotMenu(!showBotMenu)}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all"
            title="Spawn simulated coworkers to test 50+ concurrent users mesh scaling"
          >
            <Bot className="w-4 h-4 text-blue-400" />
            <span>Simulate ({botCount})</span>
          </button>

          {/* Bot Dropdown Popup */}
          {showBotMenu && (
            <div className="absolute bottom-full mb-3 right-0 w-48 glass-panel p-2 rounded-xl shadow-2xl border border-white/15 flex flex-col gap-1 z-40">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-2 py-1">
                50+ User Mesh Test
              </div>
              <button
                onClick={() => {
                  onSpawnBots(5);
                  setShowBotMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-blue-500/20 rounded-lg flex items-center justify-between"
              >
                <span>Spawn +5 Coworkers</span>
                <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              </button>
              <button
                onClick={() => {
                  onSpawnBots(15);
                  setShowBotMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-blue-500/20 rounded-lg flex items-center justify-between"
              >
                <span>Spawn +15 Coworkers</span>
                <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              </button>
              {botCount > 0 && (
                <button
                  onClick={() => {
                    onClearBots();
                    setShowBotMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 rounded-lg flex items-center justify-between border-t border-white/5 mt-1 pt-1.5"
                >
                  <span>Clear All Bots</span>
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Movement Navigation Helper Pill */}
      <div className="glass-pill px-3 py-2 rounded-xl hidden lg:flex items-center gap-2 text-[11px] text-slate-400 shadow-md">
        <Navigation className="w-3.5 h-3.5 text-cyan-400" />
        <span>WASD or Click map to walk</span>
      </div>
    </div>
  );
}

export default ControlBar;
