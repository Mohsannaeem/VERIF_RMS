import { useState, useEffect, useCallback } from 'react';
import { Users, Building2, Plus, Shield, UserCheck, UserX, Copy, Check } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const cell = { padding: '10px 12px', fontSize: '0.83rem', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' };
const head = { ...cell, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' };

const cleanError = (msg) => {
  try { const d = JSON.parse(msg).detail; return typeof d === 'string' ? d : (d?.[0]?.msg ?? msg); }
  catch { return msg || 'Something went wrong.'; }
};

/** Admin-only: manage the team's companies and user accounts. */
function AdminPanel() {
  const { user, isAdmin } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [users, setUsers]         = useState([]);
  const [error, setError]         = useState('');

  const [form, setForm] = useState({ company_id: '', email: '', username: '', password: '', role: 'user' });
  const [busy, setBusy] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    Promise.all([api.getCompanies(), api.getUsers()])
      .then(([c, u]) => {
        setCompanies(Array.isArray(c) ? c : []);
        setUsers(Array.isArray(u) ? u : []);
        setForm(f => ({ ...f, company_id: f.company_id || user?.company_id || '' }));
      })
      .catch(e => setError(cleanError(e.message)));
  }, [user]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!isAdmin) return null;

  const createUser = async () => {
    setBusy(true); setError('');
    try {
      const created = await api.createUser(form);
      setUsers(prev => [created, ...prev]);
      setForm(f => ({ ...f, email: '', username: '', password: '', role: 'user' }));
    } catch (e) { setError(cleanError(e.message)); }
    finally { setBusy(false); }
  };

  const createCompany = async () => {
    if (!newCompanyName.trim()) return;
    setError('');
    try {
      const c = await api.createCompany({ name: newCompanyName.trim() });
      setCompanies(prev => [c, ...prev]);
      setNewCompanyName('');
    } catch (e) { setError(cleanError(e.message)); }
  };

  const toggleActive = async (u) => {
    try {
      const updated = await api.updateUser(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch (e) { setError(cleanError(e.message)); }
  };

  const toggleRole = async (u) => {
    try {
      const updated = await api.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch (e) { setError(cleanError(e.message)); }
  };

  const copyId = async (id) => {
    try { await navigator.clipboard.writeText(id); setCopiedId(id); setTimeout(() => setCopiedId(''), 1500); } catch { /* noop */ }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '24px auto 0' }}>
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} /> Team Administration
        </h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Create companies and user accounts. Users sign in with their Company ID, email and password.
      </p>

      {error && <p style={{ fontSize: '0.8rem', color: 'var(--error-color)', marginBottom: '12px' }}>{error}</p>}

      {/* Companies */}
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 12px' }}>
        <Building2 size={15} /> Companies
      </h4>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input className="form-control" placeholder="New company name" value={newCompanyName}
               onChange={e => setNewCompanyName(e.target.value)}
               style={{ flex: '1 1 220px', minWidth: 0 }} />
        <button className="btn btn-secondary" onClick={createCompany} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Add company
        </button>
      </div>
      <div style={{ overflowX: 'auto', marginBottom: '28px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={head}>Company ID</th><th style={head}>Name</th><th style={head}>Status</th></tr></thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.company_id}>
                <td style={{ ...cell, fontFamily: 'monospace' }}>
                  {c.company_id}
                  <button onClick={() => copyId(c.company_id)} title="Copy" style={{ marginLeft: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                    {copiedId === c.company_id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </td>
                <td style={cell}>{c.name}</td>
                <td style={{ ...cell, color: c.is_active ? 'var(--success-color)' : 'var(--text-muted)' }}>{c.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {companies.length === 0 && <tr><td colSpan="3" style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)' }}>No companies.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create user */}
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 12px' }}>
        <Users size={15} /> Users
      </h4>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <select className="form-control" value={form.company_id} onChange={e => set('company_id', e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
        </select>
        <input className="form-control" placeholder="Name" value={form.username} onChange={e => set('username', e.target.value)} style={{ flex: '1 1 120px', minWidth: 0 }} />
        <input className="form-control" type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} style={{ flex: '1 1 160px', minWidth: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <input className="form-control" type="password" placeholder="Password (min 8)" value={form.password} onChange={e => set('password', e.target.value)} style={{ flex: '1 1 160px', minWidth: 0 }} />
        <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)} style={{ flex: '0 1 120px' }}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn btn-primary" onClick={createUser} disabled={busy} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> {busy ? 'Adding…' : 'Add user'}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={head}>User</th><th style={head}>Company</th><th style={head}>Role</th>
              <th style={head}>Status</th><th style={{ ...head, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={u.is_active ? undefined : { opacity: 0.55 }}>
                <td style={cell}>
                  <div style={{ fontWeight: 600 }}>{u.username}{u.id === user?.id && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (you)</span>}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                </td>
                <td style={{ ...cell, fontFamily: 'monospace', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{u.company_id}</td>
                <td style={cell}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: u.role === 'admin' ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                    {u.role === 'admin' && <Shield size={12} />}{u.role}
                  </span>
                </td>
                <td style={{ ...cell, color: u.is_active ? 'var(--success-color)' : 'var(--text-muted)' }}>{u.is_active ? 'Active' : 'Disabled'}</td>
                <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u.id !== user?.id && (
                    <>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', marginRight: '6px' }} title="Toggle role" onClick={() => toggleRole(u)}>
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '5px' }} title={u.is_active ? 'Disable' : 'Enable'} onClick={() => toggleActive(u)}>
                        {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminPanel;
