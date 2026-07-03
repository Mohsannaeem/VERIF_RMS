// Scheduler modes — used in both Create Run modal and Dashboard health filter.
// Add new modes here; both pages update automatically.
export const SCHEDULER_MODES = ['Nightly', 'Weekly', 'Bi-weekly', 'Monthly'];

// Trend / time-window durations — shared by Execution Trend, Pass Rate History,
// and Scheduler Health dropdowns so they always show the same options.
export const TREND_DURATIONS = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly'];

// Dashboard scheduler health filter buckets.
// Each key matches a TREND_DURATIONS entry; value is a regex against scheduler name.
export const SCHED_BUCKETS = {
  'Daily':      /daily|nightly/i,
  'Weekly':     /^weekly$/i,
  'Bi-weekly':  /bi.?weekly/i,
  'Monthly':    /monthly/i,
};

// ── Shared colour tokens (Sunset Boulevard palette) ───────────────────────────
export const COLORS = {
  passed:  '#52b788',   // teal-green
  failed:  '#e63946',   // red
  accent:  '#f4a261',   // coral
  warning: '#e9c46a',   // warm sand
  muted:   '#7a5c44',   // warm brown-muted
};

// Pie / donut slices (cycled by index)
export const PIE_COLORS = ['#e76f51', '#f4a261', '#e9c46a', '#52b788', '#264653'];

// ── Shared Recharts tooltip style (uses CSS vars — works in both themes) ─────
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--bg-color-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-md)',
  },
  itemStyle:  { color: 'var(--text-secondary)' },
  labelStyle: { color: 'var(--text-primary)', fontWeight: 600 },
};

// Status dot / label colour map
export const STATUS_COLOR = {
  scheduled: COLORS.muted,
  running:   COLORS.warning,
  passed:    COLORS.passed,
  failed:    COLORS.failed,
};
