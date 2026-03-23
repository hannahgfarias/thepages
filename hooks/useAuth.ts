import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types';

interface AuthContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (phone: string) => Promise<{ error?: string }>;
  verifyOTP: (code: string) => Promise<boolean>;
  setPreferences: (prefs: { categories: string[]; city: string }) => Promise<void>;
  signOut: () => Promise<void>;
  skip: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  session: null,
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({}),
  verifyOTP: async () => false,
  setPreferences: async () => {},
  signOut: async () => {},
  skip: () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const isAuthenticated = !!session;

  // Fetch profile from Supabase
  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) setProfile(data as Profile);
  }, [session]);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when session changes
  useEffect(() => {
    if (session?.user) {
      refreshProfile();
    } else {
      setProfile(null);
    }
  }, [session, refreshProfile]);

  // Send OTP to phone number
  const signIn = useCallback(async (phone: string) => {
    // Format to E.164: +1XXXXXXXXXX
    const digits = phone.replace(/\D/g, '');
    const formatted = '+1' + digits;
    setPendingPhone(formatted);

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) {
      console.warn('OTP send error:', error.message);
      return { error: error.message };
    }
    return {};
  }, []);

  // Verify OTP code
  const verifyOTP = useCallback(async (code: string) => {
    if (!pendingPhone || code.length !== 6) return false;

    const { data, error } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: code,
      type: 'sms',
    });

    if (error) {
      console.warn('OTP verify error:', error.message);
      return false;
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      setPendingPhone(null);
      return true;
    }

    return false;
  }, [pendingPhone]);

  // Save user preferences (categories + city)
  const setPreferences = useCallback(async (prefs: { categories: string[]; city: string }) => {
    if (!session?.user?.id) return;
    await supabase
      .from('profiles')
      .update({ location: prefs.city })
      .eq('id', session.user.id);
    await refreshProfile();
  }, [session, refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPendingPhone(null);
  }, []);

  const skip = useCallback(() => {
    // Allow browsing without auth — no-op, just dismiss the prompt
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      session,
      user,
      profile,
      loading,
      signIn,
      verifyOTP,
      setPreferences,
      signOut,
      skip,
      refreshProfile,
    }),
    [isAuthenticated, session, user, profile, loading, signIn, verifyOTP, setPreferences, signOut, skip, refreshProfile]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}
