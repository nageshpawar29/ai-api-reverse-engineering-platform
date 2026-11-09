import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  FileCode2,
  Send,
  Workflow,
  Database,
  ShieldAlert,
  TestTube2,
  PlaySquare,
  Bot,
  Settings,
  ArrowLeft,
  BookOpen,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  projectName?: string;
}

interface SidebarLink {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: string;
}

interface SidebarSection {
  title: string;
  links: SidebarLink[];
}

export const Sidebar: React.FC<SidebarProps> = ({ projectName }) => {
  const { id } = useParams<{ id: string }>();

  const sections: SidebarSection[] = [
    {
      title: 'DISCOVERY & SPECS',
      links: [
        { to: `/projects/${id}`, label: 'Overview', icon: LayoutDashboard, exact: true },
        { to: `/projects/${id}/endpoints`, label: 'Endpoints Explorer', icon: Layers },
        { to: `/projects/${id}/docs`, label: 'Interactive Docs', icon: BookOpen },
        { to: `/projects/${id}/swagger`, label: 'Swagger Studio', icon: FileCode2 },
        { to: `/projects/${id}/postman`, label: 'Postman Suite', icon: Send },
      ],
    },
    {
      title: 'ARCHITECTURE & GRAPHS',
      links: [
        { to: `/projects/${id}/graph`, label: 'CI/CD Pipeline Flow', icon: Workflow },
        { to: `/projects/${id}/database`, label: 'Database Models (ER)', icon: Database },
        { to: `/projects/${id}/security`, label: 'Security & Auth', icon: ShieldAlert },
      ],
    },
    {
      title: 'RUNTIME & AI TESTING',
      links: [
        { to: `/projects/${id}/playground`, label: 'API Playground Pro', icon: PlaySquare, badge: 'Pro' },
        { to: `/projects/${id}/tests`, label: 'Automated Tests', icon: TestTube2 },
        { to: `/projects/${id}/chat`, label: 'Ask AI Engineer', icon: Bot, badge: 'AI' },
      ],
    },
    {
      title: 'SYSTEM',
      links: [
        { to: `/projects/${id}/settings`, label: 'Configuration', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-64 border-r border-white/[0.08] bg-slate-950/90 backdrop-blur-xl flex flex-col flex-shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Project Header Box */}
      <div className="p-4 border-b border-white/[0.08]">
        <NavLink
          to="/dashboard"
          className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 text-slate-500 group-hover:text-indigo-400" />
          <span>All Projects</span>
        </NavLink>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/[0.06] shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-xs font-bold text-white truncate flex-1" title={projectName || 'Project'}>
              {projectName || 'Current Project'}
            </h2>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-indigo-400">AST Synced</span>
            <span>ID: {id?.slice(0, 6)}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <div className="px-3 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              {sec.title}
            </div>
            {sec.links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.exact}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent text-indigo-300 font-semibold border-l-2 border-indigo-500 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110" />
                    <span className="truncate">{link.label}</span>
                  </div>

                  {link.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                      {link.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

