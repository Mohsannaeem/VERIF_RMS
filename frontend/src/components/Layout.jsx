import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlaySquare, CalendarClock, Settings as SettingsIcon, Bell, FolderOpen, PieChart, Loader, Plus, ChevronDown, Sun, Moon, LogOut, User as UserIcon, Shield } from 'lucide-react';
import clsx from 'clsx';

import BASE, { api } from '../api';
import { Modal, Field, ModalFooter } from './ui/Modal.jsx';
import { useAuth } from '../context/AuthContext';

// ── Page title lookup (replaces switch statement) ──────────────────────────
const PAGE_TITLES = {
  '/dashboard': 'Consolidated Results Dashboard',
  '/runs':      'Regression Test Runs',
  '/coverage':  'VCS Code & Functional Coverage',
  '/scheduler': 'Regression Scheduler',
  '/settings':  'Integrations & Notifications',
};

function Layout() {
  const location = useLocation();

  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [project, setProject]     = useState(null);
  const [phase, setPhase]         = useState('');
  const [component, setComponent] = useState('');

  // Dropdown + modal state
  const [theme, setTheme]         = useState(() => localStorage.getItem('rms-theme') || 'dark');
  const [dropOpen, setDropOpen]   = useState(false);
  const [modal, setModal]         = useState(null);   // 'project' | 'phase' | 'component'
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const dropRef                   = useRef(null);

  const { user, isAuthenticated, logout } = useAuth();
  const [userMenu, setUserMenu]   = useState(false);
  const userRef                   = useRef(null);

  // ── Theme toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rms-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load projects ─────────────────────────────────────────────────────────
  const loadProjects = (selectId = null, selectPhase = null, selectComponent = null) => {
    return api.getProjects()
      .then(data => {
        const parsed = data.map(p => ({
          ...p,
          phases:     typeof p.phases     === 'string' ? JSON.parse(p.phases)     : p.phases,
          components: typeof p.components === 'string' ? JSON.parse(p.components) : p.components,
        }));
        setProjects(parsed);
        const target = selectId ? parsed.find(p => p.id === selectId) : (parsed.length > 0 ? parsed[0] : null);
        if (target) {
          setProject(target);
          setPhase(selectPhase    && target.phases.includes(selectPhase)         ? selectPhase     : target.phases[0]);
          setComponent(selectComponent && target.components.includes(selectComponent) ? selectComponent : target.components[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, []);

  const handleProjectChange = (e) => {
    const p = projects.find(x => x.id === e.target.value);
    setProject(p);
    setPhase(p.phases[0]);
    setComponent(p.components[0]);
  };

  // ── Open a modal ──────────────────────────────────────────────────────────
  const openModal = (type) => {
    setDropOpen(false);
    setFormError('');
    if (type === 'project') {
      setForm({ id: '', name: '', phases: '', components: '' });
    } else if (type === 'phase') {
      setForm({ phase: '' });
    } else if (type === 'component') {
      setForm({ component: '' });
    }
    setModal(type);
  };

  const closeModal = () => { setModal(null); setSaving(false); setFormError(''); };
  const setField   = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // ── Submit handlers ───────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (modal === 'project') {
        if (!form.id.trim() || !form.name.trim() || !form.phases.trim() || !form.components.trim()) {
          setFormError('All fields are required.');
          setSaving(false);
          return;
        }
        await api.saveProject({ id: form.id.trim(), name: form.name.trim(), phases: form.phases, components: form.components });
        await loadProjects(form.id.trim());

      } else if (modal === 'phase') {
        if (!form.phase.trim()) { setFormError('Phase name is required.'); setSaving(false); return; }
        const newPhase = form.phase.trim();
        if (project.phases.includes(newPhase)) { setFormError('This phase already exists.'); setSaving(false); return; }
        const updatedPhases = [...project.phases, newPhase];
        await api.saveProject({ id: project.id, name: project.name, phases: JSON.stringify(updatedPhases), components: JSON.stringify(project.components) });
        await loadProjects(project.id, newPhase, component);

      } else if (modal === 'component') {
        if (!form.component.trim()) { setFormError('Component name is required.'); setSaving(false); return; }
        const newComp = form.component.trim();
        if (project.components.includes(newComp)) { setFormError('This component already exists.'); setSaving(false); return; }
        const updatedComponents = [...project.components, newComp];
        await api.saveProject({ id: project.id, name: project.name, phases: JSON.stringify(project.phases), components: JSON.stringify(updatedComponents) });
        await loadProjects(project.id, phase, newComp);
      }
      closeModal();
    } catch (e) {
      setFormError(e.message || 'Save failed.');
      setSaving(false);
    }
  };

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <PlaySquare style={{ color: 'var(--accent-color)' }} size={28} />
          <h1>RMS Platform</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/runs" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
            <PlaySquare size={20} /> Test Runs
          </NavLink>
          <NavLink to="/coverage" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
            <PieChart size={20} /> VCS Coverage
          </NavLink>
          <NavLink to="/scheduler" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
            <CalendarClock size={20} /> Scheduler
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
            <SettingsIcon size={20} /> Integrations
          </NavLink>
        </nav>
      </aside>

      {/* Main area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              {PAGE_TITLES[location.pathname] ?? 'RMS Platform'}
            </h2>

            {/* Project / Phase / Component selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '32px', paddingLeft: '32px', borderLeft: '1px solid var(--border-color)', height: '32px' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Loader size={14} className="spin" /> Loading projects…
                </span>
              ) : projects.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No projects — use <strong style={{ color: 'var(--accent-color)', cursor: 'pointer' }} onClick={() => openModal('project')}>+ New</strong> to create one
                </span>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderOpen size={16} color="var(--text-secondary)" />
                    <select
                      className="form-control"
                      style={{ padding: '4px 12px', width: '160px', backgroundColor: 'var(--bg-color-tertiary)', border: 'none', color: 'var(--text-primary)', fontWeight: 500, height: 'auto', outline: 'none' }}
                      value={project.id}
                      onChange={handleProjectChange}
                    >
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div style={{ paddingLeft: '8px' }}>
                    <select
                      className="form-control"
                      style={{ padding: '4px 12px', width: '160px', backgroundColor: 'var(--bg-color-tertiary)', border: 'none', color: 'var(--text-primary)', fontWeight: 500, height: 'auto', outline: 'none' }}
                      value={phase}
                      onChange={e => setPhase(e.target.value)}
                    >
                      {project.phases.map(ph => <option key={ph} value={ph}>{ph}</option>)}
                    </select>
                  </div>

                  <div style={{ paddingLeft: '8px' }}>
                    <select
                      className="form-control"
                      style={{ padding: '4px 12px', width: '180px', backgroundColor: 'rgba(88, 166, 255, 0.1)', border: '1px solid var(--accent-glow)', color: 'var(--accent-color)', fontWeight: 600, height: 'auto', outline: 'none' }}
                      value={component}
                      onChange={e => setComponent(e.target.value)}
                    >
                      {project.components.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top-right actions */}
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* + New dropdown */}
            <div ref={dropRef} style={{ position: 'relative' }}>
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.85rem', fontWeight: 600 }}
                onClick={() => setDropOpen(o => !o)}
              >
                <Plus size={15} /> New <ChevronDown size={13} style={{ opacity: 0.7, marginLeft: '2px', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {dropOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', zIndex: 200, overflow: 'hidden' }}>
                  <DropItem icon="📁" label="New Project" sub="Create a brand-new project" onClick={() => openModal('project')} />
                  {project && <>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    <DropItem icon="🏷️" label="Add Phase" sub={`To ${project.name}`} onClick={() => openModal('phase')} />
                    <DropItem icon="🧩" label="Add Component" sub={`To ${project.name}`} onClick={() => openModal('component')} />
                  </>}
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button className="btn-icon" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Bell — disabled until notification feature is implemented */}
            <button className="btn-icon" disabled title="Notifications coming soon">
              <Bell size={17} />
            </button>

            {/* User menu */}
            {isAuthenticated && user && (
              <div ref={userRef} style={{ position: 'relative' }}>
                <button
                  className="btn-icon"
                  onClick={() => setUserMenu(o => !o)}
                  title={user.email}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0 8px' }}
                >
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-color)', color: '#fff',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    {(user.username || user.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown size={13} style={{ opacity: 0.7 }} />
                </button>
                {userMenu && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: '220px', zIndex: 50,
                                background: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)',
                                borderRadius: '10px', boxShadow: 'var(--shadow-lg, 0 16px 32px rgba(0,0,0,0.4))', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        {user.role === 'admin' ? <Shield size={13} style={{ color: 'var(--accent-color)' }} /> : <UserIcon size={13} />}
                        {user.username || user.email}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{user.email}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                        {user.company_id} · {user.role}
                      </div>
                    </div>
                    <button
                      onClick={() => { setUserMenu(false); logout(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px',
                               background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-color-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="main-content">
          <div className="page-transition">
            <Outlet context={{ project, phase, component }} />
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      {modal === 'project' && (
        <Modal title="Create New Project" onClose={closeModal}>
          <Field label="Project ID"   placeholder="e.g. P2"       value={form.id}         onChange={e => setField('id',         e.target.value)} />
          <Field label="Project Name" placeholder="e.g. AXIS DMA" value={form.name}       onChange={e => setField('name',       e.target.value)} />
          <Field label="Phases"       hint="Comma-separated — e.g. Q0, Q1, Q2" placeholder="Q0, Q1, Q2" value={form.phases}     onChange={e => setField('phases',     e.target.value)} />
          <Field label="Components"   hint="Comma-separated — e.g. DMA, FIFO"  placeholder="DMA"        value={form.components} onChange={e => setField('components', e.target.value)} />
          <ModalFooter error={formError} saving={saving} onCancel={closeModal} onSave={handleSave} saveLabel="Create Project" />
        </Modal>
      )}

      {modal === 'phase' && project && (
        <Modal title={`Add Phase to ${project.name}`} onClose={closeModal}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Existing: {project.phases.map(ph => <span key={ph} className="badge badge-blue" style={{ marginRight: '4px' }}>{ph}</span>)}
          </p>
          <Field label="New Phase Name" placeholder="e.g. Q4" value={form.phase} onChange={e => setField('phase', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          <ModalFooter error={formError} saving={saving} onCancel={closeModal} onSave={handleSave} saveLabel="Add Phase" />
        </Modal>
      )}

      {modal === 'component' && project && (
        <Modal title={`Add Component to ${project.name}`} onClose={closeModal}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Existing: {project.components.map(c => <span key={c} className="badge badge-blue" style={{ marginRight: '4px' }}>{c}</span>)}
          </p>
          <Field label="New Component Name" placeholder="e.g. DMA" value={form.component} onChange={e => setField('component', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          <ModalFooter error={formError} saving={saving} onCancel={closeModal} onSave={handleSave} saveLabel="Add Component" />
        </Modal>
      )}
    </div>
  );
}

// ── Small reusable pieces ──────────────────────────────────────────────────
function DropItem({ icon, label, sub, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', padding: '10px 14px', background: hover ? 'var(--bg-color-tertiary)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1, marginTop: '1px' }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{sub}</span>
      </span>
    </button>
  );
}

export default Layout;
