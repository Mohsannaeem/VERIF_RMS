import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Trash2, ExternalLink, RefreshCw, ChevronDown, ChevronRight, Download, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SCHEDULER_MODES, COLORS, STATUS_COLOR } from '../constants';
import { Modal, Field, SelectField, ModalFooter, RadioGroup } from '../components/ui/Modal.jsx';
import { toCSV, downloadCSV, passRate, durationMin, slug } from '../utils/csv';
import { downloadWorkbook, sheetName } from '../utils/xlsx';
import { api } from '../api';

// ── Column definitions ────────────────────────────────────────────────────────
// One source of truth per export shape: the CSV header order and the Excel
// schema are both derived from these, so the two formats cannot drift apart.
// `csv` formats a value for the flat text export; Excel keeps the raw number
// so columns stay sortable, with `format` controlling how it displays.
const decimal1 = { type: Number, format: '0.0', csv: v => (v == null ? '' : v.toFixed(1)) };

const SUMMARY_FIELDS = [
  { column: 'Regression ID', type: String, width: 30 },
  { column: 'Name',          type: String, width: 30 },
  { column: 'Module',        type: String, width: 18 },
  { column: 'Scheduler',     type: String, width: 12 },
  { column: 'Phase',         type: String, width: 8  },
  { column: 'Component',     type: String, width: 14 },
  { column: 'Status',        type: String, width: 12 },
  { column: 'Pass Rate %',   ...decimal1,  width: 12 },
  { column: 'Passed',        type: Number, width: 9  },
  { column: 'Failed',        type: Number, width: 9  },
  { column: 'Total',         type: Number, width: 9  },
  { column: 'Last Run',      type: String, width: 20 },
  { column: 'Log Path',      type: String, width: 28 },
];

const HISTORY_FIELDS = [
  { column: 'Regression ID',  type: String, width: 30 },
  { column: 'Module',         type: String, width: 18 },
  { column: 'Scheduler',      type: String, width: 12 },
  { column: 'Phase',          type: String, width: 8  },
  { column: 'Component',      type: String, width: 14 },
  { column: 'Execution #',    type: Number, width: 12 },
  { column: 'Status',         type: String, width: 12 },
  { column: 'Pass Rate %',    ...decimal1,  width: 12 },
  { column: 'Passed',         type: Number, width: 9  },
  { column: 'Failed',         type: Number, width: 9  },
  { column: 'Total',          type: Number, width: 9  },
  { column: 'Start Time',     type: String, width: 20 },
  { column: 'End Time',       type: String, width: 20 },
  { column: 'Duration (min)', ...decimal1,  width: 14 },
  { column: 'Log Path',       type: String, width: 28 },
  { column: 'Executed At',    type: String, width: 20 },
];

const toColumns = fields => fields.map(f => f.column);

/** Apply each field's `csv` formatter, leaving other values untouched. */
const toCsvRow = (row, fields) => Object.fromEntries(
  fields.map(f => [f.column, f.csv ? f.csv(row[f.column]) : row[f.column]]),
);

/** '' / null → undefined, so blank numeric cells stay genuinely empty. */
const numOrBlank = v => (v === '' || v == null ? undefined : Number(v));

// ── Sorting ───────────────────────────────────────────────────────────────────
const DEFAULT_SORT = { col: 'last_run', dir: 'desc' };

/** Triage order: what needs attention first. */
const STATUS_RANK = { running: 0, failed: 1, scheduled: 2, passed: 3 };

const SORTABLE = {
  pass_rate: 'Pass Rate',
  status:    'Status',
  last_run:  'Last Run',
  module:    'Module',
  scheduler: 'Scheduler',
};

/** Numeric or string key for a run under the given column. */
function sortValue(col, run, lastRunOf) {
  switch (col) {
    // total === 0 has no meaningful rate; -1 sinks it below every real value.
    case 'pass_rate': return run.total_tests ? run.passed_tests / run.total_tests : -1;
    case 'status':    return STATUS_RANK[run.status] ?? 99;
    case 'last_run':  return lastRunOf(run) || '';
    case 'module':    return (run.module    || '').toLowerCase();
    case 'scheduler': return (run.scheduler || '').toLowerCase();
    default:          return '';
  }
}

/** Bar + percentage colour, by triage severity. */
function rateColor(rate) {
  if (rate >= 90) return 'var(--success-color)';
  if (rate >= 75) return 'var(--warning-color)';
  return 'var(--error-color)';
}

