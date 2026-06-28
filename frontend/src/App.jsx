import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TestRuns from './pages/TestRuns';
import Scheduler from './pages/Scheduler';
import Settings from './pages/Settings';
import Coverage from './pages/Coverage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="runs" element={<TestRuns />} />
        <Route path="coverage" element={<Coverage />} />
        <Route path="scheduler" element={<Scheduler />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
