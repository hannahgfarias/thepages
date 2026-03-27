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
  updateProfile: (data: Partial<Pick<Profile, 'display_name' | 'handle' | 'bio' | 'bio_links' | 'location' | 'avatar_url' | 'avatar_initials' | 'avatar_color' | 'is_public'>>) => Promise<{ error?: string }>;
  setPreferences: (prefs: { categories: string[]; is_over_18?: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  skip: () => void;
  refreshProfile: () => Promise<void>;
  checkHandleAvailable: (handle: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  session: null,
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({}),
  verifyOTP: async () => false,
  updateProfile: async () => ({}),
  setPreferences: async () => {},
  signOut: async () => {},
  skip: () => {},
  refreshProfile: async () => {},
  checkHandleAvailable: async () => true,
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (error) {
        console.warn('Profile fetch error:', error.message);
        return;
      }
      if (data) setProfile(data as Profile);
    } catch (e) {
      console.warn('Profile fetch failed:', e);
    }
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

  // Check if a handle is available
  const checkHandleAvailable = useCallback(async (handle: string) => {
    if (!handle || handle.length < 2) return false;
    const formatted = handle.startsWith('@') ? handle : `@${handle}`;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', formatted)
      .maybeSingle();
    // Available if no match, or if it's the current user's handle
    return !data || data.id === session?.user?.id;
  }, [session]);

  // Update profile fields (display name, handle, bio, location, avatar)
  const updateProfile = useCallback(async (data: Partial<Pick<Profile, 'display_name' | 'handle' | 'bio' | 'bio_links' | 'location' | 'avatar_url' | 'avatar_initials' | 'avatar_color' | 'is_public'>>) => {
    if (!session?.user?.id) return { error: 'Not authenticated' };

    // Ensure handle has @ prefix
    const updateData = { ...data };
    if (updateData.handle && !updateData.handle.startsWith('@')) {
      updateData.handle = `@${updateData.handle}`;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', session.user.id);

    if (error) {
      console.warn('Profile update error:', error.message);
      return { error: error.message };
    }

    await refreshProfile();
    return {};
  }, [session, refreshProfile]);

  // Save user preferences (categories only — city is saved via updateProfile)
  const setPreferences = useCallback(async (prefs: { categories: string[]; is_over_18?: boolean }) => {
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        preferences: {
          event_types: prefs.categories,
          is_over_18: prefs.is_over_18 ?? false,
          notifications: true,
          distance_miles: 25,
        },
      })
      .eq('id', session.user.id);

    if (error) {
      console.warn('Preferences save error:', error.message);
    }
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
      updateProfile,
      setPreferences,
      signOut,
      skip,
      refreshProfile,
      checkHandleAvailable,
    }),
    [isAuthenticated, session, user, profile, loading, signIn, verifyOTP, updateProfile, setPreferences, signOut, skip, refreshProfile, checkHandleAvailable]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}
