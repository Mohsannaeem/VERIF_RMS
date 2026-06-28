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
