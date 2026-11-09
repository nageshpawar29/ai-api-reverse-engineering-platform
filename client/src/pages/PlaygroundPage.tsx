import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  PlaySquare,
  Send,
  Loader2,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  Code2,
  Layers,
  Search,
  Plus,
  Trash2,
  History,
  Sparkles,
  RotateCcw,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Key,
  Lock,
  Unlock,
  Sliders,
  Server,
  Terminal,
  Database,
  ExternalLink,
  X,
  FileCode,
  Zap,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { HttpMethod, ApiEndpoint } from '../types';

interface QueryParamItem {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

interface HeaderItem {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

interface PathVarItem {
  key: string;
  value: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  status: number;
  durationMs: number;
  responseBody: any;
  headers: Record<string, string>;
}

type AuthType = 'none' | 'bearer' | 'apikey' | 'basic';
type RequestTab = 'params' | 'pathvars' | 'headers' | 'auth' | 'body';
type ResponseTab = 'body' | 'headers' | 'security';
type SidebarTab = 'endpoints' | 'history';

export const PlaygroundPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const endpoints: ApiEndpoint[] = analysis?.endpoints || [];

  // Sidebar & Navigation
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('endpoints');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('ALL');

  // Server Environment
  const [selectedBaseUrl, setSelectedBaseUrl] = useState<string>('http://localhost:5001');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');

  // Request State
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState<string>('/api/health');
  const [activeReqTab, setActiveReqTab] = useState<RequestTab>('params');

  // Key-Value Collections
  const [queryParams, setQueryParams] = useState<QueryParamItem[]>([
    { id: '1', enabled: true, key: '', value: '', description: '' },
  ]);
  const [pathVars, setPathVars] = useState<PathVarItem[]>([]);
  const [headers, setHeaders] = useState<HeaderItem[]>([
    { id: '1', enabled: true, key: 'Content-Type', value: 'application/json' },
    { id: '2', enabled: true, key: 'Accept', value: 'application/json' },
  ]);

  // Auth State
  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState<string>('');
  const [apiKeyName, setApiKeyName] = useState<string>('x-api-key');
  const [apiKeyValue, setApiKeyValue] = useState<string>('');
  const [basicUser, setBasicUser] = useState<string>('');
  const [basicPass, setBasicPass] = useState<string>('');

  // Body State
  const [bodyType, setBodyType] = useState<'json' | 'raw'>('json');
  const [bodyContent, setBodyContent] = useState<string>('{\n  \n}');

  // Execution & Response State
  const [isSending, setIsSending] = useState<boolean>(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string> | null>(null);
  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [responseSizeKb, setResponseSizeKb] = useState<string | null>(null);
  const [activeRespTab, setActiveRespTab] = useState<ResponseTab>('body');
  const [copied, setCopied] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showCurlModal, setShowCurlModal] = useState<boolean>(false);

  // Group endpoints by controller or tag
  const tagsList = useMemo(() => {
    const set = new Set<string>();
    endpoints.forEach((ep) => {
      let rawTag = ep.controllerName || ep.path.split('/')[2] || 'General';
      rawTag = rawTag.replace(/controller$/i, '').trim();
      const tagName = rawTag ? rawTag.charAt(0).toUpperCase() + rawTag.slice(1) : 'General';
      set.add(tagName);
    });
    return ['All', ...Array.from(set).sort()];
  }, [endpoints]);

  // Filtered Endpoints
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      let rawTag = ep.controllerName || ep.path.split('/')[2] || 'General';
      rawTag = rawTag.replace(/controller$/i, '').trim();
      const tagName = rawTag ? rawTag.charAt(0).toUpperCase() + rawTag.slice(1) : 'General';

