'use client';
// Login & Sign-Up Page

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ── SIGN UP ──────────────────────────────────────────────
  async function handleSignUp() {
    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({
        type: 'success',
        text: '✅ Account created! Check your email to confirm, then log in.',
      });
    }
    setLoading(false);
  }

  // ── LOGIN ────────────────────────────────────────────────
  async function handleLogin() {
    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: '✅ Login successful! Redirecting…' });
      setTimeout(() => router.push('/dashboard'), 1200);
    }
    setLoading(false);
  }

  // ── RENDER ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4">

      {/* Back link */}
      <Link
        href="/"
        className="text-gray-600 hover:text-gray-400 text-sm mb-8 self-start max-w-sm w-full mx-auto transition-colors"
      >
        ← Back to Home
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-8 shadow-2xl">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-white">Machine Learning Hub</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in or create an account</p>
        </div>

        {/* Email field */}
        <div className="mb-4">
          <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-colors"
          />
        </div>

        {/* Password field */}
        <div className="mb-6">
          <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-colors"
          />
        </div>

        {/* Feedback message */}
        {message.text && (
          <div
            className={`mb-5 px-4 py-3 rounded-lg text-sm ${
              message.type === 'error'
                ? 'bg-red-950 border border-red-800 text-red-300'
                : 'bg-green-950 border border-green-800 text-green-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 bg-white text-black font-semibold py-3 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '…' : 'Log In'}
          </button>
          <button
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-gray-800 text-gray-200 font-semibold py-3 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-700"
          >
            {loading ? '…' : 'Sign Up'}
          </button>
        </div>

        {/* Divider note */}
        <p className="text-center text-gray-700 text-xs mt-6">
          New here? Click <span className="text-gray-500">Sign Up</span> to create an account.
        </p>
      </div>
    </main>
  );
}