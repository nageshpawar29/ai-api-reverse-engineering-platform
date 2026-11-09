import React, { useContext, useEffect, useState } from 'react';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  TestTube2,
  Download,
  Copy,
  Check,
  Code,
  Terminal,
  FileCode,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const TestsPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [testContent, setTestContent] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!analysis?.project?.id) return;

    const fetchTests = async () => {
      try {
        setIsFetching(true);
        const res = await apiClient.get(`/artifacts/${analysis.project.id}/jest_tests`, {
          responseType: 'text',
        });
        setTestContent(res.data);
      } catch (err) {
        console.error('Failed to load generated tests:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchTests();
  }, [analysis?.project?.id]);

  const handleDownload = () => {
    if (!analysis?.project || !testContent) return;
    const blob = new Blob([testContent], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.project.name.toLowerCase().replace(/\s+/g, '_')}.api.test.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(testContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || isFetching) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">Synthesizing Jest & Supertest suites...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <TestTube2 className="h-7 w-7 text-indigo-400" />
            <span>Automated Test Suite Generator</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Starter Jest & Supertest test cases synthesized directly from discovered route parameters, auth gates, and response schemas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>Copy Test Code</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Download .test.ts</span>
          </button>
        </div>
      </div>

      {/* Test Strategy Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="font-semibold text-emerald-400 mb-1">Happy Path Testing</div>
          <p className="text-slate-400">Asserts valid status codes (200/201) and JSON response payload shapes.</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="font-semibold text-amber-400 mb-1">Auth Gate Verification</div>
          <p className="text-slate-400">Verifies 401 Unauthorized occurs when bearer tokens are omitted on protected endpoints.</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="font-semibold text-rose-400 mb-1">Boundary & Not-Found Cases</div>
          <p className="text-slate-400">Tests 400 Bad Request on missing mandatory fields and 404 on invalid paths.</p>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 font-mono text-xs overflow-x-auto text-slate-300">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
          <div className="flex items-center gap-2 text-slate-400">
            <FileCode className="h-4 w-4 text-indigo-400" />
            <span>tests/api.test.ts (Jest + Supertest)</span>
          </div>
          <span className="text-[11px] text-slate-500">Auto-Generated</span>
        </div>
        <pre>{testContent}</pre>
      </div>
    </div>
  );
};
