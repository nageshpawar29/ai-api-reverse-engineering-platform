import React, { useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  Database,
  Key,
  Layers,
  FileCode,
  Copy,
  Check,
  Code,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Download,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Zap,
  Flame,
  Activity,
  Cpu,
  ExternalLink,
  X,
  Boxes,
  Clock,
  ArrowRight,
  Network,
  Server,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Table,
  Workflow,
  Route,
  Share2,
} from 'lucide-react';
import mermaid from 'mermaid';
import { DatabaseModel, ModelField, ModelRelationship } from '../types';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    darkMode: true,
    background: '#020617',
    primaryColor: '#6366f1',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#4f46e5',
    lineColor: '#6366f1',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e293b',
  },
});

type ViewMode = 'visual' | 'mermaid' | 'models' | 'pathfinder' | 'advisor' | 'ddl';
type LayoutMode = 'domain' | 'hierarchical' | 'grid';
type DomainCategory =
  | 'ALL'
  | 'Identity & Security'
  | 'Commerce & Products'
  | 'Orders & Fulfillment'
  | 'Financial & Ledger'
  | 'Audit & Compliance'
  | 'AI & Vector Search';

// Helper for data type syntax badge styling
const getDataTypeBadge = (type: string) => {
  const clean = type.toLowerCase();
  if (clean.includes('int') || clean.includes('float') || clean.includes('decimal') || clean.includes('number')) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
  if (clean.includes('date') || clean.includes('time')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
  if (clean.includes('bool')) {
    return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  }
  if (clean.includes('json')) {
    return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
  }
  if (clean.includes('vector') || clean.includes('embedding')) {
    return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
  }
  return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
};

// Helper for Domain pill colors
const getDomainBadge = (domain?: string) => {
  switch (domain) {
    case 'Identity & Security':
      return { bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30', border: 'border-blue-500/40' };
    case 'Commerce & Products':
      return { bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', border: 'border-emerald-500/40' };
    case 'Orders & Fulfillment':
      return { bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30', border: 'border-amber-500/40' };
    case 'Financial & Ledger':
      return { bg: 'bg-purple-500/10 text-purple-300 border-purple-500/30', border: 'border-purple-500/40' };
    case 'Audit & Compliance':
      return { bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30', border: 'border-slate-500/40' };
    case 'AI & Vector Search':
      return { bg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30', border: 'border-cyan-500/40' };
    default:
      return { bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30', border: 'border-indigo-500/40' };
  }
};

// Custom React Flow Table Node Component
interface TableNodeData {
  model: DatabaseModel;
  isDimmed: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  activeColumn?: string | null;
  onSelectColumn?: (colName: string) => void;
}

const SchemaTableNode: React.FC<{ data: TableNodeData; selected: boolean }> = ({ data, selected }) => {
  const { model, isDimmed, isSelected, isHighlighted } = data;
  const domainStyle = getDomainBadge(model.domain);

  let borderClasses = 'border-slate-800 bg-slate-900/95 hover:border-slate-700';
  let haloClasses = '';

  if (isSelected || selected) {
    borderClasses = 'border-emerald-400 bg-slate-900 ring-2 ring-emerald-400/50 shadow-[0_0_30px_rgba(16,185,129,0.35)]';
  } else if (isHighlighted) {
    borderClasses = 'border-amber-400 bg-slate-900 ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]';
  }

  const dimOpacity = isDimmed ? 'opacity-25 grayscale-[70%]' : 'opacity-100';

  return (
    <div
      className={`rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-200 min-w-[270px] max-w-[320px] overflow-hidden cursor-pointer ${borderClasses} ${haloClasses} ${dimOpacity}`}
    >
      {/* 4-way handles for dynamic auto-layouts */}
      <Handle type="target" position={Position.Left} id="in-left" className="!bg-emerald-400 !w-2.5 !h-2.5 !border-slate-900" />
      <Handle type="source" position={Position.Right} id="out-right" className="!bg-emerald-400 !w-2.5 !h-2.5 !border-slate-900" />
      <Handle type="target" position={Position.Top} id="in-top" className="!bg-emerald-400 !w-2.5 !h-2.5 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} id="out-bottom" className="!bg-emerald-400 !w-2.5 !h-2.5 !border-slate-900" />

      {/* Table Node Header */}
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 truncate">
          <Database className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold font-mono text-white truncate flex items-center gap-1.5">
              <span>{model.name}</span>
            </div>
            {model.tableName && (
              <div className="text-[10px] text-slate-400 font-mono truncate">
                table: {model.tableName}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${domainStyle.bg}`}>
            {model.domain?.split(' ')[0] || 'Entity'}
          </span>
          <span className="text-[9px] font-mono text-slate-500 uppercase">
            {model.ormType || 'ORM'}
          </span>
        </div>
      </div>

      {/* Table Node Columns */}
      <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
        {model.fields.map((f) => {
          const typeBadge = getDataTypeBadge(f.fieldType);
          return (
            <div
              key={f.id}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-850 flex items-center justify-between text-xs font-mono transition-colors"
            >
              <div className="flex items-center gap-2 truncate mr-2">
                {f.isPrimaryKey ? (
                  <span title="Primary Key" className="flex items-center gap-0.5 text-amber-400 font-bold text-[10px]">
                    <Key className="w-3 h-3 text-amber-400" />
                    PK
                  </span>
                ) : f.foreignKeyTarget ? (
                  <span title={`Foreign Key references ${f.foreignKeyTarget}`} className="flex items-center gap-0.5 text-indigo-400 font-bold text-[10px]">
                    <LinkIcon className="w-3 h-3 text-indigo-400" />
                    FK
                  </span>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700 ml-1" />
                )}

                <span className={`font-semibold truncate ${f.isPrimaryKey ? 'text-amber-300' : f.foreignKeyTarget ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {f.name}
                </span>

                {f.foreignKeyTarget && (
                  <span className="text-[9px] text-slate-500 truncate" title={`References ${f.foreignKeyTarget}`}>
                    → {f.foreignKeyTarget}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {f.isIndexed && (
                  <span className="text-[9px] text-amber-400 font-bold" title="Indexed Column">⚡</span>
                )}
                <span className={`text-[10px] px-1.5 py-0.2 rounded border ${typeBadge}`}>
                  {f.fieldType}
                  {f.isNullable ? '?' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Node Footer */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>{model.fields.length} attributes</span>
        <span>{model.relationships?.length || 0} foreign keys</span>
      </div>
    </div>
  );
};

const customNodeTypes = {
  tableNode: SchemaTableNode,
};

export const DatabaseSchemaPage: React.FC = () => {
  const { analysis, loading } = useContext(ProjectContext);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<ViewMode>('visual');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('domain');
  const [selectedDomain, setSelectedDomain] = useState<DomainCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Path Finder states
  const [pathStartTable, setPathStartTable] = useState<string>('');
  const [pathEndTable, setPathEndTable] = useState<string>('');

  // DDL dialect
  const [ddlDialect, setDdlDialect] = useState<'postgres' | 'mysql' | 'prisma' | 'typescript'>('postgres');

  // UI copy states
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState(false);
  const [copiedPathSql, setCopiedPathSql] = useState(false);
  const [copiedJsonMock, setCopiedJsonMock] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  const models: DatabaseModel[] = analysis?.models || [];
  const endpoints = analysis?.endpoints || [];

  // Filtered models by domain & search query
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesDomain =
        selectedDomain === 'ALL' || (m.domain && m.domain === selectedDomain);
      const matchesSearch =
        searchQuery.trim() === '' ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.tableName && m.tableName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.fields.some(
          (f) =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.fieldType.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (f.foreignKeyTarget && f.foreignKeyTarget.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      return matchesDomain && matchesSearch;
    });
  }, [models, selectedDomain, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalFields = models.reduce((acc, m) => acc + m.fields.length, 0);
    const totalFks = models.reduce(
      (acc, m) => acc + m.fields.filter((f) => Boolean(f.foreignKeyTarget)).length,
      0
    );
    const totalIndexed = models.reduce(
      (acc, m) => acc + m.fields.filter((f) => f.isIndexed || f.isPrimaryKey || f.isUnique).length,
      0
    );
    const totalRelations = models.reduce(
      (acc, m) => acc + (m.relationships?.length || 0),
      0
    );

    return { totalFields, totalFks, totalIndexed, totalRelations };
  }, [models]);

  // Set default pathfinder tables once loaded
  useEffect(() => {
    if (models.length >= 2 && !pathStartTable && !pathEndTable) {
      const userModel = models.find((m) => m.name.toLowerCase() === 'user') || models[0];
      const orderModel = models.find((m) => m.name.toLowerCase().includes('payment') || m.name.toLowerCase().includes('order')) || models[1];
      setPathStartTable(userModel.name);
      setPathEndTable(orderModel.name);
    }
  }, [models, pathStartTable, pathEndTable]);

  // 1. Build React Flow Graph (Nodes & Edges) for Interactive Visual Studio
  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const activeModelNames = new Set(filteredModels.map((m) => m.name.toLowerCase()));

    // Connected models to currently selected model
    const connectedToSelected = new Set<string>();
    if (selectedModelId) {
      connectedToSelected.add(selectedModelId.toLowerCase());
      const activeM = models.find((m) => m.id === selectedModelId || m.name.toLowerCase() === selectedModelId.toLowerCase());
      if (activeM) {
        // Outgoing
        activeM.fields.forEach((f) => {
          if (f.foreignKeyTarget) connectedToSelected.add(f.foreignKeyTarget.toLowerCase());
        });
        activeM.relationships?.forEach((r) => {
          connectedToSelected.add(r.targetModel.toLowerCase());
        });
        // Incoming
        models.forEach((other) => {
          if (
            other.fields.some((f) => f.foreignKeyTarget?.toLowerCase() === activeM.name.toLowerCase()) ||
            other.relationships?.some((r) => r.targetModel.toLowerCase() === activeM.name.toLowerCase())
          ) {
            connectedToSelected.add(other.name.toLowerCase());
          }
        });
      }
    }

    // POSITIONING STRATEGIES
    if (layoutMode === 'domain') {
      // Cluster columns by domain
      const domains: DomainCategory[] = [
        'Identity & Security',
        'Commerce & Products',
        'Orders & Fulfillment',
        'Financial & Ledger',
        'Audit & Compliance',
        'AI & Vector Search',
      ];

      let currentX = 50;
      domains.forEach((dom) => {
        const domModels = filteredModels.filter((m) => m.domain === dom);
        if (domModels.length > 0) {
          let currentY = 50;
          domModels.forEach((m) => {
            const isSel = selectedModelId === m.id || selectedModelId === m.name;
            const isConnected = selectedModelId ? connectedToSelected.has(m.name.toLowerCase()) : true;
            const isDimmed = selectedModelId ? !isConnected : false;

            nodes.push({
              id: m.name,
              type: 'tableNode',
              data: {
                model: m,
                isSelected: isSel,
                isDimmed,
                isHighlighted: isConnected && Boolean(selectedModelId) && !isSel,
              },
              position: { x: currentX, y: currentY },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            });
            currentY += 340;
          });
          currentX += 370;
        }
      });
    } else if (layoutMode === 'hierarchical') {
      // Parents on left, leaf tables on right
      const levels: Record<string, number> = {};
      models.forEach((m) => {
        const hasFk = m.fields.some((f) => Boolean(f.foreignKeyTarget));
        if (!hasFk) levels[m.name] = 0; // Root entity (Tenant, Category)
        else if (m.name.toLowerCase().includes('user') || m.name.toLowerCase().includes('product')) levels[m.name] = 1;
        else if (m.name.toLowerCase().includes('order') || m.name.toLowerCase().includes('session')) levels[m.name] = 2;
        else levels[m.name] = 3; // Leaf
      });

      const levelX = [50, 420, 790, 1160];
      const levelYCounters = [50, 50, 50, 50];

      filteredModels.forEach((m) => {
        const lvl = levels[m.name] !== undefined ? levels[m.name] : 1;
        const x = levelX[lvl] || 420;
        const y = levelYCounters[lvl] || 50;
        levelYCounters[lvl] = (levelYCounters[lvl] || 50) + 330;

        const isSel = selectedModelId === m.id || selectedModelId === m.name;
        const isConnected = selectedModelId ? connectedToSelected.has(m.name.toLowerCase()) : true;
        const isDimmed = selectedModelId ? !isConnected : false;

        nodes.push({
          id: m.name,
          type: 'tableNode',
          data: {
            model: m,
            isSelected: isSel,
            isDimmed,
            isHighlighted: isConnected && Boolean(selectedModelId) && !isSel,
          },
          position: { x, y },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });
      });
    } else {
      // Grid Matrix Layout
      let col = 0;
      let row = 0;
      filteredModels.forEach((m) => {
        const x = 50 + col * 360;
        const y = 50 + row * 340;
        col++;
        if (col >= 3) {
          col = 0;
          row++;
        }

        const isSel = selectedModelId === m.id || selectedModelId === m.name;
        const isConnected = selectedModelId ? connectedToSelected.has(m.name.toLowerCase()) : true;
        const isDimmed = selectedModelId ? !isConnected : false;

        nodes.push({
          id: m.name,
          type: 'tableNode',
          data: {
            model: m,
            isSelected: isSel,
            isDimmed,
            isHighlighted: isConnected && Boolean(selectedModelId) && !isSel,
          },
          position: { x, y },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });
      });
    }

    // Build Edges
    const registeredEdgePairs = new Set<string>();

    filteredModels.forEach((source) => {
      source.fields.forEach((f) => {
        if (f.foreignKeyTarget) {
          const target = filteredModels.find(
            (m) =>
              m.name.toLowerCase() === f.foreignKeyTarget?.toLowerCase() ||
              m.tableName?.toLowerCase() === f.foreignKeyTarget?.toLowerCase()
          );

          if (target && activeModelNames.has(source.name.toLowerCase()) && activeModelNames.has(target.name.toLowerCase())) {
            const edgeId = `e-${target.name}-${source.name}-${f.name}`;
            const pairKey = `${target.name}->${source.name}:${f.name}`;

            if (!registeredEdgePairs.has(pairKey)) {
              registeredEdgePairs.add(pairKey);

              const isConnectedEdge =
                selectedModelId &&
                (source.name.toLowerCase() === selectedModelId.toLowerCase() ||
                  target.name.toLowerCase() === selectedModelId.toLowerCase());

              edges.push({
                id: edgeId,
                source: target.name,
                target: source.name,
                animated: Boolean(isConnectedEdge),
                style: {
                  stroke: isConnectedEdge ? '#10b981' : '#475569',
                  strokeWidth: isConnectedEdge ? 2.5 : 1.5,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: isConnectedEdge ? '#10b981' : '#475569',
                },
              });
            }
          }
        }
      });
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [filteredModels, layoutMode, selectedModelId, models]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Handle node selection in visual canvas
  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedModelId((prev) => (prev === node.id ? null : node.id));
  }, []);

  // Currently selected model object
  const activeModel = useMemo(() => {
    if (!selectedModelId) return null;
    return (
      models.find(
        (m) =>
          m.id === selectedModelId || m.name.toLowerCase() === selectedModelId.toLowerCase()
      ) || null
    );
  }, [selectedModelId, models]);

  // 2. Generate Mermaid ER Diagram markup
  const mermaidSyntax = useMemo(() => {
    if (filteredModels.length === 0) {
      return 'erDiagram\n  EMPTY {\n    string message "No matching models found"\n  }';
    }

    let code = 'erDiagram\n';

    filteredModels.forEach((model) => {
      code += `  ${model.name.toUpperCase()} {\n`;
      model.fields.forEach((f) => {
        const cleanType = f.fieldType.replace(/[^a-zA-Z0-9]/g, '_');
        const cleanName = f.name.replace(/[^a-zA-Z0-9]/g, '_');
        const keyIndicator = f.isPrimaryKey ? 'PK' : f.foreignKeyTarget ? 'FK' : '';
        const comment = f.isUnique ? '"UNIQUE"' : f.isIndexed ? '"INDEXED"' : '';
        code += `    ${cleanType} ${cleanName} ${keyIndicator} ${comment}\n`;
      });
      code += '  }\n';
    });

    const addedRelKeys = new Set<string>();

    filteredModels.forEach((model) => {
      if (model.relationships && model.relationships.length > 0) {
        model.relationships.forEach((rel) => {
          const target = filteredModels.find(
            (m) => m.name.toLowerCase() === rel.targetModel.toLowerCase()
          );
          if (target) {
            const relKey = [model.name, target.name].sort().join('--');
            if (!addedRelKeys.has(relKey)) {
              addedRelKeys.add(relKey);
              let arrow = '||--o{';
              if (rel.cardinality === '1:1') arrow = '||--||';
              else if (rel.cardinality === 'N:M') arrow = '}o--o{';
              else if (rel.cardinality === 'N:1') arrow = '}o--||';
              code += `  ${target.name.toUpperCase()} ${arrow} ${model.name.toUpperCase()} : "${rel.sourceField}"\n`;
            }
          }
        });
      }

      model.fields.forEach((f) => {
        if (f.foreignKeyTarget) {
          const target = filteredModels.find(
            (m) =>
              m.name.toLowerCase() === f.foreignKeyTarget?.toLowerCase() ||
              m.tableName?.toLowerCase() === f.foreignKeyTarget?.toLowerCase()
          );
          if (target) {
            const relKey = [model.name, target.name].sort().join('--');
            if (!addedRelKeys.has(relKey)) {
              addedRelKeys.add(relKey);
              code += `  ${target.name.toUpperCase()} ||--o{ ${model.name.toUpperCase()} : "${f.name}"\n`;
            }
          }
        }
      });
    });

    return code;
  }, [filteredModels]);

  // Render Mermaid diagram
  useEffect(() => {
    if (activeTab === 'mermaid' && mermaidRef.current && filteredModels.length > 0) {
      mermaidRef.current.innerHTML = '';
      const id = `mermaid-erd-${Date.now()}`;
      mermaid
        .render(id, mermaidSyntax)
        .then(({ svg }) => {
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = svg;
          }
        })
        .catch((err) => {
          console.error('Mermaid render error:', err);
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = `<pre class="text-xs text-rose-400 p-4 font-mono bg-rose-950/20 rounded-xl border border-rose-900">${err.message}</pre>`;
          }
        });
    }
  }, [activeTab, mermaidSyntax, filteredModels]);

  // 3. Relational Path Finder & Multi-Table SQL JOIN Generator (BFS)
  const pathFinderResult = useMemo(() => {
    if (!pathStartTable || !pathEndTable || pathStartTable === pathEndTable) {
      return null;
    }

    // Graph adjacency list
    const adj = new Map<string, Array<{ neighbor: string; fromCol: string; toCol: string; direction: 'outgoing' | 'incoming' }>>();
    models.forEach((m) => adj.set(m.name, []));

    models.forEach((source) => {
      source.fields.forEach((f) => {
        if (f.foreignKeyTarget) {
          const target = models.find(
            (m) =>
              m.name.toLowerCase() === f.foreignKeyTarget?.toLowerCase() ||
              m.tableName?.toLowerCase() === f.foreignKeyTarget?.toLowerCase()
          );
          if (target) {
            adj.get(source.name)?.push({
              neighbor: target.name,
              fromCol: f.name,
              toCol: 'id',
              direction: 'outgoing',
            });
            adj.get(target.name)?.push({
              neighbor: source.name,
              fromCol: 'id',
              toCol: f.name,
              direction: 'incoming',
            });
          }
        }
      });
    });

    // BFS Queue: [currentNode, pathHops]
    const queue: Array<{ current: string; path: Array<{ from: string; to: string; fromCol: string; toCol: string; direction: string }> }> = [
      { current: pathStartTable, path: [] },
    ];
    const visited = new Set<string>([pathStartTable]);

    let foundPath: Array<{ from: string; to: string; fromCol: string; toCol: string; direction: string }> | null = null;

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (current === pathEndTable) {
        foundPath = path;
        break;
      }

      const neighbors = adj.get(current) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.neighbor)) {
          visited.add(edge.neighbor);
          queue.push({
            current: edge.neighbor,
            path: [...path, { from: current, to: edge.neighbor, fromCol: edge.fromCol, toCol: edge.toCol, direction: edge.direction }],
          });
        }
      }
    }

    if (!foundPath) return { found: false, hops: [], sql: '' };

    // Construct SQL Query
    const startTable = models.find((m) => m.name === pathStartTable);
    const startAlias = pathStartTable.toLowerCase().slice(0, 3);
    let sql = `SELECT\n  ${startAlias}.*`;

    let fromClause = `FROM "${startTable?.tableName || pathStartTable.toLowerCase() + 's'}" ${startAlias}\n`;

    let prevAlias = startAlias;
    foundPath.forEach((hop, idx) => {
      const targetTable = models.find((m) => m.name === hop.to);
      const targetAlias = `${hop.to.toLowerCase().slice(0, 3)}_${idx + 1}`;
      const targetTableName = targetTable?.tableName || hop.to.toLowerCase() + 's';

      if (hop.direction === 'outgoing') {
        fromClause += `JOIN "${targetTableName}" ${targetAlias} ON ${prevAlias}."${hop.fromCol}" = ${targetAlias}."${hop.toCol}"\n`;
      } else {
        fromClause += `JOIN "${targetTableName}" ${targetAlias} ON ${targetAlias}."${hop.toCol}" = ${prevAlias}."${hop.fromCol}"\n`;
      }
      prevAlias = targetAlias;
    });

    sql = `-- Relational Path Discovery (${foundPath.length} hops: ${pathStartTable} → ${pathEndTable})\n` + sql + `\n` + fromClause + `LIMIT 50;`;

    return {
      found: true,
      hops: foundPath,
      sql,
    };
  }, [models, pathStartTable, pathEndTable]);

  // 4. Schema Health & AI Advisor Audits
  const advisorAudits = useMemo(() => {
    const findings: Array<{
      id: string;
      category: 'INDEX' | 'SECURITY' | 'CONCURRENCY' | 'AUDIT' | 'AI_VECTOR';
      severity: 'CRITICAL' | 'WARNING' | 'OPTIMIZED';
      model: string;
      title: string;
      description: string;
      recommendation: string;
    }> = [];

    let score = 100;

    models.forEach((m) => {
      m.fields.forEach((f) => {
        if (f.foreignKeyTarget && !f.isIndexed && !f.isPrimaryKey && !f.isUnique) {
          score -= 4;
          findings.push({
            id: `idx-fk-${m.name}-${f.name}`,
            category: 'INDEX',
            severity: 'WARNING',
            model: m.name,
            title: `Unindexed Foreign Key: ${m.name}.${f.name}`,
            description: `Column references ${f.foreignKeyTarget} without an index, triggering full table scans during JOINs and CASCADE locks.`,
            recommendation: `Add index: @@index([${f.name}]) or CREATE INDEX idx_${m.tableName}_${f.name} ON ${m.tableName}("${f.name}");`,
          });
        }

        const lowerName = f.name.toLowerCase();
        if (
          lowerName.includes('password') ||
          lowerName.includes('secret') ||
          lowerName.includes('token')
        ) {
          if (!lowerName.includes('hash') && !lowerName.includes('encrypted')) {
            score -= 6;
            findings.push({
              id: `sec-pii-${m.name}-${f.name}`,
              category: 'SECURITY',
              severity: 'CRITICAL',
              model: m.name,
              title: `Unsalted / Plaintext Credential: ${m.name}.${f.name}`,
              description: `Field name implies sensitive authentication secret without explicit hashing suffix.`,
              recommendation: `Store one-way salted hashes (Argon2id/bcrypt) or envelope-encrypted values. Never persist plaintext tokens.`,
            });
          }
        }
      });

      const isTransactional =
        m.name.toLowerCase().includes('order') ||
        m.name.toLowerCase().includes('payment') ||
        m.name.toLowerCase().includes('product');

      if (isTransactional) {
        const hasVersion = m.fields.some((f) => f.name.toLowerCase() === 'version');
        const hasIdempotency = m.fields.some((f) => f.name.toLowerCase().includes('idempotency'));

        if (!hasVersion && !hasIdempotency) {
          score -= 5;
          findings.push({
            id: `concur-${m.name}`,
            category: 'CONCURRENCY',
            severity: 'WARNING',
            model: m.name,
            title: `Missing Concurrency Control: ${m.name}`,
            description: `High-concurrency table lacks optimistic locking or idempotency keys, risking race condition bugs during concurrent transactions.`,
            recommendation: `Add an integer field 'version Int @default(1)' for optimistic locking and unique idempotency keys.`,
          });
        }
      }

      if (m.name.toLowerCase().includes('vector') || m.name.toLowerCase().includes('embedding')) {
        findings.push({
          id: `vector-${m.name}`,
          category: 'AI_VECTOR',
          severity: 'OPTIMIZED',
          model: m.name,
          title: `Futuristic AI Vector Architecture: ${m.name}`,
          description: `Dense vector embeddings enable sub-millisecond semantic search and RAG retrieval.`,
          recommendation: `Configure pgvector HNSW index: CREATE INDEX ON ${m.tableName} USING hnsw (embedding vector_cosine_ops);`,
        });
      }
    });

    return {
      score: Math.max(30, Math.min(100, score)),
      findings,
    };
  }, [models]);

  // 5. DDL Generator
  const generatedDdl = useMemo(() => {
    if (ddlDialect === 'postgres') {
      let sql = `-- ==========================================================\n`;
      sql += `-- PostgreSQL 16+ Production DDL (Generated by Reverse-API)\n`;
      sql += `-- ==========================================================\n\n`;

      models.forEach((m) => {
        const table = m.tableName || `${m.name.toLowerCase()}s`;
        sql += `CREATE TABLE IF NOT EXISTS "${table}" (\n`;
        const colDefs = m.fields.map((f) => {
          let pgType = 'TEXT';
          if (f.fieldType === 'String') pgType = 'VARCHAR(255)';
          else if (f.fieldType === 'Int') pgType = 'INTEGER';
          else if (f.fieldType === 'Float' || f.fieldType === 'Decimal') pgType = 'NUMERIC(12, 2)';
          else if (f.fieldType === 'Boolean') pgType = 'BOOLEAN';
          else if (f.fieldType === 'DateTime') pgType = 'TIMESTAMPTZ';
          else if (f.fieldType === 'Json') pgType = 'JSONB';

          let def = `    "${f.name}" ${pgType}`;
          if (f.isPrimaryKey) def += ' PRIMARY KEY';
          if (!f.isNullable && !f.isPrimaryKey) def += ' NOT NULL';
          if (f.isUnique && !f.isPrimaryKey) def += ' UNIQUE';
          if (f.defaultValue) {
            if (f.defaultValue === 'now()') def += ' DEFAULT CURRENT_TIMESTAMP';
            else if (f.defaultValue === 'uuid()') def += ' DEFAULT gen_random_uuid()';
            else def += ` DEFAULT '${f.defaultValue}'`;
          }
          return def;
        });

        m.fields.forEach((f) => {
          if (f.foreignKeyTarget) {
            const targetTable = `${f.foreignKeyTarget.toLowerCase()}s`;
            colDefs.push(
              `    CONSTRAINT fk_${table}_${f.name} FOREIGN KEY ("${f.name}") REFERENCES "${targetTable}"("id") ON DELETE CASCADE`
            );
          }
        });

        sql += colDefs.join(',\n') + '\n);\n\n';

        m.fields.forEach((f) => {
          if (f.foreignKeyTarget || f.isIndexed) {
            sql += `CREATE INDEX IF NOT EXISTS idx_${table}_${f.name} ON "${table}"("${f.name}");\n`;
          }
        });
        sql += '\n';
      });

      return sql;
    } else if (ddlDialect === 'mysql') {
      let sql = `-- MySQL 8.0+ InnoDB Production DDL\n\n`;
      models.forEach((m) => {
        const table = m.tableName || `${m.name.toLowerCase()}s`;
        sql += `CREATE TABLE IF NOT EXISTS \`${table}\` (\n`;
        const colDefs = m.fields.map((f) => {
          let myType = 'VARCHAR(255)';
          if (f.fieldType === 'Int') myType = 'INT';
          else if (f.fieldType === 'Float' || f.fieldType === 'Decimal') myType = 'DECIMAL(12,2)';
          else if (f.fieldType === 'Boolean') myType = 'TINYINT(1)';
          else if (f.fieldType === 'DateTime') myType = 'DATETIME';
          else if (f.fieldType === 'Json') myType = 'JSON';

          let def = `    \`${f.name}\` ${myType}`;
          if (f.isPrimaryKey) def += ' PRIMARY KEY';
          if (!f.isNullable && !f.isPrimaryKey) def += ' NOT NULL';
          if (f.isUnique && !f.isPrimaryKey) def += ' UNIQUE';
          return def;
        });
        sql += colDefs.join(',\n') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';
      });
      return sql;
    } else if (ddlDialect === 'prisma') {
      let schema = `// Prisma Schema Definition\n\n`;
      models.forEach((m) => {
        schema += `model ${m.name} {\n`;
        m.fields.forEach((f) => {
          let line = `  ${f.name.padEnd(16)} ${f.fieldType}${f.isNullable ? '?' : ''}`;
          if (f.isPrimaryKey) line += ' @id @default(uuid())';
          else if (f.isUnique) line += ' @unique';
          else if (f.defaultValue) line += ` @default(${f.defaultValue})`;
          if (f.foreignKeyTarget) line += ` // FK -> ${f.foreignKeyTarget}`;
          schema += line + '\n';
        });
        schema += '}\n\n';
      });
      return schema;
    } else {
      let ts = `// TypeScript Domain Interfaces\n\n`;
      models.forEach((m) => {
        ts += `export interface ${m.name} {\n`;
        m.fields.forEach((f) => {
          let tType = 'string';
          if (f.fieldType === 'Int' || f.fieldType === 'Float' || f.fieldType === 'Decimal') tType = 'number';
          else if (f.fieldType === 'Boolean') tType = 'boolean';
          else if (f.fieldType === 'DateTime') tType = 'Date | string';
          else if (f.fieldType === 'Json') tType = 'Record<string, any>';
          ts += `  ${f.name}${f.isNullable ? '?' : ''}: ${tType};\n`;
        });
        ts += '}\n\n';
      });
      return ts;
    }
  }, [models, ddlDialect]);

  // Copy helpers
  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(mermaidSyntax);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(generatedDdl);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!mermaidRef.current) return;
    const svgElem = mermaidRef.current.querySelector('svg');
    if (!svgElem) return;

    const svgData = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis?.project.name.toLowerCase().replace(/\s+/g, '_')}_er_diagram.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateMockJson = (model: DatabaseModel) => {
    const mock: Record<string, any> = {};
    model.fields.forEach((f) => {
      if (f.isPrimaryKey) mock[f.name] = `${f.name.replace(/id/i, '') || 'id'}_${Math.random().toString(36).substring(2, 9)}`;
      else if (f.foreignKeyTarget) mock[f.name] = `ref_${f.foreignKeyTarget.toLowerCase()}_101`;
      else if (f.fieldType === 'Int') mock[f.name] = f.name.includes('version') ? 1 : 42;
      else if (f.fieldType === 'Float' || f.fieldType === 'Decimal') mock[f.name] = 129.99;
      else if (f.fieldType === 'Boolean') mock[f.name] = f.defaultValue === 'false' ? false : true;
      else if (f.fieldType === 'DateTime') mock[f.name] = new Date().toISOString();
      else if (f.fieldType === 'Json') mock[f.name] = { customKey: 'sample_value', enabled: true };
      else mock[f.name] = `${f.name}_sample`;
    });
    return JSON.stringify(mock, null, 2);
  };

  if (loading || !analysis) return null;

  return (
    <div
      ref={containerRef}
      className={`max-w-7xl mx-auto space-y-5 pb-12 ${
        isFullscreen ? 'p-6 bg-slate-950 min-h-screen' : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <span>Enterprise Database ER Studio</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {models.length} Entities • {stats.totalRelations} Relations • {stats.totalFields} Attributes
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Interactive Canvas, Crow's Foot Cardinality, Graph Path Finder, SQL JOIN Generator, and Schema Health Auditing.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main View Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            <button
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'visual'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Interactive Visual React Flow Studio"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
            <button
              onClick={() => setActiveTab('mermaid')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'mermaid'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mermaid 11 Crow's Foot Diagram"
            >
              📊 Mermaid
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'models'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Entities & Columns Explorer"
            >
              🗄️ Entities ({filteredModels.length})
            </button>
            <button
              onClick={() => setActiveTab('pathfinder')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'pathfinder'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Relational Path Finder & SQL JOIN Generator"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Path Finder</span>
            </button>
            <button
              onClick={() => setActiveTab('advisor')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'advisor'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="AI Schema Health & Optimization Advisor"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Advisor</span>
            </button>
            <button
              onClick={() => setActiveTab('ddl')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ddl'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="DDL Migrations Exporter"
            >
              ⚡ DDL
            </button>
          </div>

          {/* Mermaid Export Actions */}
          {activeTab === 'mermaid' && (
            <>
              <button
                onClick={handleCopyMermaid}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono transition-all"
                title="Copy Mermaid ER Markup"
              >
                {copiedMermaid ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedMermaid ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono transition-all"
                title="Download SVG Diagram"
              >
                <Download className="h-3.5 w-3.5" />
                <span>SVG</span>
              </button>
            </>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Filter by Domain & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1">Domain:</span>
          {(
            [
              'ALL',
              'Identity & Security',
              'Commerce & Products',
              'Orders & Fulfillment',
              'Financial & Ledger',
              'Audit & Compliance',
              'AI & Vector Search',
            ] as DomainCategory[]
          ).map((domain) => {
            const isSelected = selectedDomain === domain;
            const count =
              domain === 'ALL'
                ? models.length
                : models.filter((m) => m.domain === domain).length;

            if (domain !== 'ALL' && count === 0) return null;

            return (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                className={`px-2.5 py-1 rounded-lg font-mono text-xs border transition-all ${
                  isSelected
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{domain}</span>
                <span className="text-[10px] ml-1 text-slate-500">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search table, column, or foreign key..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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

      {/* TAB 1: INTERACTIVE VISUAL STUDIO (REACT FLOW) */}
      {activeTab === 'visual' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 relative overflow-hidden flex h-[680px] shadow-2xl">
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
              <Background color="#1e293b" gap={28} size={1.2} />
              <Controls className="bg-slate-900 border-slate-800 fill-slate-300" />
              <MiniMap
                nodeColor={(node: any) => {
                  const m = node.data?.model as DatabaseModel;
                  if (m?.domain === 'Identity & Security') return '#3b82f6';
                  if (m?.domain === 'Commerce & Products') return '#10b981';
                  if (m?.domain === 'Orders & Fulfillment') return '#f59e0b';
                  if (m?.domain === 'Financial & Ledger') return '#a855f7';
                  if (m?.domain === 'AI & Vector Search') return '#06b6d4';
                  return '#64748b';
                }}
                className="bg-slate-900/90 border border-slate-800 rounded-xl"
              />

              {/* Layout Switcher Panel */}
              <Panel position="top-left" className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 text-xs font-mono shadow-xl">
                <span className="text-[10px] text-slate-500 uppercase px-2 font-bold">Layout:</span>
                <button
                  onClick={() => setLayoutMode('domain')}
                  className={`px-2 py-1 rounded-lg font-medium transition-all ${
                    layoutMode === 'domain' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Grouped by Bounded Domains"
                >
                  ↔ Domains
                </button>
                <button
                  onClick={() => setLayoutMode('hierarchical')}
                  className={`px-2 py-1 rounded-lg font-medium transition-all ${
                    layoutMode === 'hierarchical' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Parent to Child Foreign Key DAG"
                >
                  ↕ Relational DAG
                </button>
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`px-2 py-1 rounded-lg font-medium transition-all ${
                    layoutMode === 'grid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compact Grid Matrix"
                >
                  🔲 Grid
                </button>
              </Panel>

              {/* Quick Instructions Badge */}
              <Panel position="bottom-left" className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono text-slate-400 space-y-1 shadow-xl">
                <div className="text-white font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Interactive Schema Canvas
                </div>
                <div>• Drag tables to rearrange canvas</div>
                <div>• Click any table to isolate & trace foreign-key edges</div>
              </Panel>
            </ReactFlow>
          </div>

          {/* Model Inspector Side Drawer */}
          {activeModel && (
            <div className="w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 p-5 overflow-y-auto space-y-5 z-20 shadow-2xl flex flex-col">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                    Table Inspector
                  </span>
                  <h3 className="text-lg font-bold text-white font-mono">{activeModel.name}</h3>
                  <p className="text-xs text-slate-400">{activeModel.description || activeModel.tableName}</p>
                </div>
                <button
                  onClick={() => setSelectedModelId(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Foreign Key Relations */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 font-mono flex items-center justify-between">
                  <span>Relationships ({activeModel.relationships?.length || 0})</span>
                </span>
                {(!activeModel.relationships || activeModel.relationships.length === 0) ? (
                  <div className="text-xs font-mono text-slate-500 p-2 bg-slate-950 rounded-lg">
                    No foreign key relations defined.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {activeModel.relationships.map((rel, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between"
                      >
                        <div className="truncate mr-2">
                          <span className="text-indigo-400 font-bold">{rel.cardinality}</span>{' '}
                          <span className="text-white">{rel.targetModel}</span>
                        </div>
                        {rel.onDelete && (
                          <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/20">
                            ON DELETE {rel.onDelete}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Connected API Endpoints */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 font-mono">
                  Connected API Endpoints
                </span>
                {(() => {
                  const connectedEps = endpoints.filter((ep) => {
                    const clean = activeModel.name.toLowerCase().replace(/s$/, '');
                    return (
                      ep.path.toLowerCase().includes(clean) ||
                      (ep.controllerName && ep.controllerName.toLowerCase().includes(clean))
                    );
                  });

                  if (connectedEps.length === 0) {
                    return (
                      <div className="text-xs font-mono text-slate-500 p-2 bg-slate-950 rounded-lg">
                        No direct route handlers found.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {connectedEps.map((ep) => (
                        <div
                          key={ep.id}
                          className="text-[11px] font-mono p-1.5 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                        >
                          <span className="text-indigo-400 font-bold">{ep.method}</span>
                          <span className="text-slate-300 truncate ml-2">{ep.path}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Mock Record Generator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">Sample Mock JSON</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateMockJson(activeModel));
                      setCopiedJsonMock(true);
                      setTimeout(() => setCopiedJsonMock(false), 2000);
                    }}
                    className="text-[11px] font-mono text-emerald-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedJsonMock ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJsonMock ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto max-h-36">
                  {generateMockJson(activeModel)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MERMAID 11 DIAGRAM */}
      {activeTab === 'mermaid' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 relative overflow-hidden flex flex-col min-h-[550px] shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md text-xs font-mono text-slate-400 z-10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Network className="w-3.5 h-3.5" />
                Crow's Foot Relational Notation
              </span>
              <span>•</span>
              <span className="text-slate-500">
                Rendering {filteredModels.length} of {models.length} tables
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setZoomScale((prev) => Math.max(0.4, prev - 0.15))}
                className="px-2 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                title="Zoom Out"
              >
                -
              </button>
              <span className="text-[10px] w-10 text-center font-bold text-slate-300">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((prev) => Math.min(2.5, prev + 0.15))}
                className="px-2 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoomScale(1)}
                className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white hover:bg-slate-800"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex-1 w-full overflow-auto p-6 flex justify-center items-start min-h-[480px]">
            <div
              ref={mermaidRef}
              style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
              className="w-full flex justify-center transition-transform duration-150"
            />
          </div>

          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] font-mono text-slate-400 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-amber-300 font-bold">PK</span>
                <span>Primary Key</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <span className="text-indigo-300 font-bold">FK</span>
                <span>Foreign Key</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-300">||--o&#123;</span>
                <span>One-to-Many</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-purple-300">||--||</span>
                <span>One-to-One</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENTITIES & ATTRIBUTES EXPLORER */}
      {activeTab === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-slate-700 transition-all shadow-lg"
            >
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-base font-mono">{model.name}</h3>
                  </div>
                  {model.tableName && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      table: <span className="text-slate-300">{model.tableName}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                    {model.ormType || 'ORM'}
                  </span>
                  {model.domain && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {model.domain}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {model.fields.map((f) => (
                  <div
                    key={f.id}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {f.isPrimaryKey ? (
                        <Key className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                      ) : f.foreignKeyTarget ? (
                        <LinkIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-700 ml-1 flex-shrink-0" />
                      )}
                      <span className="text-slate-200 font-semibold truncate">{f.name}</span>
                      {f.foreignKeyTarget && (
                        <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1 rounded border border-indigo-500/30">
                          → {f.foreignKeyTarget}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {f.isIndexed && <span className="text-[9px] text-amber-400 font-bold">⚡</span>}
                      <span className="text-slate-400 text-[11px]">{f.fieldType}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 text-[11px]">
                  {model.fields.length} attributes • {model.relationships?.length || 0} rels
                </span>
                <button
                  onClick={() => {
                    setSelectedModelId(model.name);
                    setActiveTab('visual');
                  }}
                  className="flex items-center gap-1 text-emerald-400 hover:text-white transition-colors"
                >
                  <span>View in Canvas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: PATH FINDER & MULTI-TABLE SQL JOIN GENERATOR */}
      {activeTab === 'pathfinder' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Compass className="h-5 w-5 text-indigo-400" />
              <span>Relational Graph Path Finder & Automated SQL JOIN Generator</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select any two database models across your schema. The engine performs Breadth-First-Search graph traversal over foreign keys and automatically constructs the multi-table JOIN query.
            </p>
          </div>

          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-semibold">
                Starting Table (Origin):
              </label>
              <select
                value={pathStartTable}
                onChange={(e) => setPathStartTable(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.domain?.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-semibold">
                Target Table (Destination):
              </label>
              <select
                value={pathEndTable}
                onChange={(e) => setPathEndTable(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.domain?.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Path Finding Traversal Result */}
          {pathFinderResult && pathFinderResult.found ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-center gap-3 text-xs font-mono text-indigo-300">
                <Route className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <div>
                  <span className="font-bold text-white">Relational Connection Found ({pathFinderResult.hops.length} Hops):</span>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-white font-bold">{pathStartTable}</span>
                    {pathFinderResult.hops.map((hop, i) => (
                      <React.Fragment key={i}>
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-white font-bold">{hop.to}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generated SQL JOIN query */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-slate-300 flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-emerald-400" />
                    Automated Multi-Table SQL JOIN Query
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pathFinderResult.sql);
                      setCopiedPathSql(true);
                      setTimeout(() => setCopiedPathSql(false), 2000);
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold transition-all"
                  >
                    {copiedPathSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPathSql ? 'Copied SQL!' : 'Copy SQL'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                  {pathFinderResult.sql}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xs text-slate-500">
              Select two connected tables to discover relational join paths.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI SCHEMA ADVISOR & HEALTH AUDIT */}
      {activeTab === 'advisor' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Automated Schema Health & Performance Audit</h2>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Evaluates real-world relational best practices: unindexed foreign keys (preventing full table locks), sensitive credential protection, high-concurrency race condition guards, and SOC2 auditability.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {advisorAudits.score}%
                </div>
                <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                  Health Rating
                </div>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div className="text-xs font-mono text-slate-400">
                <div>• {advisorAudits.findings.filter((f) => f.severity === 'CRITICAL').length} Critical</div>
                <div>• {advisorAudits.findings.filter((f) => f.severity === 'WARNING').length} Warnings</div>
                <div>• {advisorAudits.findings.filter((f) => f.severity === 'OPTIMIZED').length} Optimized</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {advisorAudits.findings.map((audit) => (
              <div
                key={audit.id}
                className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2 hover:border-slate-700 transition-all shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {audit.severity === 'CRITICAL' ? (
                      <span className="p-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    ) : audit.severity === 'WARNING' ? (
                      <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Zap className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-white font-mono">{audit.title}</h4>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      audit.severity === 'CRITICAL'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : audit.severity === 'WARNING'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {audit.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-8">
                  {audit.description}
                </p>

                <div className="pl-8 pt-1">
                  <div className="text-xs font-mono text-emerald-400 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                    <span className="font-bold text-slate-400 mr-1.5">Fix Recommendation:</span>
                    {audit.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: DDL & MIGRATION GENERATOR */}
      {activeTab === 'ddl' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code className="h-4 w-4 text-emerald-400" />
                <span>Production DDL & Schema Migration Generator</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Instant 1-click database DDL scripts with primary keys, foreign key CASCADE rules, and indexes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
                <button
                  onClick={() => setDdlDialect('postgres')}
                  className={`px-2.5 py-1 rounded-lg ${
                    ddlDialect === 'postgres' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PostgreSQL
                </button>
                <button
                  onClick={() => setDdlDialect('mysql')}
                  className={`px-2.5 py-1 rounded-lg ${
                    ddlDialect === 'mysql' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MySQL
                </button>
                <button
                  onClick={() => setDdlDialect('prisma')}
                  className={`px-2.5 py-1 rounded-lg ${
                    ddlDialect === 'prisma' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Prisma
                </button>
                <button
                  onClick={() => setDdlDialect('typescript')}
                  className={`px-2.5 py-1 rounded-lg ${
                    ddlDialect === 'typescript' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  TypeScript
                </button>
              </div>

              <button
                onClick={handleCopyDdl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold shadow-md transition-all"
              >
                {copiedDdl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDdl ? 'Copied DDL!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px]">
            {generatedDdl}
          </pre>
        </div>
      )}
    </div>
  );
};

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
