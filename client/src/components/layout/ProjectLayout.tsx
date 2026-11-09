import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { apiClient } from '../../api/client';
import { ProjectAnalysis } from '../../types';
import { Loader2 } from 'lucide-react';

export const ProjectContext = React.createContext<{
  analysis: ProjectAnalysis | null;
  refreshAnalysis: () => Promise<void>;
  loading: boolean;
}>({
  analysis: null,
  refreshAnalysis: async () => {},
  loading: true,
});

export const ProjectLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiClient.get<ProjectAnalysis>(`/projects/${id}/analysis`);
      setAnalysis(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching project analysis:', err);
      setError(err.response?.data?.error?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar projectName={analysis?.project?.name} />
        <main className="flex-1 bg-slate-900/40 p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <ProjectContext.Provider value={{ analysis, refreshAnalysis: fetchAnalysis, loading }}>
            {loading && !analysis ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-400">Loading project metadata...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center max-w-lg mx-auto mt-12">
                <h3 className="text-lg font-semibold text-rose-400">Failed to load project</h3>
                <p className="text-sm text-rose-200/80 mt-2">{error}</p>
              </div>
            ) : (
              <Outlet />
            )}
          </ProjectContext.Provider>
        </main>
      </div>
    </div>
  );
};
