// ── API key held by this browser ──────────────────────────────────────────────
// The raw key is shown once at creation. To keep the GUI able to write after
// auth is switched on, we retain that value here and send it on every request.
// It is deliberately never rendered again — Settings shows only the prefix.

const STORAGE_KEY = 'rms_api_key';

/** The raw key this browser authenticates with, or '' if none is held. */
export const getApiKey = () => {
  try { return localStorage.getItem(STORAGE_KEY) || ''; }
  catch { return ''; }   // private mode / storage disabled
};

export const setApiKey = (raw) => {
  try { localStorage.setItem(STORAGE_KEY, raw); } catch { /* non-fatal */ }
};

export const clearApiKey = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
};

/** First 12 chars — the same prefix the backend stores, safe to display. */
export const getApiKeyPrefix = () => getApiKey().slice(0, 12);
