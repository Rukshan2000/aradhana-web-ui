import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // `user === undefined` means "still checking"; `null` means "signed out".
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.auth.me());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => setUser(await api.auth.login(email, password));
  const register = async (fields) => setUser(await api.auth.register(fields));
  const loginWithCode = async (email, code) => setUser(await api.auth.verifyLoginCode(email, code));
  const resetPassword = async (fields) => setUser(await api.auth.resetPassword(fields));
  const changePassword = async (fields) => setUser(await api.auth.changePassword(fields));
  const updateProfile = async (fields) => setUser(await api.auth.updateProfile(fields));
  const logout = async () => { await api.auth.logout(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, login, loginWithCode, register, resetPassword, changePassword, updateProfile, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
