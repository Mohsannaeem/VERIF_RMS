/**
 * Login — the unauthenticated gate. Two modes chosen by /api/auth/status:
 *   setup  (no users yet) → create the founding admin + company
 *   signin (users exist)  → Company ID + email + password
 *
 * Styled entirely with the app's theme variables, so it matches the product
 * and follows the light/dark toggle without a second stylesheet.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlaySquare, Eye, EyeOff, Copy, Check, ArrowRight, ShieldCheck, Loader } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const field = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px',
  background: 'var(--bg-color)', border: '1px solid var(--border-color)',
  borderRadius: '9px', color: 'var(--text-primary)', fontSize: '0.9rem',
  outline: 'none', transition: 'border-color 0.15s',
};
const label = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px',
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em',
};

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...field, paddingRight: '42px' }}
      />
      <button
        type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
        title={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                 background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                 display: 'flex', padding: '2px' }}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [mode, setMode]   = useState('loading');  // loading | setup | signin
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  // signin
  const [companyId, setCompanyId] = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [remember, setRemember]   = useState(false);

  // setup
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName]     = useState('');
  const [created, setCreated]         = useState(null);   // { company_id } after setup
  const [copied, setCopied]           = useState(false);

  useEffect(() => {
    api.authStatus()
      .then(d => setMode(d.setup_complete ? 'signin' : 'setup'))
      .catch(() => setMode('signin'));   // if the probe fails, sign-in is the safe default
  }, []);

  const handleSignin = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await api.login({ company_id: companyId, email, password, remember });
      login(data, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setError(cleanError(err.message));
      setBusy(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await api.setup({ company_name: companyName, username: adminName, email, password });
      // Keep the admin signed in, but first show them the Company ID to share.
      login(data, false);
      setCreated({ company_id: data.company_id });
    } catch (err) {
      setError(cleanError(err.message));
      setBusy(false);
    }
  };

  const copyId = async () => {
    try { await navigator.clipboard.writeText(created.company_id); setCopied(true); } catch { /* noop */ }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--bg-color)',
      backgroundImage: 'radial-gradient(1200px 600px at 50% -10%, var(--accent-glow, rgba(231,111,81,0.18)), transparent 60%)',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px', background: 'var(--bg-color-secondary)',
        border: '1px solid var(--border-color)', borderRadius: '16px',
        boxShadow: 'var(--shadow-lg, 0 24px 48px rgba(0,0,0,0.4))', padding: '32px 30px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <PlaySquare style={{ color: 'var(--accent-color)' }} size={26} />
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>RMS Platform</span>
        </div>

        {mode === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', padding: '32px 0', justifyContent: 'center' }}>
            <Loader size={16} className="spin" /> Checking setup…
          </div>
        )}

        {/* ── Post-setup: reveal Company ID ─────────────────────────────── */}
        {created && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--success-color)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Workspace created</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              This is your <strong>Company ID</strong>. Your team needs it to sign in — share it with them.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
              <input readOnly value={created.company_id} onFocus={e => e.target.select()}
                     style={{ ...field, fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '0.08em', textAlign: 'center' }} />
              <button onClick={copyId} style={btnSecondary}>
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
              </button>
            </div>
            <button onClick={() => navigate('/dashboard', { replace: true })} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
              Go to Dashboard <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Setup form ────────────────────────────────────────────────── */}
        {mode === 'setup' && !created && (
          <>
            <h2 style={heading}>Create your workspace</h2>
            <p style={sub}>You're the first here. This account becomes the admin.</p>
            <form onSubmit={handleSetup}>
              <Row label="Company Name">
                <input style={field} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Verification" autoFocus />
              </Row>
              <Row label="Your Name">
                <input style={field} value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Jordan Lee" />
              </Row>
              <Row label="Email">
                <input style={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
              </Row>
              <Row label="Password" hint="At least 8 characters.">
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" autoComplete="new-password" />
              </Row>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button type="submit" disabled={busy} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', marginTop: '6px' }}>
                {busy ? 'Creating…' : <>Create workspace <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}

        {/* ── Sign-in form ──────────────────────────────────────────────── */}
        {mode === 'signin' && (
          <>
            <h2 style={heading}>Sign in</h2>
            <p style={sub}>Enter your Company ID and account details.</p>
            <form onSubmit={handleSignin}>
              <Row label="Company ID">
                <input style={{ ...field, fontFamily: 'monospace', letterSpacing: '0.06em' }}
                       value={companyId} onChange={e => setCompanyId(e.target.value.toUpperCase())}
                       placeholder="CMP-XXXXXXXX" autoFocus />
              </Row>
              <Row label="Email">
                <input style={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
              </Row>
              <Row label="Password">
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
              </Row>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', margin: '4px 0 18px', cursor: 'pointer' }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                       style={{ marginTop: '2px', accentColor: 'var(--accent-color)' }} />
                <span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Stay signed in for 30 days</span>
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>Don't check this on shared computers.</span>
                </span>
              </label>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button type="submit" disabled={busy} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
                {busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── small presentational helpers ──────────────────────────────────────────────
const heading = { fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: '18px 0 4px' };
const sub     = { fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 22px' };
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 16px',
  background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '9px',
  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
};
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px 14px', whiteSpace: 'nowrap',
  background: 'var(--bg-color-tertiary)', color: 'var(--text-primary)',
  border: '1px solid var(--border-color)', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};

function Row({ label: text, hint, children }) {
  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={label}>{text}</label>
      {children}
      {hint && <p style={{ margin: '5px 0 0', fontSize: '0.73rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function ErrorMsg({ children }) {
  return (
    <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid var(--error-color)',
                  borderRadius: '8px', padding: '9px 12px', marginBottom: '14px',
                  fontSize: '0.82rem', color: 'var(--error-color)' }}>
      {children}
    </div>
  );
}

/** FastAPI sends `{"detail": "..."}`; surface just the message. */
function cleanError(msg) {
  try {
    const d = JSON.parse(msg).detail;
    return typeof d === 'string' ? d : (d?.[0]?.msg ?? msg);
  } catch {
    return msg || 'Something went wrong.';
  }
}

export default Login;
