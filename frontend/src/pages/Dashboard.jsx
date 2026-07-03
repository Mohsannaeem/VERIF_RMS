import { useState, useEffect, useReducer } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { Target, CheckCircle, AlertTriangle, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { SCHED_BUCKETS, TREND_DURATIONS, COLORS, PIE_COLORS, TOOLTIP_STYLE, STATUS_COLOR } from '../constants';
import BASE, { api } from '../api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function DurationSelect({ value, onChange }) {
  return (
    <select className="form-control"
      style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
      value={value} onChange={onChange}>
      {TREND_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}

/** Slice an array to [window] items, offset from the right. Returns slice + nav metadata. */
function useSlice(data, defaultWin) {
  const [win, setWin]   = useState(defaultWin);
  const [off, setOff]   = useState(0);

  const n       = data.length;
  const effWin  = win === 'all' ? n : Math.min(win, n);
  const maxOff  = Math.max(0, n - effWin);
  const safeOff = Math.min(off, maxOff);
  const end     = n - safeOff;
  const start   = Math.max(0, end - effWin);
  const step    = Math.max(1, Math.floor(effWin / 3));

  const goLeft  = () => setOff(o => Math.min(o + step, maxOff));
  const goRight = () => setOff(o => Math.max(o - step, 0));
  const reset   = () => setOff(0);
  const changeWin = (v) => { setWin(v); setOff(0); };

  return {
    slice:    data.slice(start, end),
    start, end, total: n,
    win, changeWin,
    canLeft:  start > 0,
    canRight: end < n,
    goLeft, goRight, reset,
  };
}

function NavBar({ info, winOptions, label = '' }) {
  const { start, end, total, win, changeWin, canLeft, canRight, goLeft, goRight } = info;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button className="nav-pager-btn" onClick={goLeft} disabled={!canLeft} title="Older">
        <ChevronLeft size={13} />
      </button>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '82px', textAlign: 'center', userSelect: 'none' }}>
        {win === 'all' || total <= winOptions[0]
          ? `all ${total}${label}`
          : `${start + 1}–${end} / ${total}${label}`}
      </span>
      <button className="nav-pager-btn" onClick={goRight} disabled={!canRight} title="Newer">
        <ChevronRight size={13} />
      </button>
      <select className="form-control"
        style={{ width: 'auto', padding: '2px 6px', fontSize: '0.72rem', height: '26px', marginLeft: '4px' }}
        value={win} onChange={e => changeWin(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
        {winOptions.map(o => <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>)}
      </select>
    </div>
  );
}

// ── Reducer ───────────────────────────────────────────────────────────────────

const EMPTY = {
  summary:      { total: 0, passed: 0, failed: 0, pass_rate: 0 },
  trend:        [],
  by_scheduler: [],
  run_count:    0,
};

function dashboardReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START': return { ...state, loading: true, error: null, data: EMPTY };
    case 'FETCH_OK':    return { ...state, loading: false, data: action.data };
    case 'FETCH_ERR':   return { ...state, loading: false, error: action.error };
    case 'RUNS_OK':     return { ...state, runs: action.runs, runResultsMap: action.map, selectedRunId: action.selectedRunId };
    default:            return state;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { project, phase, component } = useOutletContext();
  const [duration,    setDuration]    = useState('Daily');
  const [schedWindow, setSchedWindow] = useState('Daily');

  const [state, dispatch] = useReducer(dashboardReducer, {
    loading: false, error: null, data: EMPTY,
    runs: [], selectedRunId: '', runResultsMap: {},
  });
  const { loading, error, data, runs, selectedRunId, runResultsMap } = state;

  // ── Fetch dashboard summary ───────────────────────────────────────────────
  useEffect(() => {
    if (!project) return;
    dispatch({ type: 'FETCH_START' });
    api.getDashboard({ project_id: project.id, phase, component, duration })
      .then(d  => dispatch({ type: 'FETCH_OK',  data: d }))
      .catch(e => dispatch({ type: 'FETCH_ERR', error: e.message }));
  }, [project, phase, component, duration]);

  // ── Fetch regressions + bulk results ─────────────────────────────────────
  useEffect(() => {
    if (!project) return;
    api.getRuns({ project_id: project.id })
      .then(raw => {
        const arr      = Array.isArray(raw) ? raw : (raw.value ?? []);
        const filtered = arr.filter(r => r.phase === phase && r.component === component);
        const nextId   = filtered.find(r => r.id === selectedRunId)
          ? selectedRunId : (filtered[0]?.id ?? '');

        return api.getAllRunResults({ project_id: project.id, phase, component })
          .then(allResults => {
            const map = {};
            if (Array.isArray(allResults)) {
              allResults.forEach(r => {
                if (!map[r.regression_id]) map[r.regression_id] = [];
                map[r.regression_id].push(r);
              });
            }
            dispatch({ type: 'RUNS_OK', runs: filtered, map, selectedRunId: nextId });
          });
      })
      .catch(() => {});
  }, [project?.id, phase, component]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Slice state for trend charts (shared between bar + line) ─────────────
  const { summary, trend, by_scheduler } = data;
  const trendInfo = useSlice(trend, 14);

  // Reset trend window when data refreshes
  useEffect(() => { trendInfo.reset(); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build breakdown data ──────────────────────────────────────────────────
  const fmtDate = (str) => {
    if (!str) return '';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const selectedRun     = runs.find(r => r.id === selectedRunId) ?? null;
  const selectedResults = runResultsMap[selectedRunId] || [];
  const breakdownData   = selectedResults.map((r, i) => ({
    label:  fmtDate(r.end_time || r.executed_at),
    index:  i + 1,
    date:   r.end_time || r.executed_at,
    total:  r.total_tests  || 0,
    passed: r.passed_tests || 0,
    failed: r.failed_tests || 0,
  }));

  const bkInfo = useSlice(breakdownData, 20);

  // Reset breakdown window when regression changes
  useEffect(() => { bkInfo.reset(); }, [selectedRunId]); // eslint-disable-line react-hooks/exhaustive-deps

  const passRate = selectedRun?.total_tests > 0
    ? ((selectedRun.passed_tests / selectedRun.total_tests) * 100).toFixed(1)
    : null;

  const hasData       = data.run_count > 0;
  const schedChartData = by_scheduler.filter(s => SCHED_BUCKETS[schedWindow]?.test(s.name) ?? true);

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Loading projects…
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        Viewing analytics for <strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong>
        • Phase: <span className="badge badge-blue">{phase}</span>
        • Component: <span className="badge badge-blue">{component}</span>
        {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading…</span>}
        {error   && <span style={{ fontSize: '0.75rem', color: 'var(--error-color)' }}>⚠ {error}</span>}
      </div>

      {/* Empty state */}
      {!loading && !error && !hasData && (
        <div style={{ margin: '40px auto', maxWidth: '480px', textAlign: 'center', padding: '48px 32px', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📭</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No data for this project yet</h3>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '20px' }}>
            No completed test runs found for <strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong> / {phase}.
            <br />Add runs via the API to see charts populate here.
          </p>
          <a href={`${BASE}/docs#/default/create_run_api_runs_post`} target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', padding: '8px 20px', background: 'var(--accent-color)', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
            Add a Test Run via API →
          </a>
        </div>
      )}

      {hasData && (
        <>
          {/* Metric cards */}
          <div className="dashboard-grid">
            <div className="card metric-card">
              <div className="metric-icon blue"><Target size={24} /></div>
              <div className="metric-data">
                <span className="metric-value">{summary.total.toLocaleString()}</span>
                <span className="metric-label">Total Test Cases Run</span>
              </div>
            </div>
            <div className="card metric-card">
              <div className="metric-icon green"><CheckCircle size={24} /></div>
              <div className="metric-data">
                <span className="metric-value">{summary.passed.toLocaleString()}</span>
                <span className="metric-label">Consolidated Passes</span>
              </div>
            </div>
            <div className="card metric-card">
              <div className="metric-icon red"><AlertTriangle size={24} /></div>
              <div className="metric-data">
                <span className="metric-value">{summary.failed.toLocaleString()}</span>
                <span className="metric-label">Failed Assertions / Regressions</span>
              </div>
            </div>
            <div className="card metric-card">
              <div className="metric-icon yellow"><Activity size={24} /></div>
              <div className="metric-data">
                <span className="metric-value">{summary.pass_rate}%</span>
                <span className="metric-label">Overall Pass Rate</span>
              </div>
            </div>
          </div>

          {/* ── Trend charts ────────────────────────────────────────────────── */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Execution Trend</h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <DurationSelect value={duration} onChange={e => { setDuration(e.target.value); trendInfo.reset(); }} />
                  <NavBar info={trendInfo} winOptions={[7, 14, 30, 'all']} label=" buckets" />
                </div>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendInfo.slice}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="passed" stackId="a" fill={COLORS.passed} radius={[0, 0, 4, 4]} />
                    <Bar dataKey="failed"  stackId="a" fill={COLORS.failed}  radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Pass Rate History</h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <DurationSelect value={duration} onChange={e => { setDuration(e.target.value); trendInfo.reset(); }} />
                  <NavBar info={trendInfo} winOptions={[7, 14, 30, 'all']} label=" buckets" />
                </div>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendInfo.slice}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="pass_rate" stroke={COLORS.accent} strokeWidth={3}
                      dot={{ fill: COLORS.accent, r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── Scheduler summary ───────────────────────────────────────────── */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(400px, 2fr) minmax(300px, 1fr)' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Scheduler Health — Last Run per Mode</h3>
                <select className="form-control"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                  value={schedWindow} onChange={e => setSchedWindow(e.target.value)}>
                  {Object.keys(SCHED_BUCKETS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schedChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d2215" horizontal vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{ ...TOOLTIP_STYLE.contentStyle, padding: '10px 14px', fontSize: '0.8rem' }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{label}</p>
                          <p style={{ color: COLORS.passed }}>Passed: <strong>{d?.passed}</strong></p>
                          <p style={{ color: COLORS.failed }}>Failed: <strong>{d?.failed}</strong></p>
                          <p style={{ color: COLORS.accent }}>Pass rate: <strong>{d?.pass_rate}%</strong></p>
                          <p style={{ color: 'var(--text-muted)', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontSize: '0.72rem' }}>
                            Run: {d?.run_id} &nbsp;·&nbsp; {d?.end_time}
                          </p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="passed" stackId="a" fill={COLORS.passed} />
                    <Bar dataKey="failed"  stackId="a" fill={COLORS.failed} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Execution Tracking by Scheduler</h3>
              </div>
              <div style={{ height: 300, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={schedChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {schedChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', bottom: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  {schedChartData.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div style={{ width: 10, height: 10, backgroundColor: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 2 }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Regression Run Breakdown ─────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Regression Run Breakdown</h3>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select className="form-control"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                  value={selectedRunId}
                  onChange={e => dispatch({ type: 'RUNS_OK', runs, map: runResultsMap, selectedRunId: e.target.value })}>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.id} — {r.module} ({r.scheduler})</option>)}
                </select>
                {breakdownData.length > 0 && (
                  <NavBar info={bkInfo} winOptions={[10, 20, 50, 'all']} label=" runs" />
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', alignItems: 'start' }}>
              {/* 3-line chart */}
              <div style={{ height: 340 }}>
                {bkInfo.slice.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No execution results yet — push results via the script.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bkInfo.slice} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={56} interval="preserveStartEnd" />
                      <YAxis />
                      <Tooltip {...TOOLTIP_STYLE}
                        labelFormatter={(label, payload) => {
                          const idx = payload?.[0]?.payload?.index;
                          return idx ? `#${idx} — ${label}` : label;
                        }}
                      />
                      <Line dataKey="total"  name="Total"  stroke={COLORS.accent} strokeWidth={2} dot={{ r: 4, fill: COLORS.accent,  strokeWidth: 2, stroke: 'var(--bg-color-secondary)' }} activeDot={{ r: 6 }} />
                      <Line dataKey="passed" name="Passed" stroke={COLORS.passed} strokeWidth={2} dot={{ r: 4, fill: COLORS.passed, strokeWidth: 2, stroke: 'var(--bg-color-secondary)' }} activeDot={{ r: 6 }} />
                      <Line dataKey="failed" name="Failed" stroke={COLORS.failed} strokeWidth={2} dot={{ r: 4, fill: COLORS.failed,  strokeWidth: 2, stroke: 'var(--bg-color-secondary)' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Detail panel */}
              {selectedRun && (
                <div style={{ minWidth: '200px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', paddingTop: '8px' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Run Details
                  </p>
                  <DetailRow label="Regression" value={selectedRun.id} mono />
                  <DetailRow label="Module"     value={selectedRun.module} />
                  <DetailRow label="Scheduler"  value={selectedRun.scheduler} />
                  <DetailRow label="Phase"      value={selectedRun.phase} />
                  <DetailRow label="Status"     value={selectedRun.status}
                    valueStyle={{ color: STATUS_COLOR[selectedRun.status] ?? COLORS.muted, fontWeight: 600, textTransform: 'capitalize' }} />
                  <div style={{ margin: '12px 0', height: '1px', background: 'var(--border-color)' }} />
                  <DetailRow label="Executions" value={selectedResults.length} />
                  <DetailRow label="Total"      value={selectedRun.total_tests?.toLocaleString()} />
                  <DetailRow label="Passed"     value={selectedRun.passed_tests?.toLocaleString()} valueStyle={{ color: COLORS.passed, fontWeight: 600 }} />
                  <DetailRow label="Failed"     value={selectedRun.failed_tests?.toLocaleString()} valueStyle={{ color: COLORS.failed,  fontWeight: 600 }} />
                  {passRate !== null && (
                    <div style={{ marginTop: '14px', padding: '8px 12px', background: 'rgba(231,111,81,0.1)', borderRadius: '6px', border: '1px solid var(--accent-glow)', textAlign: 'center' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)' }}>{passRate}%</span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Latest Pass Rate</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono, valueStyle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '12px' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', ...valueStyle }}>{value ?? '—'}</span>
    </div>
  );
}

export default Dashboard;