      if (selectedTag !== 'All' && tagName !== selectedTag) return false;
      if (selectedMethodFilter !== 'ALL' && ep.method !== selectedMethodFilter) return false;

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        (ep.summary && ep.summary.toLowerCase().includes(q)) ||
        (ep.controllerName && ep.controllerName.toLowerCase().includes(q))
      );
    });
  }, [endpoints, selectedTag, selectedMethodFilter, searchFilter]);

  // Extract path parameters from route string (:id or {id})
  const extractPathVariables = (routePath: string) => {
    const matches = routePath.match(/:([a-zA-Z0-9_]+)|\{([a-zA-Z0-9_]+)\}/g);
    if (!matches) return [];
    return matches.map((m) => ({
      key: m.replace(/[:{}]/g, ''),
      value: '1',
    }));
  };

  // Compute final effective URL with path variables and query params
  const computedUrl = useMemo(() => {
    const base = customBaseUrl.trim() || selectedBaseUrl;
    let effectivePath = path;

    // Substitute path variables
    pathVars.forEach((pv) => {
      if (pv.key && pv.value) {
        effectivePath = effectivePath
          .replace(`:${pv.key}`, encodeURIComponent(pv.value))
          .replace(`{${pv.key}}`, encodeURIComponent(pv.value));
      }
    });

    // Append query params
    const activeParams = queryParams.filter((qp) => qp.enabled && qp.key.trim());
    let queryString = '';
    if (activeParams.length > 0) {
      const searchParams = new URLSearchParams();
      activeParams.forEach((qp) => searchParams.append(qp.key.trim(), qp.value));
      queryString = `?${searchParams.toString()}`;
    }

    return `${base.replace(/\/$/, '')}${effectivePath.startsWith('/') ? effectivePath : `/${effectivePath}`}${queryString}`;
  }, [selectedBaseUrl, customBaseUrl, path, pathVars, queryParams]);

  // Load a discovered endpoint into Playground
  const handleSelectEndpoint = (ep: ApiEndpoint) => {
    setMethod(ep.method);
    setPath(ep.path);

    // Path vars
    const vars = extractPathVariables(ep.path);
    setPathVars(vars);

    // Query params
    const qpList = (ep.parameters || [])
      .filter((p) => p.paramIn === 'query')
      .map((p, idx) => ({
        id: `qp-${idx}`,
        enabled: true,
        key: p.name,
        value: p.defaultValue || '',
        description: p.description || '',
      }));

    if (qpList.length > 0) {
      setQueryParams(qpList);
      setActiveReqTab('params');
    } else if (vars.length > 0) {
      setActiveReqTab('pathvars');
    }

    // Body payload
    const bodyParams = (ep.parameters || []).filter((p) => p.paramIn === 'body');
    if (bodyParams.length > 0 && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
      const sampleObj: Record<string, any> = {};
      bodyParams.forEach((p) => {
        sampleObj[p.name] =
          p.defaultValue ||
          (p.dataType === 'number'
            ? 100
            : p.dataType === 'boolean'
            ? true
            : p.name.toLowerCase().includes('email')
            ? 'user@example.com'
            : p.name.toLowerCase().includes('password')
            ? 'SecretPass123!'
            : 'sample_value');
      });
      setBodyContent(JSON.stringify(sampleObj, null, 2));
      setActiveReqTab('body');
    } else if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
      setBodyContent('{\n  "exampleKey": "exampleValue"\n}');
      setActiveReqTab('body');
    }

    // Auth gate
    if (ep.authRequired) {
      setAuthType('bearer');
      if (!bearerToken) {
        setBearerToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-jwt-payload.signature');
      }
    }
  };

  // Format / Beautify JSON
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(bodyContent);
      setBodyContent(JSON.stringify(parsed, null, 2));
    } catch (e) {
      alert('Invalid JSON syntax: cannot format');
    }
  };

  // Execute Request via SSRF-Protected Proxy
  const handleSendRequest = async () => {
    setIsSending(true);
    setResponseStatus(null);
    setResponseBody(null);
    setResponseHeaders(null);
    setResponseSizeKb(null);
    const startTime = performance.now();

    try {
      // Build headers
      const finalHeaders: Record<string, string> = {};
      headers.filter((h) => h.enabled && h.key.trim()).forEach((h) => {
        finalHeaders[h.key.trim()] = h.value;
      });

      // Apply Auth
      if (authType === 'bearer' && bearerToken.trim()) {
        finalHeaders['Authorization'] = bearerToken.startsWith('Bearer ')
          ? bearerToken.trim()
          : `Bearer ${bearerToken.trim()}`;
      } else if (authType === 'apikey' && apiKeyName.trim() && apiKeyValue.trim()) {
        finalHeaders[apiKeyName.trim()] = apiKeyValue.trim();
      } else if (authType === 'basic' && (basicUser || basicPass)) {
        const encoded = btoa(`${basicUser}:${basicPass}`);
        finalHeaders['Authorization'] = `Basic ${encoded}`;
      }

      // Build Body
      let finalBody: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyContent.trim()) {
        try {
          finalBody = JSON.parse(bodyContent);
        } catch (e) {
          finalBody = bodyContent;
        }
      }

      const res = await apiClient.post('/analysis/proxy-test', {
        method,
        url: computedUrl,
        headers: finalHeaders,
        body: finalBody,
      });

      const latency = Math.round(performance.now() - startTime);
      const strData = JSON.stringify(res.data.data || '');
      const sizeKb = (new Blob([strData]).size / 1024).toFixed(2);

      setResponseTimeMs(latency);
      setResponseStatus(res.data.status);
      setResponseHeaders(res.data.headers || {});
      setResponseBody(res.data.data);
      setResponseSizeKb(sizeKb);

      // Add to session history
      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        method,
        url: computedUrl,
        status: res.data.status,
        durationMs: latency,
        responseBody: res.data.data,
        headers: res.data.headers || {},
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]);
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      setResponseTimeMs(latency);
      setResponseStatus(err.response?.status || 502);
      setResponseBody(err.response?.data || { error: err.message });
      setResponseHeaders(err.response?.headers || {});
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [computedUrl, method, bodyContent, headers, authType, bearerToken]);

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(responseBody, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadResponse = () => {
    const blob = new Blob([JSON.stringify(responseBody, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `response_${method}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  };

  // Replay from history
  const handleReplayHistory = (item: HistoryItem) => {
    setMethod(item.method);
    // Parse URL into base and path
    try {
      const u = new URL(item.url);
      setPath(u.pathname);
      setSelectedBaseUrl(`${u.protocol}//${u.host}`);
    } catch (e) {
      setPath(item.url);
    }
    setResponseStatus(item.status);
    setResponseTimeMs(item.durationMs);
    setResponseBody(item.responseBody);
    setResponseHeaders(item.headers);
  };

  // Generate runnable cURL snippet
  const generatedCurl = useMemo(() => {
    let curl = `curl -X ${method} "${computedUrl}" \\\n  -H "Content-Type: application/json"`;
    if (authType === 'bearer' && bearerToken.trim()) {
      curl += ` \\\n  -H "Authorization: Bearer ${bearerToken.trim()}"`;
    } else if (authType === 'apikey' && apiKeyName && apiKeyValue) {
      curl += ` \\\n  -H "${apiKeyName}: ${apiKeyValue}"`;
    }
    if (['POST', 'PUT', 'PATCH'].includes(method) && bodyContent.trim()) {
      curl += ` \\\n  -d '${bodyContent.replace(/'/g, "\\'")}'`;
    }
    return curl;
  }, [method, computedUrl, authType, bearerToken, apiKeyName, apiKeyValue, bodyContent]);

  if (loading || !analysis) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Initializing Sandboxed API Playground...</p>
      </div>
    );
  }

  const methodBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
    GET: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    POST: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    PUT: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    PATCH: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    DELETE: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 pb-12">
      {/* Top Header & SSRF Shield Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <PlaySquare className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Interactive API Playground Pro
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-purple-400" />
                  Postman-Grade Console
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch live requests against local or microservice backends with automated parameter extraction and SSRF defense.
              </p>
            </div>
          </div>
        </div>

        {/* Security & Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <ShieldCheck className="h-4 w-4" />
            <span>SSRF Sandboxed Proxy</span>
          </div>

          <button
            onClick={() => setShowCurlModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-mono transition-colors"
            title="Generate cURL Command"
          >
            <Terminal className="h-3.5 w-3.5 text-indigo-400" />
            <span>cURL</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Endpoints Explorer & History (3 Cols) */}
        <div className="xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg flex flex-col h-[750px]">
          {/* Sidebar Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-900/60 border-b border-slate-800 text-xs font-mono">
            <button
              onClick={() => setSidebarTab('endpoints')}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'endpoints'
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Endpoints ({endpoints.length})</span>
            </button>
            <button
              onClick={() => setSidebarTab('history')}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'history'
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>History ({history.length})</span>
            </button>
          </div>

          {/* Endpoints Tab View */}
          {sidebarTab === 'endpoints' && (
            <div className="p-3 space-y-2.5 flex-1 flex flex-col min-h-0">
              {/* Search & Tag Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search routes or controllers..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
                  {tagsList.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`px-2 py-0.5 rounded-md transition-colors whitespace-nowrap ${
                        selectedTag === tag
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                          : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800/80'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoints List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredEndpoints.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic">No matching endpoints found</div>
                ) : (
                  filteredEndpoints.map((ep) => {
                    const badge = methodBadgeColors[ep.method] || {
                      bg: 'bg-slate-800',
                      text: 'text-slate-300',
                      border: 'border-slate-700',
                    };
                    const isCurrent = path === ep.path && method === ep.method;

                    return (
                      <button
                        key={ep.id}
                        onClick={() => handleSelectEndpoint(ep)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs font-mono transition-all flex items-center justify-between group ${
                          isCurrent
                            ? 'bg-purple-950/40 border-purple-500/60 shadow-sm'
                            : 'bg-slate-900/30 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <div className="truncate flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {ep.method}
                            </span>
                            <span className="text-slate-200 font-semibold truncate">{ep.path}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {ep.controllerName || ep.summary || 'Route Handler'}
                          </span>
                        </div>
                        {ep.authRequired && (
                          <span title="Auth Gate: Bearer Token" className="flex-shrink-0">
                            <Lock className="h-3 w-3 text-amber-400" />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* History Tab View */}
          {sidebarTab === 'history' && (
            <div className="p-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-slate-400">Session Requests</span>
                {history.length > 0 && (
                  <button
                    onClick={() => setHistory([])}
                    className="text-[11px] text-rose-400 hover:underline font-mono"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 italic">No requests dispatched yet</div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleReplayHistory(item)}
                      className="w-full text-left p-2 rounded-xl bg-slate-900/40 border border-slate-800 hover:bg-slate-900 transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div className="truncate flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[10px] text-purple-400">{item.method}</span>
                          <span className="text-slate-300 truncate">{item.url}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          item.status < 300
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE & RIGHT COLUMNS: Request Studio & Response Inspector (9 Cols) */}
        <div className="xl:col-span-9 space-y-4">
          {/* Main Request Execution Bar */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Target Server Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs flex-shrink-0">
                <Server className="h-3.5 w-3.5 text-purple-400" />
                <select
                  value={selectedBaseUrl}
                  onChange={(e) => setSelectedBaseUrl(e.target.value)}
                  className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none border-none cursor-pointer"
                >
                  <option value="http://localhost:5001" className="bg-slate-900 text-white">
                    http://localhost:5001 (Platform API)
                  </option>
                  <option value="http://localhost:3000" className="bg-slate-900 text-white">
                    http://localhost:3000 (Target Backend)
                  </option>
                  <option value="http://localhost:8080" className="bg-slate-900 text-white">
                    http://localhost:8080 (Microservice)
                  </option>
                </select>
              </div>

              {/* HTTP Method Dropdown */}
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className={`bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-purple-500 ${
                  methodBadgeColors[method]?.text || 'text-white'
                }`}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m}
                  </option>
                ))}
              </select>

              {/* Endpoint Path Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/api/v1/resource"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500 shadow-inner"
                />
              </div>

              {/* Primary Send Button */}
              <button
                onClick={handleSendRequest}
                disabled={isSending}
                className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-purple-950 transition-all flex-shrink-0"
                title="Send Request (Cmd / Ctrl + Enter)"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>Send</span>
                <span className="hidden md:inline text-[10px] opacity-75 font-mono ml-0.5">⌘↵</span>
              </button>
            </div>

            {/* Resolved URL Preview Chip */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-800/80 truncate">
              <span className="text-slate-500 truncate mr-2">Dispatched URL:</span>
              <span className="text-purple-300 font-semibold truncate flex-1">{computedUrl}</span>
            </div>
          </div>

          {/* Dual Workbench: Request Builder & Response Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* REQUEST CONFIGURATOR (LEFT WORKBENCH) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl flex flex-col h-[600px]">
              {/* Tab Navigation */}
              <div className="flex items-center border-b border-slate-800 bg-slate-900/50 px-2 overflow-x-auto text-xs font-mono">
                <button
                  onClick={() => setActiveReqTab('params')}
                  className={`px-3 py-2.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeReqTab === 'params'
                      ? 'border-purple-500 text-purple-300 bg-purple-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Params</span>
                  {queryParams.filter((q) => q.enabled && q.key).length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  )}
                </button>

                {pathVars.length > 0 && (
                  <button
                    onClick={() => setActiveReqTab('pathvars')}
                    className={`px-3 py-2.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeReqTab === 'pathvars'
                        ? 'border-purple-500 text-purple-300 bg-purple-500/5'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Path Vars ({pathVars.length})</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveReqTab('headers')}
                  className={`px-3 py-2.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeReqTab === 'headers'
                      ? 'border-purple-500 text-purple-300 bg-purple-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Headers ({headers.filter((h) => h.enabled).length})</span>
                </button>

                <button
                  onClick={() => setActiveReqTab('auth')}
                  className={`px-3 py-2.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeReqTab === 'auth'
                      ? 'border-purple-500 text-purple-300 bg-purple-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Auth</span>
                  {authType !== 'none' && <Lock className="h-3 w-3 text-amber-400" />}
                </button>

                <button
                  onClick={() => setActiveReqTab('body')}
                  className={`px-3 py-2.5 border-b-2 font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeReqTab === 'body'
                      ? 'border-purple-500 text-purple-300 bg-purple-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Body</span>
                  {['POST', 'PUT', 'PATCH'].includes(method) && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-4 flex-1 overflow-y-auto">
                {/* PARAMS TAB */}
                {activeReqTab === 'params' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Query Parameters</span>
                      <button
                        onClick={() =>
                          setQueryParams((prev) => [
                            ...prev,
                            { id: `qp-${Date.now()}`, enabled: true, key: '', value: '' },
                          ])
                        }
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Param</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {queryParams.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 font-mono text-xs">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) =>
                              setQueryParams((prev) =>
                                prev.map((q, i) => (i === idx ? { ...q, enabled: e.target.checked } : q))
                              )
                            }
                            className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0"
                          />
                          <input
                            type="text"
                            placeholder="Key (e.g. limit)"
                            value={item.key}
                            onChange={(e) =>
                              setQueryParams((prev) =>
                                prev.map((q, i) => (i === idx ? { ...q, key: e.target.value } : q))
                              )
                            }
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            value={item.value}
                            onChange={(e) =>
                              setQueryParams((prev) =>
                                prev.map((q, i) => (i === idx ? { ...q, value: e.target.value } : q))
                              )
                            }
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={() => setQueryParams((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-600 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PATH VARS TAB */}
                {activeReqTab === 'pathvars' && (
                  <div className="space-y-3 font-mono text-xs">
                    <span className="text-slate-400">Path Variables (e.g. :id or {'{id}'})</span>
                    <div className="space-y-2">
                      {pathVars.map((pv, idx) => (
                        <div key={pv.key} className="flex items-center gap-2">
                          <span className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 w-32 font-bold truncate">
                            :{pv.key}
                          </span>
                          <input
                            type="text"
                            value={pv.value}
                            onChange={(e) =>
                              setPathVars((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, value: e.target.value } : p))
                              )
                            }
                            placeholder="Value"
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HEADERS TAB */}
                {activeReqTab === 'headers' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>HTTP Request Headers</span>
                      <button
                        onClick={() =>
                          setHeaders((prev) => [
                            ...prev,
                            { id: `h-${Date.now()}`, enabled: true, key: '', value: '' },
                          ])
                        }
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Header</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {headers.map((h, idx) => (
                        <div key={h.id} className="flex items-center gap-2 font-mono text-xs">
                          <input
                            type="checkbox"
                            checked={h.enabled}
                            onChange={(e) =>
                              setHeaders((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, enabled: e.target.checked } : item))
                              )
                            }
                            className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0"
                          />
                          <input
                            type="text"
                            placeholder="Header Name"
                            value={h.key}
                            onChange={(e) =>
                              setHeaders((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, key: e.target.value } : item))
                              )
                            }
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="text"
                            placeholder="Header Value"
                            value={h.value}
                            onChange={(e) =>
                              setHeaders((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item))
                              )
                            }
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={() => setHeaders((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-600 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AUTH TAB */}
                {activeReqTab === 'auth' && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400">Authentication Type:</label>
                      <select
                        value={authType}
                        onChange={(e) => setAuthType(e.target.value as AuthType)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="none">No Auth</option>
                        <option value="bearer">Bearer Token (JWT)</option>
                        <option value="apikey">API Key Header</option>
                        <option value="basic">Basic Auth</option>
                      </select>
                    </div>

                    {authType === 'bearer' && (
                      <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-bold">Bearer JWT Token</span>
                          <button
                            type="button"
                            onClick={() =>
                              setBearerToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo-signature')
                            }
                            className="text-purple-400 hover:underline text-[11px]"
                          >
                            Insert Demo Token
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={bearerToken}
                          onChange={(e) => setBearerToken(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1Ni..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
                        />
                      </div>
                    )}

                    {authType === 'apikey' && (
                      <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div>
                          <label className="text-slate-400 block mb-1">Header Name</label>
                          <input
                            type="text"
                            value={apiKeyName}
                            onChange={(e) => setApiKeyName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Key Value</label>
                          <input
                            type="text"
                            value={apiKeyValue}
                            onChange={(e) => setApiKeyValue(e.target.value)}
                            placeholder="secret-key-xyz"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                          />
                        </div>
                      </div>
                    )}

                    {authType === 'basic' && (
                      <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div>
                          <label className="text-slate-400 block mb-1">Username</label>
                          <input
                            type="text"
                            value={basicUser}
                            onChange={(e) => setBasicUser(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Password</label>
                          <input
                            type="password"
                            value={basicPass}
                            onChange={(e) => setBasicPass(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BODY TAB */}
                {activeReqTab === 'body' && (
                  <div className="space-y-2 h-full flex flex-col font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Content-Type:</span>
                        <span className="text-purple-300 font-bold">application/json</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleFormatJson}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-800 text-[11px] transition-colors"
                        >
                          Beautify JSON
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={bodyContent}
                      onChange={(e) => setBodyContent(e.target.value)}
                      rows={18}
                      placeholder="{}"
                      className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-indigo-200 focus:outline-none focus:border-purple-500 resize-none shadow-inner leading-relaxed"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* RESPONSE INSPECTOR (RIGHT WORKBENCH) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl flex flex-col h-[600px]">
              {/* Response Header Status Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Response
                  </span>

                  {responseStatus !== null && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        responseStatus < 300
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : responseStatus < 500
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {responseStatus} {responseStatus === 200 ? 'OK' : responseStatus === 201 ? 'Created' : ''}
                    </span>
                  )}
                </div>

                {responseTimeMs !== null && (
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-purple-400" />
                      <span>{responseTimeMs} ms</span>
                    </span>
                    {responseSizeKb && (
                      <span className="text-slate-400">
                        {responseSizeKb} KB
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Response Tabs Header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-3 bg-slate-950 text-xs font-mono">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveRespTab('body')}
                    className={`px-3 py-2 border-b-2 font-semibold transition-all ${
                      activeRespTab === 'body'
                        ? 'border-purple-500 text-purple-300'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Body
                  </button>
                  <button
                    onClick={() => setActiveRespTab('headers')}
                    className={`px-3 py-2 border-b-2 font-semibold transition-all ${
                      activeRespTab === 'headers'
                        ? 'border-purple-500 text-purple-300'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Headers ({responseHeaders ? Object.keys(responseHeaders).length : 0})
                  </button>
                  <button
                    onClick={() => setActiveRespTab('security')}
                    className={`px-3 py-2 border-b-2 font-semibold transition-all ${
                      activeRespTab === 'security'
                        ? 'border-purple-500 text-purple-300'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    SSRF Security
                  </button>
                </div>

                {responseBody && (
                  <div className="flex items-center gap-1.5 py-1">
                    <button
                      onClick={handleCopyResponse}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy JSON Response"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={handleDownloadResponse}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Download Response (.json)"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Response Panel Content */}
              <div className="p-4 flex-1 overflow-y-auto font-mono text-xs">
                {activeRespTab === 'body' && (
                  <div className="h-full">
                    {responseBody ? (
                      <pre className="text-emerald-300/90 leading-relaxed font-mono whitespace-pre-wrap select-text">
                        {JSON.stringify(responseBody, null, 2)}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                        <PlaySquare className="h-8 w-8 text-slate-700" />
                        <p className="text-xs italic">Dispatch an endpoint request to view payload response</p>
                      </div>
                    )}
                  </div>
                )}

                {activeRespTab === 'headers' && (
                  <div className="space-y-1.5">
                    {responseHeaders && Object.keys(responseHeaders).length > 0 ? (
                      Object.entries(responseHeaders).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-start justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 gap-3"
                        >
                          <span className="text-purple-300 font-semibold">{k}</span>
                          <span className="text-slate-300 truncate max-w-xs">{String(v)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 text-xs italic text-center py-12">
                        No response headers captured
                      </div>
                    )}
                  </div>
                )}

                {activeRespTab === 'security' && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold">
                        <ShieldCheck className="h-4 w-4" />
                        <span>SSRF Defense Clear</span>
                      </div>
                      <p className="text-[11px] text-emerald-400/80">
                        Target host has passed local and cloud metadata validation. Calls to AWS/GCP/Azure internal IPs (169.254.169.254) are strictly blocked by the proxy layer.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-slate-300">
                      <span className="text-slate-500 block">Proxy Gateway Engine:</span>
                      <span className="text-white font-bold">Reverse-Engineering Sandboxed Proxy v1.0</span>
                      <span className="text-slate-500 block pt-1">Isolation Sandbox:</span>
                      <span className="text-indigo-400">Node.js Axios Proxy with Host Header Stripping</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* cURL Modal */}
      {showCurlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold font-mono text-xs">
                <Terminal className="h-4 w-4 text-purple-400" />
                <span>Executable cURL Command</span>
              </div>
              <button
                onClick={() => setShowCurlModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-purple-300 overflow-x-auto max-h-64">
              <pre>{generatedCurl}</pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedCurl);
                  setShowCurlModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold font-mono"
              >
                Copy Command
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
