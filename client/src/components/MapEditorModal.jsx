import React, { useState } from 'react';
import { Map, X, Plus, Trash2, Save, RotateCcw, Box, Shield, Coffee, Users } from 'lucide-react';
import config from '../config.js';

export function MapEditorModal({ isOpen, onClose, officeMap, onUpdateMap }) {
  const [obstacles, setObstacles] = useState(officeMap?.obstacles || []);
  const [selectedType, setSelectedType] = useState('wall');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddObstacle = (type) => {
    const id = `obs-${Date.now()}`;
    let newObs = {
      id,
      name: `New ${type}`,
      type,
      x: 600,
      y: 500,
      width: 160,
      height: 20,
      soundAbsorption: 0.8,
      blocksMovement: true,
      color: '#334155',
    };

    if (type === 'glass-wall') {
      newObs.name = 'Glass Partition';
      newObs.soundAbsorption = 0.45;
      newObs.color = '#38bdf8';
    } else if (type === 'desk') {
      newObs.name = 'Workstation Desk';
      newObs.width = 200;
      newObs.height = 90;
      newObs.soundAbsorption = 0.25;
      newObs.color = '#475569';
    } else if (type === 'conference-table') {
      newObs.name = 'Meeting Table';
      newObs.width = 240;
      newObs.height = 120;
      newObs.soundAbsorption = 0.2;
      newObs.color = '#78350f';
    } else if (type === 'couch') {
      newObs.name = 'Lounge Sofa';
      newObs.width = 200;
      newObs.height = 80;
      newObs.soundAbsorption = 0.3;
      newObs.color = '#047857';
    }

    const updated = [...obstacles, newObs];
    setObstacles(updated);
    if (onUpdateMap) onUpdateMap({ ...officeMap, obstacles: updated });
  };

  const handleRemoveObstacle = (id) => {
    const updated = obstacles.filter((o) => o.id !== id);
    setObstacles(updated);
    if (onUpdateMap) onUpdateMap({ ...officeMap, obstacles: updated });
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${config.SERVER_URL}/api/maps/${officeMap.roomId || 'default-office'}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obstacles,
          zones: officeMap.zones,
          dimensions: officeMap.dimensions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Office layout and acoustic obstacles saved to MongoDB successfully!');
      }
    } catch (err) {
      alert('Error saving to MongoDB: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset office layout to default factory floor plan?')) return;
    try {
      const res = await fetch(`${config.SERVER_URL}/api/maps/${officeMap.roomId || 'default-office'}/reset`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.map) {
        setObstacles(data.map.obstacles);
        if (onUpdateMap) onUpdateMap(data.map);
      }
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Map className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Office Layout & Sound Obstacle Editor</h2>
              <p className="text-[11px] text-slate-400">
                Configure acoustic obstacles and persist into MongoDB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Quick Add Palette */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-300">Add Acoustic Obstacles:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleAddObstacle('wall')}
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/5 flex flex-col items-center gap-1.5 transition-all"
              >
                <Shield className="w-5 h-5 text-slate-400" />
                <span className="font-semibold text-slate-200">Solid Wall</span>
                <span className="text-[10px] text-slate-500">85% Sound Block</span>
              </button>

              <button
                onClick={() => handleAddObstacle('glass-wall')}
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/5 flex flex-col items-center gap-1.5 transition-all"
              >
                <Box className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold text-slate-200">Glass Partition</span>
                <span className="text-[10px] text-cyan-500">45% Sound Block</span>
              </button>

              <button
                onClick={() => handleAddObstacle('conference-table')}
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/5 flex flex-col items-center gap-1.5 transition-all"
              >
                <Users className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-slate-200">Meeting Table</span>
                <span className="text-[10px] text-amber-600">20% Sound Block</span>
              </button>

              <button
                onClick={() => handleAddObstacle('couch')}
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/5 flex flex-col items-center gap-1.5 transition-all"
              >
                <Coffee className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-slate-200">Lounge Couch</span>
                <span className="text-[10px] text-emerald-500">30% Sound Block</span>
              </button>
            </div>
          </div>

          {/* Active Obstacles List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-300">
              Active Obstacles & Sound Barriers ({obstacles.length}):
            </h3>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {obstacles.map((obs) => (
                <div
                  key={obs.id}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: obs.color || '#334155' }}
                    />
                    <div>
                      <span className="font-semibold text-slate-200">{obs.name}</span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        [{obs.x}, {obs.y}] • {obs.width}x{obs.height}px
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {Math.round((obs.soundAbsorption || 0.8) * 100)}% acoustic block
                    </span>
                    <button
                      onClick={() => handleRemoveObstacle(obs.id)}
                      className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={handleResetDefaults}
            className="text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition-all hover:bg-white/5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Floor Plan</span>
          </button>

          <button
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 text-xs transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Layout to MongoDB'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MapEditorModal;
