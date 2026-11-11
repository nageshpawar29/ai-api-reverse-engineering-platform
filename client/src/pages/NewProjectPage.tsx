import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  GitBranch,
  FileArchive,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Navbar } from '../components/layout/Navbar';

export const NewProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'zip' | 'github' | 'demo'>('zip');
  
  // ZIP Form
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  
  // Git Form
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');

  // Loading & Step states
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stepsList = [
    'Validating & Ingesting Codebase',
    'Safely Extracting Workspace',
    'Detecting Framework & Architecture',
    'Running AST Static Analysis (Routes & Handlers)',
    'Extracting Controllers & Middleware',
    'Analyzing Database Schemas & Models',
    'Running AI Reasoning Layer',
    'Generating OpenAPI, Postman & CI/CD Pipeline Flows',
  ];

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a ZIP file containing backend code');
      return;
    }

    const formData = new FormData();
    formData.append('archive', file);
    formData.append('name', projectName || file.name.replace(/\.zip$/i, ''));

    runIngestionWorkflow('/analysis/upload-zip', formData, true);
  };

  const handleGitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitUrl.trim()) {
      alert('Please enter a GitHub repository URL');
      return;
    }

    const payload = {
      repositoryUrl: gitUrl.trim(),
      branch: gitBranch.trim() || 'main',
      name: projectName.trim() || gitUrl.split('/').pop()?.replace(/\.git$/i, '') || 'Git Project',
    };

    runIngestionWorkflow('/analysis/clone-git', payload, false);
  };

  const handleDemoSubmit = async () => {
    runIngestionWorkflow('/analysis/load-demo', { name: 'Demo E-Commerce & Auth Backend' }, false);
  };

  const runIngestionWorkflow = async (endpoint: string, payload: any, isMultipart: boolean) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgress(15);
    setCurrentStep('Ingesting repository safely (AST static sandboxed)...');

    try {
      const res = await apiClient.post<{ projectId: string; status: string }>(
        endpoint,
        payload,
        isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
      );

      const projectId = res.data.projectId;

      // Poll analysis progress
      let completed = false;
      let attempts = 0;
      while (!completed && attempts < 60) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;

        const checkRes = await apiClient.get<{
          id: string;
          status: string;
          currentStep?: string;
          progressPercentage?: number;
          errorMessage?: string;
        }>(`/projects/${projectId}`);

        const data = checkRes.data;
        if (data.currentStep) setCurrentStep(data.currentStep);
        if (data.progressPercentage) setProgress(data.progressPercentage);

        if (data.status === 'completed') {
          completed = true;
          setProgress(100);
          setTimeout(() => {
            navigate(`/projects/${projectId}`);
          }, 800);
          return;
        } else if (data.status === 'failed') {
          throw new Error(data.errorMessage || 'Analysis failed during static parsing');
        }
      }

      // If finished polling
      navigate(`/projects/${projectId}`);
    } catch (err: any) {
      console.error('Ingestion error:', err);
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Analysis failed');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <div className="border-b border-white/[0.08] pb-6 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-mono mb-3 border border-indigo-500/25 shadow-sm">
            <Sparkles className="h-3 w-3" />
            <span>AST Static Analysis Engine • Zero Untrusted Execution</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Import Backend Project</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Upload an existing backend directory as a ZIP file or provide any public GitHub repository link. Supports Node.js, Next.js, Python (FastAPI/Flask/Django), Go (Gin/Fiber), Java (Spring Boot), PHP (Laravel), C# (.NET Core), and raw SQL tables with zero untrusted code execution.
          </p>
        </div>

        {/* Security Notice */}
        <div className="mb-8 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 backdrop-blur-md">
          <ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300">Untrusted Code Sandbox Guarantee:</strong> Uploaded source code is parsed in memory and analyzed via AST syntactic trees. <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">npm install</code>, <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">npm start</code>, and arbitrary build scripts are <span className="underline">never</span> executed on the host system.
          </div>
        </div>

        {isProcessing ? (
          <div className="p-8 rounded-2xl glass-card border border-white/[0.08] text-center shadow-2xl shadow-indigo-950/40">
            <div className="h-16 w-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Reverse-Engineering in Progress</h2>
            <p className="text-sm font-mono text-indigo-400 mb-6">{currentStep || 'Analyzing codebase...'}</p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden mb-8 max-w-md mx-auto border border-white/[0.06] p-0.5">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="max-w-md mx-auto space-y-2 text-left text-xs">
              {stepsList.map((step, idx) => {
                const stepNum = (idx + 1) * 12.5;
                const isDone = progress >= stepNum;
                const isCurrent = progress < stepNum && progress >= stepNum - 12.5;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      isDone
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : isCurrent
                        ? 'text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 font-semibold'
                        : 'text-slate-600 border border-transparent'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-700 flex-shrink-0" />
                    )}
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />
                <p className="text-xs text-rose-300 font-medium">{errorMessage}</p>
              </div>
            )}

            {/* Ingestion Method Tabs */}
            <div className="flex border-b border-white/[0.08] gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('zip')}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'zip'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileArchive className="h-4 w-4" />
                <span>ZIP Upload</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('github')}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'github'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitBranch className="h-4 w-4" />
                <span>GitHub Repository</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'demo'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>Instant Demo Backend</span>
              </button>
            </div>

            {/* ZIP Upload Tab */}
            {activeTab === 'zip' && (
              <form onSubmit={handleZipSubmit} className="space-y-6 p-6 rounded-2xl glass-card border border-white/[0.08]">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider font-mono">Project Name (Optional)</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. My Express API Service"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider font-mono">Select ZIP Archive</label>
                  <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-slate-950/60 transition-all cursor-pointer relative group">
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    {file ? (
                      <p className="text-sm font-semibold text-white">
                        Selected: <span className="text-indigo-400 font-mono">{file.name}</span> ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-200">Click to upload or drag & drop</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Supports <span className="text-indigo-400 font-semibold">Node.js</span>, <span className="text-emerald-400 font-semibold">Python</span>, <span className="text-cyan-400 font-semibold">Go</span>, and <span className="text-amber-400 font-semibold">Java</span>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!file}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01]"
                >
                  <span>Start Reverse-Engineering</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* GitHub Clone Tab */}
            {activeTab === 'github' && (
              <form onSubmit={handleGitSubmit} className="space-y-6 p-6 rounded-2xl glass-card border border-white/[0.08]">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider font-mono">Project Name (Optional)</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Acme API"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider font-mono">GitHub Repository URL</label>
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/username/express-backend-repo"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm font-mono transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider font-mono">Branch / Tag</label>
                  <input
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm font-mono transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!gitUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01]"
                >
                  <span>Clone & Analyze Repository</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Instant Demo Tab */}
            {activeTab === 'demo' && (
              <div className="p-6 rounded-2xl glass-card border border-white/[0.08] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Pre-packaged Express Demo Backend</h3>
                    <p className="text-xs text-slate-400">Includes Users, Authentication, Products, Orders, Services & Database Models</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  Test the complete reverse-engineering pipeline instantly without needing to upload your own files. The demo repository simulates a real-world multi-tiered Express API with JWT authentication, middleware chains, controller destructuring, and database relations.
                </p>

                <button
                  type="button"
                  onClick={handleDemoSubmit}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01]"
                >
                  <span>Run Instant Analysis on Demo Backend</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
