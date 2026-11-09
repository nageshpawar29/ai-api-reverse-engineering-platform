import React, { useContext, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectContext } from '../components/layout/ProjectLayout';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  Position,
  Handle,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Network,
  Filter,
  Search,
  Layers,
  Database,
  Cpu,
  Code2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Server,
  Workflow,
  Boxes,
  FileCode,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  Sparkles,
  Activity,
  Flame,
  Zap,
  RotateCcw,
  Compass,
  X,
  PlaySquare,
} from 'lucide-react';
import { ApiEndpoint, DatabaseModel, DependencyNode } from '../types';

// Node category types
type NodeCategory = 'route' | 'middleware' | 'controller' | 'service' | 'model' | 'external';
type LayoutMode = 'pipeline' | 'hierarchical' | 'domain';

interface NodeData {
  id: string;
  label: string;
  sublabel?: string;
  category: NodeCategory;
  method?: string;
  authRequired?: boolean;
  meta: any;
  inDegree: number;
  outDegree: number;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  isSource?: boolean;
  isUpstream?: boolean;
  isDownstream?: boolean;
  blastRole?: 'root' | 'upstream' | 'downstream' | null;
  healthWarning?: string;
}

// Method styling helper
const getMethodBadge = (method?: string) => {
  switch (method?.toUpperCase()) {
    case 'GET':
      return { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', dot: 'bg-emerald-400' };
    case 'POST':
      return { bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40', dot: 'bg-blue-400' };
    case 'PUT':
      return { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', dot: 'bg-amber-400' };
    case 'PATCH':
      return { bg: 'bg-purple-500/20 text-purple-400 border-purple-500/40', dot: 'bg-purple-400' };
    case 'DELETE':
      return { bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40', dot: 'bg-rose-400' };
    default:
      return { bg: 'bg-slate-500/20 text-slate-400 border-slate-500/40', dot: 'bg-slate-400' };
  }
};

// Custom Node Component for high-fidelity React Flow rendering
const ArchitectureNode: React.FC<{ data: NodeData; selected: boolean }> = ({ data, selected }) => {
  const methodStyle = data.method ? getMethodBadge(data.method) : null;

  // Determine border and halo styles
  let borderClasses = 'border-slate-800 bg-slate-900/90 hover:border-slate-700';
  let haloClasses = '';

  if (data.isSource || selected) {
    borderClasses = 'border-amber-400 bg-slate-900 shadow-[0_0_25px_rgba(251,191,36,0.45)] ring-2 ring-amber-400/50';
  } else if (data.isUpstream) {
    borderClasses = 'border-cyan-400 bg-slate-900 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/50';
  } else if (data.isDownstream) {
    borderClasses = 'border-purple-400 bg-slate-900 shadow-[0_0_20px_rgba(168,85,247,0.4)] ring-1 ring-purple-400/50';
  } else if (data.isHighlighted) {
    borderClasses = 'border-indigo-400 bg-slate-900 ring-2 ring-indigo-400/50';
  }

  const dimOpacity = data.isDimmed ? 'opacity-25 grayscale-[60%]' : 'opacity-100';

  // Category Icon & Accent Header
  const renderCategoryHeader = () => {
    switch (data.category) {
      case 'route':
        return (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${methodStyle?.bg}`}>
                {data.method}
              </span>
              {data.authRequired && (
                <span className="text-[10px] flex items-center gap-0.5 text-amber-400 bg-amber-500/10 px-1 rounded border border-amber-500/30 font-mono">
                  <Shield className="w-2.5 h-2.5" />
                  AUTH
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">ROUTE</span>
          </div>
        );
      case 'middleware':
        return (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-purple-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">GUARD / FILTER</span>
            </div>
            <span className="text-[10px] font-mono text-purple-400/70 uppercase">MIDDLEWARE</span>
          </div>
        );
      case 'controller':
        return (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">HANDLER</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-400/70 uppercase">CONTROLLER</span>
          </div>
        );
      case 'service':
        return (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Boxes className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">BUSINESS LOGIC</span>
            </div>
            <span className="text-[10px] font-mono text-amber-400/70 uppercase">SERVICE</span>
          </div>
        );
      case 'model':
        return (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Database className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">DATABASE ENTITY</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/70 uppercase">MODEL</span>
          </div>
        );
      case 'external':
        return (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-sky-400">
              <Server className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">INTEGRATION</span>
            </div>
            <span className="text-[10px] font-mono text-sky-400/70 uppercase">EXTERNAL</span>
          </div>
        );
    }
  };

  return (
    <div
      className={`rounded-xl border backdrop-blur-md p-3 min-w-[210px] max-w-[260px] shadow-lg transition-all duration-200 cursor-pointer ${borderClasses} ${dimOpacity} ${haloClasses}`}
    >
      {/* 4-way handles for dynamic auto-layouts */}
      <Handle type="target" position={Position.Left} id="in-left" className="!bg-indigo-400 !w-2 !h-2 !border-slate-900" />
      <Handle type="source" position={Position.Right} id="out-right" className="!bg-indigo-400 !w-2 !h-2 !border-slate-900" />
      <Handle type="target" position={Position.Top} id="in-top" className="!bg-indigo-400 !w-2 !h-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!bg-indigo-400 !w-2 !h-2 !border-slate-900" />

      {renderCategoryHeader()}

      <div className="mt-2">
        <div className="text-xs font-mono font-bold text-white truncate" title={data.label}>
          {data.label}
        </div>
        {data.sublabel && (
          <div className="text-[11px] text-slate-400 truncate mt-0.5" title={data.sublabel}>
            {data.sublabel}
          </div>
        )}
      </div>

      {/* Degree Badge & Health indicators */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span title="Incoming dependencies">↓ {data.inDegree} in</span>
          <span title="Outgoing dependencies">↑ {data.outDegree} out</span>
        </div>
        {data.blastRole && (
          <span
            className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] ${
              data.blastRole === 'root'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : data.blastRole === 'upstream'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            }`}
          >
            {data.blastRole}
          </span>
        )}
      </div>
    </div>
  );
};

const customNodeTypes = {
  archNode: ArchitectureNode,
};

export const DependencyGraphPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const navigate = useNavigate();

  // Selected node for deep inspection & Blast Radius
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [blastRadiusActive, setBlastRadiusActive] = useState<boolean>(true);

  // Layout mode: 'pipeline' | 'hierarchical' | 'domain'
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('pipeline');

  // Search query & filtering
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Layer toggles
  const [activeLayers, setActiveLayers] = useState<Record<NodeCategory, boolean>>({
    route: true,
    middleware: true,
    controller: true,
    service: true,
    model: true,
    external: true,
  });

  // UI States
  const [copiedMermaid, setCopiedMermaid] = useState<boolean>(false);
  const [healthBannerOpen, setHealthBannerOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (loading || !analysis) return null;

  const endpoints: ApiEndpoint[] = analysis.endpoints || [];
  const models: DatabaseModel[] = analysis.models || [];
  const rawDependencies: DependencyNode[] = analysis.dependencies || [];

  // 1. Build Unified Raw Graph Data
  const { rawNodes, rawEdges, layerCounts, healthFindings } = useMemo(() => {
    const nodeMap = new Map<string, NodeData>();
    const edgeList: Array<{ id: string; source: string; target: string; relation: string; details?: string }> = [];

    // Counters for layer pills
    const counts: Record<NodeCategory, number> = {
      route: 0,
      middleware: 0,
      controller: 0,
      service: 0,
      model: 0,
      external: 0,
    };

    // Helper to register node
    const ensureNode = (id: string, category: NodeCategory, label: string, sublabel?: string, meta?: any, method?: string, authRequired?: boolean) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label,
          sublabel,
          category,
          method,
          authRequired,
          meta: meta || {},
          inDegree: 0,
          outDegree: 0,
        });
        counts[category]++;
      }
      return nodeMap.get(id)!;
    };

    // A. Register Route Nodes
    endpoints.forEach((ep) => {
      const routeId = `route-${ep.id}`;
      ensureNode(
        routeId,
        'route',
        `${ep.method} ${ep.path}`,
        ep.purpose || ep.summary,
        ep,
        ep.method,
        ep.authRequired
      );

      // Register middlewares
      if (ep.middleware && ep.middleware.length > 0) {
        ep.middleware.forEach((mw) => {
          const mwId = `mw-${mw}`;
          ensureNode(mwId, 'middleware', mw, 'Security / Validation Interceptor', { name: mw });
          edgeList.push({
            id: `e-${routeId}-${mwId}`,
            source: routeId,
            target: mwId,
            relation: 'intercepts',
            details: 'Request Interceptor Guard',
          });

          // Connect middleware to controller
          const ctrlName = ep.controllerName || ep.handlerFunction || 'Controller';
          const ctrlId = `ctrl-${ctrlName}`;
          ensureNode(ctrlId, 'controller', ctrlName, ep.sourceFile, { name: ctrlName, file: ep.sourceFile });
          edgeList.push({
            id: `e-${mwId}-${ctrlId}`,
            source: mwId,
            target: ctrlId,
            relation: 'calls',
            details: 'Passes verified request to handler',
          });
        });
      }

      // Register Controller Node
      const ctrlName = ep.controllerName || ep.handlerFunction || 'Controller';
      const ctrlId = `ctrl-${ctrlName}`;
      ensureNode(ctrlId, 'controller', ctrlName, ep.sourceFile, { name: ctrlName, file: ep.sourceFile });
      edgeList.push({
        id: `e-${routeId}-${ctrlId}`,
        source: routeId,
        target: ctrlId,
        relation: 'calls',
        details: 'Dispatches HTTP request to handler',
      });
    });

    // B. Register Model Nodes
    models.forEach((m) => {
      const modelId = `model-${m.name}`;
      ensureNode(
        modelId,
        'model',
        m.name,
        `${m.fields?.length || 0} fields • ${m.ormType || 'ORM'}`,
        m
      );
    });

    // C. Process Extracted Dependencies from Backend AST Analysis
    rawDependencies.forEach((dep) => {
      let srcId = '';
      let tgtId = '';

      // Normalize source
      if (dep.sourceType === 'route') {
        const ep = endpoints.find((e) => `${e.method} ${e.path}` === dep.sourceId || e.id === dep.sourceId);
        srcId = ep ? `route-${ep.id}` : `route-${dep.sourceId}`;
        ensureNode(srcId, 'route', dep.sourceLabel || dep.sourceId, undefined, dep);
      } else if (dep.sourceType === 'middleware') {
        srcId = `mw-${dep.sourceId}`;
        ensureNode(srcId, 'middleware', dep.sourceLabel || dep.sourceId, undefined, dep);
      } else if (dep.sourceType === 'controller') {
        srcId = `ctrl-${dep.sourceId}`;
        ensureNode(srcId, 'controller', dep.sourceLabel || dep.sourceId, undefined, dep);
      } else if (dep.sourceType === 'service') {
        srcId = `svc-${dep.sourceId}`;
        ensureNode(srcId, 'service', dep.sourceLabel || dep.sourceId, 'Business Logic Service', dep);
      }

      // Normalize target
      if (dep.targetType === 'middleware') {
        tgtId = `mw-${dep.targetId}`;
        ensureNode(tgtId, 'middleware', dep.targetLabel || dep.targetId, undefined, dep);
      } else if (dep.targetType === 'controller') {
        tgtId = `ctrl-${dep.targetId}`;
        ensureNode(tgtId, 'controller', dep.targetLabel || dep.targetId, undefined, dep);
      } else if (dep.targetType === 'service') {
        tgtId = `svc-${dep.targetId}`;
        ensureNode(tgtId, 'service', dep.targetLabel || dep.targetId, 'Business Logic Service', dep);
      } else if (dep.targetType === 'model') {
        tgtId = `model-${dep.targetId}`;
        const foundM = models.find((m) => m.name.toLowerCase() === dep.targetId.toLowerCase());
        ensureNode(tgtId, 'model', dep.targetLabel || dep.targetId, foundM ? `${foundM.fields?.length || 0} fields` : undefined, foundM || dep);
      } else if (dep.targetType === 'external') {
        tgtId = `ext-${dep.targetId}`;
        ensureNode(tgtId, 'external', dep.targetLabel || dep.targetId, '3rd Party Cloud / API', dep);
      }

      if (srcId && tgtId && srcId !== tgtId) {
        const eId = `e-${srcId}-${tgtId}`;
        if (!edgeList.some((e) => e.id === eId)) {
          edgeList.push({
            id: eId,
            source: srcId,
            target: tgtId,
            relation: dep.relationType || 'uses',
            details: dep.details,
          });
        }
      }
    });

    // D. Connect Services to Models by naming heuristic if not already linked
    nodeMap.forEach((node) => {
      if (node.category === 'controller' || node.category === 'service') {
        models.forEach((m) => {
          const cleanName = m.name.toLowerCase().replace(/s$/, '');
          const cleanNode = node.label.toLowerCase();
          if (cleanNode.includes(cleanName)) {
            const modelNodeId = `model-${m.name}`;
            const edgeId = `e-${node.id}-${modelNodeId}`;
            if (!edgeList.some((e) => e.id === edgeId)) {
              edgeList.push({
                id: edgeId,
                source: node.id,
                target: modelNodeId,
                relation: 'queries',
                details: `Data persistence on ${m.name}`,
              });
            }
          }
        });
      }
    });

    // Calculate In-Degree and Out-Degree
    edgeList.forEach((e) => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (src) src.outDegree += 1;
      if (tgt) tgt.inDegree += 1;
    });

    // E. Architectural Health & Anti-Pattern Audit
    const findings: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; desc: string; nodeIds: string[] }> = [];

    // 1. Check for Public routes directly mutating database models
    endpoints.forEach((ep) => {
      if (!ep.authRequired && (ep.method === 'POST' || ep.method === 'DELETE' || ep.method === 'PUT')) {
        findings.push({
          id: `unauth-mutation-${ep.id}`,
          severity: 'warning',
          title: `Unauthenticated Mutation: ${ep.method} ${ep.path}`,
          desc: `Publicly accessible endpoint modifies state without detected authentication middleware.`,
          nodeIds: [`route-${ep.id}`],
        });
      }
    });

    // 2. Orphaned Models Check (Models with 0 queries)
    models.forEach((m) => {
      const mNode = nodeMap.get(`model-${m.name}`);
      if (mNode && mNode.inDegree === 0) {
        findings.push({
          id: `orphan-model-${m.name}`,
          severity: 'info',
          title: `Orphaned Model: ${m.name}`,
          desc: `Model is defined in schemas but no controllers or services were observed querying it directly.`,
          nodeIds: [`model-${m.name}`],
        });
      }
    });

    // 3. Layer Skipping Check (Controllers querying models directly when services exist)
    const hasServices = Array.from(nodeMap.values()).some((n) => n.category === 'service');
    if (hasServices) {
      edgeList.forEach((e) => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (src?.category === 'controller' && tgt?.category === 'model') {
          findings.push({
            id: `layer-skipping-${src.id}-${tgt.id}`,
            severity: 'warning',
            title: `Layer Skipping: ${src.label} → ${tgt.label}`,
            desc: `Controller accesses database model directly instead of through a service abstraction layer.`,
            nodeIds: [src.id, tgt.id],
          });
        }
      });
    }

    return {
      rawNodes: Array.from(nodeMap.values()),
      rawEdges: edgeList,
      layerCounts: counts,
      healthFindings: findings,
    };
  }, [endpoints, models, rawDependencies]);

  // 2. Blast Radius & Impact Analysis Engine
  const { blastRadiusNodes, upstreamNodes, downstreamNodes, impactMetrics } = useMemo(() => {
    if (!selectedNodeId || !blastRadiusActive) {
      return {
        blastRadiusNodes: new Set<string>(),
        upstreamNodes: new Set<string>(),
        downstreamNodes: new Set<string>(),
        impactMetrics: null,
      };
    }

    // Traverse Upstream (Callers / Consumers) via BFS
    const upstream = new Set<string>();
    const queueUp = [selectedNodeId];
    while (queueUp.length > 0) {
      const curr = queueUp.shift()!;
      rawEdges.forEach((e) => {
        if (e.target === curr && !upstream.has(e.source) && e.source !== selectedNodeId) {
          upstream.add(e.source);
          queueUp.push(e.source);
        }
      });
    }

    // Traverse Downstream (Callees / Dependencies) via BFS
    const downstream = new Set<string>();
    const queueDown = [selectedNodeId];
    while (queueDown.length > 0) {
      const curr = queueDown.shift()!;
      rawEdges.forEach((e) => {
        if (e.source === curr && !downstream.has(e.target) && e.target !== selectedNodeId) {
          downstream.add(e.target);
          queueDown.push(e.target);
        }
      });
    }

    const allImpacted = new Set<string>([selectedNodeId, ...upstream, ...downstream]);

    // Compute Impact Metrics
    let impactedRoutes = 0;
    let impactedControllers = 0;
    let impactedServices = 0;
    let impactedModels = 0;

    allImpacted.forEach((id) => {
      const n = rawNodes.find((node) => node.id === id);
      if (n) {
        if (n.category === 'route') impactedRoutes++;
        else if (n.category === 'controller') impactedControllers++;
        else if (n.category === 'service') impactedServices++;
        else if (n.category === 'model') impactedModels++;
      }
    });

    let severityScore: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    if (impactedRoutes >= 4 || (impactedRoutes >= 2 && impactedModels >= 2)) severityScore = 'CRITICAL';
    else if (impactedRoutes >= 2 || impactedServices >= 2) severityScore = 'HIGH';
    else if (impactedRoutes >= 1) severityScore = 'MODERATE';

    return {
      blastRadiusNodes: allImpacted,
      upstreamNodes: upstream,
      downstreamNodes: downstream,
      impactMetrics: {
        total: allImpacted.size,
        routes: impactedRoutes,
        controllers: impactedControllers,
        services: impactedServices,
        models: impactedModels,
        severity: severityScore,
      },
    };
  }, [selectedNodeId, blastRadiusActive, rawNodes, rawEdges]);

  // 3. Multi-Layout Positioning Engine
  const { flowNodes, flowEdges } = useMemo(() => {
    // Filter active layers and search query
    const filteredRawNodes = rawNodes.filter((node) => {
      if (!activeLayers[node.category]) return false;
      return true;
    });

    const activeNodeIds = new Set(filteredRawNodes.map((n) => n.id));

    // Filter edges where both source and target are active
    const filteredEdges = rawEdges.filter(
      (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
    );

    // Group nodes by category for column-based layout
    const categorized: Record<NodeCategory, NodeData[]> = {
      route: [],
      middleware: [],
      controller: [],
      service: [],
      model: [],
      external: [],
    };

    filteredRawNodes.forEach((n) => {
      categorized[n.category].push(n);
    });

    const nodes: Node[] = [];

    // LAYOUT 1: Left-to-Right Architecture Pipeline
    if (layoutMode === 'pipeline') {
      const columnX: Record<NodeCategory, number> = {
        route: 50,
        middleware: 360,
        controller: 670,
        service: 980,
        model: 1290,
        external: 1600,
      };

      (Object.keys(categorized) as NodeCategory[]).forEach((cat) => {
        const catNodes = categorized[cat];
        let currentY = 60;
        const spacingY = 120;

        catNodes.forEach((nodeData) => {
          const isSelected = selectedNodeId === nodeData.id;
          const isUp = upstreamNodes.has(nodeData.id);
          const isDown = downstreamNodes.has(nodeData.id);
          const inBlast = selectedNodeId ? blastRadiusNodes.has(nodeData.id) : true;
          const matchesSearch =
            searchQuery.trim().length > 0 &&
            (nodeData.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              nodeData.sublabel?.toLowerCase().includes(searchQuery.toLowerCase()));

          const isDimmed =
            (selectedNodeId && blastRadiusActive && !inBlast) ||
            (searchQuery.trim().length > 0 && !matchesSearch);

          const blastRole = isSelected
            ? 'root'
            : isUp
            ? 'upstream'
            : isDown
            ? 'downstream'
            : null;

          nodes.push({
            id: nodeData.id,
            type: 'archNode',
            data: {
              ...nodeData,
              isSource: isSelected,
              isUpstream: isUp,
              isDownstream: isDown,
              isHighlighted: matchesSearch,
              isDimmed,
              blastRole,
            },
            position: { x: columnX[cat], y: currentY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });

          currentY += spacingY;
        });
      });
    }

    // LAYOUT 2: Top-to-Bottom Hierarchical Tree
    else if (layoutMode === 'hierarchical') {
      const rowY: Record<NodeCategory, number> = {
        route: 60,
        middleware: 240,
        controller: 420,
        service: 600,
        model: 780,
        external: 960,
      };

      (Object.keys(categorized) as NodeCategory[]).forEach((cat) => {
        const catNodes = categorized[cat];
        let currentX = 60;
        const spacingX = 280;

        catNodes.forEach((nodeData) => {
          const isSelected = selectedNodeId === nodeData.id;
          const isUp = upstreamNodes.has(nodeData.id);
          const isDown = downstreamNodes.has(nodeData.id);
          const inBlast = selectedNodeId ? blastRadiusNodes.has(nodeData.id) : true;
          const matchesSearch =
            searchQuery.trim().length > 0 &&
            (nodeData.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              nodeData.sublabel?.toLowerCase().includes(searchQuery.toLowerCase()));

          const isDimmed =
            (selectedNodeId && blastRadiusActive && !inBlast) ||
            (searchQuery.trim().length > 0 && !matchesSearch);

          const blastRole = isSelected
            ? 'root'
            : isUp
            ? 'upstream'
            : isDown
            ? 'downstream'
            : null;

          nodes.push({
            id: nodeData.id,
            type: 'archNode',
            data: {
              ...nodeData,
              isSource: isSelected,
              isUpstream: isUp,
              isDownstream: isDown,
              isHighlighted: matchesSearch,
              isDimmed,
              blastRole,
            },
            position: { x: currentX, y: rowY[cat] },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
          });

          currentX += spacingX;
        });
      });
    }

    // LAYOUT 3: Domain / Resource Grouped (Cluster by URI prefix e.g. /users, /products, /auth)
    else {
      // Group routes and associated components by domain keyword
      const domains = ['auth', 'user', 'product', 'order'];
      let clusterX = 60;

      domains.forEach((dom) => {
        let clusterY = 60;
        filteredRawNodes
          .filter((n) => n.label.toLowerCase().includes(dom))
          .forEach((nodeData) => {
            const isSelected = selectedNodeId === nodeData.id;
            const inBlast = selectedNodeId ? blastRadiusNodes.has(nodeData.id) : true;
            const isDimmed = selectedNodeId && blastRadiusActive && !inBlast;

            nodes.push({
              id: nodeData.id,
              type: 'archNode',
              data: {
                ...nodeData,
                isSource: isSelected,
                isDimmed,
              },
              position: { x: clusterX, y: clusterY },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            });
            clusterY += 130;
          });
        clusterX += 340;
      });

      // Remainder nodes in shared column
      let sharedY = 60;
      filteredRawNodes
        .filter((n) => !domains.some((d) => n.label.toLowerCase().includes(d)))
        .forEach((nodeData) => {
          nodes.push({
            id: nodeData.id,
            type: 'archNode',
            data: { ...nodeData },
            position: { x: clusterX, y: sharedY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
          sharedY += 130;
        });
    }

    // Format Edges with Blast Radius Styling & Animations
    const edges: Edge[] = filteredEdges.map((e) => {
      const isSelectedFlow =
        selectedNodeId &&
        blastRadiusActive &&
        blastRadiusNodes.has(e.source) &&
        blastRadiusNodes.has(e.target);

      const isUpstreamEdge = upstreamNodes.has(e.source) || (e.target === selectedNodeId && upstreamNodes.has(e.source));
      const isDownstreamEdge = downstreamNodes.has(e.target) || (e.source === selectedNodeId && downstreamNodes.has(e.target));

      let strokeColor = '#475569';
      let strokeWidth = 1.5;
      let animated = false;

      if (selectedNodeId && blastRadiusActive) {
        if (isSelectedFlow) {
          if (isUpstreamEdge) {
            strokeColor = '#06b6d4'; // Cyan for incoming callers
            strokeWidth = 2.5;
            animated = true;
          } else if (isDownstreamEdge) {
            strokeColor = '#c084fc'; // Purple for downstream dependencies
            strokeWidth = 2.5;
            animated = true;
          } else {
            strokeColor = '#f59e0b';
            strokeWidth = 2.5;
            animated = true;
          }
        } else {
          strokeColor = '#1e293b';
          strokeWidth = 1;
        }
      } else {
        // Normal color based on relation
        if (e.relation === 'intercepts') {
          strokeColor = '#a855f7';
        } else if (e.relation === 'calls') {
          strokeColor = '#6366f1';
        } else if (e.relation === 'uses') {
          strokeColor = '#f59e0b';
        } else if (e.relation === 'queries' || e.relation === 'persists') {
          strokeColor = '#10b981';
        }
      }

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated,
        style: {
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: e.relation === 'intercepts' ? '5 5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [
    rawNodes,
    rawEdges,
    activeLayers,
    layoutMode,
    selectedNodeId,
    blastRadiusActive,
    searchQuery,
    upstreamNodes,
    downstreamNodes,
    blastRadiusNodes,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync state when layout recalculates
  React.useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Handle node selection
  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  // Currently selected node object
  const activeNode = useMemo(() => {
    return rawNodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, rawNodes]);

  // Incoming and Outgoing links for active node
  const activeNodeConnections = useMemo(() => {
    if (!activeNode) return { incoming: [], outgoing: [] };

    const incoming = rawEdges
      .filter((e) => e.target === activeNode.id)
      .map((e) => ({
        edge: e,
        node: rawNodes.find((n) => n.id === e.source),
      }))
      .filter((c) => Boolean(c.node));

    const outgoing = rawEdges
      .filter((e) => e.source === activeNode.id)
      .map((e) => ({
        edge: e,
        node: rawNodes.find((n) => n.id === e.target),
      }))
      .filter((c) => Boolean(c.node));

    return { incoming, outgoing };
  }, [activeNode, rawEdges, rawNodes]);

  // Export to Mermaid Flowchart Diagram
  const handleCopyMermaid = () => {
    let mermaidText = 'flowchart LR\n';
    mermaidText += '  %% CI/CD Pipeline Flow generated by AI Reverse-Engineering Platform\n\n';

    // Subgraphs for layers
    const layerNames: Record<NodeCategory, string> = {
      route: 'Client_Routes',
      middleware: 'Security_Middlewares',
      controller: 'Controller_Handlers',
      service: 'Business_Services',
      model: 'Database_Models',
      external: 'External_APIs',
    };

    (Object.keys(layerNames) as NodeCategory[]).forEach((cat) => {
      const catNodes = rawNodes.filter((n) => n.category === cat);
      if (catNodes.length > 0) {
        mermaidText += `  subgraph ${layerNames[cat]}["${layerNames[cat].replace('_', ' ')}"]\n`;
        catNodes.forEach((n) => {
          const safeLabel = n.label.replace(/"/g, "'");
          mermaidText += `    ${n.id}["${safeLabel}"]\n`;
        });
        mermaidText += '  end\n\n';
      }
    });

    rawEdges.forEach((e) => {
      mermaidText += `  ${e.source} -->|${e.relation}| ${e.target}\n`;
    });

    navigator.clipboard.writeText(mermaidText);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2500);
  };

  // Export Architecture JSON
  const handleExportJson = () => {
    const dataToExport = {
      project: analysis.project,
      summary: {
        totalNodes: rawNodes.length,
        totalEdges: rawEdges.length,
        layerCounts,
        healthScore: Math.max(20, 100 - healthFindings.length * 8),
      },
      nodes: rawNodes,
      edges: rawEdges,
      healthFindings,
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.project.name.toLowerCase().replace(/\s+/g, '_')}_architecture_graph.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Architecture Health Score
  const healthScore = Math.max(40, 100 - healthFindings.length * 9);

  return (
    <div
      ref={containerRef}
      className={`max-w-7xl mx-auto space-y-4 pb-8 flex flex-col ${
        isFullscreen ? 'h-screen p-4 bg-slate-950' : 'h-[calc(100vh-5.5rem)]'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Workflow className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>Enterprise CI/CD Pipeline & Architecture Flow</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {rawNodes.length} Nodes • {rawEdges.length} Edges
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Trace end-to-end execution flow: Client Routes → Security Guards → Controllers → Domain Services → DB Models.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Layout Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setLayoutMode('pipeline')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                layoutMode === 'pipeline'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Horizontal Multi-Tier Architecture Pipeline"
            >
              ↔ Pipeline
            </button>
            <button
              onClick={() => setLayoutMode('hierarchical')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                layoutMode === 'hierarchical'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Top-to-Bottom Hierarchical Tree"
            >
              ↕ Tree
            </button>
            <button
              onClick={() => setLayoutMode('domain')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                layoutMode === 'domain'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Domain & Bounded Context Clusters"
            >
              🗂 Domain
            </button>
          </div>

          {/* Blast Radius Toggle */}
          <button
            onClick={() => setBlastRadiusActive(!blastRadiusActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              blastRadiusActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle Blast Radius / Impact Highlighting when clicking nodes"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Impact Mode</span>
          </button>

          {/* Copy Mermaid */}
          <button
            onClick={handleCopyMermaid}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all"
            title="Export full graph as Mermaid flowchart markdown"
          >
            {copiedMermaid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedMermaid ? 'Mermaid Copied!' : 'Copy Mermaid'}</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all"
            title="Download Graph Adjacency List JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Filter, Search & Layer Control Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800/80 flex-shrink-0">
        {/* Layer Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1">Layers:</span>
          {(
            [
              { key: 'route', label: 'Routes', count: layerCounts.route, color: 'text-blue-400' },
              { key: 'middleware', label: 'Guards', count: layerCounts.middleware, color: 'text-purple-400' },
              { key: 'controller', label: 'Controllers', count: layerCounts.controller, color: 'text-indigo-400' },
              { key: 'service', label: 'Services', count: layerCounts.service, color: 'text-amber-400' },
              { key: 'model', label: 'Models', count: layerCounts.model, color: 'text-emerald-400' },
              { key: 'external', label: 'External', count: layerCounts.external, color: 'text-sky-400' },
            ] as const
          ).map((layer) => (
            <button
              key={layer.key}
              onClick={() =>
                setActiveLayers((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs border transition-all ${
                activeLayers[layer.key]
                  ? 'bg-slate-800 border-slate-700 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-850 text-slate-500 line-through'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeLayers[layer.key] ? 'bg-indigo-400' : 'bg-slate-600'}`} />
              <span>{layer.label}</span>
              <span className="text-[10px] text-slate-400">({layer.count})</span>
            </button>
          ))}
        </div>

        {/* Real-time Search Box */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search route, service, model..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Architectural Health & Linter Strip */}
      {healthFindings.length > 0 && healthBannerOpen && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3 flex-shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Architecture Health Audit:</span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {healthScore}% Healthy
                </span>
                <span className="text-xs text-slate-400">
                  • {healthFindings.length} architectural issues/anti-patterns detected
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {healthFindings.slice(0, 2).map((hf) => (
                  <button
                    key={hf.id}
                    onClick={() => {
                      if (hf.nodeIds[0]) setSelectedNodeId(hf.nodeIds[0]);
                    }}
                    className="text-[11px] font-mono text-amber-300 hover:underline flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20"
                  >
                    <span>⚠️ {hf.title}</span>
                  </button>
                ))}
                {healthFindings.length > 2 && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    +{healthFindings.length - 2} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setHealthBannerOpen(false)}
            className="text-slate-500 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Graph Canvas & Slide-out Inspection Drawer */}
      <div className="flex-1 w-full rounded-2xl border border-slate-800 bg-slate-950 relative overflow-hidden flex">
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={customNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            minZoom={0.15}
            maxZoom={2.2}
            className="bg-slate-950"
          >
            <Background color="#1e293b" gap={24} size={1.2} />
            <Controls className="bg-slate-900 border-slate-800 fill-slate-300" />
            <MiniMap
              nodeColor={(node: any) => {
                if (node.data?.category === 'route') return '#3b82f6';
                if (node.data?.category === 'middleware') return '#a855f7';
                if (node.data?.category === 'controller') return '#6366f1';
                if (node.data?.category === 'service') return '#f59e0b';
                if (node.data?.category === 'model') return '#10b981';
                return '#38bdf8';
              }}
              className="bg-slate-900/90 border border-slate-800 rounded-xl"
            />

            {/* Canvas Legend Panel */}
            <Panel position="bottom-left" className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 shadow-xl text-[11px] font-mono">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
                Architecture Pipeline
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5 text-blue-400">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Route</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Guard</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Controller</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Service</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Model</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-400">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>External</span>
                </div>
              </div>
            </Panel>

            {/* Blast Radius Status Badge */}
            {selectedNodeId && blastRadiusActive && impactMetrics && (
              <Panel position="top-left" className="bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-3 shadow-2xl text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="font-bold text-white">Impact Analysis Active</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      impactMetrics.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : impactMetrics.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {impactMetrics.severity} BLAST RADIUS
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
                  <span>Cyan: Upstream Callers ({upstreamNodes.size})</span>
                  <span>•</span>
                  <span>Purple: Downstream Dependencies ({downstreamNodes.size})</span>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Rich Architectural Inspection Drawer (Slide-out panel) */}
        {activeNode && (
          <div className="w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 p-5 overflow-y-auto space-y-5 z-20 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span
                  className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                    activeNode.category === 'route'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : activeNode.category === 'middleware'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : activeNode.category === 'controller'
                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                      : activeNode.category === 'service'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : activeNode.category === 'model'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                  }`}
                >
                  {activeNode.category}
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-1.5 break-all">
                  {activeNode.label}
                </h3>
                {activeNode.sublabel && (
                  <p className="text-xs text-slate-400 mt-0.5">{activeNode.sublabel}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Blast Radius Metrics Summary */}
            {impactMetrics && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Blast Radius Footprint
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {impactMetrics.total} Components Affected
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                  <div>• Routes Affected: <span className="text-white font-bold">{impactMetrics.routes}</span></div>
                  <div>• Controllers: <span className="text-white font-bold">{impactMetrics.controllers}</span></div>
                  <div>• Services: <span className="text-white font-bold">{impactMetrics.services}</span></div>
                  <div>• DB Models: <span className="text-white font-bold">{impactMetrics.models}</span></div>
                </div>
              </div>
            )}

            {/* Route Specific Features: Jump to Live Test */}
            {activeNode.category === 'route' && activeNode.meta && (
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Endpoint Actions</span>
                  <button
                    onClick={() => {
                      navigate(`/projects/${analysis.project.id}/endpoints`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold shadow-md transition-all"
                  >
                    <PlaySquare className="w-3 h-3" />
                    <span>Test in Explorer</span>
                  </button>
                </div>
                {activeNode.meta.parameters && (
                  <div className="text-xs text-slate-400">
                    <span className="font-mono text-slate-300">{activeNode.meta.parameters.length} Parameters</span> detected
                    (Query/Path/Body).
                  </div>
                )}
                {activeNode.meta.sourceFile && (
                  <div className="text-[11px] font-mono text-slate-400 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                    {activeNode.meta.sourceFile}:{activeNode.meta.lineStart || 1}
                  </div>
                )}
              </div>
            )}

            {/* Model Specific Features: Field List */}
            {activeNode.category === 'model' && activeNode.meta && (
              <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    Schema Fields
                  </span>
                  <span className="text-slate-500 font-mono">
                    {activeNode.meta.fields?.length || 0} fields
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {activeNode.meta.fields?.map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800/80"
                    >
                      <span className="text-slate-300 font-medium">{f.name}</span>
                      <span className="text-emerald-400 text-[10px]">{f.fieldType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incoming Dependencies (Callers) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Incoming Callers (In-Degree: {activeNodeConnections.incoming.length})</span>
                <span className="text-[10px] font-mono text-cyan-400">Upstream</span>
              </h4>
              {activeNodeConnections.incoming.length === 0 ? (
                <div className="text-xs text-slate-500 font-mono italic p-2 bg-slate-950 rounded-lg">
                  No upstream callers detected (Entrypoint root).
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeNodeConnections.incoming.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedNodeId(item.node!.id)}
                      className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono transition-all flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <span className="text-cyan-400 mr-1.5">←</span>
                        <span className="text-white group-hover:text-cyan-300">{item.node!.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase">{item.edge.relation}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Dependencies (Dependencies) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Outgoing Dependencies (Out-Degree: {activeNodeConnections.outgoing.length})</span>
                <span className="text-[10px] font-mono text-purple-400">Downstream</span>
              </h4>
              {activeNodeConnections.outgoing.length === 0 ? (
                <div className="text-xs text-slate-500 font-mono italic p-2 bg-slate-950 rounded-lg">
                  Leaf node (No further downstream calls).
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeNodeConnections.outgoing.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedNodeId(item.node!.id)}
                      className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono transition-all flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <span className="text-purple-400 mr-1.5">→</span>
                        <span className="text-white group-hover:text-purple-300">{item.node!.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase">{item.edge.relation}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
