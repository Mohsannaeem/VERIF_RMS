const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Base URL — use this for constructing links (e.g. Swagger docs link). */
export default BASE;

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  // DELETE returns {"ok": true} — always parse JSON
  return res.json();
}

// ---------------------------------------------------------------------------
// API surface — one function per endpoint
// ---------------------------------------------------------------------------
export const api = {
  // Projects
  getProjects: () =>
    request('/api/projects'),

  saveProject: (body) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),

  // Test Runs
  getRuns: (params) =>
    request(`/api/runs?${new URLSearchParams(params)}`),

  getRun: (id) =>
    request(`/api/runs/${encodeURIComponent(id)}`),

  createRun: (body) =>
    request('/api/runs', { method: 'POST', body: JSON.stringify(body) }),

  updateRun: (id, body) =>
    request(`/api/runs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteRun: (id) =>
    request(`/api/runs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Execution results
  getRunResults: (regressionId) =>
    request(`/api/runs/${encodeURIComponent(regressionId)}/results`),

  /** Bulk fetch all results for a project/phase/component — avoids N+1 requests. */
  getAllRunResults: (params) =>
    request(`/api/runs/results?${new URLSearchParams(params)}`),

  pushRunResult: (body) =>
    request('/api/runs/result', { method: 'POST', body: JSON.stringify(body) }),

  // Dashboard
  getDashboard: (params) =>
    request(`/api/dashboard?${new URLSearchParams(params)}`),

  // Coverage
  getCoverage: (params) =>
    request(`/api/coverage?${new URLSearchParams(params)}`),

  getLatestCoverage: (params) =>
    request(`/api/coverage/latest?${new URLSearchParams(params)}`),

  createCoverage: (body) =>
    request('/api/coverage', { method: 'POST', body: JSON.stringify(body) }),

  // Schedules
  getSchedules: (params) =>
    request(`/api/schedules?${new URLSearchParams(params)}`),

  createSchedule: (body) =>
    request('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),

  deleteSchedule: (id) =>
    request(`/api/schedules/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: (projectId) =>
    request(`/api/settings/${encodeURIComponent(projectId)}`),

  saveSettings: (body) =>
    request('/api/settings', { method: 'POST', body: JSON.stringify(body) }),
};
