import React from 'react';
import { Volume2, Activity, Map, Radio, Users, Settings, Cpu, ShieldCheck, LayoutDashboard, Compass } from 'lucide-react';

export function TopNavigation({
  socketConnected,
  peerCount,
  earshotCount,
  onOpenAudit,
  onToggleEditor,
  isEditorOpen,
  onToggleRadar,
  isRadarOpen,
  onOpenProfile,
  currentUser,
  activeTab = 'map',
  onTabChange,
}) {
  return (
    <header className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
      {/* Brand & Room Info */}
      <div className="glass-panel px-4 py-2.5 rounded-2xl flex items-center gap-3.5 pointer-events-auto">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Volume2 className="w-5 h-5 text-white animate-pulse-subtle" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-wide text-white">ProxiSpeak</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
              v2.0 Spatial Audio
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Infotact Headquarters • Virtual Floor</p>
        </div>
      </div>

      {/* View Mode Toggle: Virtual Map vs Analytics Dashboard */}
      <div className="glass-panel p-1 rounded-2xl flex items-center gap-1 pointer-events-auto shadow-md">
        <button
          onClick={() => onTabChange && onTabChange('map')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'map'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Office Map</span>
        </button>

        <button
          onClick={() => onTabChange && onTabChange('dashboard')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Center Status Indicators */}
      <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-4 text-xs pointer-events-auto hidden lg:flex">
        {/* Socket Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              socketConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-400'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {socketConnected ? 'Signaling Live' : 'Connecting...'}
          </span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Total Users in Room */}
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>{peerCount + 1} Coworkers</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Earshot Count */}
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">{earshotCount} in Earshot</span>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Spatial Benchmark Audit Button */}
        <button
          onClick={onOpenAudit}
          className="glass-panel hover:bg-slate-800/80 text-cyan-300 hover:text-cyan-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border border-cyan-500/20 hover:border-cyan-500/40 shadow-sm"
          title="Run Geospatial Benchmark (<20ms Audit)"
        >
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Spatial Audit</span>
        </button>

        {/* Map & Obstacle Editor Button */}
        <button
          onClick={onToggleEditor}
          className={`glass-panel px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
            isEditorOpen
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
              : 'hover:bg-slate-800/80 text-slate-300 border-white/10'
          }`}
          title="Edit Office Furniture & Sound Walls"
        >
          <Map className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Office Layout</span>
        </button>

        {/* Peer Radar Drawer Toggle */}
        <button
          onClick={onToggleRadar}
          className={`glass-panel px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
            isRadarOpen
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
              : 'hover:bg-slate-800/80 text-slate-300 border-white/10'
          }`}
          title="Toggle Proximity Audio Radar"
        >
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Radar</span>
        </button>

        {/* User Profile */}
        <button
          onClick={onOpenProfile}
          className="glass-panel hover:bg-slate-800/80 p-2 rounded-xl text-xs flex items-center gap-2 transition-all border border-white/10"
          title="Customize Avatar & Earshot"
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner"
            style={{ backgroundColor: currentUser?.color || '#3b82f6' }}
          >
            {(currentUser?.name || 'U')[0]}
          </div>
          <Settings className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </header>
  );
}

export default TopNavigation;
