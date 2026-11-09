import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  Send,
  Download,
  Copy,
  Check,
  Code,
  FolderTree,
  ExternalLink,
  Layers,
  Loader2,
  BookOpen,
  Terminal,
  HelpCircle,
  PlaySquare,
  KeyRound,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { apiClient } from '../api/client';

export const PostmanPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [collection, setCollection] = useState<any>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedNewman, setCopiedNewman] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'guide' | 'vars' | 'json'>('requests');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!analysis?.project?.id) return;

    const fetchPostman = async () => {
      try {
        setIsFetching(true);
        const res = await apiClient.get(`/artifacts/${analysis.project.id}/postman.json`);
        setCollection(res.data);
      } catch (err) {
        console.error('Failed to load Postman collection:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchPostman();
  }, [analysis?.project?.id]);

  const handleDownload = () => {
    if (!analysis?.project || !collection) return;
    const content = JSON.stringify(collection, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.project.name.toLowerCase().replace(/\s+/g, '_')}_postman_collection.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!collection) return;
    navigator.clipboard.writeText(JSON.stringify(collection, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyNewmanCommand = () => {
    const fileName = `${analysis?.project?.name?.toLowerCase().replace(/\s+/g, '_') || 'api'}_postman_collection.json`;
    const cmd = `newman run ${fileName} --env-var "baseUrl=http://localhost:3000" --env-var "bearerToken=<YOUR_TOKEN>"`;
    navigator.clipboard.writeText(cmd);
    setCopiedNewman(true);
    setTimeout(() => setCopiedNewman(false), 2000);
  };

  if (loading || isFetching) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        <p className="text-sm text-slate-400">Synthesizing Postman v2.1.0 Collection...</p>
      </div>
    );
  }

  const items = collection?.item || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Send className="h-6 w-6" />
            </div>
            <span>Postman Collection v2.1.0</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Automated Postman Collection synthesis with environment variables, query parameters, auth tokens, and sample bodies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/10 text-xs font-semibold transition-all backdrop-blur-md"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>Copy JSON</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-600/25 transition-all hover:scale-[1.02]"
          >
            <Download className="h-4 w-4" />
            <span>Download Collection (.json)</span>
          </button>
        </div>
      </div>

      {/* Collection Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-card border border-white/[0.08]">
          <div className="text-xs text-slate-400 font-mono">Collection Name</div>
          <div className="text-sm font-bold text-white mt-1 truncate">{collection?.info?.name || 'API Collection'}</div>
        </div>
        <div className="p-4 rounded-2xl glass-card border border-white/[0.08]">
          <div className="text-xs text-slate-400 font-mono">Schema Standard</div>
          <div className="text-sm font-bold text-amber-400 mt-1">Postman Collection v2.1.0</div>
        </div>
        <div className="p-4 rounded-2xl glass-card border border-white/[0.08]">
          <div className="text-xs text-slate-400 font-mono">Total Requests</div>
          <div className="text-sm font-bold text-white mt-1">{items.length} Endpoints Discovered</div>
        </div>
        <div className="p-4 rounded-2xl glass-card border border-white/[0.08]">
          <div className="text-xs text-slate-400 font-mono">CI/CD Runner</div>
          <div className="text-sm font-bold text-emerald-400 mt-1">Newman CLI Ready</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderTree className="h-4 w-4" />
          <span>Discovered Requests ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`pb-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'guide'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Postman Guide & Usage</span>
        </button>

        <button
          onClick={() => setActiveTab('vars')}
          className={`pb-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'vars'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Variables & Environments</span>
        </button>

        <button
          onClick={() => setActiveTab('json')}
          className={`pb-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'json'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code className="h-4 w-4" />
          <span>Raw Collection JSON</span>
        </button>
      </div>

      {/* TAB 1: REQUESTS LIST */}
      {activeTab === 'requests' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-amber-400" />
              <span>Endpoints Packaged in Collection</span>
            </h2>

            <span className="text-xs text-slate-400 font-mono">
              Click any endpoint to inspect headers, URL variables & bodies
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item: any, idx: number) => {
              const req = item.request || {};
              const method = req.method || 'GET';
              const rawUrl = req.url?.raw || req.url || '';
              const isExpanded = expandedIndex === idx;

              return (
                <div
                  key={idx}
                  className="rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-slate-500">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          method === 'GET'
                            ? 'badge-get'
                            : method === 'POST'
                            ? 'badge-post'
                            : method === 'PUT'
                            ? 'badge-put'
                            : method === 'PATCH'
                            ? 'badge-patch'
                            : 'badge-delete'
                        }`}
                      >
                        {method}
                      </span>
                      <span className="text-slate-200 font-medium font-mono text-xs">{item.name || rawUrl}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px] font-mono hidden md:inline truncate max-w-sm">
                        {rawUrl}
                      </span>

                      <Link
                        to={`/projects/${analysis?.project?.id}/playground`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/20 text-[11px] font-mono transition-colors"
                      >
                        <PlaySquare className="h-3 w-3" />
                        <span>Playground</span>
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Item Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 space-y-4 text-xs font-mono">
                      {item.request?.description && (
                        <p className="text-slate-300 font-sans text-xs">{item.request.description}</p>
                      )}

                      {/* URL & Headers */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-[11px] text-slate-400 font-semibold mb-1">Target URL Template:</div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-indigo-300">
                            {rawUrl}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400 font-semibold mb-1">Authentication:</div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-amber-300">
                            {req.auth ? 'Bearer Token ({{bearerToken}})' : 'None (Public Endpoint)'}
                          </div>
                        </div>
                      </div>

                      {/* Sample Request Body */}
                      {req.body?.raw && (
                        <div>
                          <div className="text-[11px] text-slate-400 font-semibold mb-1">Pre-configured Request Body (JSON):</div>
                          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 overflow-x-auto text-[11px]">
                            {req.body.raw}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED POSTMAN GUIDE & HOW/WHERE IT IS USED */}
      {activeTab === 'guide' && (
        <div className="space-y-6">
          {/* Section: What is a Postman Collection */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-400" />
              <span>What is a Postman Collection & Why Does It Matter?</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              A <strong>Postman Collection</strong> is an executable JSON blueprint of API endpoints adhering to the official 
              <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 text-xs ml-1 font-mono">schema.getpostman.com/json/collection/v2.1.0</code> standard.
              Instead of reading static text documentation and manually re-typing URLs, headers, and request bodies, developers and QA teams can import a single collection file and instantly execute requests with parameterized variables.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-amber-400 font-bold text-xs uppercase font-mono mb-1">1. QA & Automated Testing</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  QA engineers use collections to run end-to-end regression suites, test edge cases, validate status codes, and assert response structures automatically.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-indigo-400 font-bold text-xs uppercase font-mono mb-1">2. CI/CD Pipeline Automation</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Run collections programmatically in GitHub Actions, GitLab CI, or Jenkins using <strong>Newman CLI</strong> to fail builds if any API contract breaks.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-emerald-400 font-bold text-xs uppercase font-mono mb-1">3. Team Sharing & Onboarding</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Frontend, mobile, and third-party partners import the collection to immediately start calling your backend without guessing headers or payload shapes.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Step-by-Step How to Import & Use */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-400" />
              <span>How to Use This Collection in Postman (Step-by-Step)</span>
            </h2>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  1
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Download the Generated Collection JSON</strong>
                  Click the amber <strong>"Download Collection (.json)"</strong> button at the top of this page to save the file to your computer.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  2
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Import into Postman Desktop or Web</strong>
                  Open Postman, click the <strong>"Import"</strong> button in the top-left sidebar, and drag & drop the downloaded JSON file. All discovered endpoints will instantly appear in your sidebar.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  3
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Configure Environment Variables</strong>
                  The collection uses two dynamic variables:
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs text-slate-400 font-mono">
                    <li><code className="text-indigo-300">baseUrl</code>: The host and port of your running backend (defaults to <code className="text-indigo-300">http://localhost:3000</code>).</li>
                    <li><code className="text-amber-300">bearerToken</code>: Your JWT token for protected endpoints.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  4
                </div>
                <div>
                  <strong className="text-white block mb-0.5">Execute Requests or Run the Entire Collection</strong>
                  Click on any request and hit <strong>"Send"</strong>. Alternatively, right-click the collection folder and select <strong>"Run collection"</strong> to execute every endpoint automatically with a summary report!
                </div>
              </div>
            </div>
          </div>

          {/* Section: Running in CLI with Newman */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="h-5 w-5 text-indigo-400" />
                <span>Running via CLI / CI Pipeline with Newman</span>
              </h2>

              <button
                onClick={copyNewmanCommand}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
              >
                {copiedNewman ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copy Newman CLI</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              You can run this collection in headless terminal or continuous integration (GitHub Actions, Jenkins) using Newman:
            </p>

            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
              npm install -g newman{"\n"}
              newman run {analysis?.project?.name?.toLowerCase().replace(/\s+/g, '_') || 'api'}_postman_collection.json --env-var "baseUrl=http://localhost:3000" --env-var "bearerToken=&lt;YOUR_TOKEN&gt;"
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: VARIABLES */}
      {activeTab === 'vars' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider font-mono">
            Collection Variables
          </h2>
          <p className="text-xs text-slate-400">
            These variables are embedded in the collection and can be overridden in Postman environments:
          </p>

          <div className="border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Variable Name</th>
                  <th className="py-2.5 px-4">Default Value</th>
                  <th className="py-2.5 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(collection?.variable || []).map((v: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 text-indigo-400 font-bold">{`{{${v.key}}}`}</td>
                    <td className="py-2.5 px-4 text-slate-300">{v.value}</td>
                    <td className="py-2.5 px-4 text-slate-400 font-sans">
                      {v.key === 'baseUrl' ? 'Target host/port for backend server' : 'JWT bearer authentication token'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RAW JSON VIEW */}
      {activeTab === 'json' && (
        <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 font-mono text-xs overflow-x-auto text-slate-300">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Raw Postman Collection Schema v2.1.0 JSON
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-slate-400 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>Copy</span>
            </button>
          </div>
          <pre>{JSON.stringify(collection, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
