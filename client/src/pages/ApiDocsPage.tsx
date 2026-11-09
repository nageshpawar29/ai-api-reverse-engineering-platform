import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  BookOpen,
  Lock,
  Copy,
  Check,
  Code2,
  Terminal,
  FileCode,
  Sparkles,
  AlertTriangle,
  PlaySquare,
  FileCode2,
} from 'lucide-react';
import { ApiEndpoint } from '../types';

export const ApiDocsPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [activeSnippetLang, setActiveSnippetLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copied, setCopied] = useState(false);

  if (loading || !analysis) return null;

  const endpoints = analysis.endpoints || [];
  const currentEndpoint: ApiEndpoint =
    endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0];

  const generateSnippet = (ep: ApiEndpoint, lang: 'curl' | 'js' | 'python') => {
    if (!ep) return '';
    const fullUrl = `http://localhost:3000${ep.path}`;
    const authHeader = ep.authRequired ? '  -H "Authorization: Bearer <TOKEN>" \\\n' : '';
    const bodyParams = ep.parameters?.filter((p) => p.paramIn === 'body') || [];
    const sampleBodyObj: Record<string, any> = {};
    bodyParams.forEach((p) => {
      sampleBodyObj[p.name] = p.defaultValue || (p.dataType === 'number' ? 123 : 'example_value');
    });
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(ep.method) && bodyParams.length > 0;
    const bodyStr = JSON.stringify(sampleBodyObj, null, 2);

    if (lang === 'curl') {
      let cmd = `curl -X ${ep.method} "${fullUrl}" \\\n`;
      cmd += '  -H "Content-Type: application/json" \\\n';
      if (authHeader) cmd += authHeader;
      if (hasBody) {
        cmd += `  -d '${JSON.stringify(sampleBodyObj)}'`;
      }
      return cmd.trim();
    } else if (lang === 'js') {
      return `const response = await fetch("${fullUrl}", {
  method: "${ep.method}",
  headers: {
    "Content-Type": "application/json",${ep.authRequired ? '\n    "Authorization": "Bearer <TOKEN>",' : ''}
  },${hasBody ? `\n  body: JSON.stringify(${bodyStr.replace(/\n/g, '\n  ')})` : ''}
});
const data = await response.json();
console.log(data);`;
    } else {
      return `import requests

url = "${fullUrl}"
headers = {
    "Content-Type": "application/json",${ep.authRequired ? '\n    "Authorization": "Bearer <TOKEN>",' : ''}
}
${hasBody ? `payload = ${bodyStr}\n\nresponse = requests.${ep.method.toLowerCase()}(url, json=payload, headers=headers)` : `response = requests.${ep.method.toLowerCase()}(url, headers=headers)`}

print(response.status_code)
print(response.json())`;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="border-b border-white/[0.08] pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <span>Interactive API Documentation</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1.5">
          Auto-generated human-readable reference, contract details, and copyable client code samples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Endpoint Navigation Sidebar */}
        <div className="lg:col-span-4 glass-card border border-white/[0.08] rounded-2xl p-4 max-h-[calc(100vh-14rem)] overflow-y-auto space-y-1">
          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-2 flex items-center justify-between">
            <span>Endpoints</span>
            <span className="text-indigo-400">({endpoints.length})</span>
          </div>
          {endpoints.map((ep) => {
            const isSelected = (currentEndpoint?.id || endpoints[0]?.id) === ep.id;
            return (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpointId(ep.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border-l-2 border-transparent'
                }`}
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
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
                <span className="truncate flex-1">{ep.path}</span>
                {ep.authRequired && <Lock className="h-3 w-3 text-amber-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Endpoint Detailed Documentation */}
        <div className="lg:col-span-8 space-y-6">
          {currentEndpoint ? (
            <div className="p-6 rounded-2xl glass-card border border-white/[0.08] space-y-6 shadow-xl">
              {/* Endpoint Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-mono font-bold ${
                      currentEndpoint.method === 'GET'
                        ? 'badge-get'
                        : currentEndpoint.method === 'POST'
                        ? 'badge-post'
                        : currentEndpoint.method === 'PUT'
                        ? 'badge-put'
                        : currentEndpoint.method === 'PATCH'
                        ? 'badge-patch'
                        : 'badge-delete'
                    }`}
                  >
                    {currentEndpoint.method}
                  </span>
                  <span className="text-xl font-mono font-bold text-white">{currentEndpoint.path}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {currentEndpoint.detectionType}
                  </span>
                  {currentEndpoint.authRequired && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Lock className="h-3 w-3" />
                      <span>Auth Required</span>
                    </span>
                  )}
                  <Link
                    to={`/projects/${analysis.project.id}/playground`}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors"
                  >
                    <PlaySquare className="h-3.5 w-3.5" />
                    <span>Test in Playground</span>
                  </Link>
                  <Link
                    to={`/projects/${analysis.project.id}/swagger`}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Swagger UI</span>
                  </Link>
                </div>
              </div>

              {/* Purpose & Explanation */}
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>Purpose & Business Logic</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentEndpoint.purpose ||
                    currentEndpoint.description ||
                    'Discovered route handler handling client requests for this resource.'}
                </p>
                <div className="text-[11px] font-mono text-slate-500 pt-1">
                  Handler: {currentEndpoint.controllerName || 'inline'}.{currentEndpoint.handlerFunction || 'anonymous'} ({currentEndpoint.sourceFile}:{currentEndpoint.lineStart || 1})
                </div>
              </div>

              {/* Parameters Table */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Parameters</h3>
                {currentEndpoint.parameters && currentEndpoint.parameters.length > 0 ? (
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 font-mono text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Field</th>
                          <th className="py-2.5 px-3">Location</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Required</th>
                          <th className="py-2.5 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {currentEndpoint.parameters.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3 text-indigo-400 font-bold">{p.name}</td>
                            <td className="py-2.5 px-3 text-slate-400">{p.paramIn}</td>
                            <td className="py-2.5 px-3 text-slate-300">{p.dataType}</td>
                            <td className="py-2.5 px-3">
                              {p.required ? (
                                <span className="text-rose-400">true</span>
                              ) : (
                                <span className="text-slate-500">false</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 font-sans">{p.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No query, path, or body parameters required.</p>
                )}
              </div>

              {/* Responses Table */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Responses</h3>
                <div className="space-y-2">
                  {(currentEndpoint.responses || [{ statusCode: 200, description: 'Success', contentType: 'application/json' }]).map((r, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            r.statusCode < 300
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {r.statusCode}
                        </span>
                        <span className="text-slate-200">{r.description || 'Response contract'}</span>
                      </div>
                      <span className="font-mono text-slate-500 text-[11px]">{r.contentType || 'application/json'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Snippet Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-white">Client Code Snippet</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setActiveSnippetLang('curl')}
                      className={`px-2 py-1 rounded ${
                        activeSnippetLang === 'curl' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      onClick={() => setActiveSnippetLang('js')}
                      className={`px-2 py-1 rounded ${
                        activeSnippetLang === 'js' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Fetch
                    </button>
                    <button
                      onClick={() => setActiveSnippetLang('python')}
                      className={`px-2 py-1 rounded ${
                        activeSnippetLang === 'python' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Python
                    </button>
                  </div>
                </div>

                <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <button
                    onClick={() => copyToClipboard(generateSnippet(currentEndpoint, activeSnippetLang))}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <pre>{generateSnippet(currentEndpoint, activeSnippetLang)}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm">
              Select an endpoint to inspect documentation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
