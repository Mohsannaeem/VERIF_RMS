import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Trash2, Copy, Check, ShieldAlert } from 'lucide-react';
import { Modal, ModalFooter } from './ui/Modal.jsx';
import { api } from '../api';
import { setApiKey, clearApiKey, getApiKeyPrefix } from '../auth';

/**
 * The backend stores UTC as "YYYY-MM-DDTHH:MM:SS" with no zone suffix, which JS
 * would read as local time. Append Z so it is parsed as the UTC it actually is.
 */
const parseUtc = (s) => (s ? new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`) : null);

const UNITS = [
  ['year', 31536000], ['month', 2592000], ['day', 86400],
  ['hour', 3600],     ['minute', 60],     ['second', 1],
];

/** "2 hours ago" / "Never" — no dependency needed for something this small. */
function relativeTime(iso) {
  const d = parseUtc(iso);
  if (!d || isNaN(d)) return 'Never';
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return 'Just now';
  for (const [unit, size] of UNITS) {
    if (secs >= size) {
      const n = Math.floor(secs / size);
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'Just now';
}

const formatDate = (iso) => {
  const d = parseUtc(iso);
  return !d || isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const cell = { padding: '10px 12px', fontSize: '0.83rem', borderBottom: '1px solid var(--border-color)' };
const head = { ...cell, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' };

function ApiKeysCard() {
  const [keys, setKeys]         = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [name, setName]           = useState('');
  const [projectId, setProjectId] = useState('');
  const [creating, setCreating]   = useState(false);

  const [revealed, setRevealed] = useState(null);   // { name, key } | null
  const [copied, setCopied]     = useState(false);
  const [thisBrowser, setThisBrowser] = useState(getApiKeyPrefix());

  const load = useCallback(() => {
    api.getApiKeys()
      .then(d => { setKeys(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { setError(e.message || 'Failed to load API keys.'); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    api.getProjects().then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => setProjects([]));
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Key name is required.'); return; }
    setCreating(true); setError('');
    try {
      const created = await api.createApiKey({ name: name.trim(), project_id: projectId || null });
      // Retain the raw key so this browser can keep writing once auth is on.
      setApiKey(created.key);
      setThisBrowser(created.prefix);
      setRevealed({ name: created.name, key: created.key });
      setCopied(false);
      setName(''); setProjectId('');
      load();
    } catch (e) {
      setError(e.message || 'Failed to create the key.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (k) => {
    if (!window.confirm(`Revoke API key "${k.name}"? Any pipeline using it will stop working immediately.`)) return;
    try {
      await api.deleteApiKey(k.id);
      if (k.prefix === thisBrowser) { clearApiKey(); setThisBrowser(''); }
      setKeys(prev => prev.filter(x => x.id !== k.id));
    } catch (e) {
      setError(e.message || 'Failed to revoke the key.');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(revealed.key);
      setCopied(true);
    } catch {
      // Clipboard API needs a secure context; select the text as a fallback.
      document.getElementById('rms-revealed-key')?.select();
    }
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '24px auto 0' }}>
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={18} /> API Keys
        </h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Named keys for CI pipelines publishing results. Each can be revoked independently without
        restarting the server. A key is shown in full only once, when it is created.
      </p>

      {/* Create */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 220px' }}>
          <label className="form-label">Name</label>
          <input
            type="text" className="form-control" placeholder="e.g. Nightly CI Pipeline"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label className="form-label">Project</label>
          <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">All projects (global)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating} style={{ height: '38px', whiteSpace: 'nowrap' }}>
          {creating ? 'Generating…' : 'Generate Key'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: '0.8rem', color: 'var(--error-color)', marginBottom: '12px' }}>{error}</p>
      )}

      {thisBrowser && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          This browser authenticates with{' '}
          <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{thisBrowser}…</span>
          {' · '}
          <button
            onClick={() => { clearApiKey(); setThisBrowser(''); }}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-color)', cursor: 'pointer', font: 'inherit' }}
          >
            forget it
          </button>
        </p>
      )}

      {/* List */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={head}>Name</th>
              <th style={head}>Prefix</th>
              <th style={head}>Project</th>
              <th style={head}>Created</th>
              <th style={head}>Last Used</th>
              <th style={{ ...head, textAlign: 'right' }}>Revoke</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id}>
                <td style={{ ...cell, fontWeight: 600 }}>{k.name}</td>
                <td style={{ ...cell, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{k.prefix}…</td>
                <td style={{ ...cell, color: 'var(--text-secondary)' }}>{k.project_id ? projectName(k.project_id) : 'Global'}</td>
                <td style={{ ...cell, color: 'var(--text-secondary)' }}>{formatDate(k.created_at)}</td>
                <td style={{ ...cell, color: 'var(--text-secondary)' }}>{relativeTime(k.last_used_at)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  <button className="btn btn-danger" style={{ padding: '5px' }} title={`Revoke ${k.name}`} onClick={() => handleRevoke(k)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && keys.length === 0 && (
              <tr>
                <td colSpan="6" style={{ ...cell, textAlign: 'center', color: 'var(--text-secondary)', padding: '28px 0' }}>
                  No API keys yet — writes are currently unauthenticated.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* One-time reveal */}
      {revealed && (
        <Modal title="Copy your API key" onClose={() => setRevealed(null)}>
          <div style={{ display: 'flex', gap: '10px', padding: '10px 14px', marginBottom: '16px', background: 'rgba(248,81,73,0.08)', border: '1px solid var(--error-color)', borderRadius: '8px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--error-color)', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>This key will not be shown again.</strong>{' '}
              Copy it now and store it securely.
            </p>
          </div>

          <label className="form-label">{revealed.name}</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input
              id="rms-revealed-key" className="form-control" readOnly value={revealed.key}
              onFocus={e => e.target.select()}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: 1, minWidth: 0 }}
            />
            <button className="btn btn-secondary" onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>

          <ModalFooter
            onCancel={() => setRevealed(null)}
            onSave={() => setRevealed(null)}
            saveLabel="I've copied it"
          />
        </Modal>
      )}
    </div>
  );
}

export default ApiKeysCard;
