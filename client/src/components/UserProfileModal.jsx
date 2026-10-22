import React, { useState } from 'react';
import { User, X, Check, Palette } from 'lucide-react';

export function UserProfileModal({ isOpen, onClose, user, onSave }) {
  const [name, setName] = useState(user?.name || 'Infotact Teammate');
  const [color, setColor] = useState(user?.color || '#3b82f6');

  if (!isOpen) return null;

  const colorPalette = [
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#8b5cf6', // Purple
    '#6366f1', // Indigo
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave({ name, color });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Avatar Profile</h2>
              <p className="text-[11px] text-slate-400">Customize your virtual office identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-xl border-2 border-white/30"
              style={{ backgroundColor: color }}
            >
              {(name || 'U')[0].toUpperCase()}
            </div>
            <span className="text-slate-300 font-semibold">{name}</span>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-medium">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500 text-xs"
              placeholder="e.g. Alex Johnson"
              maxLength={30}
              required
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="text-slate-400 font-medium flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              Avatar Color Accent
            </label>
            <div className="flex items-center gap-2.5 justify-between">
              {colorPalette.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                    color === c ? 'scale-110 ring-2 ring-white shadow-lg' : 'hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all text-xs"
          >
            Update Profile
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserProfileModal;
