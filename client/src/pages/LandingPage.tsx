import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Code2,
  FileCode,
  Network,
  Workflow,
  ShieldCheck,
  Bot,
  PlaySquare,
  Sparkles,
  CheckCircle2,
  GitBranch,
  Database,
  Cpu,
  Terminal,
  Layers,
  Zap,
  Lock,
  ExternalLink,
  ChevronRight,
  Boxes,
  Activity,
  Check,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';

export const LandingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ast' | 'spec' | 'graph'>('ast');

  const supportedFrameworks = [
    { name: 'PHP Laravel', badge: 'Migrations, Eloquent & Routes', color: 'from-red-500/20 to-red-700/10 text-red-300 border-red-500/30' },
    { name: 'NestJS Enterprise', badge: 'Decorators, DTOs & Guards', color: 'from-pink-500/20 to-pink-700/10 text-pink-300 border-pink-500/30' },
    { name: 'Ruby on Rails', badge: 'ActiveRecord & Resources', color: 'from-rose-500/20 to-rose-700/10 text-rose-300 border-rose-500/30' },
    { name: 'Rust (Axum & Actix)', badge: 'Async Structs & Extractors', color: 'from-amber-600/20 to-amber-800/10 text-amber-300 border-amber-600/30' },
    { name: 'Node.js / Express', badge: 'v4.x - v5.x', color: 'from-emerald-500/20 to-emerald-700/10 text-emerald-300 border-emerald-500/30' },
    { name: 'Next.js & Nuxt', badge: 'App & Pages Route Handlers', color: 'from-slate-500/20 to-slate-700/10 text-slate-300 border-slate-500/30' },
    { name: 'Python FastAPI & Flask', badge: 'Pydantic & ASGI', color: 'from-blue-500/20 to-blue-700/10 text-blue-300 border-blue-500/30' },
    { name: 'Python Django REST', badge: 'DRF ModelViewSets & Routers', color: 'from-teal-500/20 to-teal-700/10 text-teal-300 border-teal-500/30' },
    { name: 'Go Gin & Fiber', badge: 'Static Struct AST', color: 'from-cyan-500/20 to-cyan-700/10 text-cyan-300 border-cyan-500/30' },
    { name: 'Java Spring Boot', badge: 'REST Controller & JPA', color: 'from-orange-500/20 to-orange-700/10 text-orange-300 border-orange-500/30' },
    { name: 'C# / ASP.NET Core', badge: 'EF Core & Minimal APIs', color: 'from-purple-500/20 to-purple-700/10 text-purple-300 border-purple-500/30' },
    { name: 'Universal SQL & AST', badge: 'Polyglot Heuristic Fallback', color: 'from-amber-500/20 to-amber-700/10 text-amber-300 border-amber-500/30' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">
      {/* Background Aurora Radial Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-120px] left-[15%] w-[550px] h-[550px] rounded-full bg-indigo-600/15 blur-[140px]" />
        <div className="absolute top-[-80px] right-[20%] w-[500px] h-[500px] rounded-full bg-purple-600/15 blur-[140px]" />
        <div className="absolute top-[200px] left-[35%] w-[450px] h-[450px] rounded-full bg-cyan-600/10 blur-[130px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-60 radial-mask-top" />
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-6xl mx-auto px-6 text-center">
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-8 backdrop-blur-md shadow-lg shadow-indigo-500/10 hover:border-indigo-500/50 transition-all">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            <span className="font-semibold text-white">REVERSE ENGINEERING 2.0</span>
            <span className="text-slate-500">•</span>
            <span>Static AST Parsers + Grounded LLM AI</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08]">
            Turn Undocumented Backends into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-sky-300 to-purple-400">
              Living API Contracts
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Extract complete REST endpoints, controller handlers, database models, and auth guards from raw source code.
            Instant Swagger 3.0, Postman collections, architectural pipeline graphs, and live testing in seconds.
          </p>

          {/* Call to Actions */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/projects/new"
              className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Analyze Backend Repository</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 hover:border-white/20 font-medium text-sm transition-all shadow-md backdrop-blur-md"
            >
              <Cpu className="h-4 w-4 text-indigo-400" />
              <span>Explore Active Projects</span>
            </Link>
          </div>

          {/* Key Stat Pillars */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-sm">
              <div className="text-2xl font-extrabold text-white">100%</div>
              <div className="text-xs font-semibold text-indigo-300 mt-0.5">Static AST Analysis</div>
              <div className="text-[11px] text-slate-400 mt-1">Parses code without executing or running untrusted scripts</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-sm">
              <div className="text-2xl font-extrabold text-white">12+</div>
              <div className="text-xs font-semibold text-sky-300 mt-0.5">Frameworks & Languages</div>
              <div className="text-[11px] text-slate-400 mt-1">Laravel, NestJS, Rails, Rust, Express, Python, Go, Java, .NET, Next.js, SQL</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-sm">
              <div className="text-2xl font-extrabold text-white">OpenAPI 3.0</div>
              <div className="text-xs font-semibold text-purple-300 mt-0.5">Spec Generation</div>
              <div className="text-[11px] text-slate-400 mt-1">Export standard YAML & JSON for any client SDK generator</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-sm">
              <div className="text-2xl font-extrabold text-white">&lt; 3.2s</div>
              <div className="text-xs font-semibold text-emerald-300 mt-0.5">Extraction Speed</div>
              <div className="text-[11px] text-slate-400 mt-1">Sub-second AST parsing across multi-tier repositories</div>
            </div>
          </div>

          {/* Interactive Live Cockpit Demo Preview */}
          <div className="mt-16 rounded-2xl border border-white/[0.1] bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 max-w-5xl mx-auto overflow-hidden text-left">
            {/* Window Topbar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-slate-950/90">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-xs font-mono text-slate-400 ml-2">reverse-api-telemetry // demo-ecommerce-repo</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('ast')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === 'ast' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AST Discovery
                </button>
                <button
                  onClick={() => setActiveTab('spec')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === 'spec' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  OpenAPI Spec
                </button>
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === 'graph' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pipeline Trace
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="p-6 font-mono text-xs text-slate-300 bg-slate-950/70 min-h-[280px]">
              {activeTab === 'ast' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-5 space-y-2 border-r border-slate-800/80 pr-4">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">AST Parser Tree</div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-emerald-400">routes/auth.routes.js</span>
                      <span className="text-[10px] text-slate-400">3 Endpoints</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-emerald-400">routes/products.routes.js</span>
                      <span className="text-[10px] text-slate-400">5 Endpoints</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-emerald-400">controllers/order.controller.js</span>
                      <span className="text-[10px] text-slate-400">4 Handlers</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-cyan-400">models/Order.schema.js</span>
                      <span className="text-[10px] text-slate-400">Mongoose / SQL</span>
                    </div>
                  </div>

                  <div className="md:col-span-7 space-y-3">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Live Discovered Contracts</div>
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="badge-post px-2 py-0.5 rounded text-[11px]">POST</span>
                          <span className="text-white font-semibold">/api/v1/auth/login</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">200 OK • JWT</span>
                      </div>
                      <p className="text-slate-400 text-[11px] font-sans">
                        Authenticates user credentials and signs access tokens with role metadata.
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                        <span>Params: [email, password]</span>
                        <span>•</span>
                        <span className="text-amber-400">Rate Limited</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="badge-get px-2 py-0.5 rounded text-[11px]">GET</span>
                          <span className="text-white font-semibold">/api/v1/orders/:id</span>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-mono">Protected</span>
                      </div>
                      <p className="text-slate-400 text-[11px] font-sans">
                        Retrieves detailed invoice order payload with associated items and shipping status.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'spec' && (
                <div className="space-y-2 text-slate-300">
                  <div className="text-indigo-400 font-bold">openapi: 3.0.3</div>
                  <div className="text-slate-400 pl-2">info:</div>
                  <div className="text-slate-300 pl-4">title: "Reverse-Engineered Backend API"</div>
                  <div className="text-slate-300 pl-4">version: "1.0.0"</div>
                  <div className="text-slate-400 pl-2">paths:</div>
                  <div className="text-emerald-400 pl-4">/api/v1/users:</div>
                  <div className="text-sky-400 pl-6">get:</div>
                  <div className="text-slate-300 pl-8">summary: "Fetch paginated users directory"</div>
                  <div className="text-slate-300 pl-8">security: [BearerAuth: []]</div>
                  <div className="text-slate-500 pl-4 italic"># 100% compliant with standard Swagger & Postman tooling</div>
                </div>
              )}

              {activeTab === 'graph' && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 text-center">
                  <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/30 w-full">
                    <div className="text-[10px] text-indigo-400 font-bold">HTTP REQUEST</div>
                    <div className="text-white font-semibold text-xs mt-1">/api/v1/checkout</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-600 hidden md:block" />
                  <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/30 w-full">
                    <div className="text-[10px] text-amber-400 font-bold">MIDDLEWARE</div>
                    <div className="text-white font-semibold text-xs mt-1">authGuard.verifyToken</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-600 hidden md:block" />
                  <div className="p-3 rounded-lg bg-sky-950/60 border border-sky-500/30 w-full">
                    <div className="text-[10px] text-sky-400 font-bold">CONTROLLER</div>
                    <div className="text-white font-semibold text-xs mt-1">createPaymentIntent</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-600 hidden md:block" />
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/30 w-full">
                    <div className="text-[10px] text-emerald-400 font-bold">DATABASE MODEL</div>
                    <div className="text-white font-semibold text-xs mt-1">OrderSchema.save()</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Supported Multi-Language Ecosystems */}
      <section className="py-12 border-y border-white/[0.08] bg-slate-950/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
              Supported Multi-Language Architectures
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {supportedFrameworks.map((fw) => (
              <div
                key={fw.name}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r border text-xs font-medium shadow-sm ${fw.color}`}
              >
                <Boxes className="h-4 w-4" />
                <span className="font-semibold text-white">{fw.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950/60 border border-white/10">
                  {fw.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Matrix Grid */}
      <section className="py-20 bg-slate-950 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Enterprise-Grade Reverse Engineering Toolkit
            </h2>
            <p className="mt-3 text-slate-400 text-sm">
              Replace multiple disconnected developer tools with one cohesive, AST-grounded intelligence studio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="glass-card p-6 rounded-2xl relative group">
              <div className="h-11 w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FileCode className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Swagger Studio & OpenAPI 3.0</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generate production-grade OpenAPI specifications with complete schemas, query parameters, headers, and response status codes.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card p-6 rounded-2xl relative group">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Workflow className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">CI/CD Pipeline Flow</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Visualize architectural execution flow between Routes, Middleware guards, Controllers, and Database models with React Flow.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-6 rounded-2xl relative group">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Database Schema & ER Diagrams</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Extract Mongoose schemas, Sequelize definitions, and Prisma ORM entities into interactive entity-relationship diagrams.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass-card p-6 rounded-2xl relative group">
              <div className="h-11 w-11 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Static Security & Auth Audit</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Identify unprotected endpoints, missing authentication middleware, hard-coded tokens, and dangerous parameter injections.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass-card p-6 rounded-2xl relative group">
              <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <PlaySquare className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">API Playground Pro</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                3-column Postman-grade console with real-time request builder, path variable interpolation, auth tokens, and response telemetry.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="glass-card p-6 rounded-2xl relative group">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Grounded AI Codebase Chat</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ask architectural and operational questions with answers backed by AST-indexed route handlers and exact file line citations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-white/[0.08] bg-slate-950/80 backdrop-blur-md text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">ReverseAPI Intelligence Platform</span>
            <span>•</span>
            <span>Next-Gen API Reverse Engineering</span>
          </div>
          <div className="font-mono text-slate-600">
            Node.js • Express • TypeScript • Babel AST • React 18 • Vite
          </div>
        </div>
      </footer>
    </div>
  );
};
