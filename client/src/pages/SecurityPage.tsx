import React, { useContext, useState } from 'react';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileCode,
  Lightbulb,
} from 'lucide-react';
import { SecurityFinding } from '../types';

export const SecurityPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  if (loading || !analysis) return null;

  const findings = analysis.securityFindings || [];

  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  const filteredFindings = findings.filter(
    (f) => selectedSeverity === 'ALL' || f.severity === selectedSeverity
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="border-b border-white/[0.08] pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <span>Static Security & Auth Audit</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1.5">
          Automated heuristic security analysis scanning for authentication gaps, injection risks, and sensitive data leakage.
        </p>
      </div>

      {/* Security Disclaimer Banner */}
      <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 backdrop-blur-md">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="text-amber-300">Static Analysis Scope Notice:</strong> These findings are static AST analysis heuristics to assist code review. A clean scan does not certify an application as safe from runtime or business logic vulnerabilities.
        </div>
      </div>

      {/* Severity Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedSeverity(selectedSeverity === 'critical' ? 'ALL' : 'critical')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedSeverity === 'critical'
              ? 'ring-2 ring-rose-500 bg-rose-500/20 border-rose-500 glow-rose'
              : 'glass-card border-white/[0.08] hover:border-rose-500/40'
          }`}
        >
          <div className="text-xs text-rose-300 font-mono font-bold uppercase tracking-wider">Critical</div>
          <div className="text-3xl font-black text-rose-400 mt-1">{counts.critical}</div>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === 'high' ? 'ALL' : 'high')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedSeverity === 'high'
              ? 'ring-2 ring-orange-500 bg-orange-500/20 border-orange-500'
              : 'glass-card border-white/[0.08] hover:border-orange-500/40'
          }`}
        >
          <div className="text-xs text-orange-300 font-mono font-bold uppercase tracking-wider">High</div>
          <div className="text-3xl font-black text-orange-400 mt-1">{counts.high}</div>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === 'medium' ? 'ALL' : 'medium')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedSeverity === 'medium'
              ? 'ring-2 ring-amber-500 bg-amber-500/20 border-amber-500'
              : 'glass-card border-white/[0.08] hover:border-amber-500/40'
          }`}
        >
          <div className="text-xs text-amber-300 font-mono font-bold uppercase tracking-wider">Medium</div>
          <div className="text-3xl font-black text-amber-400 mt-1">{counts.medium}</div>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === 'low' ? 'ALL' : 'low')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedSeverity === 'low'
              ? 'ring-2 ring-blue-500 bg-blue-500/20 border-blue-500'
              : 'glass-card border-white/[0.08] hover:border-blue-500/40'
          }`}
        >
          <div className="text-xs text-blue-300 font-mono font-bold uppercase tracking-wider">Low / Info</div>
          <div className="text-3xl font-black text-blue-400 mt-1">{counts.low}</div>
        </button>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30">
            <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No security warnings found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No static rule violations match the current severity filter.
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const sevColor =
              finding.severity === 'critical'
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                : finding.severity === 'high'
                ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                : finding.severity === 'medium'
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : 'text-blue-400 bg-blue-500/10 border-blue-500/30';

            return (
              <div
                key={finding.id}
                className="p-6 rounded-2xl glass-card border border-white/[0.08] space-y-4 hover:border-indigo-500/30 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${sevColor}`}>
                      {finding.severity}
                    </span>
                    <h3 className="text-base font-bold text-white">{finding.title}</h3>
                  </div>

                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-white/10">
                    {finding.category}
                  </span>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{finding.description}</p>

                {/* Recommendation */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Lightbulb className="h-4 w-4" />
                    <span>Recommended Remediation</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{finding.recommendation}</p>
                </div>

                {/* Source File Location */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-slate-500" />
                    <span>
                      {finding.sourceFile}
                      {finding.lineNumber && `:${finding.lineNumber}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase">{finding.detectionType}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
