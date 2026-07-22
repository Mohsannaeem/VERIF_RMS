import { X } from 'lucide-react';

/**
 * Reusable modal shell.
 * Clicking the backdrop closes the modal.
 */
export function Modal({ title, onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '460px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
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

/** Standard labelled text input row used inside modals. */
export function Field({ label, hint, ...props }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <input className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} {...props} />
      {hint && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

/** Standard labelled select row used inside modals. */
export function SelectField({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} {...props}>{children}</select>
    </div>
  );
}

/** Labelled group of mutually exclusive card-style radio options. */
export function RadioGroup({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map(opt => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
                padding: '10px 12px', borderRadius: '8px',
                border: `1px solid ${selected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                background: selected ? 'rgba(88,166,255,0.06)' : 'transparent',
              }}
            >
              <input
                type="radio"
                checked={selected}
                onChange={() => onChange(opt.value)}
                style={{ marginTop: '3px', accentColor: 'var(--accent-color)' }}
              />
              <span>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{opt.title}</span>
                {opt.hint && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Save / Cancel footer row for modals. */
export function ModalFooter({ error, saving, onCancel, onSave, saveLabel, busyLabel = 'Saving…' }) {
  return (
    <>
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--error-color)', marginBottom: '12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving} style={{ minWidth: '110px' }}>
          {saving ? busyLabel : saveLabel}
        </button>
      </div>
    </>
  );
}
