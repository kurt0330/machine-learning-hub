'use client';
//Protected Dashboard)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

// Quick-stat cards
const stats = [
  { label: 'Models Trained', value: '3', icon: '🤖' },
  { label: 'Datasets Loaded', value: '7', icon: '📦' },
  { label: 'Accuracy Score', value: '94%', icon: '🎯' },
  { label: 'Hours of Training', value: '12', icon: '⏱️' },
];

// Resource links
const resources = [
  { title: 'Neural Networks 101', tag: 'Beginner', icon: '🧠' },
  { title: 'Intro to Scikit-Learn', tag: 'Intermediate', icon: '📊' },
  { title: 'Deep Learning with PyTorch', tag: 'Advanced', icon: '🔥' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── AUTH GUARD ────────────────────────────────────────────
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session → redirect to login
        router.replace('/login');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  // ── LOGOUT ────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  // ── LOADING STATE ─────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-600 text-sm animate-pulse">Verifying session…</div>
      </main>
    );
  }

  // ── DASHBOARD UI ──────────────────────────────────────────
  return (
    <main className="min-h-screen bg-black">

      {/* ── TOP NAV ─────────────────────────────────────────── */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <span className="font-bold text-white tracking-tight">ML Hub</span>
          <span className="ml-2 bg-gray-800 border border-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded-full">
            Dashboard
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-400 transition-colors"
        >
          Log Out →
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── WELCOME BANNER ────────────────────────────────── */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl px-8 py-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Welcome back 👋
            </h1>
            <p className="text-gray-500 text-sm">
              Logged in as{' '}
              <span className="text-gray-300 font-medium">{user?.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-500 text-xs font-medium">Session Active</span>
          </div>
        </div>

        {/* ── STATS GRID ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-gray-950 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-gray-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── RESOURCES LIST ────────────────────────────────── */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Learning Resources</h2>
          <div className="flex flex-col gap-3">
            {resources.map((r) => (
              <div
                key={r.title}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{r.icon}</span>
                  <span className="text-gray-200 text-sm font-medium">{r.title}</span>
                </div>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                  {r.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── INTEGRATION INFO ──────────────────────────────── */}
        <div className="mt-8 border border-dashed border-gray-800 rounded-xl p-5 text-center">
          <p className="text-gray-600 text-xs">
            This page is <span className="text-gray-400">auth-protected</span> — only accessible after a successful Supabase login.
            Your session is managed client-side via <code className="bg-gray-900 px-1 rounded">supabase.auth.getSession()</code>.
          </p>
        </div>

      </div>
    </main>
  );
}