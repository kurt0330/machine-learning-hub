// ═══════════════════════════════════════════════════════════
// useUser — Global auth + profile hook
//
// Provides:  { user, profile, loading, signOut, refreshProfile }
//
// Usage:
//   const { user, profile, loading } = useUser();
//
// Wrap your app's layout (or each page) — it attaches a single
// Supabase auth listener and fetches the linked profile row.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export function useUser() {
  const router = useRouter();

  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch profile row from public.profiles ─────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[useUser] profile fetch error:', error.message);
      setProfile(null);
    } else {
      setProfile(data);
    }
  }, []);

  // ── Public: lets pages force a profile re-fetch ────────
  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Sign out helper ────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push('/');
  }, [router]);

  // ── Auth state listener ────────────────────────────────
  useEffect(() => {
    // 1. Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      fetchProfile(currentUser?.id).finally(() => setLoading(false));
    });

    // 2. Subscribe to sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        await fetchProfile(currentUser?.id);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return { user, profile, loading, signOut, refreshProfile };
}

// ── Guard helper ───────────────────────────────────────────
// Use this in pages that require auth.
// Example:
//   const { user, loading } = useUser();
//   useAuthGuard(user, loading);

export function useAuthGuard(user, loading) {
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);
}