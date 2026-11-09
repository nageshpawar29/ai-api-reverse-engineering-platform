import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectLayout } from './components/layout/ProjectLayout';

// Lazy-loaded sub-pages so heavy visualizers (SwaggerUI, Mermaid, ReactFlow) don't delay the initial site load
const ProjectOverviewPage = lazy(() => import('./pages/ProjectOverviewPage').then((m) => ({ default: m.ProjectOverviewPage })));
const EndpointsPage = lazy(() => import('./pages/EndpointsPage').then((m) => ({ default: m.EndpointsPage })));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage').then((m) => ({ default: m.ApiDocsPage })));
const SwaggerPage = lazy(() => import('./pages/SwaggerPage').then((m) => ({ default: m.SwaggerPage })));
const PostmanPage = lazy(() => import('./pages/PostmanPage').then((m) => ({ default: m.PostmanPage })));
const DependencyGraphPage = lazy(() => import('./pages/DependencyGraphPage').then((m) => ({ default: m.DependencyGraphPage })));
const DatabaseSchemaPage = lazy(() => import('./pages/DatabaseSchemaPage').then((m) => ({ default: m.DatabaseSchemaPage })));
const SecurityPage = lazy(() => import('./pages/SecurityPage').then((m) => ({ default: m.SecurityPage })));
const TestsPage = lazy(() => import('./pages/TestsPage').then((m) => ({ default: m.TestsPage })));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage').then((m) => ({ default: m.PlaygroundPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PageLoader = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
    <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    <span className="text-xs font-mono">Loading studio module...</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />

        {/* Project Layout and Sub-pages */}
        <Route path="/projects/:id" element={<ProjectLayout />}>
          <Route index element={<ProjectOverviewPage />} />
          <Route path="endpoints" element={<EndpointsPage />} />
          <Route path="docs" element={<ApiDocsPage />} />
          <Route path="swagger" element={<SwaggerPage />} />
          <Route path="postman" element={<PostmanPage />} />
          <Route path="graph" element={<DependencyGraphPage />} />
          <Route path="database" element={<DatabaseSchemaPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="tests" element={<TestsPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
