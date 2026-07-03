import { useState, useEffect, useCallback, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { SCHEDULER_MODES, COLORS, STATUS_COLOR } from '../constants';
import { Modal, Field, SelectField, ModalFooter } from '../components/ui/Modal.jsx';
import { api } from '../api';

// ── Execution history sub-table ───────────────────────────────────────────────
function RunResultsRows({ regressionId, formatDt }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit]     = useState(10);

  useEffect(() => {
    api.getRunResults(regressionId)
      .then(data => { setResults(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [regressionId]);

  if (loading) return (
    <tr>
      <td colSpan="10" style={{ padding: '12px 48px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading history…</td>
    </tr>
  );

  if (results.length === 0) return (
    <tr>
      <td colSpan="10" style={{ padding: '12px 48px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No execution results yet — push results via the script.</td>
    </tr>
  );

  const visible = limit === 'all' ? results : results.slice(-limit);

  return (
    <>
      <tr style={{ background: 'var(--bg-color-tertiary)' }}>
        <td colSpan="10" style={{ padding: '6px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Showing {visible.length} of {results.length} executions
            </span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '2px 8px', fontSize: '0.75rem', height: '24px' }}
              value={limit}
              onChange={e => setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value={10}>Last 10</option>
              <option value={25}>Last 25</option>
              <option value={50}>Last 50</option>
              <option value="all">All</option>
            </select>
          </div>
        </td>
      </tr>
      {visible.map(r => (
        <tr key={r.id} style={{ background: 'rgba(88,166,255,0.03)', borderLeft: '3px solid var(--accent-glow)' }}>
          <td style={{ paddingLeft: '48px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>#{r.id}</td>
          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.scheduler}</td>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[r.status] ?? COLORS.muted, display: 'inline-block' }} />
              <span style={{ textTransform: 'capitalize', fontSize: '0.82rem' }}>{r.status}</span>
            </div>
          </td>
          <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{r.total_tests || '—'}</td>
          <td style={{ textAlign: 'center', color: COLORS.passed, fontWeight: 600, fontSize: '0.85rem' }}>{r.passed_tests || '—'}</td>
          <td style={{ textAlign: 'center', color: COLORS.failed, fontWeight: 600, fontSize: '0.85rem' }}>{r.failed_tests || '—'}</td>
          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{formatDt(r.start_time)}</td>
          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{formatDt(r.executed_at)}</td>
          <td style={{ textAlign: 'right' }}>
            {r.log_path && (
              <button className="btn btn-secondary" style={{ padding: '4px' }} title="View Log" onClick={() => window.open(r.log_path, '_blank')}>
                <ExternalLink size={13} />
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function TestRuns() {
  const { project, phase, component } = useOutletContext();

  const [runs, setRuns]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [filters, setFilters]   = useState({ id: '', module: '', status: 'all', scheduler: 'all' });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  // useCallback — deps use `project` (not `project?.id`) to satisfy memoization rule
  const fetchRuns = useCallback(() => {
    if (!project) return;
    api.getRuns({ project_id: project.id })
      .then(raw => {
        const arr = Array.isArray(raw) ? raw : (raw.value ?? []);
        setRuns(arr.filter(r => r.phase === phase && r.component === component));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    setLoading(true);
  }, [project, phase, component]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]); // eslint-disable-line react-hooks/set-state-in-effect

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const schedulerOptions = [...new Set(runs.map(r => r.scheduler).filter(Boolean))];

  const filteredRuns = runs.filter(run => {
    if (filters.id        && !(run.name || run.id).toLowerCase().includes(filters.id.toLowerCase())) return false;
    if (filters.module    && !run.module.toLowerCase().includes(filters.module.toLowerCase())) return false;
    if (filters.status    !== 'all' && run.status    !== filters.status)    return false;
    if (filters.scheduler !== 'all' && run.scheduler !== filters.scheduler) return false;
    return true;
  });

  const openCreate = () => {
    setFormError('');
    setForm({ id: '', module: '', scheduler: 'Nightly', start_time: new Date().toISOString().slice(0, 16) });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setSaving(false); setFormError(''); };
  const setField   = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.id.trim())        { setFormError('Run ID is required.');    return; }
    if (!form.module.trim())    { setFormError('Module is required.');     return; }
    if (!form.scheduler.trim()) { setFormError('Scheduler is required.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.createRun({
        id: form.id.trim(), project_id: project.id, phase, component,
        module: form.module.trim(), scheduler: form.scheduler.trim(),
        status: 'scheduled', progress: 0,
        start_time: form.start_time || new Date().toISOString(),
        end_time: null, total_tests: 0, passed_tests: 0, failed_tests: 0, log_path: null,
      });
      closeModal();
      fetchRuns();
    } catch (e) {
      setFormError(e.message || 'Failed to create run.');
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete regression "${id}" and all its execution history? This cannot be undone.`)) return;
    try { await api.deleteRun(id); } catch (e) { console.warn('Delete failed:', e); }
    setRuns(prev => prev.filter(r => r.id !== id));
  };

  const formatDt = (str) => {
    if (!str) return '—';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!project) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
      Loading projects…
    </div>
  );

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title">Regression Run History</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} onClick={fetchRuns} disabled={loading}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} onClick={openCreate}>
              <Plus size={15} /> Create Regression
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }} />
                <th style={{ minWidth: '160px', verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '8px' }}>Regression ID</div>
                  <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} placeholder="Filter…" value={filters.id} onChange={e => setFilters(f => ({ ...f, id: e.target.value }))} />
                </th>
                <th style={{ minWidth: '180px', verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '8px' }}>Module</div>
                  <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} placeholder="Filter…" value={filters.module} onChange={e => setFilters(f => ({ ...f, module: e.target.value }))} />
                </th>
                <th style={{ minWidth: '130px', verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '8px' }}>Status</div>
                  <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="all">All</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="running">Running</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </th>
                <th style={{ minWidth: '110px', verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '8px' }}>Scheduler</div>
                  <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} value={filters.scheduler} onChange={e => setFilters(f => ({ ...f, scheduler: e.target.value }))}>
                    <option value="all">All</option>
                    {schedulerOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </th>
                <th style={{ minWidth: '80px', textAlign: 'center', verticalAlign: 'top' }}><div style={{ marginBottom: '8px' }}>Total</div></th>
                <th style={{ minWidth: '80px', textAlign: 'center', verticalAlign: 'top' }}><div style={{ marginBottom: '8px' }}>Passed</div></th>
                <th style={{ minWidth: '80px', textAlign: 'center', verticalAlign: 'top' }}><div style={{ marginBottom: '8px' }}>Failed</div></th>
                <th style={{ minWidth: '150px', verticalAlign: 'top' }}><div style={{ marginBottom: '8px' }}>Last Run</div></th>
                <th style={{ textAlign: 'right', verticalAlign: 'top' }}><div style={{ marginBottom: '8px' }}>Actions</div></th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map(run => {
                const isOpen = expanded.has(run.id);
                return (
                  <Fragment key={run.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(run.id)}>
                      <td style={{ paddingLeft: '12px', color: 'var(--text-secondary)' }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-color)', fontFamily: 'monospace' }}>{run.name || run.id}</td>
                      <td>{run.module}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[run.status] ?? COLORS.muted, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{run.status}</span>
                        </div>
                      </td>
                      <td>{run.scheduler}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{run.total_tests || '—'}</td>
                      <td style={{ textAlign: 'center', color: COLORS.passed, fontWeight: 600 }}>{run.passed_tests || '—'}</td>
                      <td style={{ textAlign: 'center', color: COLORS.failed, fontWeight: 600 }}>{run.failed_tests || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDt(run.end_time)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-danger" style={{ padding: '5px' }} title="Delete regression" onClick={() => handleDelete(run.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <>
                        <tr style={{ background: 'var(--bg-color-tertiary)' }}>
                          <td colSpan="10" style={{ padding: '6px 48px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Execution History — {run.name || run.id}
                          </td>
                        </tr>
                        <RunResultsRows regressionId={run.id} formatDt={formatDt} />
                      </>
                    )}
                  </Fragment>
                );
              })}
              {!loading && filteredRuns.length === 0 && (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
                    {runs.length === 0 ? 'No regressions yet — create one to get started.' : 'No regressions match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <Modal title="Create Regression Run" onClose={closeModal}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[['Project', project.name], ['Phase', phase], ['Component', component]].map(([k, v]) => (
              <span key={k} style={{ fontSize: '0.75rem', background: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '3px 10px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}: </span>{v}
              </span>
            ))}
          </div>
          <Field label="Regression ID" placeholder="e.g. BASIC_SANITY_TESTING" value={form.id} onChange={e => setField('id', e.target.value)} autoFocus />
          <Field label="Module / Target" placeholder="e.g. FIFO Full Regression" value={form.module} onChange={e => setField('module', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <SelectField label="Scheduler" value={form.scheduler} onChange={e => setField('scheduler', e.target.value)}>
              {SCHEDULER_MODES.map(s => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start Time</label>
              <input type="datetime-local" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={form.start_time} onChange={e => setField('start_time', e.target.value)} />
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(88,166,255,0.06)', border: '1px solid var(--accent-glow)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Status will be <strong style={{ color: COLORS.muted }}>Scheduled</strong>. Push results later via the script.
          </div>
          <ModalFooter error={formError} saving={saving} onCancel={closeModal} onSave={handleCreate} saveLabel="Create Regression" />
        </Modal>
      )}
    </div>
  );
}

export default TestRuns;
