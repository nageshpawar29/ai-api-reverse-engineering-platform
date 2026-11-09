import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Terminal, Plus, Sparkles, FolderGit2, Cpu, Activity } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const isNavActive = (path: string) => {
    if (path === '/dashboard') return location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/projects');
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-slate-950/75 backdrop-blur-xl transition-all">
      <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur-sm group-hover:opacity-100 transition duration-300" />
              <div className="relative h-9 w-9 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center text-indigo-400 group-hover:text-white group-hover:scale-105 transition-all">
                <Terminal className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                  Reverse<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">API</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>v2.4 AI</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide">Multi-Lang AST Engine</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1.5 pl-6 border-l border-white/[0.08]">
            <Link
              to="/dashboard"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                isNavActive('/dashboard')
                  ? 'bg-white/[0.08] text-white border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/projects/new"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                location.pathname === '/projects/new'
                  ? 'bg-white/[0.08] text-white border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              Import Repository
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Real-time AST Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/[0.06] text-[11px] font-mono text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300">Analyzer Online</span>
          </div>

          <Link
            to="/projects/new"
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all overflow-hidden shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 transition-all"></span>
            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></span>
            <Plus className="relative h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
            <span className="relative">New Analysis</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
