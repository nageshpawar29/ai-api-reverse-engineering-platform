import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  Settings,
  RefreshCw,
  Trash2,
  FolderGit2,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { analysis, refreshAnalysis, loading } = useContext(ProjectContext);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading || !analysis) return null;
  const { project } = analysis;

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    setMessage(null);
    try {
      await apiClient.post(`/analysis/${project.id}/reanalyze`);
      setMessage('Project successfully re-analyzed and artifacts regenerated!');
      await refreshAnalysis();
    } catch (err: any) {
      alert('Re-analysis failed: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${project.name}" and all extracted metadata?`)) return;
    try {
      await apiClient.delete(`/projects/${project.id}`);
      navigate('/dashboard');
    } catch (err: any) {
      alert('Delete failed: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Settings className="h-7 w-7 text-indigo-400" />
          <span>Project Configuration</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage workspace settings, living documentation sync, and metadata storage.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 text-emerald-300 text-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Living Documentation Re-Analysis */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Living Documentation Sync</h3>
            <p className="text-xs text-slate-400 mt-1">
              Re-scan the project directory, detect code changes, and regenerate OpenAPI specs, Postman collections, and dependency graphs.
            </p>
          </div>

          <button
            onClick={handleReanalyze}
            disabled={isReanalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
          >
            {isReanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Re-Analyze Codebase</span>
          </button>
        </div>
      </div>

      {/* Project Metadata Info */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Workspace Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block mb-1">Project ID</span>
            <span className="text-slate-300">{project.id}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block mb-1">Detected Framework</span>
            <span className="text-emerald-400 uppercase font-semibold">{project.framework}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block mb-1">Source Type</span>
            <span className="text-slate-300 uppercase">{project.sourceType}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block mb-1">Analysis Created</span>
            <span className="text-slate-300">{new Date(project.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-rose-400">Danger Zone</h3>
            <p className="text-xs text-rose-200/70 mt-1">
              Permanently delete this project analysis and all reverse-engineered specs.
            </p>
          </div>

          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
