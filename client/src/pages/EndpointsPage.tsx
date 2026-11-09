import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  Search,
  Filter,
  Lock,
  ChevronDown,
  ChevronRight,
  Code,
  FileCode,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  PlaySquare,
  Send,
  Loader2,
  Clock,
  Copy,
  Check,
  FileText,
  Network,
  Database,
  ShieldAlert,
  Cpu,
  CornerDownRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { ApiEndpoint, HttpMethod } from '../types';
import { apiClient } from '../api/client';

export const EndpointsPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedAuth, setSelectedAuth] = useState<string>('ALL');
  const [expandedEndpointId, setExpandedEndpointId] = useState<string | null>(null);

  // Active sub-tab inside expanded endpoint: 'contract' | 'usage' | 'testing'
  const [endpointTabs, setEndpointTabs] = useState<Record<string, 'contract' | 'usage' | 'testing'>>({});

  // Inline testing state for each endpoint
  const [testUrls, setTestUrls] = useState<Record<string, string>>({});
  const [testBodies, setTestBodies] = useState<Record<string, string>>({});
  const [testTokens, setTestTokens] = useState<Record<string, string>>({});
  const [testHeaders, setTestHeaders] = useState<Record<string, string>>({});
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});
  const [testResponses, setTestResponses] = useState<
    Record<string, { status: number; latencyMs: number; headers: any; data: any } | null>
  >({});
  const [copiedResponse, setCopiedResponse] = useState<string | null>(null);

  // Integration code snippet language: 'fetch' | 'axios' | 'curl' | 'python'
  const [snippetLangs, setSnippetLangs] = useState<Record<string, 'fetch' | 'axios' | 'curl' | 'python'>>({});

  if (loading || !analysis) return null;

  const endpoints = analysis.endpoints || [];
  const models = analysis.models || [];
  const dependencies = analysis.dependencies || [];

  const filteredEndpoints = endpoints.filter((ep) => {
    const matchesSearch =
      ep.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ep.controllerName && ep.controllerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ep.handlerFunction && ep.handlerFunction.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ep.purpose && ep.purpose.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMethod = selectedMethod === 'ALL' || ep.method === selectedMethod;
    const matchesAuth =
      selectedAuth === 'ALL' ||
      (selectedAuth === 'AUTH' && ep.authRequired) ||
      (selectedAuth === 'PUBLIC' && !ep.authRequired);

    return matchesSearch && matchesMethod && matchesAuth;
  });

  const toggleExpand = (id: string, defaultTab?: 'contract' | 'usage' | 'testing') => {
    setExpandedEndpointId((prev) => {
      const next = prev === id ? null : id;
      if (next && defaultTab) {
        setEndpointTabs((t) => ({ ...t, [id]: defaultTab }));
      }
      return next;
    });

    // Initialize test URL and sample body if not set
    const ep = endpoints.find((e) => e.id === id);
    if (ep && !testUrls[id]) {
      const normalizedPath = ep.path.replace(/:([a-zA-Z0-9_]+)/g, '1');
      setTestUrls((u) => ({ ...u, [id]: `http://localhost:3000${normalizedPath}` }));

      const bodyParams = ep.parameters?.filter((p) => p.paramIn === 'body') || [];
      if (bodyParams.length > 0) {
        const sampleObj: Record<string, any> = {};
        bodyParams.forEach((bp) => {
          sampleObj[bp.name] = bp.defaultValue || (bp.dataType === 'number' ? 100 : `${bp.name}_sample`);
        });
        setTestBodies((b) => ({ ...b, [id]: JSON.stringify(sampleObj, null, 2) }));
      } else {
        setTestBodies((b) => ({ ...b, [id]: '{\n  \n}' }));
      }
    }
  };

  const getSubTab = (epId: string) => endpointTabs[epId] || 'contract';
  const setSubTab = (epId: string, tab: 'contract' | 'usage' | 'testing') => {
    setEndpointTabs((prev) => ({ ...prev, [epId]: tab }));
  };

  const getSnippetLang = (epId: string) => snippetLangs[epId] || 'fetch';
  const setSnippetLang = (epId: string, lang: 'fetch' | 'axios' | 'curl' | 'python') => {
    setSnippetLangs((prev) => ({ ...prev, [epId]: lang }));
  };

  // Run in-place live test
  const handleExecuteTest = async (ep: ApiEndpoint, overrideBody?: string, overrideToken?: string) => {
    const epId = ep.id;
    const url = testUrls[epId] || `http://localhost:3000${ep.path.replace(/:([a-zA-Z0-9_]+)/g, '1')}`;
    const token = overrideToken !== undefined ? overrideToken : testTokens[epId] || '';
    const bodyText = overrideBody !== undefined ? overrideBody : testBodies[epId] || '';

    setTestLoading((prev) => ({ ...prev, [epId]: true }));
    const startTime = performance.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token.trim()) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      }

      let parsedBody: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(ep.method) && bodyText.trim()) {
        try {
          parsedBody = JSON.parse(bodyText);
        } catch (e) {
          parsedBody = bodyText;
        }
      }

      const res = await apiClient.post('/analysis/proxy-test', {
        method: ep.method,
        url,
        headers,
        body: parsedBody,
      });

      const latencyMs = Math.round(performance.now() - startTime);
      setTestResponses((prev) => ({
        ...prev,
        [epId]: {
          status: res.data.status,
          latencyMs,
          headers: res.data.headers,
          data: res.data.data,
        },
      }));
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setTestResponses((prev) => ({
        ...prev,
        [epId]: {
          status: err.response?.status || 500,
          latencyMs,
          headers: err.response?.headers || {},
          data: err.response?.data || { error: err.message },
        },
      }));
    } finally {
      setTestLoading((prev) => ({ ...prev, [epId]: false }));
    }
  };

  const copyResponseJson = (epId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponse(epId);
    setTimeout(() => setCopiedResponse(null), 2000);
  };

  // Helper: infer Where & How endpoint is used
  const getUsageIntelligence = (ep: ApiEndpoint) => {
    const pathLower = ep.path.toLowerCase();
    const method = ep.method;

    // 1. Frontend consumers
    let frontendConsumers: string[] = [];
    if (pathLower.includes('login') || pathLower.includes('auth')) {
      frontendConsumers = ['Auth Modal', 'Login Screen', 'Session Refresh Interceptor'];
    } else if (pathLower.includes('register') || pathLower.includes('signup')) {
      frontendConsumers = ['Signup Page', 'User Onboarding Flow'];
    } else if (pathLower.includes('product')) {
      frontendConsumers = method === 'GET' ? ['Product Catalog Page', 'Search Auto-complete', 'Item Detail View'] : ['Admin Product Manager', 'Inventory CMS'];
    } else if (pathLower.includes('user')) {
      frontendConsumers = ['User Profile View', 'Account Settings Form', 'Admin User Table'];
    } else if (pathLower.includes('order')) {
      frontendConsumers = method === 'POST' ? ['Shopping Cart Checkout', 'Payment Confirmation'] : ['Order History Tab', 'Tracking Dashboard'];
    } else {
      frontendConsumers = ['Application Web Client', 'Mobile iOS / Android App', 'External API Partner'];
    }

    // 2. Database model connection
    const connectedModels = models.filter((m) =>
      pathLower.includes(m.name.toLowerCase().replace(/s$/, '')) ||
      (ep.controllerName && ep.controllerName.toLowerCase().includes(m.name.toLowerCase().replace(/s$/, '')))
    );

    // 3. Step-by-step How to Use description
    const isStateModifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const howToUseSteps = [
      {
        step: 1,
        title: 'Authentication & Headers',
        desc: ep.authRequired
          ? 'Requires Bearer Token in Authorization header (Authorization: Bearer <token>) with Content-Type: application/json.'
          : 'Public route: Can be invoked without credentials with Content-Type: application/json.',
      },
      {
        step: 2,
        title: 'URL & Path Variable Resolution',
        desc: ep.path.includes(':')
          ? `Replace dynamic route parameter(s) (${ep.parameters.filter(p => p.paramIn === 'path').map(p => `:${p.name}`).join(', ')}) with real database IDs.`
          : 'Direct URL path with no mandatory path substitutions.',
      },
      {
        step: 3,
        title: 'Payload Validation Contract',
        desc: isStateModifying
          ? `Provide JSON body with required fields: ${ep.parameters.filter(p => p.paramIn === 'body').map(p => p.name).join(', ') || 'none'}.`
          : 'GET request: supports optional URL query parameters for filtering and pagination.',
      },
      {
        step: 4,
        title: 'Status Code Handling',
        desc: `Expect status ${ep.responses.find(r => r.statusCode < 300)?.statusCode || (method === 'POST' ? '201 Created' : '200 OK')} on success. Handle 400 (Validation), 401 (Auth error), and 404 (Resource not found).`,
      },
    ];

    return { frontendConsumers, connectedModels, howToUseSteps };
  };

  // Helper to generate copyable code snippet
  const generateSnippet = (ep: ApiEndpoint, lang: 'fetch' | 'axios' | 'curl' | 'python') => {
    const fullUrl = `http://localhost:3000${ep.path.replace(/:([a-zA-Z0-9_]+)/g, '1')}`;
    const bodyParams = ep.parameters?.filter((p) => p.paramIn === 'body') || [];
    const sampleObj: Record<string, any> = {};
    bodyParams.forEach((bp) => {
      sampleObj[bp.name] = bp.defaultValue || (bp.dataType === 'number' ? 100 : `${bp.name}_value`);
    });
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(ep.method) && bodyParams.length > 0;
    const bodyStr = JSON.stringify(sampleObj, null, 2);

    if (lang === 'curl') {
      let cmd = `curl -X ${ep.method} "${fullUrl}" \\\n  -H "Content-Type: application/json"`;
      if (ep.authRequired) cmd += ` \\\n  -H "Authorization: Bearer <YOUR_TOKEN>"`;
      if (hasBody) cmd += ` \\\n  -d '${JSON.stringify(sampleObj)}'`;
      return cmd;
    } else if (lang === 'axios') {
      return `import axios from 'axios';\n\nconst response = await axios({\n  method: '${ep.method.toLowerCase()}',\n  url: '${fullUrl}',\n  headers: {\n    'Content-Type': 'application/json',${ep.authRequired ? "\n    'Authorization': 'Bearer <YOUR_TOKEN>'," : ''}\n  },${hasBody ? `\n  data: ${bodyStr.replace(/\n/g, '\n  ')}` : ''}\n});\nconsole.log(response.data);`;
    } else if (lang === 'python') {
      return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Content-Type": "application/json",${ep.authRequired ? '\n    "Authorization": "Bearer <YOUR_TOKEN>",' : ''}\n}\n${hasBody ? `payload = ${bodyStr}\n\nresponse = requests.${ep.method.toLowerCase()}(url, json=payload, headers=headers)` : `response = requests.${ep.method.toLowerCase()}(url, headers=headers)`}\n\nprint(response.status_code)\nprint(response.json())`;
    } else {
      return `const response = await fetch("${fullUrl}", {\n  method: "${ep.method}",\n  headers: {\n    "Content-Type": "application/json",${ep.authRequired ? '\n    "Authorization": "Bearer <YOUR_TOKEN>",' : ''}\n  },${hasBody ? `\n  body: JSON.stringify(${bodyStr.replace(/\n/g, '\n  ')})` : ''}\n});\nconst data = await response.json();\nconsole.log(data);`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="border-b border-white/[0.08] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Layers className="h-6 w-6" />
            </div>
            <span>API Explorer & Endpoint Intelligence</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Explore discovered contracts, live test endpoints in-place, and inspect grounded AST controller mappings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300">
            {filteredEndpoints.length} of {endpoints.length} routes shown
          </span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3 rounded-2xl glass-panel">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search path, controller, or purpose..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 text-xs font-sans transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMethod(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedMethod === m
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900/80 text-slate-400 border border-white/[0.06] hover:text-white hover:bg-slate-800'
              }`}
            >
              {m}
            </button>
          ))}

          <select
            value={selectedAuth}
            onChange={(e) => setSelectedAuth(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/[0.08] text-slate-300 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-all"
          >
            <option value="ALL">All Auth States</option>
            <option value="AUTH">Protected Only</option>
            <option value="PUBLIC">Public Only</option>
          </select>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-4">
        {filteredEndpoints.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 text-slate-400 text-sm">
            No endpoints matching your filters.
          </div>
        ) : (
          filteredEndpoints.map((ep) => {
            const isExpanded = expandedEndpointId === ep.id;
            const activeTab = getSubTab(ep.id);
            const usageInfo = getUsageIntelligence(ep);
            const testResult = testResponses[ep.id];
            const isTesting = testLoading[ep.id];

            return (
              <div
                key={ep.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-indigo-500/50 bg-slate-900/90 shadow-2xl shadow-indigo-950/30'
                    : 'glass-card border-white/[0.08] hover:border-indigo-500/30'
                }`}
              >
                {/* Header Bar */}
                <div
                  onClick={() => toggleExpand(ep.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-slate-500 hover:text-slate-300">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                        ep.method === 'GET'
                          ? 'badge-get'
                          : ep.method === 'POST'
                          ? 'badge-post'
                          : ep.method === 'PUT'
                          ? 'badge-put'
                          : ep.method === 'PATCH'
                          ? 'badge-patch'
                          : 'badge-delete'
                      }`}
                    >
                      {ep.method}
                    </span>

                    <span className="font-mono text-sm font-semibold text-slate-200 truncate">{ep.path}</span>

                    {ep.authRequired && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="h-3 w-3" />
                        <span>Auth</span>
                      </span>
                    )}

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        ep.detectionType === 'DETECTED'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {ep.detectionType}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{ep.controllerName || ep.handlerFunction || 'handler'}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500 truncate max-w-xs">{ep.sourceFile}</span>
                    </div>

                    {/* Quick Action: Live Test in Place */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(ep.id, 'testing');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                    >
                      <Zap className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Test Endpoint</span>
                    </button>
                  </div>
                </div>

                {/* EXPANDED ACCORDION CONTENT */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/80 p-6 space-y-6">
                    {/* Purpose Banner */}
                    {ep.purpose && (
                      <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-3">
                        <Sparkles className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-indigo-300">Business Purpose & Intent</div>
                          <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">{ep.purpose}</div>
                        </div>
                      </div>
                    )}

                    {/* Tab Navigation within Endpoint */}
                    <div className="flex border-b border-slate-800 gap-6 text-xs font-mono font-semibold">
                      <button
                        onClick={() => setSubTab(ep.id, 'contract')}
                        className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                          activeTab === 'contract'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Contract & Parameters</span>
                      </button>

                      <button
                        onClick={() => setSubTab(ep.id, 'usage')}
                        className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                          activeTab === 'usage'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Network className="h-3.5 w-3.5" />
                        <span>How & Where It's Used</span>
                      </button>

                      <button
                        onClick={() => setSubTab(ep.id, 'testing')}
                        className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                          activeTab === 'testing'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <PlaySquare className="h-3.5 w-3.5" />
                        <span>Live Endpoint Tester</span>
                      </button>
                    </div>

                    {/* SUB-TAB 1: CONTRACT & PARAMETERS */}
                    {activeTab === 'contract' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Parameters */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                              Request Parameters & Body ({ep.parameters?.length || 0})
                            </h4>
                            {ep.parameters && ep.parameters.length > 0 ? (
                              <div className="space-y-1.5">
                                {ep.parameters.map((p) => (
                                  <div
                                    key={p.id}
                                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-indigo-400 font-medium">{p.name}</span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                        {p.paramIn}
                                      </span>
                                      {p.required && (
                                        <span className="text-[10px] text-rose-400 font-semibold">required</span>
                                      )}
                                    </div>
                                    <span className="font-mono text-slate-400 text-[11px]">{p.dataType}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">No explicit parameters detected</p>
                            )}
                          </div>

                          {/* Observed Responses */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                              Observed Status Codes ({ep.responses?.length || 0})
                            </h4>
                            {ep.responses && ep.responses.length > 0 ? (
                              <div className="space-y-1.5">
                                {ep.responses.map((r) => (
                                  <div
                                    key={r.id}
                                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-mono font-bold ${
                                          r.statusCode < 300
                                            ? 'text-emerald-400'
                                            : r.statusCode < 400
                                            ? 'text-amber-400'
                                            : 'text-rose-400'
                                        }`}
                                      >
                                        {r.statusCode}
                                      </span>
                                      <span className="text-slate-300">{r.description || 'Status response'}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500">{r.contentType}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Default 200 OK / standard JSON</p>
                            )}
                          </div>
                        </div>

                        {/* Middleware & File Citations */}
                        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-300">Middleware Chain:</span>
                            {ep.middleware && ep.middleware.length > 0 ? (
                              ep.middleware.map((m, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]"
                                >
                                  {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic">None</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                            <FileCode className="h-3.5 w-3.5 text-indigo-400" />
                            <span>
                              {ep.sourceFile}
                              {ep.lineStart && `:${ep.lineStart}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 2: HOW & WHERE IT'S USED (DEEP DETAILS) */}
                    {activeTab === 'usage' && (
                      <div className="space-y-6">
                        {/* 1. Where It Is Used (Consumer & Architecture Footprint) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs font-mono">
                              <ExternalLink className="h-4 w-4" />
                              <span>Frontend Consumers</span>
                            </div>
                            <p className="text-xs text-slate-400">Client-side views invoking this endpoint:</p>
                            <ul className="space-y-1 text-xs text-slate-200">
                              {usageInfo.frontendConsumers.map((fc, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                  <span>{fc}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                            <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs font-mono">
                              <Cpu className="h-4 w-4" />
                              <span>Backend Handler Chain</span>
                            </div>
                            <p className="text-xs text-slate-400">Execution chain traced in source code:</p>
                            <div className="text-xs font-mono text-slate-200 space-y-1">
                              <div>🎮 Controller: {ep.controllerName || 'Router handler'}</div>
                              <div>⚙️ Handler: {ep.handlerFunction || 'anonymous'}</div>
                              <div className="text-slate-500 text-[11px] truncate">📁 {ep.sourceFile}</div>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs font-mono">
                              <Database className="h-4 w-4" />
                              <span>Database Operations</span>
                            </div>
                            <p className="text-xs text-slate-400">Associated database models touched:</p>
                            {usageInfo.connectedModels.length > 0 ? (
                              <div className="space-y-1 text-xs">
                                {usageInfo.connectedModels.map((m) => (
                                  <div key={m.id} className="text-emerald-300 font-mono font-medium">
                                    🗄️ Model: {m.name} ({m.fields.length} fields)
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">No direct ORM models linked</p>
                            )}
                          </div>
                        </div>

                        {/* 2. Step-by-Step How It Is Used Guide */}
                        <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 space-y-4">
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                            Step-by-Step Integration & Execution Guide
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {usageInfo.howToUseSteps.map((s) => (
                              <div key={s.step} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                                <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                                  <span className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px]">
                                    {s.step}
                                  </span>
                                  <span>{s.title}</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed font-sans">{s.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. Integration Code Snippets */}
                        <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                              Client Integration Code Snippet
                            </h4>

                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                              {(['fetch', 'axios', 'curl', 'python'] as const).map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => setSnippetLang(ep.id, lang)}
                                  className={`px-2 py-0.5 rounded capitalize ${
                                    getSnippetLang(ep.id) === lang
                                      ? 'bg-indigo-600 text-white font-semibold'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {lang}
                                </button>
                              ))}
                            </div>
                          </div>

                          <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
                            {generateSnippet(ep, getSnippetLang(ep.id))}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 3: LIVE ENDPOINT TESTER CONSOLE */}
                    {activeTab === 'testing' && (
                      <div className="space-y-6">
                        {/* Quick One-Click Test Scenarios */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-xs font-mono text-slate-400">One-Click Test Scenarios:</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleExecuteTest(ep)}
                              disabled={isTesting}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <span>🟢 Happy Path (Valid)</span>
                            </button>

                            {ep.authRequired && (
                              <button
                                onClick={() => handleExecuteTest(ep, undefined, '')}
                                disabled={isTesting}
                                className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <span>🟡 Auth Gate Check (Omit Token)</span>
                              </button>
                            )}

                            {['POST', 'PUT'].includes(ep.method) && (
                              <button
                                onClick={() => handleExecuteTest(ep, '{}')}
                                disabled={isTesting}
                                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <span>🔴 Validation Check (Empty Body)</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Request Builder Bar */}
                        <div className="space-y-4 rounded-xl bg-slate-900/40 border border-slate-800 p-5">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <span
                              className={`px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${
                                ep.method === 'GET'
                                  ? 'badge-get'
                                  : ep.method === 'POST'
                                  ? 'badge-post'
                                  : ep.method === 'PUT'
                                  ? 'badge-put'
                                  : ep.method === 'PATCH'
                                  ? 'badge-patch'
                                  : 'badge-delete'
                              }`}
                            >
                              {ep.method}
                            </span>

                            <input
                              type="text"
                              value={testUrls[ep.id] || `http://localhost:3000${ep.path.replace(/:([a-zA-Z0-9_]+)/g, '1')}`}
                              onChange={(e) => setTestUrls({ ...testUrls, [ep.id]: e.target.value })}
                              placeholder="http://localhost:3000/api/..."
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                            />

                            <button
                              onClick={() => handleExecuteTest(ep)}
                              disabled={isTesting}
                              className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs shadow-md shadow-indigo-600/25 transition-all"
                            >
                              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              <span>Execute Request</span>
                            </button>
                          </div>

                          {/* Auth Token & Request Body Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {/* Token input */}
                            <div>
                              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                                Authorization Bearer Token {ep.authRequired ? '(Required)' : '(Optional)'}:
                              </label>
                              <input
                                type="text"
                                value={testTokens[ep.id] || ''}
                                onChange={(e) => setTestTokens({ ...testTokens, [ep.id]: e.target.value })}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            {/* Request body */}
                            {['POST', 'PUT', 'PATCH'].includes(ep.method) && (
                              <div>
                                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                                  JSON Request Body Payload:
                                </label>
                                <textarea
                                  value={testBodies[ep.id] || ''}
                                  onChange={(e) => setTestBodies({ ...testBodies, [ep.id]: e.target.value })}
                                  rows={4}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Live Response Panel */}
                        {testResult && (
                          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-semibold text-slate-400 uppercase">
                                  Live Response
                                </span>

                                <span
                                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                                    testResult.status < 300
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  Status: {testResult.status}
                                </span>

                                <span className="flex items-center gap-1 text-xs font-mono text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  <span>{testResult.latencyMs} ms</span>
                                </span>
                              </div>

                              <button
                                onClick={() => copyResponseJson(ep.id, JSON.stringify(testResult.data, null, 2))}
                                className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-mono"
                              >
                                {copiedResponse === ep.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                <span>Copy Response</span>
                              </button>
                            </div>

                            <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-60">
                              {JSON.stringify(testResult.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
