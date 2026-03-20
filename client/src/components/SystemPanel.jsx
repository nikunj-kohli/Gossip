import React from 'react';

const SystemPanel = () => {
  return (
    <aside className="w-80 border-l border-terminal-border bg-background-dark/50 hidden xl:flex flex-col p-6 gap-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Processes</h3>
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
        </div>
        <div className="space-y-3">
          <div className="p-3 rounded bg-terminal-gray border border-terminal-border flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">CPU Usage</span>
              <span className="text-[10px] text-primary">12%</span>
            </div>
            <div className="w-full h-1 bg-background-dark rounded overflow-hidden">
              <div className="bg-primary h-full w-[12%]"></div>
            </div>
          </div>
          <div className="p-3 rounded bg-terminal-gray border border-terminal-border flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">RAM Usage</span>
              <span className="text-[10px] text-primary">48%</span>
            </div>
            <div className="w-full h-1 bg-background-dark rounded overflow-hidden">
              <div className="bg-primary h-full w-[48%]"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Activity</h3>
        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <span className="material-symbols-outlined text-primary text-sm mt-0.5">add_circle</span>
            <div className="text-[11px] leading-tight">
              <p className="text-slate-300 font-medium">New cluster #rust_dev created</p>
              <p className="text-slate-600 mt-1">4 minutes ago</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="material-symbols-outlined text-slate-500 text-sm mt-0.5">check_circle</span>
            <div className="text-[11px] leading-tight">
              <p className="text-slate-300 font-medium">Security patch applied v1.2.9</p>
              <p className="text-slate-600 mt-1">2 hours ago</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-auto">
        <div className="bg-primary/5 rounded border border-primary/20 p-4">
          <p className="text-xs font-bold text-primary mb-1">PRO_UPGRADE</p>
          <p className="text-[10px] text-slate-400 mb-3">Unlock advanced terminal themes and priority data fetching.</p>
          <button className="w-full py-2 bg-primary text-background-dark text-[10px] font-bold rounded uppercase tracking-tighter">Execute Upgrade</button>
        </div>
      </div>
    </aside>
  );
};

export default SystemPanel;
