'use client';
//Protected Dashboard)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

// Quick-stat cards
const stats = [
  { 
    label: 'The Data Principle', 
    value: 'The best programs are written so that computing machines can perform them quickly and so that human beings can understand them clearly.' 
  },
  { 
    label: 'The Goal of AI', 
    value: 'The goal of machine learning is not to recreate the human mind, but to build tools that expand the reach of our own intelligence.' 
  },
  { 
    label: 'Data vs. Information', 
    value: 'Information is the oil of the 21st century, and analytics is the combustion engine that turns data into value.' 
  },
  { 
    label: 'Continuous Learning', 
    value: 'In machine learning, failure is just a data point. Every error is an opportunity for the model to refine its understanding.' 
  },
];

// Resource 
const resources = [
  { 
    title: 'Neural Networks: Systems inspired by the human brain designed to recognize patterns and interpret sensory data.', 
    tag: 'Concept', 
    icon: '🧠' 
  },
  { 
    title: 'Supervised Learning: The process of training a model using a labeled dataset where the "answer" is already known.', 
    tag: 'Method', 
    icon: '📊' 
  },
  { 
    title: 'Generative AI: Models capable of creating new content from text to images by learning the underlying structure of data.', 
    tag: 'Future', 
    icon: '🔥' 
  },
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
          <span className="font-bold text-white tracking-tight">ML - HUB</span>
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
              HII! AND WELCOME TO YOUR DASHBOARD
            </h1>
            <p className="text-gray-500 text-sm">
              {' '}
              <span className="text-gray-300 font-medium">{user?.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-500 text-xs font-medium">Session Active</span>
          </div>
        </div>

        {/* ── STATS GRID ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-gray-950 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors flex flex-col justify-center"
            >
              <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">
                {s.label}
              </div>
              <div className="text-gray-300 text-sm md:text-base italic leading-relaxed">
                "{s.value}"
              </div>
            </div>
          ))}
        </div>

        {/* ── RESOURCES LIST ────────────────────────────────── */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Learnings</h2>
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