/** `passed / total` over a thin filled bar, with the percentage alongside. */
function PassRateCell({ passed, total }) {
  if (!total) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  const pct   = (passed / total) * 100;
  const color = rateColor(pct);

  return (
    <div style={{ minWidth: '110px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{passed} / {total}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div
        style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-color-tertiary)', overflow: 'hidden' }}
        role="progressbar" aria-valuenow={Number(pct.toFixed(1))} aria-valuemin={0} aria-valuemax={100}
      >
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
    </div>
  );
}

/** Sortable column header — click cycles ascending → descending → default. */
function SortHeader({ col, label, sort, onSort, style }) {
  const active = sort.col === col;
  const Icon   = !active ? ChevronsUpDown : (sort.dir === 'asc' ? ArrowUp : ArrowDown);
  return (
    <div
      onClick={() => onSort(col)}
      title={`Sort by ${label}`}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none',
               color: active ? 'var(--accent-color)' : undefined, ...style }}
    >
      {label}
      <Icon size={13} style={{ opacity: active ? 1 : 0.45, flexShrink: 0 }} />
    </div>
  );
}

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
      <td colSpan="8" style={{ padding: '12px 48px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading history…</td>
    </tr>
  );

  if (results.length === 0) return (
    <tr>
      <td colSpan="8" style={{ padding: '12px 48px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No execution results yet — push results via the script.</td>
    </tr>
  );

  const visible = limit === 'all' ? results : results.slice(-limit);

  return (
    <>
      <tr style={{ background: 'var(--bg-color-tertiary)' }}>
        <td colSpan="8" style={{ padding: '6px 48px' }}>
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
          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <div>{formatDt(r.start_time)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>logged {formatDt(r.executed_at)}</div>
          </td>
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
  const [sort, setSort]         = useState(DEFAULT_SORT);

  // regression_id → execution results, oldest first. Feeds the CSV export.
  const [runResultsMap, setRunResultsMap] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  const [exportOpen, setExportOpen]     = useState(false);
  const [exportContent, setExportContent] = useState('summary'); // summary | history
  const [exportScope, setExportScope]     = useState('view');    // view | all
  const [exporting, setExporting]         = useState(false);
  const [exportError, setExportError]     = useState('');

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

    // Bulk-load execution history once, rather than N requests at export time.
    api.getAllRunResults({ project_id: project.id, phase, component })
      .then(raw => {
        const arr = Array.isArray(raw) ? raw : (raw.value ?? []);
        const map = {};
        for (const r of arr) (map[r.regression_id] ??= []).push(r);
        for (const list of Object.values(map)) {
          list.sort((a, b) => String(a.end_time || a.executed_at || '').localeCompare(String(b.end_time || b.executed_at || '')));
        }
        setRunResultsMap(map);
      })
      .catch(() => setRunResultsMap({}));

    setLoading(true);
  }, [project, phase, component]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const schedulerOptions = [...new Set(runs.map(r => r.scheduler).filter(Boolean))];

  /** Most recent execution's end_time, falling back to the run's own. */
  const lastRunOf = useCallback((run) => {
    const results = runResultsMap[run.id];
    return results?.length ? (results[results.length - 1].end_time ?? run.end_time) : run.end_time;
  }, [runResultsMap]);

  const filteredRuns = runs.filter(run => {
    if (filters.id        && !(run.name || run.id).toLowerCase().includes(filters.id.toLowerCase())) return false;
    if (filters.module    && !run.module.toLowerCase().includes(filters.module.toLowerCase())) return false;
    if (filters.status    !== 'all' && run.status    !== filters.status)    return false;
    if (filters.scheduler !== 'all' && run.scheduler !== filters.scheduler) return false;
    return true;
  });

  // Filters first, then sort — the order the export also relies on.
  const sortedRuns = useMemo(() => {
    if (!sort.col) return filteredRuns;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filteredRuns].sort((a, b) => {
      const av = sortValue(sort.col, a, lastRunOf);
      const bv = sortValue(sort.col, b, lastRunOf);
      if (av < bv) return -1 * factor;
      if (av > bv) return  1 * factor;
      // Stable tie-break so equal keys never reshuffle between renders.
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
    // filteredRuns is rebuilt each render; these inputs define it.
  }, [runs, filters, sort, lastRunOf]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cycle a column: ascending → descending → back to the default sort. */
  const handleSort = (col) => setSort(prev => {
    if (prev.col !== col)     return { col, dir: 'asc' };
    if (prev.dir === 'asc')   return { col, dir: 'desc' };
    return DEFAULT_SORT;
  });

  // ── Virtual scroll ──────────────────────────────────────────────────────────
  // One virtual item per regression. Each renders as its own <tbody> holding the
  // main row plus, when open, its execution history — so a variable-height group
  // is still a single measurable element.
  const scrollRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedRuns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,          // collapsed row; open rows are measured
    overscan: 8,
    getItemKey: (index) => sortedRuns[index]?.id ?? index,
  });

  // Re-measure when a row opens or closes, so rows below shift by the real height.
  useEffect(() => { rowVirtualizer.measure(); }, [expanded, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const padTop      = virtualRows.length ? virtualRows[0].start : 0;
  const padBottom   = virtualRows.length
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

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

  // ── Export ──────────────────────────────────────────────────────────────────
  const summaryRow = (run) => ({
    'Regression ID': run.id,
    'Name':          run.name || run.id,
    'Module':        run.module,
    'Scheduler':     run.scheduler,
    'Phase':         run.phase,
    'Component':     run.component,
    'Status':        run.status,
    'Pass Rate %':   numOrBlank(passRate(run.passed_tests, run.total_tests)),
    'Passed':        run.passed_tests,
    'Failed':        run.failed_tests,
    'Total':         run.total_tests,
    'Last Run':      lastRunOf(run),
    'Log Path':      run.log_path,
  });

  const historyRow = (run, r, i) => ({
    'Regression ID':  run.id,
    'Module':         run.module,
    'Scheduler':      run.scheduler,
    'Phase':          run.phase,
    'Component':      run.component,
    'Execution #':    i + 1,
    'Status':         r.status,
    'Pass Rate %':    numOrBlank(passRate(r.passed_tests, r.total_tests)),
    'Passed':         r.passed_tests,
    'Failed':         r.failed_tests,
    'Total':          r.total_tests,
    'Start Time':     r.start_time,
    'End Time':       r.end_time,
    'Duration (min)': numOrBlank(durationMin(r.start_time, r.end_time)),
    'Log Path':       r.log_path,
    'Executed At':    r.executed_at,
  });

  const exportFilename = (kind, ext) => {
    // Local date, not toISOString() — UTC would stamp yesterday for east-of-UTC users.
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `rms_${slug(project.id)}_${slug(phase)}_${slug(component)}_${kind}_${today}.${ext}`;
  };

  const handleExport = async () => {
    // "Current view" means exactly what is on screen: filtered *and* sorted.
    const source = exportScope === 'view' ? sortedRuns : runs;

    // Summary only → a single flat table, so CSV.
    if (exportContent !== 'history') {
      const rows = source.map(run => toCsvRow(summaryRow(run), SUMMARY_FIELDS));
      downloadCSV(toCSV(rows, toColumns(SUMMARY_FIELDS)), exportFilename('summary', 'csv'));
      setExportOpen(false);
      return;
    }

    // Summary + history → a workbook: summary tab, then one tab per regression.
    // A regression with no executions still gets its tab, headers only.
    setExporting(true);
    setExportError('');
    try {
      const used = new Set();
      const sheets = [
        { name: sheetName('Summary', used), rows: source.map(summaryRow), fields: SUMMARY_FIELDS },
        ...source.map(run => ({
          name:   sheetName(run.name || run.id, used),
          rows:   (runResultsMap[run.id] ?? []).map((r, i) => historyRow(run, r, i)),
          fields: HISTORY_FIELDS,
        })),
      ];
      await downloadWorkbook(sheets, exportFilename('history', 'xlsx'));
      setExportOpen(false);
    } catch (e) {
      setExportError(e.message || 'Failed to build the workbook.');
    } finally {
      setExporting(false);
    }
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
            <button className="btn btn-secondary" style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} onClick={() => setExportOpen(true)}>
              <Download size={14} /> Export
            </button>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} onClick={openCreate}>
              <Plus size={15} /> Create Regression
            </button>
          </div>
        </div>

        {/* Fixed-height own scroller: the virtualiser needs a stable viewport,
            and a self-contained one avoids fighting the page's scroll. */}
        <div ref={scrollRef} className="table-container" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }} />
                <th style={{ minWidth: '160px', verticalAlign: 'top' }}>
                  <div style={{ marginBottom: '8px' }}>Regression ID</div>
                  <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} placeholder="Filter…" value={filters.id} onChange={e => setFilters(f => ({ ...f, id: e.target.value }))} />
                </th>
                <th style={{ minWidth: '180px', verticalAlign: 'top' }}>
                  <SortHeader col="module" label={SORTABLE.module} sort={sort} onSort={handleSort} style={{ marginBottom: '8px' }} />
                  <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} placeholder="Filter…" value={filters.module} onChange={e => setFilters(f => ({ ...f, module: e.target.value }))} />
                </th>
                <th style={{ minWidth: '130px', verticalAlign: 'top' }}>
                  <SortHeader col="status" label={SORTABLE.status} sort={sort} onSort={handleSort} style={{ marginBottom: '8px' }} />
                  <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="all">All</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="running">Running</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </th>
                <th style={{ minWidth: '110px', verticalAlign: 'top' }}>
                  <SortHeader col="scheduler" label={SORTABLE.scheduler} sort={sort} onSort={handleSort} style={{ marginBottom: '8px' }} />
                  <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} value={filters.scheduler} onChange={e => setFilters(f => ({ ...f, scheduler: e.target.value }))}>
                    <option value="all">All</option>
                    {schedulerOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </th>
                <th style={{ minWidth: '150px', verticalAlign: 'top' }}>
                  <SortHeader col="pass_rate" label={SORTABLE.pass_rate} sort={sort} onSort={handleSort} style={{ marginBottom: '8px' }} />
                </th>
                <th style={{ minWidth: '150px', verticalAlign: 'top' }}>
                  <SortHeader col="last_run" label={SORTABLE.last_run} sort={sort} onSort={handleSort} style={{ marginBottom: '8px' }} />
                </th>
                <th style={{ textAlign: 'right', verticalAlign: 'top' }}><div style={{ marginBottom: '8px' }}>Actions</div></th>
              </tr>
            </thead>
            {/* Offset is carried by spacer rows rather than absolute positioning,
                which would detach cells from the table's column widths. */}
            <tbody aria-hidden="true"><tr style={{ height: padTop }} /></tbody>

            {virtualRows.map(vr => {
              const run    = sortedRuns[vr.index];
              const isOpen = expanded.has(run.id);
              return (
                <tbody
                  key={run.id}
                  data-index={vr.index}
                  ref={rowVirtualizer.measureElement}
                >
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
                    <td><PassRateCell passed={run.passed_tests} total={run.total_tests} /></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDt(lastRunOf(run))}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger" style={{ padding: '5px' }} title="Delete regression" onClick={() => handleDelete(run.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <>
                      <tr style={{ background: 'var(--bg-color-tertiary)' }}>
                        <td colSpan="8" style={{ padding: '6px 48px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Execution History — {run.name || run.id}
                        </td>
                      </tr>
                      <RunResultsRows regressionId={run.id} formatDt={formatDt} />
                    </>
                  )}
                </tbody>
              );
            })}

            <tbody aria-hidden="true"><tr style={{ height: padBottom }} /></tbody>

            {!loading && sortedRuns.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
                    {runs.length === 0 ? 'No regressions yet — create one to get started.' : 'No regressions match your filters.'}
                  </td>
                </tr>
              </tbody>
            )}
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

      {exportOpen && (
        <Modal title="Export" onClose={() => setExportOpen(false)}>
          <RadioGroup
            label="What do you want to export?"
            value={exportContent}
            onChange={setExportContent}
            options={[
              { value: 'summary', title: 'Summary only  ·  CSV',                hint: 'One row per regression with its latest result.' },
              { value: 'history', title: 'Summary + Execution History  ·  Excel', hint: 'A workbook with a summary tab, then one tab per regression holding its executions.' },
            ]}
          />
          <RadioGroup
            label="Which regressions to include?"
            value={exportScope}
            onChange={setExportScope}
            options={[
              { value: 'view', title: 'Current view',    hint: `Applies the active filters — ${filteredRuns.length} of ${runs.length} regressions.` },
              { value: 'all',  title: 'All regressions', hint: `Ignores all filters — all ${runs.length} regressions for this phase / component.` },
            ]}
          />
          <ModalFooter
            error={exportError}
            saving={exporting}
            busyLabel="Building…"
            onCancel={() => setExportOpen(false)}
            onSave={handleExport}
            saveLabel={exportContent === 'history' ? 'Download Excel' : 'Download CSV'}
          />
        </Modal>
      )}
    </div>
  );
}

export default TestRuns;
