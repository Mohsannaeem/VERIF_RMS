import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Trash2, Copy, Check, ShieldAlert } from 'lucide-react';
import { Modal, ModalFooter } from './ui/Modal.jsx';
import { api } from '../api';

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

/** Expiry is a plain date; compare as strings against today in UTC. */
const todayUtc = () => new Date().toISOString().slice(0, 10);
const isExpired = (k) => Boolean(k.expires_at) && k.expires_at <= todayUtc();

const cell = { padding: '10px 12px', fontSize: '0.83rem', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' };
const head = { ...cell, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' };

const BLANK = { name: '', owner_name: '', owner_email: '', team: '', purpose: '', expires_at: '', project_id: '' };

function Input({ label, required, ...props }) {
  return (
    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--error-color)' }}> *</span>}
      </label>
      <input className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} {...props} />
    </div>
  );
}

function ApiKeysCard() {
  const [keys, setKeys]         = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [form, setForm]       = useState(BLANK);
  const [creating, setCreating] = useState(false);

  const [revealed, setRevealed] = useState(null);   // { name, key } | null
  const [copied, setCopied]     = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    setCreating(true); setError('');
    try {
      const { key, ...created } = await api.createApiKey({
        ...form,
        team:       form.team       || null,
        purpose:    form.purpose    || null,
        expires_at: form.expires_at || null,
        project_id: form.project_id || null,
      });
      // Insert the row we already have rather than refetching. One render, so the
      // table does not flash through a stale state while the modal opens.
      setKeys(prev => [created, ...prev]);
      setRevealed({ name: created.name, key });
      setCopied(false);
      setForm(BLANK);
    } catch (e) {
      setError(cleanError(e.message));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (k) => {
    if (!window.confirm(`Revoke API key "${k.name}"? Any pipeline using it will stop working immediately.`)) return;
    try {
      await api.deleteApiKey(k.id);
      setKeys(prev => prev.filter(x => x.id !== k.id));
    } catch (e) {
      setError(cleanError(e.message));
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
        Keys authenticate CI pipelines publishing results and coverage. This interface does not
        require one. Each key is owned by a person, can be given an expiry, and can be revoked
        independently without restarting the server. A key is shown in full only once, at creation.
      </p>

      {/* Create */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <Input label="Key name" required placeholder="e.g. Nightly CI Pipeline"
               value={form.name} onChange={e => set('name', e.target.value)} />
        <Input label="Owner" required placeholder="e.g. Mohsan Naeem"
               value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
        <Input label="Email" required type="email" placeholder="owner@company.com"
               value={form.owner_email} onChange={e => set('owner_email', e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        <Input label="Team" placeholder="e.g. Verification"
               value={form.team} onChange={e => set('team', e.target.value)} />
        <Input label="Expires" type="date" min={todayUtc()}
               value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <label className="form-label">Project</label>
          <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={form.project_id} onChange={e => set('project_id', e.target.value)}>
            <option value="">All projects (global)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
        <Input label="Purpose" placeholder="What this key is used for"
               value={form.purpose} onChange={e => set('purpose', e.target.value)} />
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}
                style={{ height: '38px', whiteSpace: 'nowrap' }}>
          {creating ? 'Generating…' : 'Generate Key'}
        </button>
      </div>

      {/* Reserve the row so showing an error does not shift the table down. */}
      <div style={{ minHeight: '20px', marginBottom: '8px' }}>
        {error && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--error-color)' }}>{error}</p>}
      </div>

      {/* List */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={head}>Name</th>
              <th style={head}>Owner</th>
              <th style={head}>Team</th>
              <th style={head}>Project</th>
              <th style={head}>Expires</th>
              <th style={head}>Last Used</th>
              <th style={{ ...head, textAlign: 'right' }}>Revoke</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => {
              const expired = isExpired(k);
              return (
                <tr key={k.id} style={expired ? { opacity: 0.55 } : undefined}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{k.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{k.prefix}…</div>
                    {k.purpose && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{k.purpose}</div>}
                  </td>
                  <td style={cell}>
                    <div>{k.owner_name || '—'}</div>
                    {k.owner_email && (
                      <a href={`mailto:${k.owner_email}`} style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>{k.owner_email}</a>
                    )}
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)' }}>{k.team || '—'}</td>
                  <td style={{ ...cell, color: 'var(--text-secondary)' }}>{k.project_id ? projectName(k.project_id) : 'Global'}</td>
                  <td style={{ ...cell, color: expired ? 'var(--error-color)' : 'var(--text-secondary)' }}>
                    {k.expires_at ? (expired ? `Expired ${k.expires_at}` : k.expires_at) : 'Never'}
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)' }}>{relativeTime(k.last_used_at)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <button className="btn btn-danger" style={{ padding: '5px' }} title={`Revoke ${k.name}`} onClick={() => handleRevoke(k)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && keys.length === 0 && (
              <tr>
                <td colSpan="7" style={{ ...cell, textAlign: 'center', color: 'var(--text-secondary)', padding: '28px 0' }}>
                  No API keys yet — result publishing is currently unauthenticated.
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

/** FastAPI returns {"detail": "..."} as a JSON string; surface just the message. */
function cleanError(msg) {
  try {
    const d = JSON.parse(msg).detail;
    return typeof d === 'string' ? d : (d?.[0]?.msg ?? msg);
  } catch {
    return msg || 'Something went wrong.';
  }
}

export default ApiKeysCard;
