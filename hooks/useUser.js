'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// 1. Create the Context
const UserContext = createContext({ 
  user: null, 
  profile: null, 
  loading: true, 
  signOut: () => {}, 
  refreshProfile: () => {} 
});

// 2. The Provider Component (Used in layout.js)
export function UserProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile logic from your original version
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

  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push('/');
  }, [router]);

  // Auth listener logic from your original version
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      fetchProfile(currentUser?.id).finally(() => setLoading(false));
    });

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

  return (
    <UserContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

// 3. The Hook (Used in Navbar, Articles, etc.)
export const useUser = () => useContext(UserContext);

// 4. Auth Guard Helper
export function useAuthGuard(user, loading) {
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);
}