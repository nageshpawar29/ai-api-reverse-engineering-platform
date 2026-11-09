import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectLayout } from './components/layout/ProjectLayout';
import { ProjectOverviewPage } from './pages/ProjectOverviewPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { SwaggerPage } from './pages/SwaggerPage';
import { PostmanPage } from './pages/PostmanPage';
import { DependencyGraphPage } from './pages/DependencyGraphPage';
import { DatabaseSchemaPage } from './pages/DatabaseSchemaPage';
import { SecurityPage } from './pages/SecurityPage';
import { TestsPage } from './pages/TestsPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
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
  );
};

export default App;
