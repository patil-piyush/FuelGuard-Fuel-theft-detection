import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, fetchUserProfile } from '../lib/supabase';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.auth.getSession();
      if (error) { console.error('Failed to get session', error); setLoading(false); return; }
      const sess = data.session;
      setSession(sess);
      const usr = sess?.user ?? null;
      setUser(usr);
      if (usr) {
        const profile = await fetchUserProfile(usr.id);
        console.log('Fetched profile for ADMIN user:', profile);
        setRole(profile?.role?.toUpperCase() ?? null);
      }
      setLoading(false);
    }
    init();
    const { data: listener } = supabase?.auth?.onAuthStateChange((_event, _session) => {
      setSession(_session);
      setUser(_session?.user ?? null);
      if (_session?.user) {
        fetchUserProfile(_session.user.id).then(p => {
          console.log('Fetched profile on auth change:', p);
          setRole(p?.role?.toUpperCase() ?? null);
        });
      } else {
        setRole(null);
      }
    });
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  async function login(email, password) {
    if (!supabase) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    const usr = data.user;
    setUser(usr);
    setSession(data.session);
    const profile = await fetchUserProfile(usr.id);
    setRole(profile?.role?.toUpperCase() ?? null);
    return { user: usr };
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  }

  const value = { user, session, role, loading, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
