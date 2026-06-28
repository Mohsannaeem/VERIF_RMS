import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { Target, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { SCHED_BUCKETS } from '../constants';

import API from '../api';
const COLORS = ['#58a6ff', '#8b949e', '#d29922'];

const EMPTY = {
  summary:      { total: 0, passed: 0, failed: 0, pass_rate: 0 },
  trend:        [],
  by_scheduler: [],
  run_count:    0,
};


function Dashboard() {
  const { project, phase, component } = useOutletContext();
  const [duration, setDuration]         = useState('Daily');
  const [data, setData]                 = useState(EMPTY);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // Scheduler health time window
  const [schedWindow, setSchedWindow] = useState('Daily');

  // Run breakdown state
  const [runs, setRuns]                   = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runResultsMap, setRunResultsMap] = useState({});  // regression_id → results[]

  // ── Fetch dashboard summary ──────────────────────────────────────────────────
  useEffect(() => {
    if (!project) return;
    setLoading(true);
    setError(null);
    setData(EMPTY);
    const params = new URLSearchParams({ project_id: project.id, phase, component, duration });
    fetch(`${API}/api/dashboard?${params}`)
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [project?.id, phase, component, duration]);

  // ── Fetch regressions then their execution results ───────────────────────────
  useEffect(() => {
    if (!project) return;
    fetch(`${API}/api/runs?project_id=${project.id}`)
      .then(r => r.json())
      .then(raw => {
        const arr = Array.isArray(raw) ? raw : (raw.value ?? []);
        const filtered = arr.filter(r => r.phase === phase && r.component === component);
        setRuns(filtered);
        setSelectedRunId(prev => (filtered.find(r => r.id === prev) ? prev : (filtered[0]?.id ?? '')));
        // Fetch execution history for each regression
        return Promise.all(
          filtered.map(run =>
            fetch(`${API}/api/runs/${encodeURIComponent(run.id)}/results`)
              .then(r => r.json())
              .then(results => ({ id: run.id, results: Array.isArray(results) ? results : [] }))
              .catch(() => ({ id: run.id, results: [] }))
          )
        );
      })
      .then(entries => {
        if (!entries) return;
        const map = {};
        entries.forEach(e => { map[e.id] = e.results; });
        setRunResultsMap(map);
      })
      .catch(() => {});
  }, [project?.id, phase, component]);

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Loading projects…
      </div>
    );
  }

  const { summary, trend, by_scheduler } = data;
  const hasData = data.run_count > 0;

  const schedChartData = by_scheduler.filter(s =>
    SCHED_BUCKETS[schedWindow]?.test(s.name) ?? true
  );

  // ── Build breakdown chart: 3 lines (Total/Passed/Failed) for selected regression ──
  const fmtExecDate = (str) => {
    if (!str) return '';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const selectedRun     = runs.find(r => r.id === selectedRunId) ?? null;
  const selectedResults = runResultsMap[selectedRunId] || [];
  const breakdownData   = selectedResults.map((r, i) => ({
    label:  `#${i + 1}`,
    date:   r.executed_at,
    total:  r.total_tests  || 0,
    passed: r.passed_tests || 0,
    failed: r.failed_tests || 0,
  }));

  const passRate = selectedRun?.total_tests > 0
    ? ((selectedRun.passed_tests / selectedRun.total_tests) * 100).toFixed(1)
    : null;

  return (
    <div>
      <div style={{ marginBottom: '24px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        Viewing analytics for <strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong> • Phase: <span className="badge badge-blue">{phase}</span> • Component: <span className="badge badge-blue">{component}</span>
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
          <a href="http://localhost:8000/docs#/default/create_run_api_runs_post" target="_blank" rel="noreferrer"
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

          {/* Trend charts */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Execution Trend</h3>
                <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} value={duration} onChange={e => setDuration(e.target.value)}>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-weekly">Bi-weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                    <XAxis dataKey="name" stroke="#8b949e" />
                    <YAxis stroke="#8b949e" />
                    <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }} itemStyle={{ color: '#c9d1d9' }} />
                    <Bar dataKey="passed" stackId="a" fill="#3fb950" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="failed"  stackId="a" fill="#f85149" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Pass Rate History</h3>
                <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} value={duration} onChange={e => setDuration(e.target.value)}>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-weekly">Bi-weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                    <XAxis dataKey="name" stroke="#8b949e" />
                    <YAxis stroke="#8b949e" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="pass_rate" stroke="#58a6ff" strokeWidth={3} dot={{ fill: '#58a6ff', r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Scheduler summary */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(400px, 2fr) minmax(300px, 1fr)' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Scheduler Health — Last Run per Mode</h3>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                  value={schedWindow}
                  onChange={e => setSchedWindow(e.target.value)}
                >
                  {Object.keys(SCHED_BUCKETS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schedChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="#8b949e" />
                    <YAxis dataKey="name" type="category" stroke="#8b949e" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#c9d1d9' }}>
                            <p style={{ fontWeight: 700, color: '#fff', marginBottom: '6px' }}>{label}</p>
                            <p style={{ color: '#3fb950' }}>Passed: <strong>{d?.passed}</strong></p>
                            <p style={{ color: '#f85149' }}>Failed: <strong>{d?.failed}</strong></p>
                            <p style={{ color: '#58a6ff' }}>Pass rate: <strong>{d?.pass_rate}%</strong></p>
                            <p style={{ color: '#8b949e', marginTop: '6px', borderTop: '1px solid #30363d', paddingTop: '6px', fontSize: '0.72rem' }}>
                              Run: {d?.run_id} &nbsp;·&nbsp; {d?.end_time}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="passed" stackId="a" fill="#3fb950" />
                    <Bar dataKey="failed"  stackId="a" fill="#f85149" radius={[0, 4, 4, 0]} />
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
                      {schedChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', bottom: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  {schedChartData.map((entry, index) => (
                    <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div style={{ width: '10px', height: '10px', backgroundColor: COLORS[index % COLORS.length], borderRadius: '2px' }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Regression Run Breakdown ─────────────────────────────────────────── */}
          {runs.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Regression Run Breakdown</h3>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                  value={selectedRunId}
                  onChange={e => setSelectedRunId(e.target.value)}
                >
                  {runs.map(r => (
                    <option key={r.id} value={r.id}>{r.id} — {r.module} ({r.scheduler})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', alignItems: 'start' }}>

                {/* 3-line chart — Total / Passed / Failed per execution */}
                <div style={{ height: 300 }}>
                  {breakdownData.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No execution results yet — push results via the script.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={breakdownData} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                        <XAxis dataKey="label" stroke="#8b949e" tick={{ fontSize: 11 }} label={{ value: 'Execution', position: 'insideBottom', offset: -8, fill: '#8b949e', fontSize: 11 }} />
                        <YAxis stroke="#8b949e" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                          itemStyle={{ color: '#c9d1d9' }}
                          labelFormatter={(label, payload) => {
                            const date = payload?.[0]?.payload?.date;
                            return `${label}${date ? ` — ${fmtExecDate(date)}` : ''}`;
                          }}
                        />
                        <Line dataKey="total"  name="Total"  stroke="#58a6ff" strokeWidth={2} dot={{ r: 4, fill: '#58a6ff', strokeWidth: 2, stroke: '#0d1117' }} activeDot={{ r: 6 }} />
                        <Line dataKey="passed" name="Passed" stroke="#3fb950" strokeWidth={2} dot={{ r: 4, fill: '#3fb950', strokeWidth: 2, stroke: '#0d1117' }} activeDot={{ r: 6 }} />
                        <Line dataKey="failed" name="Failed" stroke="#f85149" strokeWidth={2} dot={{ r: 4, fill: '#f85149', strokeWidth: 2, stroke: '#0d1117' }} activeDot={{ r: 6 }} />
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
                      valueStyle={{ color: selectedRun.status === 'passed' ? '#3fb950' : selectedRun.status === 'failed' ? '#f85149' : '#d29922', fontWeight: 600, textTransform: 'capitalize' }} />
                    <div style={{ margin: '12px 0', height: '1px', background: 'var(--border-color)' }} />
                    <DetailRow label="Executions" value={selectedResults.length} />
                    <DetailRow label="Total"      value={selectedRun.total_tests?.toLocaleString()} />
                    <DetailRow label="Passed"     value={selectedRun.passed_tests?.toLocaleString()} valueStyle={{ color: '#3fb950', fontWeight: 600 }} />
                    <DetailRow label="Failed"     value={selectedRun.failed_tests?.toLocaleString()} valueStyle={{ color: '#f85149', fontWeight: 600 }} />
                    {passRate !== null && (
                      <div style={{ marginTop: '14px', padding: '8px 12px', background: 'rgba(88,166,255,0.08)', borderRadius: '6px', border: '1px solid var(--accent-glow)', textAlign: 'center' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)' }}>{passRate}%</span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Latest Pass Rate</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
