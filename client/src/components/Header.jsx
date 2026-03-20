import React from 'react';

const Header = () => {
  return (
    <header className="flex items-center justify-between border-b border-terminal-border bg-background-dark px-4 py-2">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-2xl">terminal</span>
          <h1 className="text-sm font-bold tracking-tighter uppercase">Root_Feed</h1>
        </div>
        <nav className="flex gap-1">
          <a className="px-3 py-1 text-xs font-medium rounded bg-primary/10 text-primary border border-primary/20" href="#">~/feed</a>
          <a className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors" href="#">~/explore</a>
          <a className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors" href="#">~/logs</a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
          <input 
            className="h-8 w-48 rounded border-none bg-terminal-gray pl-8 text-xs text-slate-300 focus:ring-1 focus:ring-primary/50 placeholder:text-slate-600" 
            placeholder="grep search..." 
            type="text" 
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="material-symbols-outlined text-sm text-primary">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
