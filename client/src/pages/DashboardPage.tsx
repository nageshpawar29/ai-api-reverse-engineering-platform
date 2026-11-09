import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  FolderGit2,
  Layers,
  ShieldAlert,
  Clock,
  Trash2,
  ArrowRight,
  Loader2,
  Sparkles,
  Database,
  ExternalLink,
  Search,
  CheckCircle2,
  FileCode2,
  PlaySquare,
  Workflow,
  Cpu,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Project } from '../types';
import { Navbar } from '../components/layout/Navbar';

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('ALL');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ projects: Project[] }>('/projects');
      setProjects(res.data.projects || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      setError(err.response?.data?.error?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project analysis?')) return;

    try {
      await apiClient.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert('Failed to delete project: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.framework.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFramework =
      frameworkFilter === 'ALL' ||
      p.framework.toLowerCase() === frameworkFilter.toLowerCase();

    return matchesSearch && matchesFramework;
  });

  const getFrameworkColor = (framework: string) => {
    const fw = framework.toLowerCase();
    if (fw.includes('express') || fw.includes('node')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    } else if (fw.includes('fastapi') || fw.includes('flask')) {
      return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    } else if (fw.includes('django')) {
      return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
    } else if (fw.includes('gin') || fw.includes('go')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    } else if (fw.includes('spring') || fw.includes('java')) {
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    }
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Analyzed Projects</h1>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                {projects.length} Total
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Manage your reverse-engineered backend repositories, OpenAPI contracts, and architecture maps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/projects/new"
              className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Import Repository</span>
            </Link>
          </div>
        </div>

        {/* Dashboard Stats Overview */}
        {projects.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl glass-card border border-white/[0.08] relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
                <span>Active Repositories</span>
                <FolderGit2 className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">{projects.length}</div>
              <div className="text-[11px] text-indigo-400 mt-1 font-mono">AST Extracted</div>
            </div>

            <div className="p-4 rounded-2xl glass-card border border-white/[0.08] relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
                <span>Parser Pipeline</span>
                <Cpu className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">Multi-Lang</div>
              <div className="text-[11px] text-emerald-400 mt-1 font-mono">Babel • AST • Static</div>
            </div>

            <div className="p-4 rounded-2xl glass-card border border-white/[0.08] relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
                <span>Spec Generation</span>
                <FileCode2 className="h-4 w-4 text-sky-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">OpenAPI 3.0</div>
              <div className="text-[11px] text-sky-400 mt-1 font-mono">JSON & YAML Sync</div>
            </div>

            <div className="p-4 rounded-2xl glass-card border border-white/[0.08] relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
                <span>Analysis Engine</span>
                <Sparkles className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">Grounded AI</div>
              <div className="text-[11px] text-purple-400 mt-1 font-mono">Deterministic + LLM</div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        {projects.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-2xl bg-slate-900/60 border border-white/[0.08] backdrop-blur-md">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search projects by name or framework..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-white/[0.08] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-sans"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['ALL', 'express', 'fastapi', 'django', 'gin', 'spring'].map((fw) => (
                <button
                  key={fw}
                  onClick={() => setFrameworkFilter(fw)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                    frameworkFilter.toLowerCase() === fw.toLowerCase()
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {fw.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400 font-mono">Inspecting analyzed workspaces...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-center">
            <p className="text-rose-400 font-medium">{error}</p>
            <button
              onClick={fetchProjects}
              className="mt-3 px-4 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-900/40 backdrop-blur-md">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
              <FolderGit2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {projects.length === 0 ? 'No projects analyzed yet' : 'No matching projects found'}
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
              {projects.length === 0
                ? 'Upload a backend ZIP repository (Node.js, Python, Go, or Java) or provide a Git URL to begin automated AST extraction.'
                : 'Try adjusting your search query or framework filter.'}
            </p>
            {projects.length === 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/projects/new"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 hover:scale-[1.02]"
                >
                  Import First Repository
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((proj) => (
              <div
                key={proj.id}
                className="group relative flex flex-col p-5 rounded-2xl glass-card border border-white/[0.08] hover:border-indigo-500/40 transition-all overflow-hidden"
              >
                {/* Accent top line on hover */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${getFrameworkColor(proj.framework)}`}>
                      {proj.framework}
                    </span>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors mt-2 truncate" title={proj.name}>
                      {proj.name}
                    </h3>
                  </div>

                  <button
                    onClick={(e) => handleDelete(proj.id, e)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-4 flex-1">
                  {proj.description || 'Reverse-engineered backend codebase with static AST route parsing.'}
                </p>

                {/* Quick Tool Links */}
                <div className="grid grid-cols-3 gap-1.5 mb-4 p-1.5 rounded-xl bg-slate-950/60 border border-white/[0.05]">
                  <Link
                    to={`/projects/${proj.id}/swagger`}
                    className="flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <FileCode2 className="h-3 w-3 text-indigo-400" />
                    <span>Swagger</span>
                  </Link>
                  <Link
                    to={`/projects/${proj.id}/graph`}
                    className="flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Workflow className="h-3 w-3 text-sky-400" />
                    <span>Flow</span>
                  </Link>
                  <Link
                    to={`/projects/${proj.id}/playground`}
                    className="flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <PlaySquare className="h-3 w-3 text-purple-400" />
                    <span>Play</span>
                  </Link>
                </div>

                {/* Footer status & entry */}
                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        proj.status === 'completed'
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : proj.status === 'analyzing'
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-rose-400'
                      }`}
                    />
                    <span className="capitalize text-[11px] text-slate-300">{proj.status}</span>
                  </span>

                  <Link
                    to={`/projects/${proj.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 group-hover:translate-x-1 transition-all"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
