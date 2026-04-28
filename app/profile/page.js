// [Next.js Code - app/profile/page.js]
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../hooks/useUser';

export default function ProfileRedirect() {
  const router = useRouter();
  const { profile, loading } = useUser();

  useEffect(() => {
    if (!loading && profile?.username) {
      router.replace(`/profile/${profile.username}`);
    } else if (!loading && !profile) {
      router.replace('/login');
    }
  }, [profile, loading, router]);

  return (
    <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </main>
  );
}