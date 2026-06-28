import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlaySquare, CalendarClock, Settings as SettingsIcon, Bell, FolderOpen, PieChart, Loader, Plus, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

import API from '../api';

// ── Modal shell ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '420px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex', borderRadius: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Labelled input row ─────────────────────────────────────────────────────────
function Field({ label, hint, ...props }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <input className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} {...props} />
      {hint && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function Layout() {
  const location = useLocation();

  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [project, setProject]     = useState(null);
  const [phase, setPhase]         = useState('');
  const [component, setComponent] = useState('');

  // Dropdown + modal state
  const [dropOpen, setDropOpen]   = useState(false);
  const [modal, setModal]         = useState(null);   // 'project' | 'phase' | 'component'
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const dropRef                   = useRef(null);

  // ── Close dropdown on outside click ──────────────────────────────────────────
  useEffect(() => {
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load projects ─────────────────────────────────────────────────────────────
  const loadProjects = (selectId = null, selectPhase = null, selectComponent = null) => {
    return fetch(`${API}/api/projects`)
      .then(r => r.json())
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
          setPhase(selectPhase    && target.phases.includes(selectPhase)     ? selectPhase     : target.phases[0]);
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

  // ── Open a modal ──────────────────────────────────────────────────────────────
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

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // ── Submit handlers ───────────────────────────────────────────────────────────
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
        const res = await fetch(`${API}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: form.id.trim(), name: form.name.trim(), phases: form.phases, components: form.components }),
        });
        if (!res.ok) throw new Error(await res.text());
        await loadProjects(form.id.trim());

      } else if (modal === 'phase') {
        if (!form.phase.trim()) { setFormError('Phase name is required.'); setSaving(false); return; }
        const newPhase = form.phase.trim();
        if (project.phases.includes(newPhase)) { setFormError('This phase already exists.'); setSaving(false); return; }
        const updatedPhases = [...project.phases, newPhase];
        const res = await fetch(`${API}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: project.id, name: project.name, phases: JSON.stringify(updatedPhases), components: JSON.stringify(project.components) }),
        });
        if (!res.ok) throw new Error(await res.text());
        await loadProjects(project.id, newPhase, component);

      } else if (modal === 'component') {
        if (!form.component.trim()) { setFormError('Component name is required.'); setSaving(false); return; }
        const newComp = form.component.trim();
        if (project.components.includes(newComp)) { setFormError('This component already exists.'); setSaving(false); return; }
        const updatedComponents = [...project.components, newComp];
        const res = await fetch(`${API}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: project.id, name: project.name, phases: JSON.stringify(project.phases), components: JSON.stringify(updatedComponents) }),
        });
        if (!res.ok) throw new Error(await res.text());
        await loadProjects(project.id, phase, newComp);
      }
      closeModal();
    } catch (e) {
      setFormError(e.message || 'Save failed.');
      setSaving(false);
    }
  };

  const getPageTitle = (pathname) => {
    switch (pathname) {
      case '/dashboard': return 'Consolidated Results Dashboard';
      case '/runs':      return 'Regression Test Runs';
      case '/coverage':  return 'VCS Code & Functional Coverage';
      case '/scheduler': return 'Regression Scheduler';
      case '/settings':  return 'Integrations & Notifications';
      default:           return 'RMS Platform';
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
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{getPageTitle(location.pathname)}</h2>

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

            <button className="btn btn-secondary" style={{ padding: '8px', display: 'flex' }}>
              <Bell size={18} />
            </button>
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
          <Field label="Project ID" placeholder="e.g. P2" value={form.id} onChange={e => setField('id', e.target.value)} />
          <Field label="Project Name" placeholder="e.g. AXIS DMA" value={form.name} onChange={e => setField('name', e.target.value)} />
          <Field label="Phases" hint="Comma-separated — e.g. Q0, Q1, Q2" placeholder="Q0, Q1, Q2" value={form.phases} onChange={e => setField('phases', e.target.value)} />
          <Field label="Components" hint="Comma-separated — e.g. DMA, FIFO" placeholder="DMA" value={form.components} onChange={e => setField('components', e.target.value)} />
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

// ── Small reusable pieces ──────────────────────────────────────────────────────

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

function ModalFooter({ error, saving, onCancel, onSave, saveLabel }) {
  return (
    <>
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--error-color)', marginBottom: '12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving} style={{ minWidth: '110px' }}>
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </>
  );
}

export default Layout;
