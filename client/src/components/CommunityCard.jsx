import React from 'react';

const CommunityCard = ({ name, version, description, peers, icon, locked = false }) => {
  if (locked) {
    return (
      <div className="group bg-slate-panel/50 border border-dashed border-slate-border rounded-lg p-5 transition-all cursor-not-allowed opacity-80">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded bg-slate-border/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-600 text-2xl">lock</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-500">{name}</h3>
            <p className="text-xs text-slate-600 font-mono">{version}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mb-6 line-clamp-2">{description}</p>
        <div className="flex items-center justify-between pt-4 border-t border-slate-border/50">
          <div className="flex -space-x-2 opacity-50">
            <div className="w-6 h-6 rounded-full border border-slate-panel bg-slate-800"></div>
          </div>
          <span className="text-[10px] font-mono text-slate-600 bg-slate-border/20 px-2 py-0.5 rounded border border-slate-border">system_only</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-slate-panel border border-slate-border hover:border-primary/40 rounded-lg p-5 transition-all cursor-pointer relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="material-symbols-outlined text-slate-500 hover:text-primary text-sm">open_in_new</span>
      </div>
      
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded bg-slate-border flex items-center justify-center group-hover:bg-primary/5 transition-colors">
          <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-100">{name}</h3>
          <p className="text-xs text-slate-500 font-mono">{version}</p>
        </div>
      </div>
      
      <p className="text-xs text-slate-400 leading-relaxed mb-6 line-clamp-2">{description}</p>
      
      <div className="flex items-center justify-between pt-4 border-t border-slate-border/50">
        <div className="flex -space-x-2">
          <div className="w-6 h-6 rounded-full border border-slate-panel bg-slate-700"></div>
          <div className="w-6 h-6 rounded-full border border-slate-panel bg-slate-600"></div>
          <div className="w-6 h-6 rounded-full border border-slate-panel bg-primary/20 flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">+{peers > 999 ? '2k' : peers > 99 ? '8' : '4'}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{peers}_peers</span>
      </div>
    </div>
  );
};

export default CommunityCard;
