const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Base URL — use this for constructing links (e.g. Swagger docs link). */
export default BASE;

// ---------------------------------------------------------------------------
// Auth token — remember-me lives in localStorage, session in sessionStorage.
// ---------------------------------------------------------------------------
function getToken() {
  return localStorage.getItem('rms_token') || sessionStorage.getItem('rms_token') || null;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------
async function request(path, options = {}) {
  // Write endpoints stay unauthenticated for CI; the Bearer token, when present,
  // identifies the signed-in user so the backend can scope their own keys.
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  });

  // A 401 from a normal call means our token expired → drop it and return to
  // login. The auth endpoints themselves answer 401 for bad credentials, which
  // is not a session expiry, so they must surface their own message instead.
  const isAuthCall = path.startsWith('/api/auth/');
  if (res.status === 401 && !isAuthCall) {
    ['localStorage', 'sessionStorage'].forEach((s) => {
      window[s].removeItem('rms_token');
      window[s].removeItem('rms_user');
    });
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }

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
  // Auth
  authStatus: () =>
    request('/api/auth/status'),

  setup: (body) =>
    request('/api/auth/setup', { method: 'POST', body: JSON.stringify(body) }),

  login: (body) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  me: () =>
    request('/api/auth/me'),

  // Admin — companies
  getCompanies: () =>
    request('/api/admin/companies'),

  createCompany: (body) =>
    request('/api/admin/companies', { method: 'POST', body: JSON.stringify(body) }),

  deactivateCompany: (id) =>
    request(`/api/admin/companies/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Admin — users
  getUsers: () =>
    request('/api/admin/users'),

  createUser: (body) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),

  updateUser: (id, body) =>
    request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

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

  // API keys
  getApiKeys: (params) =>
    request(`/api/keys${params ? `?${new URLSearchParams(params)}` : ''}`),

  /** Returns the raw key in `key` — the only time it is ever available. */
  createApiKey: (body) =>
    request('/api/keys', { method: 'POST', body: JSON.stringify(body) }),

  deleteApiKey: (id) =>
    request(`/api/keys/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: (projectId) =>
    request(`/api/settings/${encodeURIComponent(projectId)}`),

  saveSettings: (body) =>
    request('/api/settings', { method: 'POST', body: JSON.stringify(body) }),
};
