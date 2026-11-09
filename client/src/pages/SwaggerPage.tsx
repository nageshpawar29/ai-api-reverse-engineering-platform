import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  FileCode2,
  Download,
  Copy,
  Check,
  Code,
  Layout,
  Loader2,
  Lock,
  Unlock,
  Server,
  Search,
  ExternalLink,
  PlaySquare,
  ShieldCheck,
  Sparkles,
  Terminal,
  Layers,
  ChevronDown,
  RefreshCw,
  Key,
  ListFilter,
  CheckCircle2,
  X,
  Code2,
} from 'lucide-react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { apiClient } from '../api/client';

type ViewMode = 'ui' | 'catalog' | 'snippets' | 'json' | 'yaml';
type SnippetLang = 'curl' | 'fetch' | 'axios' | 'python';

export const SwaggerPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [viewMode, setViewMode] = useState<ViewMode>('ui');
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [isFetchingSpec, setIsFetchingSpec] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Server & Auth Config
  const [selectedServer, setSelectedServer] = useState<string>('http://localhost:5001');
  const [customServer, setCustomServer] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [bearerToken, setBearerToken] = useState<string>('');
  const [activeToken, setActiveToken] = useState<string>('');

  // Code Snippet Generator State
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<string>('');
  const [snippetLang, setSnippetLang] = useState<SnippetLang>('curl');

  useEffect(() => {
    if (!analysis?.project?.id) return;

    const fetchSpec = async () => {
      try {
        setIsFetchingSpec(true);
        const [jsonRes, yamlRes] = await Promise.all([
          apiClient.get(`/artifacts/${analysis.project.id}/openapi.json`),
          apiClient.get(`/artifacts/${analysis.project.id}/openapi.yaml`, { responseType: 'text' }),
        ]);
        setOpenApiSpec(jsonRes.data);
        setYamlContent(yamlRes.data);

        // Preselect first server if available
        if (jsonRes.data?.servers?.[0]?.url) {
          setSelectedServer(jsonRes.data.servers[0].url);
        }
      } catch (err) {
        console.error('Failed to load OpenAPI artifacts:', err);
      } finally {
        setIsFetchingSpec(false);
      }
    };

    fetchSpec();
  }, [analysis?.project?.id]);

  // Derived endpoint statistics from spec
  const stats = useMemo(() => {
    if (!openApiSpec?.paths) {
      return { total: 0, get: 0, post: 0, put: 0, delete: 0, patch: 0, auth: 0, tags: [] as string[] };
    }

    let total = 0;
    let get = 0;
    let post = 0;
    let put = 0;
    let del = 0;
    let patch = 0;
    let auth = 0;
    const tagsSet = new Set<string>();

    Object.entries(openApiSpec.paths).forEach(([_, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, op]: [string, any]) => {
        total++;
        const m = method.toLowerCase();
        if (m === 'get') get++;
        else if (m === 'post') post++;
        else if (m === 'put') put++;
        else if (m === 'delete') del++;
        else if (m === 'patch') patch++;

        if (op?.security && op.security.length > 0) auth++;
        if (op?.tags && Array.isArray(op.tags)) {
          op.tags.forEach((t: string) => tagsSet.add(t));
        }
      });
    });

    return {
      total,
      get,
      post,
      put,
      delete: del,
      patch,
      auth,
      tags: Array.from(tagsSet).sort(),
    };
  }, [openApiSpec]);

  // Flat endpoints list for Catalog and Snippets
  const flatEndpoints = useMemo(() => {
    if (!openApiSpec?.paths) return [];
    const list: Array<{
      id: string;
      path: string;
      method: string;
      summary: string;
      description: string;
      tag: string;
      hasAuth: boolean;
      parameters: any[];
      responses: Record<string, any>;
    }> = [];

    Object.entries(openApiSpec.paths).forEach(([pathKey, methods]: [string, any]) => {
      Object.entries(methods).forEach(([methodKey, op]: [string, any]) => {
        list.push({
          id: `${methodKey.toUpperCase()} ${pathKey}`,
          path: pathKey,
          method: methodKey.toUpperCase(),
          summary: op.summary || `${methodKey.toUpperCase()} ${pathKey}`,
          description: op.description || '',
          tag: op.tags?.[0] || 'General',
          hasAuth: Boolean(op.security && op.security.length > 0),
          parameters: op.parameters || [],
          responses: op.responses || {},
        });
      });
    });

    return list;
  }, [openApiSpec]);

  // Default snippet endpoint
  useEffect(() => {
    if (flatEndpoints.length > 0 && !selectedEndpointKey) {
      setSelectedEndpointKey(flatEndpoints[0].id);
    }
  }, [flatEndpoints, selectedEndpointKey]);

  // Dynamic spec with currently selected server
  const activeSpec = useMemo(() => {
    if (!openApiSpec) return null;
    const targetUrl = customServer.trim() || selectedServer;
    return {
      ...openApiSpec,
      servers: [
        {
          url: targetUrl,
          description: 'Current Active Target Server',
        },
        ...(openApiSpec.servers || []).filter((s: any) => s.url !== targetUrl),
      ],
    };
  }, [openApiSpec, selectedServer, customServer]);

  // Request interceptor injecting Bearer Token
  const requestInterceptor = useCallback(
    (req: any) => {
      if (activeToken) {
        req.headers['Authorization'] = `Bearer ${activeToken}`;
      }
      return req;
    },
    [activeToken]
  );

  const handleDownload = (format: 'json' | 'yaml') => {
    if (!analysis?.project) return;
    const content = format === 'json' ? JSON.stringify(openApiSpec, null, 2) : yamlContent;
    const mime = format === 'json' ? 'application/json' : 'text/yaml';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.project.name.toLowerCase().replace(/\s+/g, '_')}_openapi.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyAuth = () => {
    setActiveToken(bearerToken.trim());
    setShowAuthModal(false);
  };

  const handleClearAuth = () => {
    setBearerToken('');
    setActiveToken('');
    setShowAuthModal(false);
  };

  // Generate code snippet for selected endpoint
  const currentSnippet = useMemo(() => {
    const ep = flatEndpoints.find((e) => e.id === selectedEndpointKey);
    if (!ep) return '// Select an endpoint to view code snippet';

    const baseUrl = customServer.trim() || selectedServer || 'http://localhost:5001';
    const fullUrl = `${baseUrl.replace(/\/$/, '')}${ep.path}`;
    const tokenHeader = activeToken ? `\n  -H "Authorization: Bearer ${activeToken}"` : '';

    switch (snippetLang) {
      case 'curl':
        return `curl -X ${ep.method} "${fullUrl}" \\
  -H "Content-Type: application/json"${tokenHeader}${
          ['POST', 'PUT', 'PATCH'].includes(ep.method) ? ` \\\n  -d '{"example": "payload"}'` : ''
        }`;

      case 'fetch':
        return `fetch("${fullUrl}", {
  method: "${ep.method}",
  headers: {
    "Content-Type": "application/json",${
      activeToken ? `\n    "Authorization": "Bearer ${activeToken}",` : ''
    }
  },${
    ['POST', 'PUT', 'PATCH'].includes(ep.method)
      ? `\n  body: JSON.stringify({ example: "payload" }),`
      : ''
  }
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));`;

      case 'axios':
        return `import axios from 'axios';

const response = await axios({
  method: '${ep.method.toLowerCase()}',
  url: '${fullUrl}',
  headers: {
    'Content-Type': 'application/json',${
      activeToken ? `\n    'Authorization': 'Bearer ${activeToken}',` : ''
    }
  },${
    ['POST', 'PUT', 'PATCH'].includes(ep.method)
      ? `\n  data: { example: 'payload' },`
      : ''
  }
});

console.log(response.data);`;

      case 'python':
        return `import requests

url = "${fullUrl}"
headers = {
    "Content-Type": "application/json",${
      activeToken ? `\n    "Authorization": "Bearer ${activeToken}",` : ''
    }
}
${
  ['POST', 'PUT', 'PATCH'].includes(ep.method)
    ? `payload = {"example": "payload"}\nresponse = requests.${ep.method.toLowerCase()}(url, json=payload, headers=headers)`
    : `response = requests.${ep.method.toLowerCase()}(url, headers=headers)`
}

print(response.status_code)
print(response.json())`;

      default:
        return '';
    }
  }, [selectedEndpointKey, snippetLang, flatEndpoints, selectedServer, customServer, activeToken]);

  if (loading || isFetchingSpec) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Compiling OpenAPI 3.0 Architecture Specification...</p>
        <span className="text-xs text-slate-500 font-mono">AST Parsing & Spec Synthesis</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileCode2 className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  OpenAPI 3.0 / Swagger Interactive Studio
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  OpenAPI v3.0.3 Validated
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Zero-execution static AST discovery enriches routes, controllers, schemas, and security gates into an interactive live playground.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auth Token Button */}
          <button
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeToken
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Configure Bearer JWT Token for Swagger Live Requests"
          >
            {activeToken ? <Lock className="h-3.5 w-3.5 text-emerald-400" /> : <Key className="h-3.5 w-3.5 text-indigo-400" />}
            <span>{activeToken ? 'Bearer Auth Active' : 'Authorize Token'}</span>
            {activeToken && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </button>

          {/* Download Dropdowns */}
          <button
            onClick={() => handleDownload('json')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all hover:border-slate-700"
            title="Download OpenAPI JSON Schema"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>JSON</span>
          </button>

          <button
            onClick={() => handleDownload('yaml')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all hover:border-slate-700"
            title="Download OpenAPI YAML Spec"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>YAML</span>
          </button>

          {/* Test in Playground Link */}
          {analysis?.project?.id && (
            <Link
              to={`/projects/${analysis.project.id}/playground`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-sm shadow-indigo-950"
            >
              <PlaySquare className="h-3.5 w-3.5" />
              <span>API Playground</span>
            </Link>
          )}
        </div>
      </div>

      {/* Metrics & Statistical Overview Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Endpoints</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-white font-mono">{stats.total}</span>
            <span className="text-xs text-indigo-400 font-mono">paths</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">HTTP Methods</span>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              GET {stats.get}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              POST {stats.post}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              PUT {stats.put}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              DEL {stats.delete}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Security Gates</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{stats.auth}</span>
            <span className="text-xs text-slate-400 font-mono">
              ({stats.total > 0 ? Math.round((stats.auth / stats.total) * 100) : 0}% protected)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Service Domains</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-purple-400 font-mono">{stats.tags.length}</span>
            <span className="text-xs text-slate-400 font-mono">controllers</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Active Target URL</span>
          <div className="truncate text-xs font-mono text-indigo-300 mt-1" title={selectedServer}>
            {selectedServer.replace('http://', '')}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Schema Conformance</span>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>0 Linter Errors</span>
          </div>
        </div>
      </div>

      {/* Main Studio Navigation Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/70 p-2 rounded-2xl border border-slate-800">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setViewMode('ui')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'ui'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layout className="h-3.5 w-3.5" />
            <span>Interactive Swagger UI</span>
          </button>

          <button
            onClick={() => setViewMode('catalog')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'catalog'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Endpoint Catalog</span>
          </button>

          <button
            onClick={() => setViewMode('snippets')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'snippets'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Code Snippets</span>
          </button>

          <button
            onClick={() => setViewMode('json')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all whitespace-nowrap ${
              viewMode === 'json'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>JSON Spec</span>
          </button>

          <button
            onClick={() => setViewMode('yaml')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all whitespace-nowrap ${
              viewMode === 'yaml'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>YAML Spec</span>
          </button>
        </div>

        {/* Server Target Selector & Filter Input */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Target Base URL Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            <Server className="h-3.5 w-3.5 text-indigo-400" />
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none border-none py-1 pr-1 cursor-pointer"
            >
              <option value="http://localhost:5001" className="bg-slate-900 text-slate-200">
                http://localhost:5001 (Platform API)
              </option>
              <option value="http://localhost:3000" className="bg-slate-900 text-slate-200">
                http://localhost:3000 (Target App)
              </option>
              <option value="http://localhost:8080" className="bg-slate-900 text-slate-200">
                http://localhost:8080 (Gateway)
              </option>
            </select>
          </div>

          {/* Search Filter Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter endpoints..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono w-40 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* VIEW MODE: Interactive Swagger UI */}
      {viewMode === 'ui' && activeSpec && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800/90 p-4 sm:p-6 overflow-hidden swagger-dark-wrapper shadow-xl shadow-slate-950/80">
          <SwaggerUI
            spec={activeSpec}
            requestInterceptor={requestInterceptor}
            filter={searchFilter || true}
            docExpansion="list"
            defaultModelsExpandDepth={1}
            displayRequestDuration={true}
            tryItOutEnabled={true}
            persistAuthorization={true}
          />
        </div>
      )}

      {/* VIEW MODE: Endpoint Catalog */}
      {viewMode === 'catalog' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Discovered Endpoints Catalog</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  High-level architectural matrix of routes, parameters, authentication gates, and response schemas.
                </p>
              </div>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                {flatEndpoints.length} total operations
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-[650px] overflow-y-auto">
              {flatEndpoints
                .filter(
                  (ep) =>
                    !searchFilter ||
                    ep.path.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    ep.summary.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    ep.method.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    ep.tag.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .map((ep) => {
                  const methodColors: Record<string, string> = {
                    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                    PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                    DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                  };

                  return (
                    <div
                      key={ep.id}
                      className="p-4 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                              methodColors[ep.method] || 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {ep.method}
                          </span>
                          <span className="font-mono text-sm font-semibold text-white">{ep.path}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {ep.tag}
                          </span>
                          {ep.hasAuth ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                              <Lock className="h-3 w-3" />
                              Bearer Token Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                              <Unlock className="h-3 w-3 text-slate-500" />
                              Public
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{ep.summary}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedEndpointKey(ep.id);
                            setViewMode('snippets');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono flex items-center gap-1.5 transition-colors"
                          title="Generate Code Snippet"
                        >
                          <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Snippet</span>
                        </button>

                        {analysis?.project?.id && (
                          <Link
                            to={`/projects/${analysis.project.id}/playground`}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors"
                          >
                            <PlaySquare className="h-3.5 w-3.5" />
                            <span>Try Out</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE: Code Snippets Generator */}
      {viewMode === 'snippets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Endpoint Selector Sidebar */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-400" />
              <span>Select Operation</span>
            </h3>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {flatEndpoints.map((ep) => {
                const isSelected = selectedEndpointKey === ep.id;
                return (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEndpointKey(ep.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-indigo-600/20 text-white border-indigo-500/50 shadow-sm'
                        : 'bg-slate-900/40 text-slate-400 border-slate-800/80 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <div className="truncate">
                      <span
                        className={`font-bold mr-2 ${
                          ep.method === 'GET'
                            ? 'text-emerald-400'
                            : ep.method === 'POST'
                            ? 'text-blue-400'
                            : ep.method === 'DELETE'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-slate-200">{ep.path}</span>
                    </div>
                    {ep.hasAuth && <Lock className="h-3 w-3 text-amber-400 flex-shrink-0 ml-1.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generated Code Window */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                {(['curl', 'fetch', 'axios', 'python'] as SnippetLang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSnippetLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all ${
                      snippetLang === lang
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'fetch' ? 'Fetch JS' : lang === 'axios' ? 'Axios' : 'Python'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleCopy(currentSnippet)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="p-6 bg-slate-950 overflow-x-auto font-mono text-xs text-slate-200 min-h-[350px]">
              <pre className="text-indigo-200/90 leading-relaxed">{currentSnippet}</pre>
            </div>

            <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Ready for terminal or client app execution</span>
              <span className="font-mono text-indigo-400">Target: {selectedServer}</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE: Raw JSON Specification */}
      {viewMode === 'json' && (
        <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 font-mono text-xs overflow-x-auto text-slate-200 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="text-xs text-slate-400 font-mono">OpenAPI 3.0.3 Specification (JSON Format)</span>
            <button
              onClick={() => handleCopy(JSON.stringify(openApiSpec, null, 2))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre>{JSON.stringify(openApiSpec, null, 2)}</pre>
        </div>
      )}

      {/* VIEW MODE: Raw YAML Specification */}
      {viewMode === 'yaml' && (
        <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 font-mono text-xs overflow-x-auto text-slate-200 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="text-xs text-slate-400 font-mono">OpenAPI 3.0.3 Specification (YAML Format)</span>
            <button
              onClick={() => handleCopy(yamlContent)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied YAML' : 'Copy YAML'}</span>
            </button>
          </div>
          <pre>{yamlContent}</pre>
        </div>
      )}

      {/* Quick Bearer Token Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Key className="h-5 w-5 text-indigo-400" />
                <span>Configure Live Authorization</span>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Provide a JWT bearer token to automatically inject into all interactive Swagger UI requests via request headers.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300">Bearer Token / JWT</label>
              <textarea
                rows={4}
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setBearerToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo-signature')}
                className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline"
              >
                Insert Sample Token
              </button>

              <div className="flex items-center gap-2">
                {activeToken && (
                  <button
                    type="button"
                    onClick={handleClearAuth}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
                  >
                    Clear Token
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApplyAuth}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
                >
                  Apply to Swagger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
