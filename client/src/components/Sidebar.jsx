import React from 'react';

const Sidebar = () => {
  return (
    <aside className="w-64 border-r border-terminal-border bg-background-dark/50 hidden lg:flex flex-col p-4 gap-6">
      <div className="space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-2">Sub-Processes</p>
        <div className="flex flex-col gap-1">
          <a className="group flex items-center gap-3 px-2 py-2 rounded hover:bg-terminal-gray transition-colors" href="#">
            <span className="material-symbols-outlined text-sm text-slate-500 group-hover:text-primary">star</span>
            <span className="text-sm text-slate-400 group-hover:text-slate-200">Featured</span>
          </a>
          <a className="group flex items-center gap-3 px-2 py-2 rounded hover:bg-terminal-gray transition-colors" href="#">
            <span className="material-symbols-outlined text-sm text-slate-500 group-hover:text-primary">trending_up</span>
            <span className="text-sm text-slate-400 group-hover:text-slate-200">Trending</span>
          </a>
          <a className="group flex items-center gap-3 px-2 py-2 rounded hover:bg-terminal-gray transition-colors" href="#">
            <span className="material-symbols-outlined text-sm text-slate-500 group-hover:text-primary">schedule</span>
            <span className="text-sm text-slate-400 group-hover:text-slate-200">Latest</span>
          </a>
        </div>
      </div>
      
      <div className="space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-2">Clusters</p>
        <div className="flex flex-col gap-1">
          <a className="flex items-center justify-between px-2 py-2 rounded hover:bg-terminal-gray text-slate-400 hover:text-slate-200 transition-colors text-sm" href="#">
            <span>#linux_kern</span>
            <span className="text-[10px] text-primary bg-primary/10 px-1 rounded">2.4k</span>
          </a>
          <a className="flex items-center justify-between px-2 py-2 rounded hover:bg-terminal-gray text-slate-400 hover:text-slate-200 transition-colors text-sm" href="#">
            <span>#ui_ux</span>
            <span className="text-[10px] text-slate-500">842</span>
          </a>
          <a className="flex items-center justify-between px-2 py-2 rounded hover:bg-terminal-gray text-slate-400 hover:text-slate-200 transition-colors text-sm" href="#">
            <span>#minimalist</span>
            <span className="text-[10px] text-slate-500">1.1k</span>
          </a>
        </div>
      </div>
      
      <div className="mt-auto p-4 rounded bg-terminal-gray/40 border border-terminal-border/50">
        <p className="text-[10px] text-slate-500 leading-relaxed italic">System Status: 100% Operational. Low memory overhead detected.</p>
      </div>
    </aside>
  );
};

export default Sidebar;
