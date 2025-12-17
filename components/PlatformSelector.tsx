import React from 'react';
import { Platform } from '../types';

interface PlatformSelectorProps {
  selected: Platform;
  onChange: (platform: Platform) => void;
}

const platforms = Object.values(Platform);

export const PlatformSelector: React.FC<PlatformSelectorProps> = ({ selected, onChange }) => {
  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
            selected === p
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
};
