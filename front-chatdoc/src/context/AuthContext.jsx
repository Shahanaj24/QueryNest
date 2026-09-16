/**
 * Authentication state.
 *
 * Holds the current user, restores a session on reload from the stored token,
 * and clears all user-specific state on logout (requirement 3).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `initialising` prevents a flash of the login page while the stored token
  // is being validated on first load.
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!tokenStore.get()) {
        setInitialising(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        // Token was rejected; the interceptor has already cleared it.
        tokenStore.clear();
      } finally {
        if (!cancelled) setInitialising(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // The api client fires this when any request returns 401.
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('chatdoc:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('chatdoc:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (details) => {
    const result = await authApi.register(details);
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Signing out locally must succeed even if the server call fails.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, initialising, isAuthenticated: Boolean(user), login, register, logout }),
    [user, initialising, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
