'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState({ type: '', text: '' });

  // ── NEW: Auto-redirect if session exists ────────────────
  useEffect(() => {
    if (!userLoading && user) {
      console.log("Session detected, redirecting to dashboard...");
      router.replace('/dashboard');
    }
  }, [user, userLoading, router]);

  async function handleLogin() {
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    } else {
      setMessage({ type: 'success', text: 'Login successful! Redirecting…' });
      // No need to manual redirect here, the useEffect above will catch it
    }
  }

  // ── IMPORTANT: Prevent showing the form if we are already logged in ──
  if (userLoading || user) {
    return (
      <main style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'var(--color-bg-base)' 
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight:      '100vh',
        background:     'var(--color-bg-base)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        'var(--space-6)',
      }}
    >
      {/* Back link */}
      <Link
        href="/"
        style={{
          color:          'var(--color-text-muted)',
          fontSize:       'var(--text-sm)',
          textDecoration: 'none',
          marginBottom:   'var(--space-6)',
          alignSelf:      'flex-start',
          maxWidth:       'var(--max-width-sm)',
          width:          '100%',
          margin:         '0 auto var(--space-6)',
          display:        'block',
          transition:     'color var(--transition-fast)',
        }}
        onMouseEnter={e => e.target.style.color = 'var(--color-text-secondary)'}
        onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}
      >
        ← Back to Home
      </Link>

      {/* Card */}
      <div
        className="card"
        style={{
          width:    '100%',
          maxWidth: 'var(--max-width-sm)',
          padding:  'var(--space-8)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            'var(--space-2)',
              marginBottom:   'var(--space-4)',
            }}
          >
            <span
              style={{
                fontWeight:     'var(--weight-bold)',
                fontSize:       'var(--text-base)',
                letterSpacing:  'var(--tracking-tight)',
                color:          'var(--color-text-primary)',
              }}
            >
              ML — HUB
            </span>
          </div>
          <h1
            style={{
              fontSize:   'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
              color:      'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Welcome back
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Sign in to your account to continue
          </p>
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className={`form-input ${message.type === 'error' ? 'form-input--error' : ''}`}
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className={`form-input ${message.type === 'error' ? 'form-input--error' : ''}`}
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {/* Feedback */}
        {message.text && (
          <div
            className={`feedback ${
              message.type === 'error' ? 'feedback--error' : 'feedback--success'
            }`}
            style={{ marginBottom: 'var(--space-5)' }}
          >
            {message.text}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn btn--primary btn--full btn--lg"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</>
            : 'Log In'
          }
        </button>

        {/* Divider */}
        <div className="divider--text" style={{ margin: 'var(--space-6) 0' }}>
          or
        </div>

        {/* Sign up link */}
        <p
          style={{
            textAlign:  'center',
            fontSize:   'var(--text-sm)',
            color:      'var(--color-text-muted)',
          }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            style={{
              color:          'var(--color-text-primary)',
              fontWeight:     'var(--weight-medium)',
              textDecoration: 'none',
            }}
          >
            Create one →
          </Link>
        </p>
      </div>
    </main>
  );
}