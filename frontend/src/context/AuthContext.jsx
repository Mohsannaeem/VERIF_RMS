/**
 * AuthContext — global auth state for the RMS Platform.
 *
 * Token storage:
 *   remember = true  → localStorage   (survives browser restart, 30-day token)
 *   remember = false → sessionStorage (cleared when the tab/browser closes)
 *
 * A logout in one tab propagates to the others via the `storage` event.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rms_token';
const USER_KEY  = 'rms_user';

function readStored() {
  try {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
    const raw   = localStorage.getItem(USER_KEY)  || sessionStorage.getItem(USER_KEY);
    return { token, user: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, user: null };
  }
}

function clearStored() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  });
}

export function AuthProvider({ children }) {
  const [{ token, user }, setState] = useState(readStored);

  // Cross-tab: if the token is removed elsewhere, drop our state too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY && !e.newValue) setState({ token: null, user: null });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Persist a successful auth response. `data` is the backend's login/setup body. */
  const login = useCallback((data, remember = false) => {
    const store = remember ? localStorage : sessionStorage;
    // Write to the chosen store and clear the other, so switching remember-mode
    // never leaves a stale token behind in the store we are not using.
    (remember ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
    (remember ? sessionStorage : localStorage).removeItem(USER_KEY);
    store.setItem(TOKEN_KEY, data.access_token);
    store.setItem(USER_KEY, JSON.stringify(data.user));
    setState({ token: data.access_token, user: data.user });
  }, []);

  const logout = useCallback(() => {
    clearStored();
    setState({ token: null, user: null });
    window.location.href = '/login';
  }, []);

  const value = {
    token,
    user,
    isAdmin: user?.role === 'admin',
    isAuthenticated: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
