import React from 'react';

const DashboardSidebar = () => {
  return (
    <aside className="w-64 border-r border-slate-border bg-slate-panel flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-background-dark">
          <span className="material-symbols-outlined text-sm font-bold">terminal</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-slate-100">OS_COMMUNITY</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 pb-2">Navigation</div>
        <a className="flex items-center gap-3 px-3 py-2 rounded bg-primary/10 text-primary border border-primary/20" href="#">
          <span className="material-symbols-outlined text-[20px]">grid_view</span>
          <span className="text-sm font-medium">Dashboard</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2 rounded text-slate-400 hover:bg-slate-border/50 hover:text-slate-100 transition-colors" href="#">
          <span className="material-symbols-outlined text-[20px]">forum</span>
          <span className="text-sm font-medium">Messages</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2 rounded text-slate-400 hover:bg-slate-border/50 hover:text-slate-100 transition-colors" href="#">
          <span className="material-symbols-outlined text-[20px]">hub</span>
          <span className="text-sm font-medium">Network Nodes</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2 rounded text-slate-400 hover:bg-slate-border/50 hover:text-slate-100 transition-colors" href="#">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-sm font-medium">System Prefs</span>
        </a>
      </nav>
      
      <div className="p-4 border-t border-slate-border">
        <div className="flex items-center gap-3 p-2 rounded hover:bg-slate-border/30 transition-colors cursor-pointer">
          <div className="relative">
            <div className="w-8 h-8 rounded bg-slate-border border border-primary/30 flex items-center justify-center overflow-hidden">
              <img 
                className="w-full h-full object-cover" 
                alt="User profile minimalist avatar" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCaad-F6KFRAuhS5KBicKZzWlCeGpWlDvxR1oTY3ABDGUFPFLyOYdGCoAmYoP-G7IyLvSojKHVTSUaRApCZqtubOE6XfU5qCq9T_b3rsPVnWA43GBKJV5VIOtfNcnp3ZqdbYw9OtOxx84XjtMcf_j0DnH2m1PAXZFfy5hdlUfDkCtjOmAZbqj3ErRF2AYZVIAZ30QsCMlPp9cQObi9XYl7xBCvYpMoNYmFf8apmh-CCVu1my2nRbe5HedofUw-_P_oap1BltbjOkh0"
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full border border-slate-panel"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-100 truncate">root@developer</p>
            <p className="text-[10px] text-primary/70">uptime: 14h 22m</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
